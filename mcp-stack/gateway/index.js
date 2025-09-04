import express from 'express';
import { createServer } from 'http';
import { claimPort } from './binder.js';
import { log } from './logger.js';
import fs from 'fs';
import { resolveSearxng } from '../sidecars/searxng.js';
import { resolveFlareSolverr } from '../sidecars/flaresolverr.js';
import { spawn } from 'child_process';

const registry = JSON.parse(fs.readFileSync('mcp-stack/servers/registry.json', 'utf-8'));
const state = new Map();
for (const srv of registry) {
  state.set(srv.name, { ...srv, health: 'disabled', process: null, connections: [] });
}

async function main() {
  const app = express();
  app.get('/healthz', (req, res) => {
    const servers = {};
    for (const [name, srv] of state) servers[name] = srv.health;
    res.json({ status: 'ok', servers });
  });
  app.get('/readyz', (req, res) => {
    res.json({ ready: true });
  });
  app.get('/servers', (req, res) => {
    const list = Array.from(state.values()).map(s => ({ name: s.name, health: s.health }));
    res.json(list);
  });
  app.get('/servers/:name/info', (req, res) => {
    const srv = state.get(req.params.name);
    if (!srv) return res.status(404).end();
    res.json({ name: srv.name, health: srv.health, capabilities: srv.capabilities || {} });
  });
  app.get('/servers/:name/sse', (req, res) => {
    const srv = state.get(req.params.name);
    if (!srv) return res.status(404).end();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    srv.connections.push(res);
    if (!srv.process) spawnServer(srv);
    res.write('event: message\n');
    res.write('data: connected\n\n');
    req.on('close', () => {
      srv.connections = srv.connections.filter(r => r !== res);
    });
  });
  app.get('/.well-known/mcp-servers.json', (req, res) => {
    const urlBase = `${req.protocol}://${req.get('host')}`;
    const servers = Array.from(state.values()).map(s => ({
      name: s.name,
      transport: 'sse',
      url: `${urlBase}/servers/${s.name}/sse`,
      health: s.health,
      version: '0.1.0',
      capabilities: s.capabilities || {}
    }));
    res.json(servers);
  });

  const httpPort = await claimPort('PORT_HTTP', 'PORT_RANGE_HTTP');
  const server = createServer(app);
  server.listen(httpPort, () => {
    const addr = server.address();
    const port = typeof addr === 'object' ? addr.port : httpPort;
    log('info', 'gateway', 'listening', { port });
    for (const srv of state.values()) srv.health = 'ready';
    resolveSidecars();
  });
}

async function resolveSidecars() {
  const searx = await resolveSearxng();
  const sx = state.get('searxng');
  if (sx) sx.health = searx.enabled ? 'ready' : 'disabled';
  const flare = await resolveFlareSolverr();
  const curl = state.get('curl');
  if (curl) {
    if (flare.enabled) {
      curl.capabilities.flareSolverr = true;
      curl.health = 'ready';
    } else {
      curl.capabilities.flareSolverr = false;
      curl.health = 'ready';
    }
  }
}

function spawnServer(srv) {
  const child = spawn(srv.command, srv.args, { stdio: ['pipe', 'pipe', 'pipe'] });
  srv.process = child;
  child.stdout.on('data', d => {
    for (const res of srv.connections) {
      res.write(`data: ${d.toString().trim()}\n\n`);
    }
    log('info', srv.name, d.toString().trim());
  });
  child.stderr.on('data', d => log('error', srv.name, d.toString().trim()));
  child.on('exit', code => {
    srv.health = 'degraded';
    log('error', srv.name, 'exit', { code });
  });
}

main();
