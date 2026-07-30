#!/usr/bin/env bash
set -euo pipefail

# Removes, from every destination link-skills.sh writes to (SKILL_LINK_DESTS in
# scripts/skills-lib.sh), each symlink that points back into this repo, and every
# per-entry link tree link-skills.sh built for a dev-artifact-carrying skill. Real
# directories and unrelated symlinks are left alone.
#
# It clears every destination unconditionally, because link-skills.sh writes to every
# destination unconditionally — that symmetry is why neither script takes a client
# argument, and why unlink needs no memory of how the link run was invoked.

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/skills-lib.sh
. "$REPO/scripts/skills-lib.sh"

points_into_repo() {
  local resolved
  resolved="$(readlink -f "$1" 2>/dev/null || true)"
  case "$resolved" in
    "$REPO" | "$REPO"/*) return 0 ;;
    *) return 1 ;;
  esac
}

unlink_dest() {
  local dest="$1"
  find "$dest" -mindepth 1 -maxdepth 1 | while IFS= read -r entry; do
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
}

scanned=false
for dest in "${SKILL_LINK_DESTS[@]}"; do
  [ -d "$dest" ] || continue
  scanned=true
  echo "$dest:"
  unlink_dest "$dest"
done

if [ "$scanned" = false ]; then
  echo "no link destination exists (${SKILL_LINK_DESTS[*]}) — nothing to unlink"
fi
