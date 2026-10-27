import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const urls = [
  'https://global.popmart.com/products/mokoko-close-to-sweet-pendant',
  'https://popmart.fandom.com/wiki/Mokoko',
  'https://global.popmart.com/products/labubu-pronounce-wings-of-fortune-pendant',
  'https://popmart.fandom.com/wiki/Labubu',
  'https://global.popmart.com/products/labubu-lets-checkmate-plush-37cm',
  'https://popmart.fandom.com/wiki/Let%27s_Checkmate',
  'https://global.popmart.com/products/labubu-hide-and-seek-in-singapore-figure',
  'https://popmart.fandom.com/wiki/Hide_and_Seek_in_Singapore'
];

async function run(url){
  return new Promise((resolve)=>{
    const proc = spawn('node',['tools/web2md/cli.js',url]);
    let out='';
    proc.stdout.on('data',d=>out+=d);
    proc.stderr.on('data',d=>out+=d);
    proc.on('close',code=>{
      resolve({code,out});
    });
  });
}

async function main(){
  const junit = [];
  for(const url of urls){
    const r = await run(url);
    const host = new URL(url).hostname;
    const hostDir = path.join('tmp','web2md-diag',host);
    let status=false; let size=0; let text=0; let tier=0;
    try{
      const subdirs = await fs.readdir(hostDir);
      const latest = subdirs.sort().pop();
      const meta = JSON.parse(await fs.readFile(path.join(hostDir,latest,'page.meta.json'),'utf8'));
      const diag = JSON.parse(await fs.readFile(path.join(hostDir,latest,'diag.json'),'utf8'));
      size = (await fs.stat(path.join(hostDir,latest,'page.raw.html'))).size;
      text = (await fs.stat(path.join(hostDir,latest,'page.norm.md'))).size;
      tier = meta.tier;
      const attempt = diag.attempts.find(a=>a.tier===tier);
      status = attempt && attempt.status>=200;
    }catch{}
    junit.push({url,code:r.code,status,size,text,tier});
    console.log(url,r.code,status,size,text,tier);
  }
  const xml=[`<testsuite name="web2md" tests="${junit.length}">`];
  for(const t of junit){
    const pass = t.code===0 && t.status && (t.size>1024 || t.text>2048);
    xml.push(` <testcase name="${t.url}" time="0">` + (pass?'':`<failure/>`) + '</testcase>');
  }
  xml.push('</testsuite>');
  await fs.mkdir(path.join('tmp','web2md-diag'),{recursive:true});
  await fs.writeFile(path.join('tmp','web2md-diag','junit.xml'),xml.join('\n'));
}

if(process.argv.includes('--run')){
  main();
}
