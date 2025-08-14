from fastapi import FastAPI, Depends, Request, Response, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import httpx, json
from . import settings
from .auth import require_auth
from .types import FlareRequest
from .md_convert import html_to_markdown
from .image_picker import pick_hero

app = FastAPI(title="Flare MD Gateway", version="1.0.0")
security = HTTPBasic()

async def _post_solver(payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
        r = await client.post(settings.SOLVER_URL, json=payload)
        r.raise_for_status()
        return r.json()

@app.get("/healthz")
async def healthz():
    return Response(content="ok", media_type="text/plain")

@app.get("/readyz")
async def readyz():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(settings.SOLVER_URL, json={"cmd":"sessions.list"})
            if r.status_code == 200:
                return Response(content="ready", media_type="text/plain")
    except Exception:
        pass
    return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

@app.post("/health/deep")
async def deep_probe(credentials: HTTPBasicCredentials = Depends(security)):
    require_auth(credentials)
    targets = [
        "https://m.popmart.com/us/products/578/labubu-time-to-chill-vinyl-plush-doll",
        "https://m.popmart.com/us/products/1874/"
    ]
    ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ok = False; results = []
    for url in targets:
        payload = {
            "cmd": "request.get",
            "url": url,
            "maxTimeout": 60000,
            "followRedirects": True,
            "userAgent": ua,
            "headers": {"accept-language":"en-US,en;q=0.9"}
        }
        try:
            data = await _post_solver(payload)
        except Exception as e:
            results.append({"url":url,"ok":False,"error":str(e)})
            continue
        html = (data or {}).get("solution",{}).get("response","") or ""
        matched = all(x.lower() in html.lower() for x in ("Time to Chill","Release","2022"))
        if matched and html:
            title, md = html_to_markdown(html, url)
            hero, cands = pick_hero(html, url)
            results.append({"url":url,"ok":True,"title":title,"hero":hero,"candidates":cands})
            ok = True
        else:
            results.append({"url":url,"ok":False,"reason":"string_match_failed"})
    status_code = 200 if ok else 500
    return Response(content=json.dumps({"results":results}, ensure_ascii=False),
                    status_code=status_code, media_type="application/json; charset=utf-8")

@app.post("/v1")
async def v1_proxy(req: Request, credentials: HTTPBasicCredentials = Depends(security)):
    require_auth(credentials)
    body = await req.json()
    flare_req = FlareRequest(**body)
    data = await _post_solver(flare_req.model_dump())
    sol = (data or {}).get("solution", {})
    html = sol.get("response")
    wants_md = "text/markdown" in (req.headers.get("accept", "").lower())
    if not wants_md and req.url.query:
        for kv in req.url.query.split("&"):
            if kv.lower() in ("fmt=md","format=md"):
                wants_md = True
                break
    if data.get("status") == "ok" and isinstance(html, str) and html.strip():
        base_url = flare_req.url or ""
        title, md = html_to_markdown(html, base_url)
        hero, candidates = pick_hero(html, base_url)
        if wants_md:
            parts = []
            if title: parts.append(f"# {title}\n")
            if hero:  parts.append(f"![hero]({hero})\n\n")
            parts.append(md)
            out = "".join(parts)
            return Response(content=out, media_type="text/markdown; charset=utf-8", headers={
                "X-Source-URL": base_url,
                "X-Content-Format": "markdown"
            })
        sol["format"] = "markdown"
        sol["markdown"] = (f"# {title}\n\n" if title else "") + (f"![hero]({hero})\n\n" if hero else "") + md
        sol["title"] = title
        sol["images"] = {"hero":hero, "candidates":candidates}
        data["solution"] = sol
        return Response(content=json.dumps(data, ensure_ascii=False), media_type="application/json; charset=utf-8")
    return Response(content=json.dumps(data, ensure_ascii=False), media_type="application/json; charset=utf-8")
