import express from 'express';
import {createServer} from 'http';
import {spawn} from 'child_process';
import fs from 'fs';
import path from 'path';
import getPort, {portNumbers} from 'get-port';

const registryPath = new URL('../servers/registry.json', import.meta.url);
const registry = JSON.parse(fs.readFileSync(registryPath));

const app = express();
const log = (level, comp, server, msg) => {
  console.log(JSON.stringify({ts:new Date().toISOString(), level, comp, server, msg}));
};

const children = new Map();
const states = new Map();

function spawnServer(name, cfg){
  if(children.has(name)) return;
  const proc = spawn(cfg.command, cfg.args || [], {env:{...process.env, ...cfg.env}, stdio:'pipe'});
  children.set(name, proc);
  states.set(name, {health:'ready', reason:null});
  proc.on('exit', code => {
    states.set(name, {health:'degraded', reason:`exit ${code}`});
    children.delete(name);
    log('warn','child',name,`exited with code ${code}`);
  });
}

app.get('/servers/:name/sse',(req,res)=>{
  const name = req.params.name;
  const cfg = registry[name];
  if(!cfg){ res.status(404).end(); return; }
  spawnServer(name,cfg);
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({name})}\n\n`);
});

app.get('/servers/:name/info',(req,res)=>{
  const name=req.params.name;
  const s=states.get(name) || {health:'disabled'};
  res.json({name,...s});
});

app.get('/servers',(req,res)=>{
  const list=Object.keys(registry).map(name=>({name,...(states.get(name)||{health:'disabled'})}));
  res.json(list);
});

app.get('/.well-known/mcp-servers.json',(req,res)=>{
  const base=`${req.protocol}://${req.get('host')}`;
  const manifest = Object.keys(registry).map(name=>({
    name,
    transport:'sse',
    url:`${base}/servers/${name}/sse`,
    health:(states.get(name)||{health:'disabled'}).health,
    version:'0.1.0',
    capabilities:registry[name].capabilities||{}
  }));
  res.json(manifest);
});

app.get('/healthz', (req,res)=>res.json({ok:true}));
app.get('/readyz', (req,res)=>res.json({ready:true}));

const choosePort = async () => {
  const fixed = process.env.PORT_HTTP ? Number(process.env.PORT_HTTP) : undefined;
  if(fixed !== undefined) return fixed;
  if(process.env.PORT_RANGE_HTTP){
    const [low,high] = process.env.PORT_RANGE_HTTP.split('-').map(Number);
    return await getPort({port: portNumbers(low, high)});
  }
  return await getPort();
};

const start = async () => {
  const port = await choosePort();
  const server=createServer(app);
  server.listen(port, ()=>{
    const real=server.address().port;
    log('info','gateway',null,`listening:${real}`);
  });
};

start();
