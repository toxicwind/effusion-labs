export function startSSE(res, headers = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    ...headers,
  });
  res.write("\n");
  return {
    send(event, data) {
      if (!res.writableEnded) {
        if (event) res.write(`event: ${event}\n`);
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        res.write(`data: ${payload}\n\n`);
      }
    },
    ping() {
      if (!res.writableEnded) res.write(`: ping ${Date.now()}\n\n`);
    },
    close() {
      if (!res.writableEnded) res.end();
    },
  };
}

