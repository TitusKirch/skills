#!/usr/bin/env bash
set -euo pipefail

# Runs the Agent Skills conformance check over every skill in this repo — the
# unattended half of the `validate-skills` skill, wired into CI by
# .github/workflows/skills-conformance.yml.
#
# Deliberately NOT part of `pnpm verify`: the local gate stays pnpm-only, so a
# contributor without Docker can still run it. This is its own workflow.
#
# Why Docker rather than actions/setup-python: skills-ref needs Python >= 3.11,
# which this repo otherwise has no use for. Containerising it pins the interpreter
# and the validator together in one place, and makes the check run identically on a
# laptop and on the runner — the same pattern `vhs-demo` already uses for rendering.
#
#   bash scripts/check-conformance.sh   # or: pnpm skills:conformance

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/skills-lib.sh
. "$REPO/scripts/skills-lib.sh"

IMAGE='python:3.12-slim'

# Pinned, because the pin is what the gate asserts: skills-ref's ALLOWED_FIELDS is
# the allowed-frontmatter list, and it moves with the spec. An unpinned validator
# would silently change the verdict under an unrelated pull request.
#
# 0.1.1 is the PyPI build, which installs NO `skills-ref` console script — the GitHub
# main tree does, the released wheel does not. Hence the module invocation below; pin
# and invocation have to move together.
VALIDATOR='skills-ref==0.1.1'
VALIDATOR_MODULE='skills_ref.cli'

# The single sanctioned re-tier, reproduced from skills/meta/validate-skills/REFERENCE.md
# ("The one re-tiered line"). skills-ref fails the whole skill for any top-level
# frontmatter key outside the standard's six; these are Claude Code extensions, so the
# verdict is kept ("not in the open standard") while the tier becomes client-extension
# (non-portable) rather than spec violation. Without this the gate is red on day one on
# work-implement-queue and work-review-queue, whose `disallowed-tools` is deliberate
# and recorded in ADR-0007.
#
# The list is Claude-Code-only and known incomplete — issue #109 is what completes it.
# test/conformance-gate.test.ts pins it to the skill's prose so the two cannot drift.
CLIENT_EXTENSIONS=(
  disallowed-tools
  when_to_use
  disable-model-invocation
  arguments
  model
  context
)

# The container side: install once, then validate every skill directory handed in.
# `##`-prefixed markers frame each skill's output so the host can attribute findings
# without re-running the validator per skill.
CONTAINER_SCRIPT='
set -eu
spec=$1
module=$2
shift 2

if ! pip install --quiet --no-cache-dir --disable-pip-version-check \
  --root-user-action=ignore "$spec" >/tmp/pip.log 2>&1; then
  echo "##INSTALL-FAILED"
  sed "s/^/    /" /tmp/pip.log
  exit 3
fi

# A wheel that installed but cannot be imported fails here rather than as N identical
# validation failures — the shape a swallowed install error would otherwise take.
if ! python -c "import $module" >/tmp/import.log 2>&1; then
  echo "##INSTALL-FAILED"
  sed "s/^/    /" /tmp/import.log
  exit 3
fi

python -c "import importlib.metadata as m; print(\"##VALIDATOR\", m.version(\"skills-ref\"))"

for dir in "$@"; do
  echo "##BEGIN $dir"
  rc=0
  python -m "$module" validate "/repo/$dir" 2>&1 || rc=$?
  echo "##END $dir $rc"
done
'

# --- discovery ---------------------------------------------------------------
# What a skill *is* stays defined once, in gen-skills.ts; this reaches it through
# --paths rather than globbing skills/*/*/ and inventing a second definition.
skill_dirs=()
while IFS= read -r md; do
  [ -n "$md" ] && skill_dirs+=("$(dirname "$md")")
done < <(skills_md_paths "$REPO")

if [ "${#skill_dirs[@]}" -eq 0 ]; then
  echo "conformance: no skills discovered — refusing to report a pass" >&2
  exit 2
fi

# --- run ---------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "conformance: docker is required to run $VALIDATOR (see the header of this script)" >&2
  exit 2
fi

raw="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$raw" "$err"' EXIT

docker_rc=0
docker run --rm -v "$REPO:/repo:ro" -w /tmp "$IMAGE" \
  sh -c "$CONTAINER_SCRIPT" conformance "$VALIDATOR" "$VALIDATOR_MODULE" "${skill_dirs[@]}" \
  >"$raw" 2>"$err" || docker_rc=$?

if grep -q '^##INSTALL-FAILED$' "$raw"; then
  echo "conformance: installing $VALIDATOR failed — the validator never ran" >&2
  sed -n '/^##INSTALL-FAILED$/,$p' "$raw" | tail -n +2 >&2
  exit 2
fi

if ! grep -q '^##VALIDATOR ' "$raw"; then
  echo "conformance: the validator produced no verdict (docker exit $docker_rc)" >&2
  cat "$err" >&2
  exit 2
fi

# --- report ------------------------------------------------------------------
# Every exit path above is a loud failure of the *gate*, never a pass: a check that
# did not run and a check that passed are opposite facts, and only one of them
# licenses merging.

validator_version=''
current=''
buf=()
ok=0
extended=0
failed=0

# Is $1 one of the re-tiered Claude Code extension keys?
is_client_extension() {
  local key="$1" known
  for known in "${CLIENT_EXTENSIONS[@]}"; do
    [ "$key" = "$known" ] && return 0
  done
  return 1
}

# Judge one skill from the lines collected between its ##BEGIN and ##END markers.
judge() {
  local dir="$1" rc="$2"
  local line finding keys tail key unknown_joined
  local -a violations=() extensions=() unknown=()

  if [ "$rc" = 0 ]; then
    printf '  ok    %s\n' "$dir"
    ok=$((ok + 1))
    return
  fi

  for line in "${buf[@]}"; do
    [ -z "${line//[[:space:]]/}" ] && continue
    [[ $line == 'Validation failed for '* ]] && continue

    if [[ $line =~ ^[[:space:]]*-[[:space:]]+(.*)$ ]]; then
      finding="${BASH_REMATCH[1]}"
    else
      # Not the documented bullet shape — a traceback, a usage error. Never dropped:
      # unrecognised output is a failure, not a silence.
      violations+=("$line")
      continue
    fi

    if [[ $finding =~ ^Unexpected\ fields\ in\ frontmatter:\ (.+)\.\ (Only\ .*)$ ]]; then
      keys="${BASH_REMATCH[1]}"
      tail="${BASH_REMATCH[2]}"
      unknown=()
      IFS=',' read -ra split <<<"$keys"
      for key in "${split[@]}"; do
        key="${key//[[:space:]]/}"
        [ -z "$key" ] && continue
        if is_client_extension "$key"; then
          extensions+=("$key")
        else
          unknown+=("$key")
        fi
      done
      if [ "${#unknown[@]}" -gt 0 ]; then
        unknown_joined="$(
          IFS=', '
          echo "${unknown[*]}"
        )"
        violations+=("Unexpected fields in frontmatter: $unknown_joined. $tail")
      fi
    else
      violations+=("$finding")
    fi
  done

  # rc said "invalid" but nothing was attributable — report the raw output rather
  # than let a non-zero exit read as clean.
  if [ "${#violations[@]}" -eq 0 ] && [ "${#extensions[@]}" -eq 0 ]; then
    violations+=("validator exited $rc with no parsable finding: ${buf[*]}")
  fi

  if [ "${#violations[@]}" -gt 0 ]; then
    printf '  FAIL  %s\n' "$dir"
    failed=$((failed + 1))
  else
    printf '  ok    %s\n' "$dir"
    ok=$((ok + 1))
    extended=$((extended + 1))
  fi

  for line in "${extensions[@]}"; do
    printf '          client extension (Claude Code), not portable: %s\n' "$line"
  done
  for line in "${violations[@]}"; do
    printf '          %s\n' "$line"
  done
}

seen=0
while IFS= read -r line; do
  case "$line" in
    '##VALIDATOR '*)
      validator_version="${line#'##VALIDATOR '}"
      printf 'skills-ref %s\n' "$validator_version"
      ;;
    '##BEGIN '*)
      current="${line#'##BEGIN '}"
      buf=()
      ;;
    '##END '*)
      rest="${line#'##END '}"
      judge "${rest% *}" "${rest##* }"
      seen=$((seen + 1))
      current=''
      ;;
    *)
      [ -n "$current" ] && buf+=("$line")
      ;;
  esac
done <"$raw"

echo

if [ "$seen" -ne "${#skill_dirs[@]}" ]; then
  echo "conformance: validated $seen of ${#skill_dirs[@]} skills — the run was cut short" >&2
  cat "$err" >&2
  exit 2
fi

printf '%d conformant (%d carrying a client extension), %d failed\n' \
  "$ok" "$extended" "$failed"

[ "$failed" -eq 0 ] || exit 1
