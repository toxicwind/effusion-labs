/**
 * Popmart Dashboard Real-time Integration
 * Connects to orchestrator WebSocket for live recon updates
 */

import { api } from './api-client'

interface ReconUpdate {
    type: 'recon_started' | 'recon_completed' | 'recon_progress'
    task_id: string
    params?: Record<string, any>
    exit_code?: number
    progress?: number
}

class PopmartDashboard {
    private wsCleanup?: () => void
    private progressCallback?: (update: ReconUpdate) => void

    connect(onUpdate: (update: ReconUpdate) => void): void {
        this.progressCallback = onUpdate

        // Connect to popmart WebSocket channel
        this.wsCleanup = api.connectWebSocket(
            'popmart',
            (message) => {
                if (message.type === 'event' && message.payload) {
                    const update = message.payload as ReconUpdate
                    this.handleUpdate(update)
                }
            },
            (error) => {
                console.error('[Popmart] WebSocket error:', error)
            },
        )
    }

    private handleUpdate(update: ReconUpdate): void {
        if (this.progressCallback) {
            this.progressCallback(update)
        }

        // Update UI indicators
        if (update.type === 'recon_started') {
            this.showProgress(update.task_id, 0)
        } else if (update.type === 'recon_progress' && update.progress !== undefined) {
            this.showProgress(update.task_id, update.progress)
        } else if (update.type === 'recon_completed') {
            this.showProgress(update.task_id, 100)
            this.reloadData()
        }
    }

    async startRecon(params: {
        id_start?: number
        id_end?: number
        scan_collections?: boolean
        scan_brandip?: boolean
        scan_popnow?: boolean
        probe_cdn?: boolean
    }): Promise<void> {
        try {
            const response = await api.triggerPopmartRecon(params)
            console.log('[Popmart] Recon started:', response)

            // Show toast notification
            this.showNotification(`Recon scan queued: ${response.task_id}`)
        } catch (error) {
            console.error('[Popmart] Failed to start recon:', error)
            this.showNotification('Failed to start recon scan', 'error')
        }
    }

    private showProgress(taskId: string, progress: number): void {
        const progressBar = document.querySelector(`[data-task="${taskId}"] .progress-bar`)
        if (progressBar) {
            progressBar.setAttribute('style', `width: ${progress}%`)
            progressBar.textContent = `${Math.round(progress)}%`
        }
    }

    private async reloadData(): Promise<void> {
        // Trigger page reload to fetch latest data
        // TODO: Implement incremental data fetch via API
        setTimeout(() => {
            window.location.reload()
        }, 2000)
    }

    private showNotification(message: string, type: 'info' | 'error' = 'info'): void {
        // Create toast notification
        const toast = document.createElement('div')
        toast.className = `alert alert-${type === 'error' ? 'error' : 'info'} fixed top-4 right-4 z-50 shadow-lg`
        toast.innerHTML = `
      <div>
        <span>${message}</span>
      </div>
    `
        document.body.appendChild(toast)

        setTimeout(() => {
            toast.remove()
        }, 5000)
    }

    disconnect(): void {
        if (this.wsCleanup) {
            this.wsCleanup()
        }
    }
}

// Initialize on page load if popmart dash board exists
if (document.querySelector('[data-dashboard="popmart"]')) {
    const dashboard = new PopmartDashboard()
    dashboard.connect((update) => {
        console.log('[Popmart] Update:', update)
    })

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        dashboard.disconnect()
    })

        // Expose to window for button handlers
        ; (window as any).popmartDashboard = dashboard
}

export { PopmartDashboard }
