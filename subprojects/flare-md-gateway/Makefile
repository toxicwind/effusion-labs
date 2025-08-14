.PHONY: up down logs test build

up:
./scripts/dev_up.sh

down:
./scripts/dev_down.sh

logs:
docker logs -f flare-md-gateway

test:
docker build -t local/flare-md-gateway:dev .
pytest -q

build:
docker build -t ghcr.io/$$GH_OWNER/flare-md-gateway:latest .
