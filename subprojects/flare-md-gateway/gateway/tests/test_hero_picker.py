import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from gateway.app.image_picker import pick_hero

def test_pick_hero_prefers_og():
    html = """
    <html><head>
    <meta property='og:image' content='http://example.com/og.jpg'>
    <meta name='twitter:image' content='http://example.com/tw.jpg'>
    </head><body></body></html>
    """
    hero, cands = pick_hero(html, "http://example.com/page")
    assert hero == "http://example.com/og.jpg"
    assert hero in cands
