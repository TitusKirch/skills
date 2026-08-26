# Tracker — local (files)

The **local files** branch of the work loop — reached when `work.tracker` (falling back to `issue.tracker`) resolves to `local`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

No service, no auth, no network: the issues are **committed markdown files** in the repo, `<dir>/NNNN-slug.md`, one per issue. `<dir>` is `work.local.dir`, falling back to `issue.local.dir` and then to `.agents/issues` — the same two-step fallback `work.linear.team` takes. Why files, and why these answers rather than the plausible alternatives: [ADR-0023](https://github.com/TitusKirch/skills/blob/main/docs/99.adr/0023-back-the-local-tracker-with-committed-files.md).

**The forge axis is untouched.** `local` is a **tracker**, not a forge: the root `forge` key still says where pull requests go, so a repo may file its issues in-tree and open its PRs on GitHub. `work.branch`, the push and the PR keep their meanings — but a store that lives **in the tree** does interact with `work.branch: worktree`, and that is [the next section](#which-tree-is-the-tracker), not an absence of interaction.

## Which tree is the tracker

The issue files are **committed**, so under `work.branch: worktree` — and under `parallel: true`, which _is_ worktrees (**Branch strategy** in `REFERENCE.md`) — every per-issue worktree checks out **its own copy** of `<dir>/NNNN-slug.md` on its own branch. Three copies of an issue are three answers to "what state is it in", and only one of them can be the tracker.

**The store is the main working tree's `<dir>`, resolved absolutely** — the same directory from inside any worktree, and the one path both drains can derive rather than carry. A per-issue worktree's copy is a **checkout artifact: read nothing from it, write nothing to it.** It is a snapshot of the state at branch-off and goes stale the moment the drain advances the issue.

```sh
# The tracker's tree. `git worktree list` always prints the main working tree first,
# and this resolves identically from inside a linked worktree — derived, never carried
# (the same reason the drains derive their worktree paths instead of passing them).
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
[ -n "$main" ] || { echo "cannot resolve the main working tree" >&2; exit 1; }
```

Skip that rule and the failure is **silent**, which is the shape this driver is most exposed to:

1. the drain leases `state: 'working'` in the store;
2. the worker's worktree, branched off `pr.base` beforehand, still reads `state: 'ready'`;
3. the worker advances to `reviewRequested` in whichever copy its cwd happens to land in — into the worktree, it either commits lifecycle churn onto the PR branch or dirties the tree and trips the clean-tree assert (**Lease & race rules** in `REFERENCE.md`); into the store, the PR branch still carries a stale `ready`;
4. the review drain greps the store, sees no `reviewRequested`, and the issue is **invisible to the review queue** — indistinguishable from a drained one.

Two consequences follow from there being exactly one writable copy:

- **Only one side ever edits the file, so the merge stays clean.** Transitions are written and committed in the main working tree; a per-issue **worktree** carries the issue file exactly as it was cut and no worker ever touches its own copy. A file changed on one side only merges without a conflict — that is precisely what the never-write-the-worktree rule buys, and precisely what is lost the moment a worker edits its own copy.
- **`branch:<name>` + `parallel: false` escapes the question entirely.** There the shared branch is the main tree's branch and the store and the work are the same checkout, so the rule costs that configuration nothing. **`branch:<name>` + `parallel: true` does not escape it** **Branch strategy** in `REFERENCE.md` says that combination produces its work **in isolated worktrees** and lands it serialized, which is exactly why `branch:dev` + `parallel` is the race-free pairing — so the store is split there precisely as it is under `worktree`, and the rule applies unchanged.

**The remaining cell, `worktree` + `parallel: false`, is the one this rule does not cover — and it is the default pairing**, so it gets a rule of its own rather than an exemption. Per **Branch strategy** in `REFERENCE.md` that combination is _one tree, hops_: the main working tree checks the issue branch out **in place**. The store is the same path in that same tree, so it travels with the branch, and the discriminator is no longer the **tree** but the **branch it currently holds**. Every step of "the store is the main working tree's `<dir>`" is satisfied while the failure happens anyway:

1. the drain writes `state: 'working'` in the store while the tree is on `pr.base`;
2. the tree hops onto `ai/0042-…`, and the store — same path, same tree — is now that branch's copy;
3. the worker advances to `reviewRequested`; the write commits onto the **PR branch**, or dirties the tree;
4. the tree hops back to `pr.base`, the review drain greps the store and sees no `reviewRequested` — **invisible to the review queue**, indistinguishable from a drained one. Step 4 of the walkthrough above, reached without breaking a single rule.

**So the store is written only while the tracker's tree is on `pr.base`.** The transition before the hop is written before it, the transition after the work is written after the hop back — never from the issue branch. This is a **rule about ordering, not about paths**, which is why the `$main` resolution above does not catch it, and it holds in every configuration: under `branch:<name>` the shared branch **is** `pr.base`, and under `parallel: true` the drain never leaves it, so the assert below is free there and load-bearing only in the hopping cell.

```sh
# Assert before every store write. $main is the tracker's tree, resolved above;
# $resolved is the config from the resolver. pr.base falls back to the repo's
# default branch, exactly as the branch base does everywhere else.
base=$(printf '%s' "$resolved" | jq -er '.pr.base // empty' 2>/dev/null) || base=
[ -n "$base" ] || base=$(git -C "$main" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$base" ] || { echo "cannot resolve pr.base — refusing to write the store" >&2; exit 1; }

head=$(git -C "$main" rev-parse --abbrev-ref HEAD)
[ "$head" = "$base" ] || { echo "refusing to write the store: $main is on $head, not $base" >&2; exit 1; }
```

An unresolvable base **stops the write** rather than defaulting to one: guessing `main` on a repo whose base is `dev` writes the transition to the wrong branch's copy, which is the same silent failure this section exists to close.

**The assert binds the review drain too**, and that is where this cell costs something. The review loop writes the same store, and it does not hop — so while the implement drain sits on an issue branch, a concurrent review drain's write **fails loudly** instead of landing in that branch's copy. A drain that stops with a message beats one that writes a verdict into a file nobody reads again, but the two loops genuinely do not overlap cleanly here. **Where both drains run against one checkout, prefer `branch:<name>`**: the tree never leaves the shared branch, so the store never moves and the assert is free.

Rejected: **declaring the cell unsupported.** It is the default pairing (`branch` defaults to `worktree`, `parallel` to `false`), so refusing it would make `tracker: local` unusable until a repo configures its way out of a default it never chose. Rejected: **moving the store out of the working tree** for this cell — the issue files are committed by construction ([ADR-0023](https://github.com/TitusKirch/skills/blob/main/docs/99.adr/0023-back-the-local-tracker-with-committed-files.md)), and a store outside the tree is a different tracker, not a fix to this one.

The main working tree is also the one place the two drains agree on **without exchanging state**. A repo whose main tree sits on a branch that lacks `<dir>` is not a special case: the existence check below reports it as the setup problem it is.

## The file

```markdown
---
number: 42
title: 'Add a local file-based issue tracker driver'
state: 'ready'
priority: 'low'
labels: ['feature', 'research']
assignee: null
blockedBy: [38]
parent: null
---

# What problem are you trying to solve?

…the body, exactly as the `issue` skill would have written it for a forge…
```

- **Frontmatter is the tracker's data; the prose is the issue.** Only the fields above are read as tracker state — a line in the body is text, never a relation, a state or a priority, the same split the label-vs-body rule (**Label vs body precedence** in `REFERENCE.md`) draws everywhere else.
- **`state` holds the config key** (`ready`, `working`, `reviewRequested`, `reviewing`, `changesRequested`, `needsHuman`, `done`, `blocked`), **never the `work.labels.*` string.** A file has no label catalog to resolve a string against, so the key — the thing every rule in the loop already reasons about — is what is written. The `labels.*` strings are simply unused here, and `labels.<key>: false` still turns the mechanic off: no file carries that key, so nothing selects on it.
- **`priority` is matched against `work.priorityLabels`** (**Config** in `REFERENCE.md`) — verbatim, or against an entry's segment after a `: ` separator, so a ladder of `priority: high` accepts both `'priority: high'` and a bare `'high'`. **Unmatched or absent ranks lowest**, never highest: an unranked issue must not jump the queue.
- **`assignee`** is what the reconcile's guard (**Reconcile** in `REFERENCE.md`) reads. It is only as distinct as the runner's own git identity, and nothing here proves it is per-runner — so the default-to-shared rule applies unchanged: take the **age-gated** path, never a bare-assignee reclaim.
- **`labels`** is free-form and carries no lifecycle meaning; the loop never writes it.
- **Nothing is ever deleted.** `done` and `blocked` are states, not removals — a skill never deletes or moves an issue file. Archiving is the repo's own business.
- **Reading is quote-tolerant; writing is canonical.** The file is advertised as human-readable and hand-editable, and `state: ready` is as valid a YAML scalar as `state: 'ready'` — so a matcher that accepts only the quoted form drops a hand-written issue out of **every** queue, silently, exactly the way the empty-directory trap does. Every read therefore tolerates optional quotes and trailing space; every write emits the single-quoted form, so a file the loop has touched is canonical without a hand-written one being rejected:

  ```sh
  # the one matcher — ONE regex, written out in full at each of its three uses
  # (this loop's Eligible, work-review's selection, the transition guard below).
  # $key is a config key; ERE, so quote it for grep -E:
  "^state:[[:space:]]*['\"]?$key['\"]?[[:space:]]*$"
  ```

  **Inline it; never wrap it in a shell helper.** A `state_re()` function is the obvious deduplication and is wrong here for the reason stated twice already: **each command runs in its own process**, so a function defined in one command does not exist in the next. `$(state_re state ready)` then expands to the **empty string**, and `grep -qE ""` matches **any non-empty line** — the matcher does not fail, it matches everything, so the guard below passes unconditionally and the queries select the whole directory. Same failure shape as the empty `--label` **Selection query** in `REFERENCE.md` warns about, and the reason three written-out copies are cheaper than one definition that has to travel.

  This is the opposite call from the `## AI review — round N` heading, whose exact wording **is** load-bearing because `work-review`'s round count parses it — and which says so where it is defined.

## Resolving the store, and the empty-directory trap

**`local.dir` is repo-relative, so it is never used as a path on its own.** Every command here runs in its own process with **no guaranteed cwd** — and the loop's own verify recipe `cd`s into a worktree — so a bare `"$dir"` resolves against whatever the process happened to inherit: a missing directory in one command and, worse, a _different_ tree's copy in the next. Anchor it, and anchor it to the [tracker's tree](#which-tree-is-the-tracker) rather than the current one:

```sh
# $resolved comes from the resolver — see "Reading the config" in REFERENCE.md.
# $main is the main working tree — see "Which tree is the tracker".
dir=$(printf '%s' "$resolved" | jq -er '.work.local.dir // .issue.local.dir // empty' 2>/dev/null) || dir=
[ -n "$dir" ] || dir=.agents/issues
case "$dir" in /*) store=$dir ;; *) store=$main/$dir ;; esac
[ -d "$store" ] || { echo "tracker is local but $store does not exist" >&2; exit 1; }
```

`$store` — absolute, anchored, existence-checked — is what every recipe below and in `work-review`'s REFERENCE reads and writes; a bare `$dir` never appears again.

The check is that `$store` **exists**. A missing directory under `tracker: local` is a **setup problem to report**, not an empty queue — the same distinction **Selection query** in `REFERENCE.md` draws for a label the tracker lacks, and it fails the same silent way: a glob that matches nothing reads exactly like a backlog that is done.

## Eligible

```sh
# the implement loop's two inputs, by config key; drop a key whose mechanic is off.
# Quotes are optional in the file (see "The file"), so the match tolerates them.
grep -lE "^state:[[:space:]]*['\"]?(ready|changesRequested)['\"]?[[:space:]]*$" "$store"/*.md 2>/dev/null
```

Order the matches by `priority` (above), then by `number` — the file tracker's stand-in for creation order, and stable in a way a filesystem listing is not.

## Writing a transition

Every lifecycle move is one rewritten frontmatter line, written to a sibling temp file and **`mv`-ed over the issue** — so a crash leaves either the old file or the new one, never a half-written issue. Read-then-write in **one** command: these skills run each command in its own process, so a state read on one line is a stale fact by the next.

```sh
# $f is "$store/NNNN-slug.md" — always under the tracker's tree, never the current
# worktree's copy. $from/$to are config keys, $who the runner identity.
awk -v to="$to" -v who="$who" '
  NR == 1 && $0 == "---" { fm = 1; print; next }
  fm && $0 == "---"      { fm = 0; print; next }
  fm && /^state:/        { print "state: \047" to "\047"; next }
  fm && /^assignee:/     { print "assignee: " (who == "" ? "null" : "\047" who "\047"); next }
                         { print }
' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
```

The write emits the **canonical quoted** form while the `/^state:/` match accepts whatever the file holds — the read-tolerant / write-canonical rule from [The file](#the-file), which is also why the guard below cannot be quote-strict. Guard it with the `$from` state in the **same** command, with the matcher [written out](#the-file) rather than called from a helper the next process will not have:

```sh
grep -qE "^state:[[:space:]]*['\"]?$from['\"]?[[:space:]]*$" "$f" || exit 1
```

so a run that lost the race stops instead of overwriting — and so the guard cannot fail **open**, which an unresolved helper would make it do silently. **This is no more a compare-and-swap than the label flip is** — as everywhere else in this file, **The single-flight lock** in `REFERENCE.md` is what makes multi-consumer safe within a checkout, and the reconcile's guard is what covers the clones it cannot see.

## Referencing the issue from git

Reference the issue by its **path** — `Refs .agents/issues/0042-….md` — and **not** by `#42`. On a repo whose forge is GitHub a bare `#42` renders as a link to an unrelated GitHub issue, which is worse than no reference at all. The branch name needs no new rule: `ai/<ref>-<slug>` with the padded number as the ref (`ai/0042-add-a-local-tracker`), derivable from the filename alone.

That path is also the reconcile's artifact query (**Reconcile** in `REFERENCE.md`) — `git log origin/<branch> --grep '0042-'` for a shared branch, or the PR whose head is the issue's branch where the repo has a forge.

## What is inert here

Repo scope — `work.labels.repo`, in `trackers/linear.md` — (the files are already in the repo), `work.linear.*`, and **Catalog cache** in `REFERENCE.md`. Where the review loop puts its verdict — appended to the issue file, which is also where the round count is read from — is `work-review`'s REFERENCE.
