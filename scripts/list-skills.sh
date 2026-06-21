#!/usr/bin/env bash
set -euo pipefail

# Lists every SKILL.md under the repo, relative to the repo root.

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/skills-lib.sh
. "$REPO/scripts/skills-lib.sh"

skills_md_paths "$REPO"
