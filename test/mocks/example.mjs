export function mockExample() {
  httpMock
    .mock('https://example.com', { path: '/resource', method: 'GET' })
    .reply(200, { ok: true })
}
