#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { search } = require('./index');

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = { engine:'ddg', pages:1, forceProxy:undefined, noProxyHosts:undefined };
  const queryParts=[];
  for(let i=0;i<args.length;i++){
    const a=args[i];
    if(a==='--engine') opts.engine=args[++i];
    else if(a==='--pages') opts.pages=parseInt(args[++i],10);
    else if(a==='--proxy') opts.forceProxy=true;
    else if(a==='--no-proxy') opts.forceProxy=false;
    else if(a==='--no-proxy-hosts') opts.noProxyHosts=args[++i];
    else queryParts.push(a);
  }
  return {opts, query: queryParts.join(' ')};
}

async function main(){
  const {opts, query}=parseArgs();
  if(!query){
    console.error('usage: search2serp --engine ddg --pages N [--proxy|--no-proxy] [--no-proxy-hosts "host,host"] "query"');
    process.exit(1);
  }
  const res = await search(query,opts);
  console.log('proxy.state', res.proxy);
  const dir = path.join('tmp','search2serp');
  await fs.mkdir(dir,{recursive:true});
  const file = path.join(dir,`${opts.engine}.jsonl`);
  await fs.writeFile(file,res.results.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await fs.writeFile(path.join(dir,'diag.json'),JSON.stringify({query,engine:opts.engine,proxy:res.proxy},null,2));
  console.log('saved',file);
}

main();
