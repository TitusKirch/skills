#!/usr/bin/env bash
set -euo pipefail

# Symlinks each skill under skills/ into ~/.claude/skills/, so Claude Code
# discovers them as user-scope skills available in every project.
#
# A skill with no dev-artifact dir is linked as one whole-folder symlink. One that
# carries a dev-artifact dir (evals/, see scripts/skills-lib.sh) cannot be — the
# symlink would pull the artifact into the installation — so its root entries are
# linked individually and the artifact is left behind. This mirrors how packaging
# excludes evals/: a linked skill must be as self-contained as a published one.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills"

# shellcheck source=scripts/skills-lib.sh
. "$REPO/scripts/skills-lib.sh"

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

# A per-entry link tree we built holds only symlinks; a user's own skill dir holds
# real files. That difference is how we tell a tree we may rebuild from a directory
# we must not touch. An empty dir counts as ours.
dir_is_link_tree() {
  local dir="$1" strays
  [ -d "$dir" ] || return 1
  strays="$(find "$dir" -mindepth 1 -maxdepth 1 ! -type l)"
  [ -z "$strays" ]
}

# Link one skill: whole-folder when it has no dev artifacts, else entry by entry so
# the artifact stays behind.
link_skill() {
  local src="$1" name="$2" target="$3" entry

  if ! skill_has_dev_artifacts "$src"; then
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skip $name — $target exists and is not a symlink" >&2
      return
    fi
    ln -sfn "$src" "$target"
    echo "linked $name -> $src"
    return
  fi

  if [ -L "$target" ]; then
    rm -f "$target" # replace a prior whole-folder symlink with the link tree
  elif [ -e "$target" ] && ! dir_is_link_tree "$target"; then
    echo "skip $name — $target exists and is not a link tree we created" >&2
    return
  fi
  mkdir -p "$target"
  while IFS= read -r entry; do
    ln -sfn "$src/$entry" "$target/$entry"
  done < <(skill_install_entries "$src")
  echo "linked $name -> $src (dev artifacts excluded)"
}

while IFS= read -r skill_md; do
  src="$(dirname "$REPO/$skill_md")"
  name="$(basename "$src")"
  link_skill "$src" "$name" "$DEST/$name"
done < <(skills_md_paths "$REPO")
