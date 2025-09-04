export class Discovery {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.servers = new Map();
  }
  register(name, entry) {
    this.servers.set(name, {
      name,
      transport: 'sse',
      url: `${this.baseUrl}/servers/${name}/sse`,
      health: 'disabled',
      version: entry.version || '0.1.0',
      capabilities: entry.capabilities || {},
      info: entry.info || {}
    });
  }
  setHealth(name, health, reason) {
    const s = this.servers.get(name);
    if (s) {
      s.health = health;
      if (reason) s.info.reason = reason;
    }
  }
  manifest() {
    return Array.from(this.servers.values());
  }
}
