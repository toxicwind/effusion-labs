let server;

export async function startMsw(...handlers) {
  const { setupServer } = await import('msw/node');
  server = setupServer(...handlers);
  server.listen();
}

export function stopMsw() {
  server?.close();
}
