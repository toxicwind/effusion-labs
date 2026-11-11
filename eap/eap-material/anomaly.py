#!/usr/bin/env python3
"""anomaly.py — EAP surface probe, corrected per official docs.

Note: This is a sanitized copy of the probe used during testing.
Credentials are loaded from a local secrets file and are not included here.
"""
import base64, concurrent.futures, json, re, ssl, sys, time
import urllib.error, urllib.request
from pathlib import Path

BASE = "https://generativelanguage.googleapis.com"
PROJ = "YOUR_EAP_PROJECT_ID"
STAMP = time.strftime("%Y%m%d-%H%M%S")
DATA = Path.home() / "estate-scripts" / "data"
DATA.mkdir(parents=True, exist_ok=True)
RAW = DATA / f"anomaly-{STAMP}"
RAW.mkdir(exist_ok=True)

def get_key():
    # In the actual environment, this reads from ~/.secrets
    return "YOUR_API_KEY_HERE"
KEY = get_key()
_CTX = ssl.create_default_context()

def call(path, body, *, timeout=60, method="POST", extra=None, auth="key"):
    url = BASE + path
    data = json.dumps(body).encode() if isinstance(body,(dict,list)) else (body.encode() if isinstance(body,str) else body)
    req = urllib.request.Request(url, data=data, method=method)
    if auth in ("key","both"): req.add_header("x-goog-api-key", KEY)
    if auth in ("bearer","both"): req.add_header("Authorization", "Bearer " + KEY)
    if auth != "none": req.add_header("x-goog-user-project", PROJ)
    if data: req.add_header("Content-Type", "application/json")
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
            return r.status, (time.monotonic()-t0)*1000, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, (time.monotonic()-t0)*1000, e.read(), dict(e.headers)
    except Exception as e:
        return 0, (time.monotonic()-t0)*1000, str(e).encode(), {}

def parse(body):
    if not body: return None
    try: doc = json.loads(body.decode("utf-8","replace"))
    except Exception: return None
    return doc[0] if isinstance(doc, list) and doc else doc

def s03_server_side_retrieval():
    tools = [
        {"type":"tool_search"},
        {"type":"function","name":"get_weather","description":"Get current weather for a city",
         "defer_loading":True, "parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}},
        {"type":"function","name":"get_forecast","description":"Get multi-day weather forecast",
         "defer_loading":True, "parameters":{"type":"object","properties":{"city":{"type":"string"},"days":{"type":"integer"}},"required":["city"]}},
    ]
    prompts = ["What is the weather in Tokyo right now?", "Forecast for Paris for the next 3 days."]
    def probe(i_p):
        i, p = i_p
        body = {"model":"gemini-flash-tool-retrieval","input":p,"tools":tools}
        code, ms, rb, _ = call("/v1beta/interactions", body)
        doc = parse(rb) or {}
        sc, sr, fc = [], [], []
        for s in doc.get("steps") or []:
            t = s.get("type")
            if t == "tool_search_call": sc.append((s.get("arguments") or {}).get("function_names") or [])
            if t == "tool_search_result": sr.append([r.get("name") for r in (s.get("result") or []) if isinstance(r, dict)])
            if t == "function_call": fc.append(s.get("name"))
        return i, {"prompt":p,"code":code,"search_calls":sc,"search_results":sr,"fn_calls":fc}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        for i, r in sorted(ex.map(probe, enumerate(prompts, 1)), key=lambda x: x[0]):
            print(json.dumps(r, indent=2))

if __name__ == "__main__":
    print("Running Server-Side Retrieval Probe...")
    s03_server_side_retrieval()
