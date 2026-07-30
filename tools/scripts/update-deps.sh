#!/bin/sh

# Packages with `ng-update` migrations must be updated via `ng update` so their
# migration schematics run; pnpm is not allowed to bump them directly.

echo "🔍 Checking for outdated packages..."
pnpm -r outdated
OUTDATED=$?

if [ $OUTDATED -eq 0 ]; then
  echo "✅ Everything is up to date, nothing to do."
  exit 0
fi

if [ $OUTDATED -ne 1 ]; then
  echo "❌ Failed to check for updates"
  exit 1
fi

printf "🚀 Updates available. Update now? [y/N] "
read -r ANSWER

case "$ANSWER" in
  y | Y | yes | YES) ;;
  *)
    echo "🛑 Update cancelled."
    exit 0
    ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working tree is not clean, commit or stash before updating."
  exit 1
fi

# Every migration-bearing package goes in a single `ng update` call: it runs one
# clean-tree check and updates them atomically. Chaining several `ng update`
# calls would fail, since the first dirties the tree and the next one refuses.
# It runs inside apps/web because that is the workspace package owning the
# Angular CLI and the angular.json it needs.
echo "🅰️ Updating Angular and ngrx (with migrations)..."
pnpm --filter @chesspecker/web exec ng update @angular/cli @angular/core @ngrx/signals

if [ $? -ne 0 ]; then
  echo "❌ Migration-based update failed"
  exit 1
fi

echo "📦 Updating remaining packages across the workspace..."
pnpm -r up --latest '!@angular/*' '!@ngrx/*'

if [ $? -ne 0 ]; then
  echo "❌ General update failed"
  exit 1
fi

# angular-eslint lives at the root (the shared eslint.config.mjs imports it), so
# it is out of `ng update`'s reach and gets bumped by pnpm above. Its migrations
# only matter on a major bump — run them by hand when that happens.
echo "⚠️  angular-eslint was bumped by pnpm, without its ng-update schematics."
echo "    On a major bump, review https://github.com/angular-eslint/angular-eslint releases."

echo "🎉 Done! Review the diff before committing."
