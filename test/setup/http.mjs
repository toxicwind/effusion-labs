import { MockAgent, setGlobalDispatcher } from 'undici';

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();

mockAgent.on('no match', ({ method, origin, path }) => {
  throw new Error(
    `Unmatched request: ${method} ${origin}${path}.\nAdd a mock in test/mocks/`,
  );
});

const httpMock = {
  mock(origin, setup) {
    return mockAgent.get(origin).intercept(setup);
  },
  allowNetFor(re) {
    mockAgent.enableNetConnect(re);
  },
};

globalThis.httpMock = httpMock;

setGlobalDispatcher(mockAgent);
export { mockAgent };
