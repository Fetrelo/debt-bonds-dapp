#!/bin/sh
# Copies tracked hooks into .git/hooks (no git config changes).
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.githooks/prepare-commit-msg"
DST="$ROOT/.git/hooks/prepare-commit-msg"

if [ ! -d "$ROOT/.git" ]; then
  echo "error: not a git checkout (missing .git)" >&2
  exit 1
fi
if [ ! -f "$SRC" ]; then
  echo "error: missing $SRC" >&2
  exit 1
fi

cp "$SRC" "$DST"
chmod +x "$DST"
echo "Installed $DST (strips Cursor Co-authored-by lines on commit)"
