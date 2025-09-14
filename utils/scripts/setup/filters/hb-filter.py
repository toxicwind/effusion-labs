#!/usr/bin/env python3
import os,sys
W=int(os.environ.get("HB_FILTER_W","3500")); LOGF=os.environ.get("HB_FILTER_LOGF","")
PFX=os.environ.get("HB_FILTER_PFX","[HBWRAP"); SFX=os.environ.get("HB_FILTER_SFX","]")
BIN=os.environ.get("HB_FILTER_BIN","[HBBIN"); FLUSH=int(os.environ.get("HB_FILTER_FLUSH",str(4*W)))
logfh=open(LOGF,"ab",buffering=0) if LOGF else None
ALLOWED={9,10,13,27}
def bad(b): return any(((x not in ALLOWED) and (x<32 or x==127)) for x in b)
def chunks(b,nl):
  L=len(b)
  if L<=W: sys.stdout.buffer.write(b+nl); return
  n=(L+W-1)//W; s=0
  for i in range(1,n+1):
    e=min(s+W,L); chunk=b[s:e]; a, c = s+1, e
    sys.stdout.buffer.write((f"{PFX} {i}/{n} {a}..{c}{SFX} ").encode()+chunk+b"\n"); s=e
  if nl: sys.stdout.buffer.write(nl)
def soft(buf):
  while len(buf)>FLUSH:
    win=bytes(buf[:W]); del buf[:W]
    sys.stdout.buffer.write((f"{PFX} 1/1 1..{len(win)}{SFX} ").encode()+win+b"\n")
buf=bytearray()
while True:
  ch=sys.stdin.buffer.read(8192)
  if not ch: break
  buf.extend(ch); soft(buf)
  while True:
    pn=buf.find(b"\n"); pr=buf.find(b"\r")
    if pn<0 and pr<0: break
    if pn<0: pn=1<<30
    if pr<0: pr=1<<30
    pos = pn if pn<pr else pr
    delim=buf[pos:pos+1]; line=bytes(buf[:pos]); take=1
    if delim==b"\r" and buf[pos:pos+2]==b"\r\n": take=2
    raw=bytes(buf[:pos+take]); del buf[:pos+take]
    if logfh: logfh.write(raw)
    if bad(line): sys.stdout.buffer.write((f"{BIN} suppressed {len(line)} bytes\n").encode())
    else: chunks(line,b"\n")
if buf:
  if logfh: logfh.write(bytes(buf))
  if bad(bytes(buf)): sys.stdout.buffer.write((f"{BIN} suppressed {len(buf)} bytes").encode())
  else: chunks(bytes(buf),b"")
