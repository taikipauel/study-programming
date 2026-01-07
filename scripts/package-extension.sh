#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/vscode-extension"
DIST_DIR="$EXT_DIR/dist"
VSIX_PATH="$DIST_DIR/study-programming.vsix"

mkdir -p "$DIST_DIR"

cd "$EXT_DIR"

npm install
npx tsc -p tsconfig.json
npx @vscode/vsce package --out "$VSIX_PATH"

if npx @vscode/vsce verify --help >/dev/null 2>&1; then
  npx @vscode/vsce verify --packagePath "$VSIX_PATH"
else
  echo "Warning: vsce verify is not available in this environment."
fi

echo "VSIX created at: $VSIX_PATH"
