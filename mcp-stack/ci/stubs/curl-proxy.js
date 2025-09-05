import http from 'node:http';
http.createServer((req,res)=>{
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:true,url:req.url,status:200,body:'ok'}));
}).listen(9350,'127.0.0.1');
