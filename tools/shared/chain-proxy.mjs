import { Server } from 'proxy-chain';
import process from 'node:process';

function req(name){
  const v = process.env[name];
  if(!v) throw new Error(`Missing ${name}`);
  return v;
}

const PRE = req('PRE_HOP_PROXY');
const TARGET = req('OUTBOUND_PROXY_URL');
const USER = process.env.OUTBOUND_PROXY_USER || '';
const PASS = process.env.OUTBOUND_PROXY_PASS || '';

const targetWithAuth = (() => {
  const u = new URL(TARGET);
  if(USER) u.username = USER;
  if(PASS) u.password = PASS;
  return u.toString();
})();

const server = new Server({
  port: 8899,
  prepareRequestFunction: () => ({
    upstreamProxyUrl: PRE,
    customConnectServer: targetWithAuth,
  }),
});

server.listen(() => {
  console.log(`CHAIN_PROXY_URL=http://127.0.0.1:${server.port}`);
});
