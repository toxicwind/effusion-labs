import os
import requests
from functools import wraps
from flask import Flask, request, Response, jsonify
from readability import Document
from markdownify import markdownify as md
from bs4 import BeautifulSoup
from urllib.parse import urljoin

app = Flask(__name__)
AUTH_API_KEY = os.environ.get("GATEWAY_API_KEY", "your-secret-key-goes-here")
FLARESOLVERR_URL = "http://solver:8191/v1"
FLARESOLVERR_TIMEOUT = 120

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.headers.get('X-Api-Key') != AUTH_API_KEY:
            return jsonify({"error": "Unauthorized. Invalid or missing API Key."}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/convert', methods=['POST'])
@require_api_key
def convert_url_to_markdown():
    json_data = request.get_json()
    if not json_data or 'url' not in json_data:
        return jsonify({"error": "Missing 'url' in request body"}), 400
    target_url = json_data['url']
    try:
        solver_payload = {
            "cmd": "request.get",
            "url": target_url,
            "maxTimeout": (FLARESOLVERR_TIMEOUT - 10) * 1000,
        }
        solver_payload.update({k: v for k, v in json_data.items() if k != 'url'})
        response = requests.post(FLARESOLVERR_URL, json=solver_payload, timeout=FLARESOLVERR_TIMEOUT)
        response.raise_for_status()
        solver_data = response.json()
        if solver_data.get('status') != 'ok':
            app.logger.error(f"FlareSolverr failed for {target_url}: {solver_data}")
            return jsonify({"error": "FlareSolverr failed to process the request", "details": solver_data}), 502
        html_content = solver_data.get("solution", {}).get("response")
        if not html_content:
            return jsonify({"error": "FlareSolverr returned empty HTML content"}), 500
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to FlareSolverr timed out"}), 504
    except requests.exceptions.RequestException as e:
        app.logger.error(f"FlareSolverr connection error: {e}")
        return jsonify({"error": f"Failed to connect to FlareSolverr: {e}"}), 504
    try:
        doc = Document(html_content)
        title = doc.short_title()
        content_html = doc.summary(html_partial=True)
        soup = BeautifulSoup(content_html, "lxml")
        for tag in soup.find_all(['a', 'img']):
            attribute = 'href' if tag.name == 'a' else 'src'
            if attribute in tag.attrs:
                tag[attribute] = urljoin(target_url, tag[attribute])
        markdown_content = md(str(soup), heading_style="ATX", bullets="*")
        final_output = f"# {title}\n\n*Source: <{target_url}>*\n\n---\n\n{markdown_content}"
    except Exception as e:
        app.logger.error(f"Markdown conversion failed for {target_url}: {e}")
        return jsonify({"error": "Failed during HTML to Markdown conversion"}), 500
    return Response(final_output, mimetype='text/markdown; charset=utf-8')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200
