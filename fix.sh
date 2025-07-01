#!/bin/bash

mkdir -p .portainer .github/workflows

cat > .portainer/Dockerfile <<'EOF'
FROM nginx:stable-alpine
COPY _site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
EOF

cat > .portainer/nginx.conf <<'EOF'
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf|eot|webp)$ {
    expires 30d;
    access_log off;
    add_header Cache-Control "public";
  }
}
EOF

cat > .github/workflows/deploy.yml <<'EOF'
name: Build and Push Effusion Labs Image

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm install

      - name: Build Eleventy Site
        run: npx @11ty/eleventy

      - name: Setup Docker
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Docker Image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:latest .portainer
          docker push ghcr.io/${{ github.repository }}:latest
EOF

echo "✅ All Portainer deployment files created."
echo "✅ Committing and pushing files..."
git branch -M main 
git add .
git commit -m "Add CI deploy pipeline, Dockerfile, and nginx config for Portainer"
git push -u origin main

echo "🎉 Done. Portainer can now pull ghcr.io/$(basename $(git remote get-url origin) .git):latest"
