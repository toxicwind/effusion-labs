/**
 * API Client for Effusion Labs Unified Orchestrator
 * Frontend integration layer - ALL data flows through the API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

interface ServiceHealth {
    name: string
    status: 'healthy' | 'degraded' | 'down'
    latency_ms?: number
    last_check: string
}

interface MCPRequest {
    server: string
    payload: Record<string, any>
}

interface PopmartReconParams {
    id_start?: number
    id_end?: number
    scan_collections?: boolean
    scan_brandip?: boolean
    scan_popnow?: boolean
    probe_cdn?: boolean
}

interface WebSocketMessage {
    type: string
    channel: string
    payload: Record<string, any>
    timestamp: string
}

interface PipelineTask {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed'
    start_time: string
    end_time?: string
    exit_code?: number
    logs: string[]
}

class APIClient {
    private baseURL: string
    private wsURL: string
    private activeConnections: Map<string, WebSocket> = new Map()

    constructor(baseURL: string = API_BASE_URL, wsURL: string = WS_BASE_URL) {
        this.baseURL = baseURL
        this.wsURL = wsURL
    }

    // Health & Monitoring
    async health(): Promise<{ status: string; timestamp: string; services_monitored: number }> {
        const res = await fetch(`${this.baseURL}/health`)
        return res.json()
    }

    async servicesHealth(): Promise<ServiceHealth[]> {
        const res = await fetch(`${this.baseURL}/services/health`)
        return res.json()
    }

    // MCP Integration
    async mcpServers(): Promise<any> {
        const res = await fetch(`${this.baseURL}/mcp/servers`)
        return res.json()
    }

    async mcpSend(request: MCPRequest): Promise<any> {
        const res = await fetch(`${this.baseURL}/mcp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        })
        return res.json()
    }

    // Markdown Conversion
    async convertMarkdown(url: string): Promise<{ markdown: string }> {
        const res = await fetch(`${this.baseURL}/markdown/convert?url=${encodeURIComponent(url)}`, {
            method: 'POST',
        })
        return res.json()
    }

    // Popmart Recon
    async triggerPopmartRecon(params: PopmartReconParams = {}): Promise<{
        task_id: string
        status: string
        message: string
    }> {
        const res = await fetch(`${this.baseURL}/popmart/recon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })
        return res.json()
    }

    // Cannabis Analysis
    async getCannabisReport(): Promise<string> {
        const res = await fetch(`${this.baseURL}/cannabis/report/demo`)
        return res.text()
    }

    async getCannabisData(): Promise<any[]> {
        const res = await fetch(`${this.baseURL}/cannabis/data/synthetic`)
        return res.json()
    }

    // Pipeline Manager
    async runPipeline(params: { command?: string; mode?: string; label?: string }): Promise<{ task_id: string; status: string }> {
        const res = await fetch(`${this.baseURL}/pipeline/lv-images/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })
        return res.json()
    }

    async getPipelineTasks(): Promise<PipelineTask[]> {
        const res = await fetch(`${this.baseURL}/pipeline/tasks`)
        return res.json()
    }

    async getPipelineTask(taskId: string): Promise<PipelineTask> {
        const res = await fetch(`${this.baseURL}/pipeline/tasks/${taskId}`)
        return res.json()
    }

    // WebSocket Real-time Channels
    connectWebSocket(
        channel: 'popmart' | 'mcp' | 'system' | 'health',
        onMessage: (message: WebSocketMessage) => void,
        onError?: (error: Event) => void,
    ): () => void {
        const wsUrl = `${this.wsURL}/ws/${channel}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log(`[WebSocket] Connected to channel: ${channel}`)
            this.activeConnections.set(channel, ws)
        }

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                onMessage(message)
            } catch (error) {
                console.error('[WebSocket] Failed to parse message:', error)
            }
        }

        ws.onerror = (error) => {
            console.error(`[WebSocket] Error on channel ${channel}:`, error)
            if (onError) onError(error)
        }

        ws.onclose = () => {
            console.log(`[WebSocket] Disconnected from channel: ${channel}`)
            this.activeConnections.delete(channel)
        }

        // Return cleanup function
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
            this.activeConnections.delete(channel)
        }
    }

    // SSE Event Stream
    connectEventStream(onEvent: (event: MessageEvent) => void): () => void {
        const eventSource = new EventSource(`${this.baseURL}/events/stream`)

        eventSource.onmessage = onEvent

        eventSource.onerror = (error) => {
            console.error('[SSE] Event stream error:', error)
        }

        // Return cleanup function
        return () => {
            eventSource.close()
        }
    }

    // Utility: Close all connections
    disconnectAll(): void {
        this.activeConnections.forEach((ws) => ws.close())
        this.activeConnections.clear()
    }
}

// Singleton instance
export const api = new APIClient()

// Export types
export type { ServiceHealth, MCPRequest, PopmartReconParams, WebSocketMessage, PipelineTask }
