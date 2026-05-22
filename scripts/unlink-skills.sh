#!/usr/bin/env bash
set -euo pipefail

# Removes every symlink under ~/.claude/skills/ that points back into this repo.
# Real directories and unrelated symlinks are left alone.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills"

if [ ! -d "$DEST" ]; then
  echo "no $DEST — nothing to unlink"
  exit 0
fi

find "$DEST" -mindepth 1 -maxdepth 1 -type l | while IFS= read -r link; do
  resolved="$(readlink -f "$link" 2>/dev/null || true)"
  case "$resolved" in
    "$REPO" | "$REPO"/*)
      rm "$link"
      echo "unlinked $(basename "$link")"
      ;;
  esac
done
