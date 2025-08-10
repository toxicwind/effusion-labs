#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { fetchWithFallback } = require('./index');

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = { ipv4Only:false, noH2:false, lang:'en', headless:false };
  const urls=[];
  for(let i=0;i<args.length;i++){
    const a=args[i];
    if(a==='--ipv4-only') opts.ipv4Only=true;
    else if(a==='--no-h2') opts.noH2=true;
    else if(a==='--lang') { opts.lang=args[++i]; }
    else if(a==='--headless') opts.headless=true;
    else if(!a.startsWith('--')) urls.push(a);
  }
  return {opts,urls};
}

async function main(){
  const {opts,urls}=parseArgs();
  if(urls.length===0){
    console.error('usage: web2md <url>');
    process.exit(1);
  }
  const results=[];
  for(const url of urls){
    try{
      const r = await fetchWithFallback(url,opts);
      const host = new URL(url).hostname;
      const ts = Date.now().toString();
      const dir = path.join('tmp','web2md-diag',host,ts);
      await fs.mkdir(dir,{recursive:true});
      await fs.writeFile(path.join(dir,'page.raw.html'),r.html);
      await fs.writeFile(path.join(dir,'page.norm.md'),r.markdown);
      await fs.writeFile(path.join(dir,'page.meta.json'),JSON.stringify({url,tier:r.tier,hashes:r.hashes,http_version:r.httpVersion,ua:'web2md/1.0',lang:opts.lang},null,2));
      await fs.writeFile(path.join(dir,'diag.json'),JSON.stringify(r.diagnostics,null,2));
      const size = r.html.length;
      const textLen = r.markdown.length;
      const status = size>1024 || textLen>2048 ? 'ok':'too-small';
      results.push({url,tier:r.tier,status,bytes:size,text:textLen,dir});
      if(status==='too-small') process.exitCode=2;
    }catch(err){
      const host = new URL(url).hostname;
      const ts = Date.now().toString();
      const dir = path.join('tmp','web2md-diag',host,ts);
      await fs.mkdir(dir,{recursive:true});
      if(err.diagnostics){
        await fs.writeFile(path.join(dir,'diag.json'),JSON.stringify(err.diagnostics,null,2));
      }
      console.error('fail',url,err.message);
      results.push({url,error:err.message,dir});
      process.exitCode=1;
    }
  }
  console.table(results);
  results.forEach(r=>{ if(r.dir) console.log('saved',r.url,'->',r.dir); });
}

main();
