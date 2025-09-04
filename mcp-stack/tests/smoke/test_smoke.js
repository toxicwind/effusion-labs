import {spawn} from 'child_process';
import EventSource from 'eventsource';
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
  const es = new EventSource(`http://localhost:${port}/servers/echo/sse`);
  let got=false;
  es.on('ready', e=>{got=true;});
  await delay(500);
  assert.ok(got,'did not receive ready event');
  es.close();
  child.kill();
};
await main();
