# Tracker — local (files)

The **local files** branch of `issue` — reached when `issue.tracker` resolves to `local`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

The issues are **committed markdown files** in the repo — `<dir>/NNNN-slug.md`, `<dir>` being `issue.local.dir` (default `.agents/issues`), a sibling of `.agents/handoffs/` and committed for the same reason: an issue nobody can review or share is not worth filing. No service, no auth, no network. The layout, the frontmatter fields and how the work loop transitions them: `work-implement`'s `trackers/local.md`; this section is the create/update/search half.

- **Availability** — `<dir>` exists, or this is the repo's first local issue and the create makes it. There is nothing to authenticate and nothing to be unreachable, which is the point of the tracker. Resolve it to the absolute `$store` below before touching it — never use the repo-relative value as a path.
- **Catalogs** — none. There is no label, milestone or project catalog to cache or resolve against, so `issue.labels.exclude` has nothing to exclude and a plan never lists unresolved catalog items. Labels are free text in the file's `labels` field and carry no lifecycle meaning.
- **Templates still apply.** `.github/ISSUE_TEMPLATE/` is a **repo** convention, not a GitHub feature — the same argument the Linear section makes — so the body is composed from the chosen template exactly as it would be for a forge, and only where it lands differs.
- **Update** — rewrite the file. Frontmatter fields are one line each; the body is prose. Never touch `state` or `assignee` here: those are the work loop's, and writing them from this skill hands an issue to a queue behind the queue's back.
- **Close** — there is no close. `state: 'done'` (or `'blocked'`) is the terminal marker and the file stays where it is; deleting or moving it is the repo's own housekeeping, never this skill's.
- **Search/list** — `grep -rl` over `$store`, or a title match on the filenames. A plain-text store is the one place where searching the **body** is trivial and needs no query language. Frontmatter fields are matched **quote-tolerantly** (`state: ready` and `state: 'ready'` are the same value) — the rule and its one exception are stated in **The file**, in `work-implement`'s REFERENCE.
- **Sub-issues** — the child's `parent:` field, holding the parent's number. One field instead of GitHub's separate REST calls, and read by the work loop as the same edge.

**`local.dir` is repo-relative, so anchor it before using it.** Each of these commands runs in its own process with no guaranteed cwd, and the work loop reads the **same** store from inside its worktrees — so both halves must resolve to one absolute directory or they file into different trees. The anchor is the **main working tree**, for the reason **Which tree is the tracker** in `work-implement`'s `trackers/local.md` gives: the issue files are committed, so a linked worktree holds a stale copy of every one of them.

**Allocating the number is then the only race.** Numbers are sequential, so two creates can pick the same one:

```sh
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
[ -n "$main" ] || { echo "cannot resolve the main working tree" >&2; exit 1; }
dir=$(printf '%s' "$resolved" | jq -er '.issue.local.dir // empty' 2>/dev/null) || dir=
[ -n "$dir" ] || dir=.agents/issues
case "$dir" in /*) store=$dir ;; *) store=$main/$dir ;; esac
mkdir -p "$store"

# highest existing number, then claim the next one atomically — noclobber makes the
# create fail rather than overwrite, so a lost race retries instead of eating an issue.
last=$(ls "$store" | sed -n 's/^\([0-9][0-9]*\)-.*\.md$/\1/p' | sort -n | tail -1)
n=$(( ${last:-0} + 1 ))
f=$(printf '%s/%04d-%s.md' "$store" "$n" "$slug")
( set -C; : > "$f" ) || { echo "number taken, retry"; }
```

`set -C` is the same atomic create-or-fail the work loop's single-flight lock rests on, used here for the same reason: a test-then-create reopens the very window it is meant to close. Retry with the next free number rather than reporting a failure — the collision is expected on a busy repo, not exceptional.
