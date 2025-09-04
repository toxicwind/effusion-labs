# MCP Stack

Minimal gateway stacking stdio MCP servers behind Server-Sent Events.

## Quickstart

```bash
cd mcp-stack
npm install
PROFILE=dev PORT_SSE=0 PORT_HTTP=0 npm start
```

Then open `/.well-known/mcp-servers.json` on the reported HTTP port.
