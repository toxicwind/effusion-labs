/**
 * WebSocket Sync Layer — Real-time bidirectional sync for agent state
 * Broadcasts lens results, swarm telemetry, and build events to connected clients.
 * Enables live collaborative perception across distributed agents.
 */

const { WebSocketServer } = require('ws');

class SyncLayer {
  constructor(opts = {}) {
    this.port = opts.port || parseInt(process.env.SYNC_PORT || '17358', 10);
    this.wss = null;
    this.clients = new Map();
    this.channels = new Map();
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });
    this.wss.on('connection', (ws, req) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.clients.set(clientId, { ws, channels: new Set(), connectedAt: new Date().toISOString() });
      ws.on('message', (data) => this._handleMessage(clientId, data));
      ws.on('close', () => this.clients.delete(clientId));
      ws.send(JSON.stringify({ type: 'hello', clientId, channels: Array.from(this.channels.keys()) }));
    });
    console.log(`[sync] WebSocket server on port ${this.port}`);
  }

  _handleMessage(clientId, data) {
    try {
      const msg = JSON.parse(data);
      const client = this.clients.get(clientId);
      if (!client) return;
      if (msg.type === 'subscribe') {
        for (const ch of msg.channels || []) {
          client.channels.add(ch);
          if (!this.channels.has(ch)) this.channels.set(ch, new Set());
          this.channels.get(ch).add(clientId);
        }
      }
      if (msg.type === 'unsubscribe') {
        for (const ch of msg.channels || []) {
          client.channels.delete(ch);
          this.channels.get(ch)?.delete(clientId);
        }
      }
      if (msg.type === 'broadcast') {
        this.broadcast(msg.channel, msg.payload, clientId);
      }
    } catch (e) {
      // Invalid message
    }
  }

  broadcast(channel, payload, excludeClientId = null) {
    const msg = JSON.stringify({ type: 'event', channel, payload, timestamp: new Date().toISOString() });
    for (const [clientId, client] of this.clients) {
      if (clientId === excludeClientId) continue;
      if (client.channels.has(channel) || channel === '*') {
        if (client.ws.readyState === 1) client.ws.send(msg);
      }
    }
  }

  broadcastLensResult(lensName, result, meta = {}) {
    this.broadcast('lens', { lens: lensName, result, meta });
  }

  broadcastSwarmTelemetry(telemetry) {
    this.broadcast('swarm', { telemetry });
  }

  broadcastBuildEvent(event, data) {
    this.broadcast('build', { event, data });
  }

  getStats() {
    return {
      clients: this.clients.size,
      channels: Object.fromEntries(Array.from(this.channels.entries()).map(([k, v]) => [k, v.size]))
    };
  }
}

module.exports = { SyncLayer };