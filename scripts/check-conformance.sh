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

# The single sanctioned re-tier, mirrored from skills/meta/validate-skills/REFERENCE.md
# ("The extension matrix"). skills-ref fails the whole skill for any top-level
# frontmatter key outside the standard's six; every key below is one a named client
# defines, so the verdict is kept ("not in the open standard") while the tier becomes
# client-extension (non-portable) rather than spec violation. Without this the gate is
# red on day one on work-implement-queue and work-review-queue, whose `disallowed-tools`
# is deliberate and recorded in ADR-0007.
#
# Each entry is `field=clients`, because *which* clients define a field is part of the
# finding rather than a footnote: `paths` and `disable-model-invocation` are Cursor's as
# well as Claude Code's, so reporting them as Claude-only would state something untrue
# about how portable they are. The skill's matrix is the source and this is the mirror;
# test/conformance-gate.test.ts pins the two key-for-key and client-for-client.
#
# Claude Code's seventeen documented fields minus the three that are also standard
# (`name`, `description`, `allowed-tools` — skills-ref allows all three, so none is ever
# re-tiered) leaves fourteen; Cursor's legacy `globs` is the fifteenth.
CLIENT_EXTENSIONS=(
  'agent=Claude Code'
  'argument-hint=Claude Code'
  'arguments=Claude Code'
  'background=Claude Code'
  'context=Claude Code'
  'disable-model-invocation=Claude Code, Cursor'
  'disallowed-tools=Claude Code'
  'effort=Claude Code'
  'globs=Cursor'
  'hooks=Claude Code'
  'model=Claude Code'
  'paths=Claude Code, Cursor'
  'shell=Claude Code'
  'user-invocable=Claude Code'
  'when_to_use=Claude Code'
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

# Prints the clients that define $1, or fails if it is not a re-tiered extension key.
client_extension_clients() {
  local key="$1" entry
  for entry in "${CLIENT_EXTENSIONS[@]}"; do
    if [ "$key" = "${entry%%=*}" ]; then
      printf '%s' "${entry#*=}"
      return 0
    fi
  done
  return 1
}

# Judge one skill from the lines collected between its ##BEGIN and ##END markers.
judge() {
  local dir="$1" rc="$2"
  local line finding keys tail key clients unknown_joined
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
        if clients="$(client_extension_clients "$key")"; then
          # `clients|key`, split again at print time — the finding is the pair.
          extensions+=("$clients|$key")
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
    printf '          client extension (%s), not portable: %s\n' "${line%%|*}" "${line#*|}"
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
