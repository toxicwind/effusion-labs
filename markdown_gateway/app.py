import os
from functools import wraps
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
from markdownify import markdownify
from readability import Document

app = Flask(__name__)
API_KEY = os.environ.get("GATEWAY_API_KEY")
DEFAULT_SOLVER_URL = "http://solver:8191/v1"


def get_solver_url() -> str:
    return os.environ.get("SOLVER_URL", DEFAULT_SOLVER_URL)


SOLVER_URL = get_solver_url()


def require_api_key(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not API_KEY or request.headers.get("X-Api-Key") != API_KEY:
            return jsonify({"error": "unauthorized"}), 401
        return func(*args, **kwargs)

    return wrapper


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/convert", methods=["POST"])
@require_api_key
def convert():
    data = request.get_json(silent=True) or {}
    url = data.get("url")
    if not url:
        return jsonify({"error": "url is required"}), 400

    payload = {"cmd": "request.get", "url": url}
    try:
        solver_resp = requests.post(SOLVER_URL, json=payload, timeout=120)

        solver_resp.raise_for_status()
        body = solver_resp.json()
        if body.get("status") != "ok":
            return jsonify({"error": "solver error"}), 502
        html = body.get("solution", {}).get("response")
        if not html:
            return jsonify({"error": "empty response"}), 502
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

    doc = Document(html)
    cleaned_html = doc.summary()
    soup = BeautifulSoup(cleaned_html, "lxml")
    for tag in soup.find_all(href=True):
        tag["href"] = urljoin(url, tag["href"])
    for tag in soup.find_all(src=True):
        tag["src"] = urljoin(url, tag["src"])
    markdown = markdownify(str(soup))
    return jsonify({"flareresolver": body, "markdown": markdown})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
