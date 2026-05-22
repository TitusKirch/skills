#!/usr/bin/env bash
set -euo pipefail

# Symlinks each skill under skills/ into ~/.claude/skills/, so Claude Code
# discovers them as user-scope skills available in every project.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills"

# If ~/.claude/skills is itself a symlink that points back into this repo,
# we'd end up writing the per-skill symlinks into the repo's own skills/ tree.
# Detect and bail out instead of polluting the working copy.
if [ -L "$DEST" ]; then
  resolved="$(readlink -f "$DEST")"
  case "$resolved" in
    "$REPO" | "$REPO"/*)
      echo "error: $DEST is a symlink into this repo ($resolved)." >&2
      echo "Remove it (rm \"$DEST\") and re-run; the script will recreate it as a real dir." >&2
      exit 1
      ;;
  esac
fi

mkdir -p "$DEST"

find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -print0 |
  while IFS= read -r -d '' skill_md; do
    src="$(dirname "$skill_md")"
    name="$(basename "$src")"
    target="$DEST/$name"

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skip $name — $target exists and is not a symlink" >&2
      continue
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src"
  done
