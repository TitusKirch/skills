#!/usr/bin/env bash
set -euo pipefail

# Symlinks each skill under skills/ into every user-scope skills directory the clients
# this repo publishes for actually read (SKILL_LINK_DESTS in scripts/skills-lib.sh), so
# they discover them as user-scope skills available in every project.
#
# A skill with no dev-artifact dir is linked as one whole-folder symlink. One that
# carries a dev-artifact dir (evals/, see scripts/skills-lib.sh) cannot be — the
# symlink would pull the artifact into the installation — so its root entries are
# linked individually and the artifact is left behind. This mirrors how packaging
# excludes evals/: a linked skill must be as self-contained as a published one. Both
# forms apply per destination: each one gets its own whole-folder link or link tree.

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/skills-lib.sh
. "$REPO/scripts/skills-lib.sh"

# If a destination is itself a symlink that points back into this repo, we'd end up
# writing the per-skill symlinks into the repo's own skills/ tree. Detect and bail out
# instead of polluting the working copy. Every destination is checked before any of
# them is written, so a bad one fails the run outright rather than half-linking.
for dest in "${SKILL_LINK_DESTS[@]}"; do
  [ -L "$dest" ] || continue
  resolved="$(readlink -f "$dest")"
  case "$resolved" in
    "$REPO" | "$REPO"/*)
      echo "error: $dest is a symlink into this repo ($resolved)." >&2
      echo "Remove it (rm \"$dest\") and re-run; the script will recreate it as a real dir." >&2
      exit 1
      ;;
  esac
done

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

# Read the skill list once, then replay it per destination — discovery shells out to
# the generator, and every destination gets the same set. Collected with read rather
# than mapfile, which bash 3.2 (still /bin/bash on macOS) does not have.
skill_mds=()
while IFS= read -r skill_md; do
  skill_mds+=("$skill_md")
done < <(skills_md_paths "$REPO")

for dest in "${SKILL_LINK_DESTS[@]}"; do
  mkdir -p "$dest"
  echo "$dest:"
  for skill_md in "${skill_mds[@]}"; do
    src="$(dirname "$REPO/$skill_md")"
    name="$(basename "$src")"
    link_skill "$src" "$name" "$dest/$name"
  done
done
