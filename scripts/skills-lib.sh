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
