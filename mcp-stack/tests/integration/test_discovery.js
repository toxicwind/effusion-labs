import {spawn} from 'child_process';
import fetch from 'node-fetch';
import {setTimeout as delay} from 'timers/promises';
import assert from 'assert';

const main = async () => {
  const child = spawn('node',['gateway/index.js'],{env:{...process.env,PORT_HTTP:'0'},stdio:['ignore','pipe','inherit']});
  let port;
  child.stdout.on('data',d=>{
    const line=d.toString().trim();
    try{
      const obj=JSON.parse(line);
      if(obj.msg && obj.msg.startsWith('listening:')){
        port=obj.msg.split(':')[1];
      }
    }catch{}
  });
  while(!port){
    await delay(100);
  }
  const res = await fetch(`http://localhost:${port}/.well-known/mcp-servers.json`);
  const list = await res.json();
  assert.ok(Array.isArray(list),'manifest not array');
  const echo = list.find(s=>s.name==='echo');
  assert.ok(echo && echo.url.includes(`/servers/echo/sse`),'echo server missing');
  child.kill();
};
await main();
