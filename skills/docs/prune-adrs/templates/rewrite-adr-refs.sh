#!/bin/sh
# rewrite-adr-refs.sh — apply a reviewed ADR prune map to a repository, mechanically.
#
# The judgement (which record stays, which merges into another, which moves to a page)
# is made beforehand and written into the map. This script only executes it: it rewrites
# every reference to a removed record across the tracked files, removes the records and
# their index rows, and proves afterwards that no reference to a removed id is left.
# No search is heuristic; the same map always produces the same tree.
#
# Usage:  sh rewrite-adr-refs.sh [--apply | --check] [--diff] MAP
#   (default)  dry run: report what would change, touch nothing
#   --apply    rewrite references, delete removed records and their index rows, then check
#   --check    only report references that still point at a removed id
#   --diff     with a dry run, print a unified diff per changed file
#
# MAP is tab-separated, one record per line, `#` comments and blank lines ignored:
#   <id> <TAB> <action> [<TAB> <target> [<TAB> <label>]]
#   keep | trim | split
#                     the record stays; no reference changes
#   merge  <id>       references move to the surviving record <id>
#   move   <href> <label>
#                     references move to a page: a link target becomes <href>, a bare
#                     `ADR-NNNN` becomes <label>. A relative <href> is a repo path (a docs
#                     page, a skill's DESIGN.md) and is written relative to each linking
#                     file; an absolute <href> (a site path such as `/concepts/x`) is
#                     written as given
#   drop              allowed only for a record nothing else references
#
# Exit: 0 done / clean · 1 references to removed ids remain · 2 invalid usage or map.
# POSIX sh, sed -E and awk only; no GNU-only flags.

set -eu

mode=dry diff=0 map=
for arg in "$@"; do
  case $arg in
  --apply) mode=apply ;;
  --check) mode=check ;;
  --diff) diff=1 ;;
  -*) echo "unknown option: $arg" >&2; exit 2 ;;
  *) [ -z "$map" ] || { echo "one MAP only" >&2; exit 2; }; map=$arg ;;
  esac
done
[ -n "$map" ] || { echo "usage: sh rewrite-adr-refs.sh [--apply|--check] [--diff] MAP" >&2; exit 2; }
[ -f "$map" ] || { echo "map not found: $map" >&2; exit 2; }
case $map in /*) ;; *) map="$(pwd)/$map" ;; esac

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not inside a git repository" >&2; exit 2; }
cd "$top"
log=docs/99.adr
[ -d "$log" ] || { echo "no $log in $top" >&2; exit 2; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

# --- read and validate the map -------------------------------------------------------
# entries: id action target label  (tab-separated, normalized)
awk -F '\t' '
  /^[ \t]*(#|$)/ { next }
  { gsub(/\r$/, ""); printf "%s\t%s\t%s\t%s\n", $1, $2, $3, $4 }
' "$map" > "$work/entries"

bad=0
fail() { echo "map: $*" >&2; bad=1; }
record() { # print the record file for an id, or nothing
  for f in "$log/$1"-*.md; do
    if [ -f "$f" ]; then printf '%s\n' "$f"; return 0; fi
  done
  return 0
}

cut -f1 "$work/entries" | sort | uniq -d > "$work/dupes"
[ -s "$work/dupes" ] && fail "ids listed twice: $(tr '\n' ' ' < "$work/dupes")"

: > "$work/removed"
while IFS="$(printf '\t')" read -r id action target label; do
  case $id in [0-9][0-9][0-9][0-9]) ;; *) fail "not a 4-digit id: '$id'"; continue ;; esac
  if [ "$mode" != check ] && [ -z "$(record "$id")" ]; then fail "$id: no record $log/$id-*.md"; fi
  case $action in
  keep | trim | split) ;;
  merge)
    case $target in [0-9][0-9][0-9][0-9]) ;; *) fail "$id: merge needs a 4-digit target id"; continue ;; esac
    [ "$target" != "$id" ] || fail "$id: merges into itself"
    t_action=$(awk -F '\t' -v t="$target" '$1 == t { print $2 }' "$work/entries")
    case $t_action in '' | keep | trim | split) ;; *) fail "$id: merge target $target is itself $t_action" ;; esac
    [ -n "$(record "$target")" ] || fail "$id: merge target $target has no record"
    printf '%s\n' "$id" >> "$work/removed" ;;
  move)
    [ -n "$target" ] || fail "$id: move needs a target href"
    [ -n "$label" ] || fail "$id: move needs a label"
    case $target in /*) ;; *) [ "$mode" = check ] || [ -f "$target" ] || fail "$id: move target $target does not exist" ;; esac
    printf '%s\n' "$id" >> "$work/removed" ;;
  drop) printf '%s\n' "$id" >> "$work/removed" ;;
  *) fail "$id: unknown action '$action'" ;;
  esac
done < "$work/entries"
[ "$bad" -eq 0 ] || exit 2

if [ ! -s "$work/removed" ]; then
  echo "nothing to remove: every record in the map is kept"
  exit 0
fi
ids=$(paste -sd '|' "$work/removed")

# Files that may still mention a removed id: every tracked text file, except changelogs
# (released history) — the records themselves are removed below, so they are excluded too.
candidates() {
  git grep -l -I -E "ADR-($ids)([^0-9]|\$)|adr/($ids)-|]\\(($ids)-" -- . \
    ':(glob,exclude)**/CHANGELOG*' ':(glob,exclude)CHANGELOG*' 2>/dev/null || true
}
is_removed_record() { # $1 = path; true when it is a removed record or a translation of one
  case $1 in */99.adr/*) ;; *) return 1 ;; esac
  base=${1##*/}
  grep -qx "${base%%-*}" "$work/removed"
}

# --- check -----------------------------------------------------------------------------
check() {
  found=0
  candidates | while IFS= read -r f; do
    is_removed_record "$f" && continue
    grep -n -E "ADR-($ids)([^0-9]|\$)|adr/($ids)-|]\\(($ids)-" "$f" | sed "s|^|$f:|"
  done > "$work/left"
  if [ -s "$work/left" ]; then
    echo "references to removed records remain:"
    cat "$work/left"
    found=1
  fi
  # A survivor that now cites itself — its own Supersedes line rewritten onto its own id.
  awk -F '\t' '$2 == "merge" { print $3 }' "$work/entries" | sort -u | while IFS= read -r m; do
    f=$(record "$m"); [ -n "$f" ] || continue
    grep -n -E "ADR-$m([^0-9]|\$)" "$f" | grep -v -E "^[0-9]+:# ADR-$m " | sed "s|^|$f:|"
  done > "$work/self"
  if [ -s "$work/self" ]; then
    echo "surviving records that now reference themselves:"
    cat "$work/self"
    found=1
  fi
  if [ "$found" -eq 0 ]; then echo "clean: no reference to a removed record remains"; fi
  return "$found"
}

if [ "$mode" = check ]; then
  check && exit 0 || exit 1
fi

# --- build the rewrite -----------------------------------------------------------------
esc() { printf '%s' "$1" | sed 's/[\\&|]/\\&/g'; }
slug_of() { f=$(record "$1"); f=${f##*/}; printf '%s' "${f%.md}"; }

# relpath FROM_DIR TO_PATH — both repo-relative
relpath() {
  awk -v from="$1" -v to="$2" 'BEGIN {
    nf = (from == "." || from == "") ? 0 : split(from, a, "/")
    nt = split(to, b, "/")
    i = 1
    while (i <= nf && i < nt && a[i] == b[i]) i++
    out = ""
    for (j = i; j <= nf; j++) out = out "../"
    for (j = i; j <= nt; j++) out = out b[j] (j < nt ? "/" : "")
    print out
  }'
}

# Expressions that do not depend on where the linking file sits.
: > "$work/fixed.sed"
: > "$work/rel.list" # id <TAB> repo path, for moves whose href is written relative
while IFS="$(printf '\t')" read -r id action target label; do
  case $action in
  merge)
    new=$(esc "$(slug_of "$target")")
    {
      printf 's|(]\\([^)]*adr/)%s-[a-z0-9-]*|\\1%s|g\n' "$id" "$new"
      printf 's|]\\(%s-[a-z0-9-]*|](%s|g\n' "$id" "$new"
      printf 's|ADR-%s([^0-9])|ADR-%s\\1|g\n' "$id" "$target"
      printf 's|ADR-%s$|ADR-%s|\n' "$id" "$target"
    } >> "$work/fixed.sed" ;;
  move)
    case $target in
    /*)
      href=$(esc "$target")
      {
        printf 's|]\\([^)]*adr/%s-[a-z0-9-]*(\\.md)?(#[^)]*)?\\)|](%s)|g\n' "$id" "$href"
        printf 's|]\\(%s-[a-z0-9-]*(\\.md)?(#[^)]*)?\\)|](%s)|g\n' "$id" "$href"
      } >> "$work/fixed.sed" ;;
    *) printf '%s\t%s\n' "$id" "$target" >> "$work/rel.list" ;;
    esac
    lab=$(esc "$label")
    {
      printf 's|ADR-%s([^0-9])|%s\\1|g\n' "$id" "$lab"
      printf 's|ADR-%s$|%s|\n' "$id" "$lab"
    } >> "$work/tokens.sed" ;;
  esac
done < "$work/entries"
touch "$work/tokens.sed"

# Index rows of removed records go before anything is rewritten onto a survivor.
: > "$work/index.sed"
while IFS= read -r id; do printf '/^[|][ ]*\\[ADR-%s]/d\n' "$id" >> "$work/index.sed"; done < "$work/removed"

script_for() { # $1 = file; prints the sed program for that file
  f=$1 dir=$(dirname "$1")
  case ${f##*/} in index.md) case $dir in */99.adr) cat "$work/index.sed" ;; esac ;; esac
  while IFS="$(printf '\t')" read -r id target; do
    href=$(esc "$(relpath "$dir" "$target")")
    printf 's|]\\([^)]*adr/%s-[a-z0-9-]*(\\.md)?(#[^)]*)?\\)|](%s)|g\n' "$id" "$href"
    printf 's|]\\(%s-[a-z0-9-]*(\\.md)?(#[^)]*)?\\)|](%s)|g\n' "$id" "$href"
  done < "$work/rel.list"
  cat "$work/fixed.sed" "$work/tokens.sed"
}

# --- run it ----------------------------------------------------------------------------
changed=0
candidates > "$work/files"
while IFS= read -r f; do
  is_removed_record "$f" && continue
  script_for "$f" > "$work/prog.sed"
  sed -E -f "$work/prog.sed" "$f" > "$work/out"
  cmp -s "$f" "$work/out" && continue
  changed=$((changed + 1))
  if [ "$mode" = apply ]; then
    cat "$work/out" > "$f"
  else
    echo "would change: $f"
    if [ "$diff" -eq 1 ]; then diff -u "$f" "$work/out" || true; fi
  fi
done < "$work/files"

# The records themselves, in every locale tree.
git ls-files -- 'docs/99.adr/*.md' 'docs/*/99.adr/*.md' > "$work/records"
removed_files=0
while IFS= read -r f; do
  is_removed_record "$f" || continue
  removed_files=$((removed_files + 1))
  if [ "$mode" = apply ]; then rm -f "$f"; else echo "would remove: $f"; fi
done < "$work/records"

if [ "$mode" = apply ]; then
  echo "changed $changed files, removed $removed_files records"
  check && exit 0 || exit 1
fi
echo "dry run: would change $changed files, remove $removed_files records — rerun with --apply"
