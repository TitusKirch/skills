#!/bin/sh
# Resolve .tituskirch-skills.json: the base config with the selected profile
# deep-merged onto it, and the profiles key removed.
#
# Every skill that reads the config ships a byte-identical copy of this file, so
# they all resolve it the same way. Do not edit a copy: it is overwritten wholesale
# whenever the skills are regenerated. Change it in the skills repo instead.
#
# Usage:  sh resolve-config.sh [path/to/.tituskirch-skills.json]
#
# Selects the profile from TITUSKIRCH_SKILLS_PROFILE, falling back to "ci" when
# CI holds a truthy value. An unset or unknown name yields the base config.
#
# Exit codes:
#   0  resolved config on stdout, or no output because there is no config file
#   2  jq is unavailable — read the file directly and merge by the rules below
#
# The merge is jq's `*`: objects merge recursively at any depth, arrays and
# scalars are replaced rather than concatenated, and an explicit null sets null
# rather than deleting a key. Any fallback path owes the same semantics.
set -e

if [ -n "$1" ]; then
  config="$1"
else
  root=$(git rev-parse --show-toplevel 2>/dev/null) || root=
  [ -n "$root" ] || exit 0
  config="$root/.tituskirch-skills.json"
fi

[ -f "$config" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 2

# CI=false is a non-empty value, so test for truthy words rather than presence.
case "${CI:-}" in
true | 1 | yes) detected=ci ;;
*) detected= ;;
esac
profile="${TITUSKIRCH_SKILLS_PROFILE:-$detected}"

if [ -n "$profile" ] &&
  ! jq -e --arg p "$profile" '(.profiles // {}) | has($p)' "$config" >/dev/null; then
  echo "resolve-config: no profile named '$profile'; using the base config" >&2
fi

jq --arg p "$profile" '
  ((.profiles // {})[$p] // {}) as $overlay
  | (. * $overlay)
  | del(.profiles)
' "$config"
