#!/bin/sh

if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  echo "🔄 Rebase in progress detected, continuing..."

  git rebase --continue

  if [ $? -ne 0 ]; then
    echo "❌ Rebase still has conflicts, resolve them and run script again"
    exit 1
  fi

  echo "⬆️ Pushing rebased dev to origin..."
  git push --force-with-lease origin dev

  if [ $? -ne 0 ]; then
    echo "❌ Push failed"
    exit 1
  fi

  echo "🎉 Done! dev is now up to date with main."
  exit 0
fi

echo "🔍 Checking for changes in main..."
git fetch origin main

LOCAL=$(git rev-parse origin/main)
REMOTE=$(git rev-parse main 2>/dev/null || echo "none")

if git merge-base --is-ancestor origin/main dev; then
  echo "✅ Already up to date with main, nothing to do."
  exit 0
fi

echo "📦 Changes detected in main, rebasing dev..."
git rebase origin/main

if [ $? -ne 0 ]; then
  echo "⚠️ Rebase has conflicts. Resolve them, then run script again."
  exit 1
fi

echo "⬆️ Pushing rebased dev to origin..."
git push --force-with-lease origin dev

if [ $? -ne 0 ]; then
  echo "❌ Push failed"
  exit 1
fi

echo "🎉 Done! dev is now up to date with main."
