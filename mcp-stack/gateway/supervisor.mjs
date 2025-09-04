import { spawn } from "node:child_process";
import { log } from "./logger.mjs";

export class Supervisor {
  constructor() {
    this.procs = new Map(); // name -> state
    this.clients = new Map(); // name -> Set<sse>
  }

  ensureClients(name) {
    if (!this.clients.has(name)) this.clients.set(name, new Set());
    return this.clients.get(name);
  }

  addClient(name, sse) {
    const set = this.ensureClients(name);
    set.add(sse);
    return () => set.delete(sse);
  }

  broadcast(name, event, data) {
    const set = this.ensureClients(name);
    for (const sse of set) sse.send(event, data);
  }

  state(name) {
    return this.procs.get(name) || { status: "idle", restarts: 0 };
  }

  async spawn(name, spec) {
    const existing = this.procs.get(name);
    if (existing?.status === "running") return existing;

    const state = { status: "starting", restarts: (existing?.restarts || 0), spec };
    this.procs.set(name, state);
    log("info", "supervisor", "spawn", { server: name, cmd: spec.cmd, args: spec.args });

    const child = spawn(spec.cmd, spec.args, { cwd: spec.cwd, env: { ...process.env, ...spec.env } });
    state.child = child;
    state.status = "running";
    state.startedAt = Date.now();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let bufOut = "";
    child.stdout.on("data", (chunk) => {
      bufOut += chunk;
      let idx;
      while ((idx = bufOut.indexOf("\n")) >= 0) {
        const line = bufOut.slice(0, idx);
        bufOut = bufOut.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          this.broadcast(name, "message", obj);
          log("debug", "server", "stdout", { server: name, obj });
        } catch (e) {
          this.broadcast(name, "raw", line);
          log("warn", "server", "non_json_line", { server: name, line });
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      log("warn", "server", "stderr", { server: name, chunk: String(chunk).trim().slice(0, 200) });
    });

    child.on("exit", (code, sig) => {
      const prev = this.procs.get(name);
      const restarts = (prev?.restarts || 0) + 1;
      const backoff = Math.min(30_000, 500 * 2 ** restarts);
      this.procs.set(name, { status: "degraded", exit: { code, sig }, restarts, backoff, spec });
      this.broadcast(name, "state", { status: "degraded", exit: { code, sig }, restarts });
      log("error", "supervisor", "exit", { server: name, code, sig, restarts });
      // Auto-restart if clients remain
      const hasClients = this.ensureClients(name).size > 0;
      if (hasClients) setTimeout(() => this.spawn(name, spec).catch(()=>{}), backoff);
    });

    return state;
  }

  send(name, payload) {
    const s = this.procs.get(name);
    if (!s?.child || s.status !== "running") throw new Error("server_not_running");
    s.child.stdin.write(JSON.stringify(payload) + "\n");
  }
}

