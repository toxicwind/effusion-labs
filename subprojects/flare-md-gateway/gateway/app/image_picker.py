from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import json

BAD = ("sprite","logo","icon","placeholder","svg","data:")
GOOD = ("product","hero","banner","labubu","monsters","popmart")

def _norm(u, base):
    if not u or u.startswith("data:"):
        return None
    return urljoin(base or "", u)

def _dim_meta(soup):
    try:
        w = soup.find("meta", attrs={"property":"og:image:width"})
        h = soup.find("meta", attrs={"property":"og:image:height"})
        if w and h: return (int(w["content"]), int(h["content"]))
    except Exception:
        pass
    return None

def _from_meta(soup, base):
    cands = []
    for prop in ("og:image:secure_url","og:image:url","og:image"):
        m = soup.find("meta", attrs={"property":prop})
        if m and m.get("content"):
            cands.append(("og", _norm(m["content"].strip(), base), _dim_meta(soup)))
    for name in ("twitter:image","twitter:image:src"):
        m = soup.find("meta", attrs={"name":name})
        if m and m.get("content"):
            cands.append(("tw", _norm(m["content"].strip(), base), None))
    link = soup.find("link", attrs={"rel": lambda v: v and "image_src" in v})
    if link and link.get("href"):
        cands.append(("link", _norm(link["href"], base), None))
    return cands

def _from_jsonld(soup, base):
    out = []
    for tag in soup.find_all("script", attrs={"type":"application/ld+json"}):
        try:
            data = json.loads(tag.string or "{}")
        except Exception:
            continue
        items = [data] if isinstance(data, dict) else (data if isinstance(data, list) else [])
        for item in items:
            imgs = item.get("image")
            if not imgs: continue
            imgs = imgs if isinstance(imgs, list) else [imgs]
            for im in imgs:
                if isinstance(im, str):
                    u = _norm(im, base)
                    if u: out.append(("ld", u, None))
                elif isinstance(im, dict) and "url" in im:
                    u = _norm(im["url"], base)
                    wh = None
                    try:
                        wh = (int(im.get("width",0)), int(im.get("height",0))) if im.get("width") and im.get("height") else None
                    except Exception:
                        pass
                    if u: out.append(("ld", u, wh))
    return out

def _from_content(soup, base):
    out = []
    for img in soup.find_all("img"):
        src = _norm(img.get("src"), base)
        if src: out.append(("img", src, None))
        ss = img.get("srcset")
        if ss:
            best, bestw = None, -1
            for part in [p.strip() for p in ss.split(",")]:
                seg = part.split()
                if not seg: continue
                u2 = _norm(seg[0], base)
                w = 0
                if len(seg) > 1 and seg[1].endswith("w"):
                    try: w = int(seg[1][:-1])
                    except: pass
                if u2 and w >= bestw:
                    best, bestw = u2, w
            if best: out.append(("imgset", best, (bestw, 0)))
    return out

def _score(url, dims, base_host):
    url_l = (url or "").lower()
    score = 0
    if dims and dims[0] and dims[1]:
        score += dims[0]*dims[1]
    host = urlparse(url).netloc
    if base_host and (base_host in host or host.endswith(base_host)):
        score += 50_000
    if any(t in url_l for t in GOOD): score += 10_000
    if any(t in url_l for t in BAD):  score -= 20_000
    if any(x in url_l for x in ("1200x630","1200_630","ogimage")): score += 5_000
    return score

def pick_hero(html, base):
    soup = BeautifulSoup(html, "lxml")
    base_host = urlparse(base or "").netloc
    cands = _from_meta(soup, base) + _from_jsonld(soup, base) + _from_content(soup, base)
    seen, uniq = set(), []
    for _, u, dims in cands:
        if not u or u in seen: continue
        seen.add(u); uniq.append((u, dims))
    if not uniq: return None, []
    ranked = sorted(uniq, key=lambda t: _score(t[0], t[1], base_host), reverse=True)
    hero = ranked[0][0]
    top10 = [u for (u, _) in ranked[:10]]
    return hero, top10
