#!/bin/bash

# Ensure you're authenticated to GitHub CLI
gh auth status || gh auth login

# Define repo context
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "🔧 Setting default branch to 'main' on $REPO..."
gh api -X PATCH "repos/$REPO" -f default_branch='main'

echo "🧹 Deleting remote 'master' branch on $REPO..."
gh api -X DELETE "repos/$REPO/git/refs/heads/master"

echo "✅ Pruning local references..."
git remote prune origin

echo "🎉 Branch switch complete. 'main' is now the sole branch."
