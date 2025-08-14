from bs4 import BeautifulSoup
from readability import Document
from markdownify import markdownify
from urllib.parse import urljoin

def html_to_markdown(html: str, base_url: str):
    title = None
    try:
        doc = Document(html)
        main = doc.summary(html_partial=True)
        title = doc.short_title()
    except Exception:
        main = html
    soup = BeautifulSoup(main, "lxml")
    for t in soup(["script","style","noscript"]): t.decompose()
    for a in soup.find_all(["a","img"]):
        if a.name == "a" and a.has_attr("href"):
            a["href"] = urljoin(base_url or "", a["href"])
        if a.name == "img" and a.has_attr("src"):
            a["src"] = urljoin(base_url or "", a["src"])
    body_md = markdownify(str(soup), heading_style="ATX", code_language=False,
                          escape_asterisks=False, strip=["style","script"])
    return title, body_md.strip() + "\n"
