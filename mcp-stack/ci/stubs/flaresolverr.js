import http from 'node:http';
import { readFileSync } from 'node:fs';
const data = readFileSync(new URL('./data/flaresolverr.json', import.meta.url));
http.createServer((req,res)=>{
  if(req.method==='POST' && req.url==='/v1'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(data);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(8191,'127.0.0.1');
