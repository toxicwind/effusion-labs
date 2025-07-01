# 1. Confirm the dotfolders aren't ignored
grep -E '^(\.portainer|\.github)' .gitignore || echo "✅ Not ignored by .gitignore"

# 2. Explicitly add key files to staging
git add .portainer/Dockerfile .portainer/nginx.conf
git add .github/workflows/deploy.yml

# 3. Confirm they're staged
git status

# 4. Commit with explicit message
git commit -m "Add CI and container config folders (.github, .portainer)"

# 5. Push to main
git push origin main
