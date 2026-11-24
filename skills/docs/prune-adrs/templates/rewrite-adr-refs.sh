#!/bin/sh
# rewrite-adr-refs.sh — apply a reviewed ADR prune map to a repository, mechanically.
#
# The judgement (which record stays, which merges into another, which moves to a page)
# is made beforehand and written into the map. This script only executes it: it rewrites
# every reference to a removed record across the repo's text files, removes the records and
# their index rows, writes the batch into the migration protocol, and proves afterwards that
# every link into the log resolves. No search is heuristic: a link is resolved against the
# file it sits in, and only a link that lands on a record of this log is ever rewritten.
#
# Usage:  sh rewrite-adr-refs.sh [MODE] [OPTIONS] MAP
#         sh rewrite-adr-refs.sh --renumber [--apply] [--diff] [OPTIONS]
# Modes:
#   (default)   dry run: report what would change, touch nothing
#   --apply     rewrite references, delete removed records and their index rows, append the
#               batch to the migration protocol, then check
#   --check     report every reference to a removed id, every link into the log that does
#               not resolve (record, slug, locale or #anchor), a removed record still present
#               and a survivor that now cites itself
#   --cites     list every line citing a trimmed or split record, for a human to read: the
#               id still resolves, but the sentence a citation leans on may have left
#   --reworded  report every sentence a trim, split, merge or relative move added that is not
#               a deletion from committed text (--base, default HEAD). Exempt: a pointer
#               line (Supersedes / Partly supersedes / superseded by) and, on a page the
#               batch created, its headings and the paragraph under its H1. A sentence that
#               carries a link (the pointer a trim leaves) and a deletion that lost a
#               negation are not refused but listed, for the reviewer to read
#   --renumber  close the gaps: renumber every record of the log 1..N in order, rename the
#               files in every locale tree and rewrite every reference repo-wide in one pass
# Options:
#   --diff             with a dry run, print a unified diff per changed file
#   --base=REV         --reworded compares against REV; it must resolve
#   --log=DIR          the log directory (default docs/99.adr); DIR's siblings' DIR-named
#                      children are its locale trees (docs/<locale>/99.adr)
#   --width=N          digits per id (default: read from the log's file names, else 4)
#   --route=PATH       the site route the log renders under (default /adr/)
#   --repo-url=PREFIX  an absolute URL prefix that maps to the repo root (repeatable). The
#                      origin remote's GitHub/GitLab blob/tree/raw URLs are recognised anyway
#   --site-url=ORIGIN  an absolute URL origin that maps to the site root (repeatable)
#   --batch=NAME       the protocol's batch name (default: the map's file name)
#   --fragments=drop   let a move collapse links with a #fragment onto the page top
#
# MAP is tab-separated, one record per line, `#` comments and blank lines ignored:
#   <id> <TAB> <action> [<TAB> <target> [<TAB> <label>]]
#   keep | trim       the record stays; no reference changes
#   split [<ids>]     the record stays; <ids> (comma-separated) are the records split off it,
#                     which --reworded checks against the record's committed text
#   merge  <id>       references move to the surviving record <id>
#   move   <href> <label>
#                     references move to a page: a link becomes <href>, a bare `ADR-NNNN`
#                     becomes <label>. A relative <href> is a repo path (a docs page, a skill's
#                     DESIGN.md), written relative to each linking file; an absolute one (a
#                     site path such as `/concepts/x`) is written as given
#   drop              allowed only for a record nothing references; refused before any write
#
# The protocol is <log>/migration.tsv: every applied map row and every renumbering, with the
# batch and the commit it was applied to. It is never scanned or rewritten, and it is deleted
# by hand, in its own commit, once every reviewer has signed the migration off.
#
# Exit: 0 done / clean · 1 a finding: references or dead links remain, a sentence was
# reworded, or an apply was refused before writing · 2 invalid usage, map or failed scan.
# POSIX sh, sed and awk only; no GNU-only flags. Runs under LC_ALL=C.

set -eu
LC_ALL=C
export LC_ALL

mode=dry diff=0 map= base=HEAD log=docs/99.adr width= route=/adr/ batch= fragments=keep
nl='
'
user_repo_urls= site_urls=
for arg in "$@"; do
  case $arg in
  --apply) [ "$mode" = renumber ] && mode=renumber-apply || mode=apply ;;
  --check) mode=check ;;
  --cites) mode=cites ;;
  --reworded) mode=reworded ;;
  --renumber) [ "$mode" = apply ] && mode=renumber-apply || mode=renumber ;;
  --diff) diff=1 ;;
  --base=?*) base=${arg#--base=} ;;
  --log=?*) log=${arg#--log=}; log=${log%/} ;;
  --width=?*) width=${arg#--width=} ;;
  --route=?*) route=${arg#--route=} ;;
  --repo-url=?*) user_repo_urls="$user_repo_urls${arg#--repo-url=}$nl" ;;
  --site-url=?*) site_urls="$site_urls${arg#--site-url=}$nl" ;;
  --batch=?*) batch=${arg#--batch=} ;;
  --fragments=drop) fragments=drop ;;
  -*) echo "unknown option: $arg" >&2; exit 2 ;;
  *) [ -z "$map" ] || { echo "one MAP only" >&2; exit 2; }; map=$arg ;;
  esac
done
case $mode in
renumber | renumber-apply) [ -z "$map" ] || { echo "--renumber takes no MAP" >&2; exit 2; } ;;
*)
  [ -n "$map" ] || { echo "usage: sh rewrite-adr-refs.sh [--apply|--check|--cites|--reworded|--renumber] [options] MAP" >&2; exit 2; }
  [ -f "$map" ] || { echo "map not found: $map" >&2; exit 2; }
  case $map in /*) ;; *) map="$(pwd)/$map" ;; esac
  if [ -z "$batch" ]; then batch=${map##*/}; batch=${batch%.*}; fi ;;
esac
case $route in /*/) ;; *) echo "--route must start and end with /: $route" >&2; exit 2 ;; esac

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not inside a git repository" >&2; exit 2; }
cd "$top"
[ -d "$log" ] || { echo "no $log in $top" >&2; exit 2; }
logbase=${log##*/}
case $log in */*) logparent=${log%/*}; lp="$logparent/" ;; *) logparent=.; lp= ;; esac
protocol="$log/migration.tsv"

if [ -z "$width" ]; then
  width=4
  for f in "$log"/[0-9]*-*.md; do
    [ -f "$f" ] || continue
    n=${f##*/}; n=${n%%-*}; width=${#n}; break
  done
fi
case $width in '' | *[!0-9]*) echo "--width must be a number" >&2; exit 2 ;; esac

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

ere_escape() { printf '%s' "$1" | sed 's/[].[\\*^$+?(){}|/]/\\&/g'; }

# URL prefixes the engine resolves: repo-root prefixes (R) and site origins (S).
: > "$work/urls"
remote=$(git remote get-url origin 2>/dev/null || true)
case $remote in
git@*:*) host=${remote#git@}; path=${host#*:}; host=${host%%:*} ;;
https://* | http://*) host=${remote#*://}; host=${host#*@}; path=${host#*/}; host=${host%%/*} ;;
*) host= path= ;;
esac
if [ -n "$host" ]; then
  path=${path%.git}
  printf 'R\thttps?://%s/%s/(-/)?(blob|tree|raw)/[^/]+/\n' "$(ere_escape "$host")" "$(ere_escape "$path")" >> "$work/urls"
fi
printf '%s' "$user_repo_urls" | while IFS= read -r u; do
  [ -n "$u" ] && printf 'R\t%s\n' "$(ere_escape "${u%/}/")"
done >> "$work/urls"
printf '%s' "$site_urls" | while IFS= read -r u; do
  [ -n "$u" ] && printf 'S\t%s\n' "$(ere_escape "${u%/}")"
done >> "$work/urls"

# --- tables: every record in every locale tree, and the anchors each one defines ---------
tables() {
  {
    for f in "$log"/*.md; do [ -f "$f" ] && printf '%s\n' "$f"; done
    for f in "$lp"*/"$logbase"/*.md; do [ -f "$f" ] && printf '%s\n' "$f"; done
  } | awk -v W="$width" -v LOG="$log" '
    { n = split($0, p, "/"); b = p[n]; d = substr($0, 1, length($0) - length(b) - 1)
      if (b !~ /^[0-9]+-.+\.md$/) next
      id = substr(b, 1, index(b, "-") - 1); if (length(id) != W) next
      slug = substr(b, length(id) + 2); slug = substr(slug, 1, length(slug) - 3)
      loc = ""; if (d != LOG) { loc = d; sub(/\/[^\/]*$/, "", loc); sub(/^.*\//, "", loc) }
      printf "%s\t%s\t%s\t%s\n", $0, id, slug, loc }
  ' > "$work/records"
  cut -f1 "$work/records" > "$work/record-paths"
  : > "$work/anchors"
  if [ -s "$work/record-paths" ]; then
    # GitHub-style heading slugs (ASCII punctuation dropped, other bytes kept), explicit
    # {#id} heading attributes and id="…" anchors. A renderer with other rules needs its build.
    while IFS= read -r f; do
      awk -v F="$f" '
        /^(```|~~~)/ { fence = !fence; next }
        fence { next }
        /^#+[ \t]/ {
          h = $0; sub(/^#+[ \t]+/, "", h); sub(/[ \t]+#+[ \t]*$/, "", h)
          if (match(h, /\{#[^}]+\}[ \t]*$/)) { a = substr(h, RSTART + 2); sub(/\}[ \t]*$/, "", a); print F "\t" a; next }
          h = tolower(h); gsub(/[!-,.\/:-@[-^`{-~]/, "", h); gsub(/[ \t]/, "-", h)
          if (seen[h]++) h = h "-" (seen[h] - 1)
          print F "\t" h
        }
        { s = $0; while (match(s, /id="[^"]+"/)) { print F "\t" substr(s, RSTART + 4, RLENGTH - 5); s = substr(s, RSTART + RLENGTH) } }
      ' "$f" >> "$work/anchors"
    done < "$work/record-paths"
  fi
}
rec_of() { awk -F '\t' -v i="$1" '$2 == i && $4 == "" { print $1; exit }' "$work/records"; }
slug_of() { awk -F '\t' -v i="$1" '$2 == i && $4 == "" { print $3; exit }' "$work/records"; }
isid() { case $1 in *[!0-9]*) return 1 ;; esac; [ ${#1} -eq "$width" ]; }

# --- scan: the files that may reference the log, NUL-safe, a failed search is fatal -----
# Every text file git does not ignore — tracked, and untracked too, since the pages a batch
# writes are new when the script runs — except changelogs (released history) and the
# protocol (it names the old ids on purpose).
scan() { # $1 = ERE prefilter
  set +e
  git grep --untracked -z -l -I -E "$1" -- . \
    ':(glob,exclude)**/CHANGELOG*' ':(glob,exclude)CHANGELOG*' ":(exclude)$protocol" \
    > "$work/files.z" 2> "$work/grep.err"
  rc=$?
  set -e
  if [ "$rc" -gt 1 ]; then echo "search failed:" >&2; cat "$work/grep.err" >&2; exit 2; fi
  if [ -n "$(tr -cd '\n\t' < "$work/files.z")" ]; then
    echo "a file name holds a newline or a tab; rename it first:" >&2
    tr '\000' '\n' < "$work/files.z" | grep -n "$(printf '\t')" >&2 || true
    exit 2
  fi
  tr '\000' '\n' < "$work/files.z" > "$work/files"
}
# A path written as text — in code, a comment, backticks — when it names the log or its route.
bracket() { printf '%s' "$1" | sed 's/[.+*?(){}|$]/[&]/g'; }
barepath="[A-Za-z0-9_.~/:@%+-]*($(bracket "$route")|$(bracket "$logbase")/)[0-9]+-[A-Za-z0-9_.-]*(#[A-Za-z0-9_-]+)?"
any_ref="ADR-[0-9]{$width}([^0-9]|\$)|(^|[^A-Za-z0-9])[0-9]{$width}-[A-Za-z]"

# --- the engine: resolve every link and token, then rewrite, check or list --------------
cat > "$work/engine.awk" <<'AWK'
function lastslash(s,   i) { for (i = length(s); i > 0; i--) if (substr(s, i, 1) == "/") return i; return 0 }
function isid(s) { return length(s) == W && s ~ /^[0-9]+$/ }
function normalize(p,   n, a, i, k, st, out) {
  n = split(p, a, "/"); k = 0
  for (i = 1; i <= n; i++) {
    if (a[i] == "" || a[i] == ".") continue
    if (a[i] == "..") { if (k > 0 && st[k] != "..") k--; else st[++k] = ".."; continue }
    st[++k] = a[i]
  }
  out = ""; for (i = 1; i <= k; i++) out = out (i > 1 ? "/" : "") st[i]
  return out
}
function relpath(from, to,   nf, nt, a, b, i, j, out) {
  nf = (from == "." || from == "") ? 0 : split(from, a, "/"); nt = split(to, b, "/")
  i = 1; while (i <= nf && i < nt && a[i] == b[i]) i++
  out = ""; for (j = i; j <= nf; j++) out = out "../"
  for (j = i; j <= nt; j++) out = out b[j] (j < nt ? "/" : "")
  return out
}
function loglocale(d,   pre, rest) { # locale of a log dir: "" default, SUBSEP when d is no log dir
  if (d == LOG) return ""
  pre = (LOGPARENT == "." ? "" : LOGPARENT "/")
  if (substr(d, 1, length(pre)) != pre) return SUBSEP
  rest = substr(d, length(pre) + 1)
  if (index(rest, "/") && substr(rest, index(rest, "/") + 1) == LOGBASE && substr(rest, 1, index(rest, "/") - 1) !~ /\//) return substr(rest, 1, index(rest, "/") - 1)
  return SUBSEP
}
function seg(b) { # an id-slug segment: sets CI, CS, SUF
  SUF = ""
  if (b ~ /\.md$/) { SUF = ".md"; b = substr(b, 1, length(b) - 3) }
  if (b !~ /^[0-9]+-[^\/]+$/) return 0
  CI = substr(b, 1, index(b, "-") - 1); if (!isid(CI)) return 0
  CS = substr(b, length(CI) + 2); return 1
}
function resolve_repo(p,   n, d, b, loc) {
  p = normalize(p); n = lastslash(p)
  d = n ? substr(p, 1, n - 1) : "."; b = n ? substr(p, n + 1) : p
  loc = loglocale(d); if (loc == SUBSEP || !seg(b)) return "none"
  CL = loc; CP = d "/" CI "-" CS ".md"; return "rec"
}
function resolve_route(r,   loc, rest) {
  loc = ""
  if (substr(r, 1, length(ROUTE)) != ROUTE) {
    if (!match(r, /^\/[A-Za-z][A-Za-z](-[A-Za-z0-9]+)?\//)) return "none"
    loc = substr(r, 2, RLENGTH - 2); r = substr(r, RLENGTH)
    if (substr(r, 1, length(ROUTE)) != ROUTE) return "none"
  }
  rest = substr(r, length(ROUTE) + 1)
  if (index(rest, "/") || !seg(rest)) return "none"
  CL = loc; CP = ""; return "route"
}
function classify(path,   i, r) {
  if (BARE) { r = classify_(path); if (r == "none" && substr(path, 1, 1) != "/" && path !~ /^[A-Za-z][A-Za-z0-9+.-]*:/) r = resolve_repo(path); return r }
  return classify_(path)
}
function classify_(path,   i, r) {
  if (path ~ /^[A-Za-z][A-Za-z0-9+.-]*:/) {
    for (i = 1; i <= NR_; i++) if (match(path, "^(" RU[i] ")")) return resolve_repo(substr(path, RLENGTH + 1))
    for (i = 1; i <= NS_; i++) if (match(path, "^(" SU[i] ")")) {
      r = substr(path, RLENGTH + 1); if (substr(r, 1, 1) != "/") r = "/" r
      return resolve_route(r)
    }
    if (match(path, /adr\/[0-9]+-/)) { CI = substr(path, RSTART + 4, RLENGTH - 5); if (isid(CI)) return "url" }
    return "none"
  }
  if (substr(path, 1, 1) == "/") { r = resolve_route(path); if (r != "none") return r; return resolve_repo(substr(path, 2)) }
  return resolve_repo(DIR == "." ? path : DIR "/" path)
}
function wanted(id) { return MODE == "check" ? (id in REMOVED) : MODE == "cites" ? (id in KEPT) : (id in REWRITE) }
function ev(kind, id) { printf "%s\t%s\t%s\t%d\t%s\n", kind, id, FILE, LN, LINE > EVENTS }
function cite(id) { if (id != FREC) ev("cite", id) }
function checklink(k, frag,   key, a) {
  if (CI in REMOVED) { ev("remains", CI); return }
  # Outside a document, or written as a bare path, a link may be an example or a fixture: only
  # a removed id is a finding there. A document's links must resolve.
  if (BARE || !DOC) return
  key = CL SUBSEP CI
  if (!(key in REC) || (k == "rec" && REC[key] != CP) || (k == "route" && RSLUG[key] != CS)) { ev("deadfile", CI); return }
  if (length(frag) > 1) { a = substr(frag, 2); if (!((REC[key] SUBSEP a) in ANCH)) ev("deadanchor", CI) }
}
function handle(h,   frag, path, p, qs, ts, k, pre) {
  frag = ""; qs = ""; ts = ""
  p = index(h, "#"); if (p) { frag = substr(h, p); path = substr(h, 1, p - 1) } else path = h
  p = index(path, "?"); if (p) { qs = substr(path, p); path = substr(path, 1, p - 1) }
  if (path ~ /.\/$/) { ts = "/"; path = substr(path, 1, length(path) - 1) }
  if (path == "") return h
  k = classify(path)
  if (k == "none") return h
  if (k == "url") { if (wanted(CI)) ev("url", CI); return h }
  if (MODE == "cites") { if (CI in KEPT) cite(CI); return h }
  if (MODE == "check") { checklink(k, frag); return h }
  if (!(CI in REWRITE)) return h
  if (ACT[CI] == "drop") { ev("dropref", CI); return h }
  if (ACT[CI] == "move") {
    if (length(frag) > 1) ev("fragment", CI)
    return substr(TGT[CI], 1, 1) == "/" ? TGT[CI] : relpath(DIR, TGT[CI])
  }
  pre = substr(path, 1, lastslash(path))
  return pre NEW[CI] "-" (NSLUG[CI] != "" ? NSLUG[CI] : CS) SUF ts qs frag
}
function hold(x) { PH[++NP] = x; return "\034" NP "\035" }
function restore(s,   out, n) {
  out = ""
  while (match(s, /\034[0-9]+\035/)) { n = substr(s, RSTART + 1, RLENGTH - 2); out = out substr(s, 1, RSTART - 1) PH[n]; s = substr(s, RSTART + RLENGTH) }
  return out s
}
function links(s, re, skip,   out, m, lead, h) { # replace each href the regex finds
  out = ""
  while (match(s, re)) {
    m = substr(s, RSTART, RLENGTH); out = out substr(s, 1, RSTART - 1); s = substr(s, RSTART + RLENGTH)
    lead = substr(m, 1, skip); h = substr(m, skip + 1)
    if (substr(h, 1, 1) == "<" && skip == 2) { lead = lead "<"; h = substr(h, 2) }
    out = out lead hold(handle(h))
  }
  return out s
}
function wiki(s,   m, id) { # [[…]] cannot be resolved: only reported
  while (match(s, /\[\[[^]]*\]\]/)) {
    m = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
    if (match(m, /[0-9]+-/)) { id = substr(m, RSTART, RLENGTH - 1); if (isid(id) && wanted(id)) { if (MODE == "cites") cite(id); else ev("unsupported", id) } }
  }
}
function tokens(s,   out, m, id) {
  out = ""
  while (match(s, /ADR-[0-9]+/)) {
    m = substr(s, RSTART, RLENGTH); out = out substr(s, 1, RSTART - 1); s = substr(s, RSTART + RLENGTH)
    id = substr(m, 5)
    if (isid(id) && wanted(id)) {
      if (MODE == "cites") cite(id)
      else if (MODE == "check") ev("remains", id)
      else if (ACT[id] == "drop") ev("dropref", id)
      else if (ACT[id] == "move") m = LABEL[id]
      else m = "ADR-" NEW[id]
    }
    out = out m
  }
  return out s
}
function process(line,   s, pre, rest, lead, h) {
  NP = 0; s = line
  wiki(s)
  if (match(s, /^ ? ? ?\[[^]]+\]:[ \t]*/)) { # a reference definition
    pre = substr(s, 1, RLENGTH); rest = substr(s, RLENGTH + 1)
    if (match(rest, /^<?[^ \t>]+/)) {
      h = substr(rest, 1, RLENGTH); lead = ""
      if (substr(h, 1, 1) == "<") { lead = "<"; h = substr(h, 2) }
      s = pre lead hold(handle(h)) substr(rest, RLENGTH + 1)
    }
  }
  s = links(s, "\\]\\(<?[^)> \t]+", 2)
  s = links(s, "href=\"[^\"]+", 6)
  s = links(s, "<[A-Za-z][A-Za-z0-9+.-]*:[^> \t]+", 1)
  BARE = 1; s = links(s, BAREPATH, 0); BARE = 0
  return restore(tokens(s))
}
function delrow(line,   id) { # an index row of a removed record
  if (!ISINDEX || !match(line, /^\|[ \t]*\[ADR-[0-9]+\]/)) return 0
  id = substr(line, RSTART, RLENGTH); sub(/^.*ADR-/, "", id); sub(/\]$/, "", id)
  return (id in REMOVED)
}
BEGIN {
  FS = "\t"
  while ((getline l < RECORDS) > 0) { split(l, a, "\t"); REC[a[4] SUBSEP a[2]] = a[1]; RSLUG[a[4] SUBSEP a[2]] = a[3] }
  while ((getline l < ANCHORS) > 0) { split(l, a, "\t"); ANCH[a[1] SUBSEP a[2]] = 1 }
  while ((getline l < IDMAP) > 0) {
    split(l, a, "\t"); ACT[a[1]] = a[2]; NEW[a[1]] = a[3]; NSLUG[a[1]] = a[4]; TGT[a[1]] = a[5]; LABEL[a[1]] = a[6]
    if (a[2] == "merge" || a[2] == "move" || a[2] == "drop") REMOVED[a[1]] = 1
    if ((a[1] in REMOVED) || a[2] == "renumber") REWRITE[a[1]] = 1
    if (a[2] == "trim" || a[2] == "split") KEPT[a[1]] = 1
  }
  while ((getline l < URLS) > 0) { split(l, a, "\t"); if (a[1] == "R") RU[++NR_] = a[2]; else SU[++NS_] = a[2] }
  while ((getline f < FILES) > 0) {
    FILE = f; n = lastslash(f); DIR = n ? substr(f, 1, n - 1) : "."; b = n ? substr(f, n + 1) : f
    FREC = ""; if (loglocale(DIR) != SUBSEP && seg(b)) FREC = CI
    if (FREC in REMOVED) continue
    ISINDEX = (b == "index.md" && loglocale(DIR) != SUBSEP)
    DOC = (tolower(b) ~ /\.(md|mdx|markdown|html?|rst|adoc)$/)
    LN = 0; CH = 0; buf = ""; first = 1
    while ((getline LINE < f) > 0) {
      LN++
      if (MODE == "rewrite" && delrow(LINE)) { CH = 1; continue }
      nl = process(LINE)
      if (nl != LINE) CH = 1
      if (MODE == "rewrite") { buf = buf (first ? "" : "\n") nl; first = 0 }
    }
    close(f)
    if (MODE == "rewrite" && CH) { o = OUT "/" (++NO); printf "%s", buf > o; close(o); print NO "\t" f > MANIFEST }
  }
  close(EVENTS); close(MANIFEST)
}
AWK

engine() { # $1 = rewrite | check | cites; reads $work/files and $work/idmap
  : > "$work/events"; : > "$work/manifest"; rm -rf "$work/out"; mkdir "$work/out"
  awk -v MODE="$1" -v W="$width" -v LOG="$log" -v LOGPARENT="$logparent" -v LOGBASE="$logbase" \
    -v ROUTE="$route" -v RECORDS="$work/records" -v ANCHORS="$work/anchors" -v IDMAP="$work/idmap" \
    -v URLS="$work/urls" -v FILES="$work/files" -v OUT="$work/out" -v MANIFEST="$work/manifest" \
    -v EVENTS="$work/events" -v BAREPATH="$barepath" -f "$work/engine.awk"
}
report() { # $1 = kind, $2 = heading; prints path:line:text once per line, in scan order
  awk -F '\t' -v k="$1" '$1 == k && !seen[$3 FS $4]++ { t = $5; for (i = 6; i <= NF; i++) t = t FS $i; print $3 ":" $4 ":" t }' \
    "$work/events" > "$work/rep"
  [ -s "$work/rep" ] || return 1
  echo "$2"; cat "$work/rep"
  return 0
}

# --- read and validate the map -------------------------------------------------------
bad=0
fail() { echo "map: $*" >&2; bad=1; }
tables
: > "$work/entries"; : > "$work/idmap"
case $mode in renumber | renumber-apply) ;; *)
  awk -F '\t' '/^[ \t]*(#|$)/ { next } { gsub(/\r$/, ""); printf "%s\t%s\t%s\t%s\n", $1, $2, $3, $4 }' "$map" > "$work/entries"
  cut -f1 "$work/entries" | sort | uniq -d > "$work/dupes"
  [ -s "$work/dupes" ] && fail "ids listed twice: $(tr '\n' ' ' < "$work/dupes")"
  git ls-tree --name-only HEAD -- "$log/" 2>/dev/null > "$work/head-records" || : > "$work/head-records"
  while IFS="$(printf '\t')" read -r id action target label; do
    isid "$id" || { fail "not a $width-digit id: '$id'"; continue; }
    now=$(rec_of "$id")
    case $action in
    keep | trim | split)
      [ -n "$now" ] || fail "$id: no record $log/$id-*.md"
      if [ "$action" = split ] && [ -n "$target" ]; then
        for s in $(printf '%s' "$target" | tr ',' ' '); do
          isid "$s" || { fail "$id: split-off id '$s' is not $width digits"; continue; }
          [ -n "$(rec_of "$s")" ] || fail "$id: split-off record $s does not exist"
        done
      fi ;;
    merge)
      isid "$target" || { fail "$id: merge needs a $width-digit target id"; continue; }
      [ "$target" != "$id" ] || fail "$id: merges into itself"
      t_action=$(awk -F '\t' -v t="$target" '$1 == t { print $2 }' "$work/entries")
      case $t_action in '' | keep | trim | split) ;; *) fail "$id: merge target $target is itself $t_action" ;; esac
      [ -n "$(rec_of "$target")" ] || fail "$id: merge target $target has no record" ;;
    move)
      [ -n "$target" ] || fail "$id: move needs a target href"
      [ -n "$label" ] || fail "$id: move needs a label"
      case $target in /*) ;; *) [ -f "$target" ] || fail "$id: move target $target does not exist" ;; esac ;;
    drop) ;;
    *) fail "$id: unknown action '$action'"; continue ;;
    esac
    case $action in merge | move | drop)
      # Before the batch the record must exist; a rerun after a partial apply may find it gone,
      # but never an id the log did not have at HEAD.
      case $mode in dry | apply)
        [ -n "$now" ] || grep -q "^$log/$id-" "$work/head-records" || fail "$id: no record $log/$id-*.md, now or at HEAD" ;;
      esac ;;
    esac
    case $action in
    merge) printf '%s\tmerge\t%s\t%s\t\t\n' "$id" "$target" "$(slug_of "$target")" ;;
    move) printf '%s\tmove\t\t\t%s\t%s\n' "$id" "$target" "$label" ;;
    *) printf '%s\t%s\t\t\t\t\n' "$id" "$action" ;;
    esac >> "$work/idmap"
  done < "$work/entries"
  [ "$bad" -eq 0 ] || exit 2 ;;
esac
removed_ids=$(awk -F '\t' '$2 == "merge" || $2 == "move" || $2 == "drop" { print $1 }' "$work/idmap")

# --- cites -----------------------------------------------------------------------------
# A trimmed or split record keeps its id, so nothing dangles — but a citation elsewhere may
# lean on a sentence that left it. Which ones do is a reading; finding every candidate is not.
if [ "$mode" = cites ]; then
  awk -F '\t' '$2 == "trim" || $2 == "split" { print $1 }' "$work/idmap" > "$work/kept"
  if [ ! -s "$work/kept" ]; then echo "nothing to list: the map trims and splits no record"; exit 0; fi
  scan "$any_ref"
  engine cites
  while IFS= read -r id; do
    awk -F '\t' -v i="$id" '$1 == "cite" && $2 == i && !seen[$3 FS $4]++ { t = $5; for (j = 6; j <= NF; j++) t = t FS $j; print $3 ":" $4 ":" t }' "$work/events" > "$work/cites"
    echo "ADR-$id — $(wc -l < "$work/cites" | tr -d ' ') citing lines"
    cat "$work/cites"
  done < "$work/kept"
  exit 0
fi

# --- reworded --------------------------------------------------------------------------
# Every sentence a batch leaves on a record or a target page must be a deletion from a
# committed sentence that page or its sources had: its words, in order, a subsequence of it.
# That is a word-sequence check; whether a deletion kept the meaning is the reviewer's.
if [ "$mode" = reworded ]; then
  git rev-parse --verify --quiet "$base^{commit}" > /dev/null || { echo "--base: '$base' is not a revision" >&2; exit 2; }
  git ls-tree -r --name-only "$base" -- "$log/" > "$work/base-records"
  base_rec() { grep "^$log/$1-[^/]*\\.md\$" "$work/base-records" | head -n 1; }
  : > "$work/pairs"
  pair() { # $1 = target page, $2 = id whose committed record is a source
    s=$(base_rec "$2"); [ -n "$s" ] || { echo "$2: no record at $base" >&2; exit 2; }
    printf '%s\t%s\n' "$1" "$s" >> "$work/pairs"
  }
  while IFS="$(printf '\t')" read -r id action target label; do
    case $action in
    trim) pair "$(rec_of "$id")" "$id" ;;
    split)
      pair "$(rec_of "$id")" "$id"
      for s in $(printf '%s' "$target" | tr ',' ' '); do pair "$(rec_of "$s")" "$id"; done ;;
    merge) pair "$(rec_of "$target")" "$id" ;;
    move) case $target in /*) echo "note: $id moves to a site path; its page is not compared" ;; *) pair "$target" "$id" ;; esac ;;
    esac
  done < "$work/entries"
  cat > "$work/reworded.awk" <<'AWK'
function body(file, P,   line, n, st, np, cur, fence) {
  n = 0; st = 0; np = 0; cur = ""
  while ((getline line < file) > 0) {
    n++
    if (n == 1 && line == "---") { st = 1; continue }
    if (st == 1) { if (line == "---") st = 2; continue }
    if (line ~ /^(```|~~~)/) { fence = !fence; continue }
    if (fence) continue
    if (line ~ /^[ \t]*$/ || line ~ /^#/) { if (cur != "") P[++np] = cur; cur = ""; if (line ~ /^#/) P[++np] = line; continue }
    cur = cur line " "
  }
  if (cur != "") P[++np] = cur
  close(file); return np
}
function sentences(P, np, S, X, isnew,   k, n, cur, h1, done, head) {
  n = 0; h1 = 0; done = 0
  for (k = 1; k <= np; k++) {
    head = 0
    if (P[k] ~ /^#/) { if (P[k] ~ /^# /) h1 = k; S[++n] = P[k]; X[n] = isnew; continue }
    if (isnew && h1 && !done && !pointer(P[k])) { head = 1; done = 1 }
    cur = P[k]
    while (match(cur, /[.!?][*_`")]*[ ]+/)) { S[++n] = substr(cur, 1, RSTART + RLENGTH - 1); X[n] = head; cur = substr(cur, RSTART + RLENGTH) }
    if (cur ~ /[^ ]/) { S[++n] = cur; X[n] = head }
  }
  return n
}
function delink(s,   out, m) { # a link counts as its text
  out = ""
  while (match(s, /\[[^]]*\]\([^)]*\)/)) { m = substr(s, RSTART, RLENGTH); out = out substr(s, 1, RSTART - 1) substr(m, 2, index(m, "](") - 2); s = substr(s, RSTART + RLENGTH) }
  return out s
}
function unlink(s) { gsub(/!?\[[^]]*\]\([^)]*\)/, " ", s); return s }
function norm(w) { gsub(/[.,;:!?)("*_`]+$/, "", w); gsub(/^[!("*_`>]+/, "", w); return tolower(w) }
function words(sent, arr,   n, i, raw, k, w) {
  n = split(sent, raw, /[ ]+/); k = 0
  for (i = 1; i <= n; i++) { w = norm(raw[i]); if (w != "") arr[++k] = w }
  return k
}
function subseq(a, na, b, nb,   i, j) { j = 1; for (i = 1; i <= nb && j <= na; i++) if (a[j] == b[i]) j++; return j > na }
function swap(s,   i, k, out, p) { # the map's own token rewrites, applied to committed text
  for (k = 1; k <= NSUB; k++) {
    out = ""
    while ((p = index(s, SFROM[k])) > 0 && substr(s, p + length(SFROM[k]), 1) !~ /[0-9]/) { out = out substr(s, 1, p - 1) STO[k]; s = substr(s, p + length(SFROM[k])) }
    s = out s
  }
  return s
}
function pointer(s) { return s ~ /^(> )?(\*\*)?(Partly )?([Ss]upersedes|[Ss]uperseded by)/ }
BEGIN {
  while ((getline l < SUBS) > 0) { split(l, t, "\t"); SFROM[++NSUB] = t[1]; STO[NSUB] = t[2] }
  split("not no never nor without unless only cannot don't doesn't isn't won't nothing none neither", t, " ")
  for (i in t) NEG[t[i]] = 1
  np = body(ARGV[1], P); nn = sentences(P, np, NS, NX, ISNEW)
  no = 0
  for (f = 2; f < ARGC; f++) {
    delete Q; delete QS; delete QX
    nq = body(ARGV[f], Q); m = sentences(Q, nq, QS, QX, 0)
    for (i = 1; i <= m; i++) OS[++no] = delink(swap(QS[i]))
  }
  for (s = 1; s <= nn; s++) {
    if (NX[s] || pointer(NS[s])) continue
    delete A; na = words(delink(NS[s]), A); if (na == 0) continue
    hit = 0
    for (o = 1; o <= no && !hit; o++) { delete B; nb = words(OS[o], B); if (subseq(A, na, B, nb)) hit = o }
    if (hit) {
      delete B; nb = words(OS[hit], B); delete HAS; for (i = 1; i <= na; i++) HAS[A[i]] = 1
      for (i = 1; i <= nb; i++) if ((B[i] in NEG) && !(B[i] in HAS)) { printf "N\t%s: %s\n", PAGE, substr(NS[s], 1, 160); break }
      continue
    }
    if (NS[s] ~ /\]\(/) { printf "L\t%s: %s\n", PAGE, substr(NS[s], 1, 160); continue }
    printf "F\t%s: %s\n", PAGE, substr(NS[s], 1, 160)
  }
  exit
}
AWK
  awk -F '\t' '$2 == "merge" { print "ADR-" $1 "\tADR-" $3 } $2 == "move" { print "ADR-" $1 "\t" $4 }' "$work/entries" > "$work/subs"
  : > "$work/found"; pages=0
  cut -f1 "$work/pairs" | awk '!seen[$0]++' > "$work/pages"
  while IFS= read -r t; do
    pages=$((pages + 1)); i=0; set --
    if git cat-file -e "$base:$t" 2> /dev/null; then isnew=0; git show "$base:$t" > "$work/src.0"; set -- "$work/src.0"; else isnew=1; fi
    awk -F '\t' -v t="$t" '$1 == t { print $2 }' "$work/pairs" | awk '!seen[$0]++' > "$work/srcs"
    while IFS= read -r s; do
      i=$((i + 1)); git show "$base:$s" > "$work/src.$i"; set -- "$@" "$work/src.$i"
    done < "$work/srcs"
    awk -v ISNEW="$isnew" -v PAGE="$t" -v SUBS="$work/subs" -f "$work/reworded.awk" "$t" "$@" >> "$work/found"
  done < "$work/pages"
  echo "compared $pages pages against their committed text at $base"
  if grep -q '^L' "$work/found"; then echo "sentences that carry a link, not a deletion — review them as pointers:"; sed -n 's/^L\t//p' "$work/found"; fi
  if grep -q '^N' "$work/found"; then echo "deletions that dropped a negation — review the meaning:"; sed -n 's/^N\t//p' "$work/found"; fi
  if grep -q '^F' "$work/found"; then
    echo "sentences that are not a deletion from committed text:"; sed -n 's/^F\t//p' "$work/found"; exit 1
  fi
  echo "clean: every sentence is a deletion from what was committed"
  exit 0
fi

# --- check -----------------------------------------------------------------------------
check() {
  found=0
  tables
  scan "$any_ref"
  engine check
  report remains "references to removed records remain:" && found=1
  report deadfile "links to a record that does not exist (id, slug or locale):" && found=1
  report deadanchor "links into a surviving record whose anchor no longer exists:" && found=1
  report unsupported "references in a form this script cannot resolve — fix them by hand:" && found=1
  report url "note: links to another site's ADR path, left alone:" || true
  for id in $removed_ids; do awk -F '\t' -v i="$id" '$2 == i { print $1 }' "$work/records"; done > "$work/present"
  if [ -s "$work/present" ]; then echo "removed records still present:"; cat "$work/present"; found=1; fi
  # A survivor that now cites itself — its own Supersedes line rewritten onto its own id.
  awk -F '\t' '$2 == "merge" { print $3 }' "$work/idmap" | sort -u | while IFS= read -r m; do
    f=$(rec_of "$m"); [ -n "$f" ] || continue
    grep -n -E "ADR-$m([^0-9]|\$)" "$f" | grep -v -E "^[0-9]+:# ADR-$m " | sed 's|^|'"$(printf '%s' "$f" | sed 's/[\\&|]/\\&/g')"':|'
  done > "$work/self"
  if [ -s "$work/self" ]; then echo "surviving records that now reference themselves:"; cat "$work/self"; found=1; fi
  if [ "$found" -eq 0 ]; then echo "clean: every reference resolves and no removed record remains"; fi
  return "$found"
}
if [ "$mode" = check ]; then check && exit 0 || exit 1; fi

# --- renumber: the id map is every record whose rank differs from its id ------------------
if [ "$mode" = renumber ] || [ "$mode" = renumber-apply ]; then
  awk -F '\t' '$4 != "" { print $2 }' "$work/records" | sort -u > "$work/loc-ids"
  awk -F '\t' '$4 == "" { print $2 }' "$work/records" | sort -u > "$work/def-ids"
  orphan=$(comm -23 "$work/loc-ids" "$work/def-ids" | tr '\n' ' ')
  [ -z "$orphan" ] || { echo "locale records with no default record: $orphan" >&2; exit 2; }
  awk -v W="$width" '{ n++; new = sprintf("%0" W "d", n); if (new != $1) printf "%s\trenumber\t%s\t\t\t\n", $1, new }' \
    "$work/def-ids" > "$work/idmap"
  if [ ! -s "$work/idmap" ]; then echo "nothing to renumber: the ids already run 1..$(wc -l < "$work/def-ids" | tr -d ' ')"; exit 0; fi
  scan "$any_ref"
  engine rewrite
fi

# --- dry run / apply -------------------------------------------------------------------
case $mode in dry | apply)
  if [ -z "$removed_ids" ]; then
    if [ "$mode" = apply ]; then check && exit 0 || exit 1; fi
    echo "nothing to remove: every record in the map is kept"; exit 0
  fi
  ids=$(printf '%s\n' $removed_ids | paste -sd '|' -)
  scan "ADR-($ids)([^0-9]|\$)|(^|[^A-Za-z0-9])($ids)-[A-Za-z]"
  engine rewrite ;;
esac

refused=0
report dropref "a dropped record is still referenced — merge or move it instead:" && refused=1
report unsupported "references in a form this script cannot rewrite — fix them by hand first:" && refused=1
if [ "$fragments" != drop ] && report fragment "links whose #fragment a move would collapse onto the page top (map a fragment-free target, fix them, or pass --fragments=drop):"; then refused=1; fi
report url "note: links to another site's ADR path, left alone:" || true

finals() { # write each changed file's final text to $work/final/N, keeping a final newline
  rm -rf "$work/final"; mkdir "$work/final"
  while IFS="$(printf '\t')" read -r n f; do
    cat "$work/out/$n" > "$work/final/$n"
    if [ -s "$f" ] && [ -z "$(tail -c 1 "$f")" ]; then echo >> "$work/final/$n"; fi
  done < "$work/manifest"
}
finals

# Record files that go (a batch) or get a new name (renumbering), in every locale tree.
: > "$work/moves"
awk -F '\t' 'NR == FNR { act[$1] = $2; new[$1] = $3; next }
  ($2 in act) { d = $1; sub(/\/[^\/]*$/, "", d)
    if (act[$2] == "renumber") printf "%s\t%s/%s-%s.md\n", $1, d, new[$2], $3
    else if (act[$2] == "merge" || act[$2] == "move" || act[$2] == "drop") printf "%s\t\n", $1 }' \
  "$work/idmap" "$work/records" > "$work/moves"

if [ "$mode" = dry ] || [ "$mode" = renumber ]; then
  while IFS="$(printf '\t')" read -r n f; do
    echo "would change: $f"
    if [ "$diff" -eq 1 ]; then diff -u "$f" "$work/final/$n" || true; fi
  done < "$work/manifest"
  while IFS="$(printf '\t')" read -r from to; do
    if [ -n "$to" ]; then echo "would rename: $from -> $to"; else echo "would remove: $from"; fi
  done < "$work/moves"
  [ "$refused" -eq 0 ] || { echo "an apply would be refused: nothing would be written"; exit 1; }
  echo "dry run: would change $(wc -l < "$work/manifest" | tr -d ' ') files, $( [ "$mode" = dry ] && echo remove || echo rename) $(wc -l < "$work/moves" | tr -d ' ') records — rerun with --apply"
  exit 0
fi

[ "$refused" -eq 0 ] || { echo "refused: nothing was written"; exit 1; }
while IFS="$(printf '\t')" read -r n f; do cat "$work/final/$n" > "$f"; done < "$work/manifest"
while IFS="$(printf '\t')" read -r from to; do
  if [ -z "$to" ]; then rm -f "$from"; else mv "$from" "$from.renumber-tmp"; fi
done < "$work/moves"
while IFS="$(printf '\t')" read -r from to; do
  [ -z "$to" ] || mv "$from.renumber-tmp" "$to"
done < "$work/moves"

# The protocol: every row this run applied, once, with the batch and the commit under it.
sha=$(git rev-parse --short=12 HEAD 2> /dev/null || echo none)
if [ ! -f "$protocol" ]; then
  {
    echo "# ADR migration protocol, written by prune-adrs' rewrite-adr-refs.sh: every old id and what"
    echo "# replaced it. Keep it until every reviewer has signed the migration off, then delete it in"
    echo "# its own commit."
    printf '# batch\tbase\tid\taction\ttarget\tlabel\n'
  } > "$protocol"
fi
if [ "$mode" = renumber-apply ]; then
  awk -F '\t' -v s="$sha" '{ printf "renumber\t%s\t%s\trenumber\t%s\t\n", s, $1, $3 }' "$work/idmap"
else
  awk -F '\t' -v b="$batch" -v s="$sha" '{ printf "%s\t%s\t%s\t%s\t%s\t%s\n", b, s, $1, $2, $3, $4 }' "$work/entries"
fi | while IFS= read -r row; do grep -qxF "$row" "$protocol" || printf '%s\n' "$row" >> "$protocol"; done

echo "changed $(wc -l < "$work/manifest" | tr -d ' ') files, $( [ "$mode" = apply ] && echo removed || echo renamed) $(wc -l < "$work/moves" | tr -d ' ') records; protocol: $protocol"
if [ "$mode" = renumber-apply ]; then
  removed_ids=
  : > "$work/idmap"
  tables
  awk -F '\t' '$4 == "" { print $1 "\t" $2 }' "$work/records" | while IFS="$(printf '\t')" read -r f id; do
    h=$(grep -m 1 '^# ' "$f" || true)
    case $h in *ADR-[0-9]*) case $h in *"ADR-$id "* | *"ADR-$id") ;; *) echo "$f: heading names another id: $h" ;; esac ;; esac
  done > "$work/h1"
  if [ -s "$work/h1" ]; then echo "records whose heading disagrees with the file name:"; cat "$work/h1"; check || true; exit 1; fi
fi
check && exit 0 || exit 1
