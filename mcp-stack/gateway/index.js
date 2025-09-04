import express from 'express';
import fs from 'node:fs';
import { resolvePort } from './binder.js';
import { ServerProcess } from './supervisor.js';
import { Discovery } from './discovery.js';
import { resolveSearxng } from '../sidecars/searxng.js';
import { resolveFlaresolverr } from '../sidecars/flaresolverr.js';

async function loadRegistry() {
  const file = new URL('../servers/registry.json', import.meta.url);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

async function main() {
  const profile = process.env.PROFILE || 'dev';
  const ssePort = await resolvePort('SSE');
  const httpPort = await resolvePort('HTTP');

  const registry = await loadRegistry();
  const servers = new Map();
  for (const entry of registry) {
    const proc = new ServerProcess(entry);
    servers.set(entry.name, proc);
  }
  const discovery = new Discovery('');

  const sseApp = express();
  sseApp.get('/servers/:name/sse', async (req, res) => {
    const name = req.params.name;
    const proc = servers.get(name);
    if (!proc) return res.status(404).end();
    await proc.ensure();
    discovery.setHealth(name, 'ready');
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();
    res.write(`data: connected\n\n`);
    const onStdout = (d) => res.write(`data: ${d}\n\n`);
    const onStderr = (d) => res.write(`event: error\ndata: ${d}\n\n`);
    proc.on('stdout', onStdout);
    proc.on('stderr', onStderr);
    req.on('close', () => {
      proc.off('stdout', onStdout);
      proc.off('stderr', onStderr);
    });
  });

  const httpApp = express();
  httpApp.get('/servers', (req, res) => {
    res.json(Array.from(servers.keys()));
  });
  httpApp.get('/servers/:name/info', (req, res) => {
    const s = discovery.servers.get(req.params.name);
    if (!s) return res.status(404).end();
    res.json(s);
  });
  httpApp.get('/.well-known/mcp-servers.json', (req, res) => {
    res.json({ servers: discovery.manifest() });
  });
  httpApp.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });
  httpApp.get('/readyz', (req, res) => {
    res.json({ ready: true });
  });

  const sseServer = sseApp.listen(ssePort, async () => {
    const actual = sseServer.address().port;
    discovery.baseUrl = `http://localhost:${actual}`;
    for (const [name, proc] of servers.entries()) {
      discovery.register(name, proc.entry);
    }
    const searxng = await resolveSearxng();
    if (!searxng.enabled) {
      discovery.setHealth('searxng', 'disabled', searxng.reason);
    } else {
      discovery.setHealth('searxng', 'ready');
    }
    const flare = await resolveFlaresolverr();
    if (flare.available) {
      const curl = discovery.servers.get('curl');
      if (curl) curl.capabilities.flareSolverr = true;
    }
    console.log(`SSE listening on ${actual}`);
  });

  const httpServer = httpApp.listen(httpPort, () => {
    const actual = httpServer.address().port;
    console.log(`HTTP listening on ${actual}`);
  });

  console.log(`PROFILE=${profile}`);
}

main();
