#!/bin/bash
set -e

# Stop if git tree is dirty
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Your git working tree is not clean. Commit or stash your changes first."
  exit 1
fi

BUMP=${1:-patch}

echo "Bumping plugin version ($BUMP)..."
# This bumps package.json, and runs version-bump.mjs which updates manifest.json and versions.json
npm version $BUMP --no-git-tag-version

# Extract the new version
VERSION=$(node -e "console.log(require('./package.json').version)")

echo "Staging files..."
git add package.json manifest.json versions.json package-lock.json

echo "Committing release $VERSION..."
git commit -m "Release plugin $VERSION"

echo "Tagging $VERSION..."
git tag "$VERSION"

echo ""
echo "Successfully released plugin $VERSION locally!"
echo "To publish the release via GitHub Actions, run:"
echo "  git push && git push --tags"
