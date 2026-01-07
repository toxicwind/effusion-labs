# Effusion Labs Services Architecture

## API-Centric Design

**Frontend → API → Backend Services**

All data flows through the unified API orchestrator. Frontend is **UX only**, consuming orchestrator endpoints.

```
┌──────────────┐
│   Frontend   │  (Eleventy/Vite, UX only)
└──────┬───────┘
       │ HTTP/WS
       ▼
┌──────────────────────┐
│  API Orchestrator    │  (FastAPI, BFF pattern)
│                      │
│  - Health Monitor    │
│  - WebSocket Hub     │
│  - Service Proxy     │
└──────┬───────────────┘
       │
       ├──▶ MCP Gateway       (Node.js, SSE streaming)
       ├──▶ Markdown Gateway  (Python Flask)
       ├──▶ Popmart Recon     (Python async)
       └──▶ DayZ API Client   (Nitrado integration)
```

## Services

### 1. API Orchestrator (`orchestrator.py`)

**Port**: 8000  
**Tech**: FastAPI + WebSockets + SSE

**Responsibilities**:

- Unified API gateway (BFF pattern)
- Service health aggregation
- Real-time event distribution
- Background task coordination

**Endpoints**:

- `GET /health` - Orchestrator health
- `GET /services/health` - All services health
- `POST /mcp/send` - MCP proxy
- `GET /mcp/servers` - MCP server list
- `POST /markdown/convert` - URL → Markdown
- `POST /popmart/recon` - Trigger recon scan
- `WS /ws/{channel}` - WebSocket channels
- `GET /events/stream` - SSE stream

### 2. MCP Gateway (`mcp-stack/gateway/server.mjs`)

**Port**: 3000  
**Tech**: Node.js + MCP Protocol

**Responsibilities**:

- MCP server management
- SSE streaming to clients
- Sidecar orchestration (FlareSolverr, SearXNG)

### 3. Markdown Gateway (`markdown-gateway/app.py`)

**Port**: 8001  
**Tech**: Python Flask + Readability

**Responsibilities**:

- URL content extraction
- HTML → Markdown conversion
- Content cleaning

### 4. Popmart Recon (`oneoff_popmart.py`)

**Tech**: Python async (httpx + selectolax)

**Responsibilities**:

- Product ID discovery
- PDP sweeping
- Collection enumeration
- CDN probing

### 5. DayZ API Client (`dayz_api_client.py`)

**Tech**: Python async (httpx)

**Responsibilities**:

- Nitrado API integration
- Server management
- Player tracking
- RCon commands
- Config management

## Frontend Integration

### API Client (`api-client.ts`)

TypeScript client wrapping orchestrator API.

```typescript
import { api } from './api-client'

// Health check
const health = await api.health()

// MCP request
const result = await api.mcpSend({
  server: 'filesystem',
  payload: { method: 'list', params: { path: '/' } }
})

// WebSocket
const cleanup = api.connectWebSocket('popmart', (message) => {
  console.log('Event:', message)
})

// Trigger recon
await api.triggerPopmartRecon({
  id_start: 3450,
  id_end: 3650,
  scan_collections: true
})
```

### Popmart Realtime (`popmart-realtime.ts`)

Dashboard WebSocket integration for live recon updates.

**Features**:

- Progress tracking
- Toast notifications
- Auto-reload on completion

## Docker Compose

```bash
# Development (hot-reload)
docker compose -f docker-compose.dev.yml watch

# Production
docker compose -f docker-compose.yml up -d
```

## Environment Variables

```env
# API Orchestrator
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
MCP_GATEWAY_URL=http://localhost:3000
MARKDOWN_GATEWAY_URL=http://localhost:8001

# DayZ
NITRADO_API_TOKEN=your_token_here

# MCP Sidecars
SEARXNG_ENGINE_URL=http://searxng:8080
FLARESOLVERR_URL=http://flaresolverr:8191
```

## Development Workflow

1. **Start orchestrator**:

   ```bash
   cd services
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements-orchestrator.txt
   python orchestrator.py
   ```

2. **Start MCP gateway**:

   ```bash
   cd services/mcp-stack
   npm install
   npm run dev
   ```

3. **Start frontend (hot-reload)**:

   ```bash
   npm run dev
   # OR with Docker
   docker compose -f docker-compose.dev.yml watch
   ```

4. **Monitor health**:

   ```bash
   curl http://localhost:8000/services/health | jq
   ```

## API Documentation

OpenAPI spec: `services/openapi.yaml`

Interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Pattern Donors

Inspired by production patterns from:

- **FastAPI**: Official async patterns, dependency injection
- **Kong/Traefik**: API gateway architecture
- **DayZ Dev Tools**: PBO/config management patterns
- **Nitrado API**: Server management patterns
- **Service Mesh**: Health monitoring, sidecar orchestration

## Future Enhancements

- [ ] Redis pub/sub for multi-instance orchestrator
- [ ] GraphQL BFF layer
- [ ] gRPC for internal service communication
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Rate limiting per client
- [ ] API key authentication
- [ ] WebSocket reconnection handling
- [ ] Event replay/history
- [ ] Metrics dashboard (Prometheus/Grafana)
