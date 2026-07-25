#!/usr/bin/env bash
# Shared skill discovery — the one place that defines "a skill is a directory
# under skills/ containing a SKILL.md". Sourced by list-skills.sh and
# link-skills.sh so the find lives in a single seam.

# Print each skill's SKILL.md path relative to the repo root, sorted.
# Usage: skills_md_paths <repo-root>
skills_md_paths() {
  local repo="$1"
  (cd "$repo" && find skills -name SKILL.md -not -path '*/node_modules/*' | sort)
}

# Directories that may sit inside a skill folder for development but must never be
# carried into an installation. Eval fixtures (evals/) are the one such dir today:
# a development artifact, so an installed or linked skill leaves it behind — the
# same exclusion Anthropic's skill-creator applies when it packages a skill
# (package_skill.py's ROOT_EXCLUDE_DIRS). Recognised only at the skill root, never
# when nested deeper, matching that tool.
SKILL_DEV_ARTIFACT_DIRS=(evals)

# Whether <skill-dir> carries any root-level dev-artifact directory, so it cannot
# be linked as one whole-folder symlink without dragging the artifact along.
# Usage: skill_has_dev_artifacts <skill-dir>
skill_has_dev_artifacts() {
  local dir="$1" name
  for name in "${SKILL_DEV_ARTIFACT_DIRS[@]}"; do
    [ -d "$dir/$name" ] && return 0
  done
  return 1
}

# Print the basenames of <skill-dir>'s root entries to install, one per line, with
# the dev-artifact dirs left out. Used when a skill can't be whole-folder symlinked
# because it carries such a dir.
# Usage: skill_install_entries <skill-dir>
skill_install_entries() {
  local dir="$1" path name excl excluded
  # dotglob so a root dotfile (e.g. .npmignore) is carried like every other entry;
  # without it "$dir"/* skips dotfiles and the per-entry link tree would silently
  # drop what a whole-folder symlink keeps. Scoped to the subshell so it can't leak.
  (
    shopt -s dotglob
    for path in "$dir"/*; do
      [ -e "$path" ] || continue
      name="$(basename "$path")"
      excluded=false
      for excl in "${SKILL_DEV_ARTIFACT_DIRS[@]}"; do
        [ "$name" = "$excl" ] && excluded=true && break
      done
      [ "$excluded" = true ] && continue
      printf '%s\n' "$name"
    done
  )
}
