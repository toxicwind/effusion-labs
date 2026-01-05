export function startSSE(res, headers = {}, retryMs = 15000) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Helpful for proxies like Nginx
    'X-Accel-Buffering': 'no',
    ...headers,
  })
  // Recommend client retry window and flush initial padding
  res.write(`retry: ${retryMs}\n\n`)
  return {
    send(event, data) {
      if (!res.writableEnded) {
        if (event) res.write(`event: ${event}\n`)
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        res.write(`data: ${payload}\n\n`)
      }
    },
    ping() {
      if (!res.writableEnded) res.write(`: ping ${Date.now()}\n\n`)
    },
    close() {
      if (!res.writableEnded) res.end()
    },
  }
}
