import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

// Helper to start the server and efficiently wait for it to be ready.
async function startServer() {
  const child = spawn(process.execPath, ["mcp-stack/gateway/server.mjs"], {
    env: { ...process.env, PROFILE: "dev", LOG_LEVEL: "info", PORT_HTTP: "0" },
    stdio: ['ignore', 'pipe', 'pipe'] // Use stdio pipe for cleaner stream handling
  });

  // This promise rejects if the server doesn't start within 10 seconds.
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Server start timed out after 5s")), 10000)
  );

  // This promise resolves as soon as the server logs its listening port.
  const started = new Promise((resolve) => {
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    
    // Process stdout line-by-line instead of polling a growing buffer.
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line for next chunk

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log?.comp === 'startup' && log?.msg === 'listening' && log.port) {
            resolve({ child, port: log.port });
            return; // Found it, we're done.
          }
        } catch {}
      }
    });
  });

  // Wait for whichever promise finishes first.
  return Promise.race([started, timeout]);
}

async function main() {
  const { child, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  console.log(`✅ Gateway started on port ${port}`);

  try {
    // ## Test 1: SSE Framing and Heartbeat
    // This now consumes the stream properly instead of using a fixed wait.
    console.log("  - Running Test 1: SSE Framing...");
    const sseRes = await fetch(`${base}/servers/filesystem/sse`, { headers: { Accept: 'text/event-stream' } });
    if (!sseRes.ok) throw new Error('SSE connection failed');
    
    let receivedText = '';
    let hasRetry = false;
    let hasHeartbeat = false;

    // Use `for await...of` to read the stream cleanly without deadlocks.
    for await (const chunk of sseRes.body) {
      receivedText += new TextDecoder().decode(chunk);
      hasRetry = /^retry:\s*\d+/m.test(receivedText);
      hasHeartbeat = receivedText.includes('heartbeat');
      if (hasRetry && hasHeartbeat) break; // Exit as soon as we have what we need.
    }
    if (!hasRetry) throw new Error('Missing SSE retry directive');
    if (!hasHeartbeat) throw new Error('Missing SSE heartbeat event');
    console.log("    -> Pass");


    // ## Test 2: Child Process Exit Handling
    // This is the critical fix to prevent the test from hanging.
    console.log("  - Running Test 2: Child Exit Handling...");
    const childExitRes = await fetch(`${base}/servers/filesystem/sse`);
    let childPid = null;
    for await (const chunk of childExitRes.body) {
      const line = new TextDecoder().decode(chunk);
      const match = line.match(/"pid":(\d+)/);
      if (match) {
        childPid = Number(match[1]);
        break; // Found the PID, stop reading the stream.
      }
    }
    await childExitRes.body.cancel(); // Crucially, close the connection.

    if (!childPid) throw new Error("Could not find child PID in SSE stream");
    
    try { process.kill(childPid, 'SIGKILL'); } catch (e) { /* Ignore error if already exited */ }
    
    await sleep(250); // Give gateway a moment to update health status.
    
    const manifestRes = await fetch(`${base}/.well-known/mcp-servers.json`);
    const manifest = await manifestRes.json();
    const fs = manifest.servers.find(s => s.name === 'filesystem');
    if (fs?.health !== 'degraded') throw new Error(`Health status was '${fs?.health}', expected 'degraded'`);
    console.log("    -> Pass");


    // ## Test 3: Admin helper endpoints
    console.log("  - Running Test 3: Admin endpoints...");
    const q = await (await fetch(`${base}/admin/queue`)).json();
    if (typeof q.currentLength !== 'number' || typeof q.maxConcurrency !== 'number') throw new Error('admin_queue_shape');
    const rate = await (await fetch(`${base}/admin/rate`)).json();
    if (typeof rate.limitPerSec !== 'number') throw new Error('admin_rate_shape');
    const retry = await (await fetch(`${base}/admin/retry`)).json();
    if (retry.policy !== 'exponential') throw new Error('admin_retry_shape');
    const sc = await (await fetch(`${base}/admin/sidecars`)).json();
    if (!Array.isArray(sc) || !sc[0]?.lastChecked) throw new Error('admin_sidecars_shape');
    console.log("    -> Pass");

    // ## Test 4: Optional Internet Tests
    if (process.env.INTERNET_TESTS === '1') {
        console.log("  - Running Test 4: Internet Connectivity...");
        const readWebRes = await fetch(`${base}/servers/readweb/info`, { method:'POST', body: JSON.stringify({ url:'https://example.org' }) });
        const readWebJson = await readWebRes.json();
        if(!readWebJson?.ok || !readWebJson?.md) throw new Error('readweb_example_failed');
        console.log("    -> Pass");
    }

  } finally {
    // Cleanup: Ensure the main server process is terminated.
    child.kill('SIGTERM');
    await once(child, 'exit');
    console.log("✅ Gateway shut down cleanly.");
  }
  
  console.log('\nINTEGRATION: All tests passed!');
}

main().catch((e) => {
  console.error('\nINTEGRATION: Test failed!', e);
  process.exit(1);
});
