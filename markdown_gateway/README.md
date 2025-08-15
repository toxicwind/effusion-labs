# Markdown Gateway Service

A Flask-based service that retrieves a web page through FlareSolverr, cleans the HTML and returns Markdown.

## Configuration
Create a `.env` file or export variables before starting.

| Variable | Purpose |
| --- | --- |
| `GATEWAY_API_KEY` | Shared secret required in the `X-Api-Key` header |
| `GATEWAY_PORT` | Host port mapped to container port 5000 (default 49159) |

## Docker Compose
```bash
cd markdown_gateway
echo GATEWAY_API_KEY=changeme > .env
docker compose up --build -d
```

## Usage
```bash
curl -X POST http://localhost:49159/convert \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: changeme" \
  -d '{"url": "https://example.com"}'
```

## Notes
- Service listens on HTTP; use a reverse proxy to enable HTTPS in production.
- Requests to FlareSolverr time out after 120 seconds.
