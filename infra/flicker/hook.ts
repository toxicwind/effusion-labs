// effusion deploy webhook receiver.
// GitHub push -> this hook -> flicker jobs (build, then rollout).
// Verifies the GitHub HMAC-SHA256 signature; the secret lives yote-side at
// /home/toxic/.secrets/effusion-hook and never enters the repo.
// Responds 200 immediately (GitHub's delivery timeout is ~10s); the pipeline
// runs in the background and narrates to the fleet channel on completion.

const FLICKER = "http://127.0.0.1:25148";
const REPO = "/home/toxic/projects/effusion-labs";
const PORT = 25242;

const SECRETS = await Bun.file("/home/toxic/.secrets").text();
const SECRET = (SECRETS.split("\n").find((l) => l.startsWith("EFFUSION_HOOK_SECRET=")) ?? "")
  .slice("EFFUSION_HOOK_SECRET=".length).trim();
if (!SECRET) throw new Error("EFFUSION_HOOK_SECRET missing from /home/toxic/.secrets");

async function flickerJob(name: string, command: string): Promise<any> {
  const r = await fetch(`${FLICKER}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, command }),
  });
  if (!r.ok) throw new Error(`flicker submit failed: ${r.status}`);
  return r.json();
}

async function jobStatus(id: number): Promise<any> {
  const r = await fetch(`${FLICKER}/api/jobs/${id}`);
  return r.json();
}

async function waitFor(job: any, ceilingMs: number): Promise<boolean> {
  if (job.cached === true) return true;
  const id = job.id;
  const start = Date.now();
  while (Date.now() - start < ceilingMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await jobStatus(id);
    if (st.status === "success") return true;
    if (st.status === "failed" || st.status === "error") return false;
  }
  return false;
}

async function fleetSay(text: string) {
  try {
    // yote-side fleet post: write the journal record the mirror flusher picks up
    const uuid = [...crypto.getRandomValues(new Uint8Array(4))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const rec = JSON.stringify({
      sender: "burrow", channel: "fleet", message: text,
      ts: Date.now(), uuid,
    });
    await Bun.write(`/home/toxic/hatch/fleet-outbox/pending/${uuid}.json`, rec);
  } catch { /* narration must never break the deploy */ }
}

async function runPipeline(sha: string) {
  const short = sha.slice(0, 7);
  try {
    const build = await flickerJob(
      `effusion-build-${short}`,
      `${REPO}/infra/flicker/build.sh ${sha}`
    );
    if (!(await waitFor(build, 20 * 60 * 1000))) {
      await fleetSay(`effusion deploy ${short}: BUILD FAILED (flicker job ${build.id}) — rollout skipped`);
      return;
    }
    const rollout = await flickerJob(
      `effusion-rollout-${short}`,
      `${REPO}/infra/flicker/rollout.sh ${sha}`
    );
    if (!(await waitFor(rollout, 10 * 60 * 1000))) {
      await fleetSay(`effusion deploy ${short}: ROLLOUT FAILED (flicker job ${rollout.id}) — rolled back to previous image`);
      return;
    }
    await fleetSay(`effusion deploy ${short}: LIVE — build + rollout green`);
  } catch (e) {
    await fleetSay(`effusion deploy ${short}: pipeline error: ${e}`);
  }
}

async function validSignature(req: Request, body: Uint8Array): Promise<boolean> {
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sig === `sha256=${hex}`;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/effusion-hook") return new Response("not found", { status: 404 });
    if (req.method === "GET") return Response.json({ ok: true, service: "effusion-hook" });
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

    const body = new Uint8Array(await req.arrayBuffer());
    if (!(await validSignature(req, body))) return new Response("bad signature", { status: 403 });

    const event = req.headers.get("x-github-event");
    if (event === "ping") return Response.json({ ok: true });
    if (event !== "push") return new Response("ignored", { status: 200 });

    const payload = JSON.parse(new TextDecoder().decode(body));
    if (payload.ref !== "refs/heads/main") return new Response("not main", { status: 200 });
    const sha: string = payload.after;
    if (!sha || sha === "0000000000000000000000000000000000000000")
      return new Response("no commits", { status: 200 });

    // async: GitHub times out deliveries at ~10s; the pipeline takes minutes
    void runPipeline(sha);
    return Response.json({ ok: true, accepted: sha });
  },
});

console.log(`effusion-hook listening on 127.0.0.1:${PORT}`);
