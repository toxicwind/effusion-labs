import { Server, createTunnel } from 'proxy-chain';
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

const targetUrl = new URL(TARGET);
const tunnel = await createTunnel(PRE, `${targetUrl.hostname}:${targetUrl.port}`);
const upstreamProxyUrl = (() => {
  const auth = USER ? `${encodeURIComponent(USER)}:${encodeURIComponent(PASS)}@` : '';
  return `http://${auth}${tunnel}`;
})();

const server = new Server({
  port: 8899,
  verbose: true,
  prepareRequestFunction: () => ({
    upstreamProxyUrl,
  }),
});

server.listen(() => {
  console.log(`CHAIN_PROXY_URL=http://127.0.0.1:${server.port}`);
});
