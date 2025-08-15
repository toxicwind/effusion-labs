import { registerMock } from './register.mjs';

export function mockExample() {
  registerMock('https://example.com', { path: '/resource', method: 'GET' })
    .reply(200, { ok: true });
}
