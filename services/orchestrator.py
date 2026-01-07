"""
Effusion Labs API Orchestrator
Unified API Gateway for microservices coordination

Architecture:
- BFF (Backend for Frontend) pattern
- Event-driven microservices orchestration
- WebSocket real-time updates
- DayZ server management integration
- MCP gateway integration
- Popmart recon integration
"""

from fastapi import FastAPI, WebSocket, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import asyncio
import json
import httpx
from datetime import datetime
from enum import Enum
import os

app = FastAPI(
    title="Effusion Labs API Orchestrator",
    version="1.0.0",
    description="Unified API gateway coordinating all backend services"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service configuration
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:3000")
MARKDOWN_GATEWAY_URL = os.getenv("MARKDOWN_GATEWAY_URL", "http://localhost:8000")

class ServiceStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"

class ServiceHealth(BaseModel):
    name: str
    status: ServiceStatus
    latency_ms: Optional[float] = None
    last_check: datetime

class MCPRequest(BaseModel):
    server: str
    payload: Dict[str, Any]

class PopmartReconRequest(BaseModel):
    id_start: int = Field(default=3450, ge=1)
    id_end: int = Field(default=3650, le=10000)
    scan_collections: bool = False
    scan_brandip: bool = False
    scan_popnow: bool = False
    probe_cdn: bool = False

class WebsocketMessage(BaseModel):
    type: str
    channel: str
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# In-memory event bus (replace with Redis/RabbitMQ for production)
event_subscribers: Dict[str, List[WebSocket]] = {}
service_health_cache: Dict[str, ServiceHealth] = {}

async def get_http_client():
    """Dependency for HTTP client"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client

@app.get("/")
async def root():
    """API root with discovery links"""
    return {
        "name": "Effusion Labs API Orchestrator",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "services": "/services/health",
            "mcp": "/mcp",
            "markdown": "/markdown/convert",
            "popmart": "/popmart/recon",
            "websocket": "ws://localhost:8000/ws/{channel}",
            "docs": "/docs",
            "openapi": "/openapi.json"
        }
    }

@app.get("/health")
async def health_check():
    """Orchestrator health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services_monitored": len(service_health_cache)
    }

@app.get("/services/health", response_model=List[ServiceHealth])
async def services_health():
    """Aggregate health status of all backend services"""
    health_checks = []
    
    # Check MCP Gateway
    start = datetime.utcnow()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MCP_GATEWAY_URL}/healthz", timeout=5.0)
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            status = ServiceStatus.HEALTHY if response.status_code == 200 else ServiceStatus.DEGRADED
            health_checks.append(ServiceHealth(
                name="mcp-gateway",
                status=status,
                latency_ms=latency,
                last_check=datetime.utcnow()
            ))
    except Exception:
        health_checks.append(ServiceHealth(
            name="mcp-gateway",
            status=ServiceStatus.DOWN,
            last_check=datetime.utcnow()
        ))
    
    # Check Markdown Gateway
    start = datetime.utcnow()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MARKDOWN_GATEWAY_URL}/health", timeout=5.0)
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            status = ServiceStatus.HEALTHY if response.status_code == 200 else ServiceStatus.DEGRADED
            health_checks.append(ServiceHealth(
                name="markdown-gateway",
                status=status,
                latency_ms=latency,
                last_check=datetime.utcnow()
            ))
    except Exception:
        health_checks.append(ServiceHealth(
            name="markdown-gateway",
            status=ServiceStatus.DOWN,
            last_check=datetime.utcnow()
        ))
    
    # Update cache
    for health in health_checks:
        service_health_cache[health.name] = health
    
    return health_checks

@app.post("/mcp/send")
async def mcp_send(request: MCPRequest, client: httpx.AsyncClient = Depends(get_http_client)):
    """Forward MCP request to gateway and return response"""
    try:
        response = await client.post(
            f"{MCP_GATEWAY_URL}/servers/{request.server}/send",
            json=request.payload
        )
        return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"MCP Gateway error: {str(e)}")

@app.get("/mcp/servers")
async def mcp_servers(client: httpx.AsyncClient = Depends(get_http_client)):
    """List available MCP servers"""
    try:
        response = await client.get(f"{MCP_GATEWAY_URL}/servers")
        return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"MCP Gateway error: {str(e)}")

@app.post("/markdown/convert")
async def convert_markdown(url: str, client: httpx.AsyncClient = Depends(get_http_client)):
    """Convert URL to markdown via markdown gateway"""
    try:
        response = await client.post(
            f"{MARKDOWN_GATEWAY_URL}/convert",
            json={"url": url}
        )
        return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Markdown Gateway error: {str(e)}")

@app.post("/popmart/recon")
async def popmart_recon(
    request: PopmartReconRequest,
    background_tasks: BackgroundTasks
):
    """Trigger Popmart recon scan (async background task)"""
    task_id = f"popmart-recon-{datetime.utcnow().timestamp()}"
    
    async def run_recon():
        """Execute oneoff_popmart.py as background task"""
        import subprocess
        cmd = [
            "python3",
            "services/oneoff_popmart.py",
            "--id-start", str(request.id_start),
            "--id-end", str(request.id_end)
        ]
        if request.scan_collections:
            cmd.append("--scan-collections")
        if request.scan_brandip:
            cmd.append("--scan-brandip")
        if request.scan_popnow:
            cmd.append("--scan-popnow")
        if request.probe_cdn:
            cmd.append("--probe-cdn")
        
        # TODO: Publish events to websocket subscribers
        await publish_event("popmart", {
            "type": "recon_started",
            "task_id": task_id,
            "params": request.dict()
        })
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        await publish_event("popmart", {
            "type": "recon_completed",
            "task_id": task_id,
            "exit_code": process.returncode
        })
    
    background_tasks.add_task(run_recon)
    
    return {
        "task_id": task_id,
        "status": "queued",
        "message": "Popmart recon scan initiated"
    }

@app.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    
    # Register subscriber
    if channel not in event_subscribers:
        event_subscribers[channel] = []
    event_subscribers[channel].append(websocket)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "channel": channel,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and receive messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back or process
            await websocket.send_json({
                "type": "echo",
                "received": message,
                "timestamp": datetime.utcnow().isoformat()
            })
    except Exception:
        pass
    finally:
        # Unregister subscriber
        if channel in event_subscribers:
            event_subscribers[channel].remove(websocket)

async def publish_event(channel: str, payload: Dict[str, Any]):
    """Publish event to all subscribers on a channel"""
    if channel not in event_subscribers:
        return
    
    message = {
        "type": "event",
        "channel": channel,
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Send to all subscribers
    dead_sockets = []
    for websocket in event_subscribers[channel]:
        try:
            await websocket.send_json(message)
        except:
            dead_sockets.append(websocket)
    
    # Remove dead connections
    for websocket in dead_sockets:
        event_subscribers[channel].remove(websocket)

@app.get("/events/stream")
async def event_stream():
    """Server-Sent Events stream for real-time updates"""
    async def event_generator():
        while True:
            # Send heartbeat
            yield f"event: heartbeat\ndata: {json.dumps({'timestamp': datetime.utcnow().isoformat()})}\n\n"
            await asyncio.sleep(30)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "orchestrator:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
