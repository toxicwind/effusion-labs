const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const os = require('node:os');

function startServer(){
  const server = http.createServer((req,res)=>{
    if(req.url==='/a') res.end('<h1>A</h1>');
    else res.end('<h1>B</h1>');
  });
  return new Promise(resolve=>server.listen(0,()=>resolve(server)));
}

function run(cmd,args,env={}){
  return new Promise((resolve,reject)=>{
    execFile(cmd,args,{env:{...process.env,...env}},(err,stdout,stderr)=>{
      if(err){err.stdout=stdout;err.stderr=stderr;return reject(err);} resolve({stdout,stderr});
    });
  });
}

test('archive-docs captures manifest', async t=>{
  const server = await startServer();
  const port = server.address().port;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'docs-'));
  const manifest = {libraries:[{name:'markdown-it',pages:[{slug:'a',url:`http://localhost:${port}/a`},{slug:'b',url:`http://localhost:${port}/b`}]}]};
  const manifestPath = path.join(tmp,'manifest.json');
  await fs.writeFile(manifestPath,JSON.stringify(manifest));
  const knowledgeDir = path.join(tmp,'knowledge');
  await fs.mkdir(knowledgeDir);
  await run('node',['tools/archive-docs.js',manifestPath],{VENDOR_DOCS_DIR:tmp,KNOWLEDGE_ROOT:knowledgeDir});
  const inv = JSON.parse(await fs.readFile(path.join(tmp,'_inventory.json'),'utf-8'));
  assert.strictEqual(inv[0].name,'markdown-it');
  const man = JSON.parse(await fs.readFile(path.join(tmp,'markdown-it',inv[0].version,'manifest.json'),'utf-8'));
  assert.strictEqual(man.length,2);
  await fs.access(path.join(tmp,'markdown-it',inv[0].version,'a.md'));
  await fs.access(path.join(tmp,'markdown-it',inv[0].version,'b.md'));
  server.close();
});
