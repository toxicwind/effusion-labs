import { mockAgent } from '../setup/http.mjs';

export function registerMock(origin, options) {
  return mockAgent.get(origin).intercept(options);
}
