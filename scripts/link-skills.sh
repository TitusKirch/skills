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

# Ownership is proven, never assumed from a name. A whole-folder link is ours when it
# resolves to exactly this skill's folder; a per-entry link tree is ours when every
# entry in it is a symlink resolving into exactly this skill's folder. Anything else at
# the target — a user's own skill, another clone's link, a mixed tree — is somebody
# else's install, and replacing it would make the client load a different skill.
resolves_to() { # <link> <dir>: the link resolves to <dir> or into it
  local resolved
  resolved="$(readlink -f "$1" 2>/dev/null || true)"
  case "$resolved" in "$2" | "$2"/*) return 0 ;; *) return 1 ;; esac
}
is_our_tree() { # <dir> <src>: only symlinks, all into <src>; an empty dir counts as ours
  local dir="$1" src="$2" entry
  [ -d "$dir" ] && [ ! -L "$dir" ] || return 1
  while IFS= read -r entry; do
    [ -L "$entry" ] && resolves_to "$entry" "$src" || return 1
  done < <(find "$dir" -mindepth 1 -maxdepth 1)
  return 0
}
target_is_free_or_ours() { # <target> <src>
  local target="$1" src="$2"
  [ -e "$target" ] || [ -L "$target" ] || return 0      # nothing there yet
  if [ -L "$target" ]; then resolves_to "$target" "$src"; return; fi
  is_our_tree "$target" "$src"
}

# Link one skill: whole-folder when it has no dev artifacts, else entry by entry so
# the artifact stays behind. Only called once the preflight proved the target ours.
link_skill() {
  local src="$1" name="$2" target="$3" entry

  if ! skill_has_dev_artifacts "$src"; then
    [ -d "$target" ] && [ ! -L "$target" ] && rm -r -- "$target" # our tree, now a whole link
    ln -sfn "$src" "$target"
    echo "linked $name -> $src"
    return
  fi

  [ -L "$target" ] && rm -f "$target" # our whole-folder link, replaced by the link tree
  mkdir -p "$target"
  # Drop our own entries the source no longer has, then (re)link every current one.
  while IFS= read -r entry; do
    [ -e "$src/$(basename "$entry")" ] || rm -f "$entry"
  done < <(find "$target" -mindepth 1 -maxdepth 1 -type l)
  while IFS= read -r entry; do
    ln -sfn "$src/$entry" "$target/$entry"
  done < <(skill_install_entries "$src")
  echo "linked $name -> $src (dev artifacts excluded)"
}

# Read the skill list once, and only from a discovery that succeeded: a failing
# generator must stop the run before any destination is created, not leave two empty
# directories behind an exit 0. Collected with read rather than mapfile, which bash 3.2
# (still /bin/bash on macOS) does not have.
listing="$(skills_md_paths "$REPO")" || { echo "error: skill discovery failed — nothing linked" >&2; exit 1; }
[ -n "$listing" ] || { echo "error: skill discovery found no skills — nothing linked" >&2; exit 1; }
skill_mds=()
while IFS= read -r skill_md; do
  [ -n "$skill_md" ] && skill_mds+=("$skill_md")
done <<<"$listing"

# Preflight every destination before writing to any: one conflict anywhere leaves both
# installations exactly as they were.
conflicts=()
for dest in "${SKILL_LINK_DESTS[@]}"; do
  for skill_md in "${skill_mds[@]}"; do
    src="$(dirname "$REPO/$skill_md")"
    target="$dest/$(basename "$src")"
    target_is_free_or_ours "$target" "$src" || conflicts+=("$target (wanted -> $src, has -> $(readlink -f "$target" 2>/dev/null || echo "$target"))")
  done
done
if [ "${#conflicts[@]}" -gt 0 ]; then
  echo "error: these targets hold another install of the same name; nothing was linked:" >&2
  printf '  %s\n' "${conflicts[@]}" >&2
  echo "Remove or rename them (or run skills:unlink from the checkout that owns them), then re-run." >&2
  exit 1
fi

for dest in "${SKILL_LINK_DESTS[@]}"; do
  mkdir -p "$dest"
  echo "$dest:"
  for skill_md in "${skill_mds[@]}"; do
    src="$(dirname "$REPO/$skill_md")"
    name="$(basename "$src")"
    link_skill "$src" "$name" "$dest/$name"
  done
done
