# prune-adrs — reference

The mechanics of the migration: how the log is measured, what a batch map holds, how the script is run and what its exits mean. **What counts as an architecture decision, how long a record may run and why it never grows** are `write-adr`'s, read from its SKILL.md (**When a decision earns an ADR**) and its REFERENCE (**What the body may hold**, **Size**, **Lifecycle — append-only**). They are named here, not copied, because this skill never runs without `write-adr` installed.

## Inventory

Read-only, and shown before any record is judged. Body length excludes frontmatter:

```sh
log=docs/99.adr
for f in "$log"/[0-9][0-9][0-9][0-9]-*.md; do
  printf '%s\t%s\n' "$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' "$f" | wc -w)" "$f"
done | sort -n > "$tmp/lengths"
```

| Measure                         | How                                                                                                                |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| records, median, p90            | from `$tmp/lengths`                                                                                                |
| over budget                     | body over 500 words — `write-adr`'s stated-reason ceiling                                                          |
| amendments                      | records carrying a `## Amendments` heading                                                                         |
| supersede chains                | `Supersedes ADR-NNNN` / `Superseded by` pointers, with each record's first-commit date from `git log` (below)      |
| records arriving with a feature | the commit that added each record — `git log --diff-filter=A --format='%h %s' -- <record>` — typed `feat` or `fix` |

```sh
git log --follow --diff-filter=A --reverse --format=%as -- "$record" | head -n 1   # the day a record landed
```

**A chain is measured in days.** Records that supersede one another within a few days are a decision still being worked out when it landed, and the classic `merge`. A supersede months later is a reversal, and both records stay.

## The map

One **batch map** per batch, tab-separated, one record per line, `#` comments and blank lines ignored:

```text
# id	action	target	label
0021	keep
0038	trim
0598	merge	0601
0609	move	/concepts/smp/dragon-egg	the dragon egg page
0594	move	docs/2.concepts/shop/gift-cards.md	the gift card page
0412	drop
```

| Action          | `target`                                                                                                                                             | `label`                                  |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `keep` / `trim` | —                                                                                                                                                    | —                                        |
| `merge`         | the surviving record's 4-digit id — a record kept or trimmed, never one removed in any batch                                                         | —                                        |
| `move`          | the page's link target: a repo path `docs/…md` (written relative to each linking file), or the site path the repo already links with (`/concepts/…`) | the text that replaces a bare `ADR-NNNN` |
| `drop`          | —                                                                                                                                                    | —                                        |

**Use the link form the repo already uses.** A rendered site that links records as `/adr/NNNN-slug` links pages the same way, so its `move` targets are site paths; a portable tree links files, so its targets are `docs/` paths. Mixing them leaves a tree that half-renders.

**The label reads in a sentence.** It replaces `ADR-0609` wherever it stands — a code comment, a link text, a table cell — so a noun phrase (`the dragon egg page`) works where a path would not.

**Where batch maps live** — under the git common dir, beside the other TitusKirch caches, so they survive across sessions and are never committed:

```sh
maps="$(git rev-parse --git-common-dir)/tituskirch-skills/prune-adrs"
mkdir -p "$maps"
printf '%s\n' "$maps/batch-01.tsv"
```

Delete the directory once the migration's final check is clean.

## The script

[`templates/rewrite-adr-refs.sh`](templates/rewrite-adr-refs.sh) — POSIX `sh`, `sed -E` and `awk`, run from anywhere inside the repo:

```sh
# Fill in this skill's own directory, as for the resolver.
skill=/absolute/path/to/this/skill
sh "$skill/templates/rewrite-adr-refs.sh" --diff "$maps/batch-01.tsv"   # dry run, with diffs
sh "$skill/templates/rewrite-adr-refs.sh" --apply "$maps/batch-01.tsv"  # rewrite, remove, check
cat "$maps"/batch-*.tsv > "$maps/all.tsv"
sh "$skill/templates/rewrite-adr-refs.sh" --check "$maps/all.tsv"       # the closing check
```

| Mode      | Does                                                                                                                     |
| :-------- | :----------------------------------------------------------------------------------------------------------------------- |
| (default) | dry run — lists every file it would change and every record it would remove; touches nothing                             |
| `--diff`  | with a dry run, a unified diff per changed file                                                                          |
| `--apply` | removes the removed records' index rows, rewrites every reference, deletes the records in every locale tree, then checks |
| `--check` | only reports — every line still citing a removed id, and every survivor that now cites itself                            |

| Exit | Means                                                                                 |
| :--: | :------------------------------------------------------------------------------------ |
| `0`  | done, or clean                                                                        |
| `1`  | references to removed records remain, or a survivor cites itself — named line by line |
| `2`  | invalid usage or map — nothing was written                                            |

**What it rewrites, exactly.** In every tracked text file except changelogs: a bare `ADR-NNNN` (matched whole, so `ADR-00031` and `ADR-0030` are never touched for `0003`); a link whose target contains `adr/NNNN-…` (site paths and file paths alike); and a relative `NNNN-….md` link inside a `99.adr/` directory. A merge keeps a link's form and anchor and swaps the record; a move replaces the link target and turns the bare id into the label.

**What it validates before writing anything** — 4-digit ids listed once, a record for each, a known action, a merge target that exists and is not itself removed, a `move` page that exists when it is a repo path, and a label on every `move`. Any failure exits `2` with the tree untouched.

**What it deliberately does not do.** It never decides an action, never writes a page, never edits a record's prose beyond the reference tokens, and never touches a changelog. A survivor whose `Supersedes ADR-0598` line now reads `Supersedes ADR-0601` on record 0601 is reported, not repaired: whether the line goes or says something else is a reading, and the script makes none.

**Run in batches, check once at the end.** Each `--apply` takes only its own batch map, because the records an earlier batch removed are gone and would fail validation. The closing `--check` takes all of them at once.

## Config

`.tituskirch-skills.json` at the consuming repo's root is an optional, committed config shared across TitusKirch skills. This skill reads the **`docs.*`** section and adds no key of its own. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how.

| Key              | Effect here                                                                       |
| :--------------- | :-------------------------------------------------------------------------------- |
| `docs` = `false` | the skill is **disabled** — stop with a notice; an _absent_ block is not disabled |
| `docs.language`  | the language moved material is framed in on a new page                            |
| `docs.render`    | which link form a `move` target uses ([the map](#the-map))                        |

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
disabled=$(printf '%s' "$resolved" | jq -er 'if .docs == false then 1 else empty end' 2>/dev/null) || disabled=
render=$(printf '%s' "$resolved" | jq -er '.docs.render // empty' 2>/dev/null) || render= # empty = portable: docs/ paths
```

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;   # 11: unknown profile named
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found, could not run, or was told to select a profile the config does not define, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset name, or a detected `ci` the config does not define, yields the base config unchanged. A `TITUSKIRCH_SKILLS_PROFILE` naming no defined profile exits `11` — a renamed profile stops the run rather than silently dropping its overlay.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>
