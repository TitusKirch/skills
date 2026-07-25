#!/usr/bin/env bash
set -euo pipefail

# Removes every symlink under ~/.claude/skills/ that points back into this repo,
# and every per-entry link tree link-skills.sh built for a dev-artifact-carrying
# skill. Real directories and unrelated symlinks are left alone.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills"

if [ ! -d "$DEST" ]; then
  echo "no $DEST — nothing to unlink"
  exit 0
fi

points_into_repo() {
  local resolved
  resolved="$(readlink -f "$1" 2>/dev/null || true)"
  case "$resolved" in
    "$REPO" | "$REPO"/*) return 0 ;;
    *) return 1 ;;
  esac
}

find "$DEST" -mindepth 1 -maxdepth 1 | while IFS= read -r entry; do
  name="$(basename "$entry")"
  if [ -L "$entry" ]; then
    if points_into_repo "$entry"; then
      rm "$entry"
      echo "unlinked $name"
    fi
  elif [ -d "$entry" ]; then
    # A per-entry link tree: drop the symlinks pointing into this repo, then remove
    # the dir if that empties it. A user's own real skill dir holds no such links,
    # so it is never reclaimed; one that still holds real files survives the rmdir.
    removed=false
    while IFS= read -r inner; do
      if points_into_repo "$inner"; then
        rm "$inner"
        removed=true
      fi
    done < <(find "$entry" -mindepth 1 -maxdepth 1 -type l)
    if [ "$removed" = true ] && rmdir "$entry" 2>/dev/null; then
      echo "unlinked $name"
    fi
  fi
done
