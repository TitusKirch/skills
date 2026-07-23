---
name: work-implement-queue
summary: Drains the ready/changes-requested queue — implements each issue to a pushed, reviewable state.
description: Drains a repo's queue of implementable issues across GitHub (gh) or Linear (MCP) — selects every issue that is ready or has changes requested, orders them by priority (and, on a shared branch, by dependency), then implements each one to a pushed, reviewable state by delegating to work-implement. It hands each issue to the review loop (label review); the separate work-review-queue reviews them. Starts by reclaiming issues an earlier run crashed mid-implementation. Honours a per-run cap, runs sequentially or in parallel per config, single-flight-locked. Use when the user wants to batch-process, drain, or auto-implement the ready issues, run the implement loop, says things like "work the issues", "arbeite die Issues ab", "drain the queue", or runs it under /loop.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
---

# work-implement-queue

Drain the repo's queue of **implementable** issues — every `ready` issue plus every `changes-requested` issue (re-work after review) — and carry each to a **pushed, reviewable** state by delegating to [`work-implement`](../work-implement/SKILL.md). The loop is **thin**: the tracker is the queue, each issue is worked in a **fresh worker**, and the output is an issue in `review`, handed to the [`work-review-queue`](../work-review-queue/SKILL.md). Run it under `/loop work-implement-queue` for continuous operation.

**Opted out?** If the repo config sets `work` to `false`, all `work-*` skills are **disabled** for the repo — stop immediately and tell the user they are turned off in `.tituskirch-skills.json`. An _absent_ `work` block is **not** disabled. Check `.work == false` on the resolved config before acquiring the lock or building the queue. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & lock

- Config + tracker as in [`work-implement`](../work-implement/SKILL.md) (the `work.*` section; [REFERENCE](../work-implement/REFERENCE.md#config)).
- Acquire the **implement single-flight lock** — a file in the git common dir; a second implement-drain in the same repo sees it and exits. (The review loop uses a **separate** lock, so implement and review drains can run concurrently.)

### 2. Reconcile — reclaim crashed implementations

Before building the queue, reclaim issues an earlier implement-run crashed on: an issue in `working` with **no pushed artifact** (no PR / no pushed commit for it) was leased but abandoned before its push. The implement lock guarantees no live worker holds it, so **flip it back to `ready`** (and drop the assignee) to be re-worked — or `blocked` if it left an unrecoverable state. Full rules: [REFERENCE](../work-implement/REFERENCE.md#reconcile). Idempotent — nothing to reclaim is the normal outcome.

(A `working` issue **with** a pushed artifact only failed to flip its label — advance it to `review` instead of re-working.)

### 3. Build the queue

- The [selection query](../work-implement/REFERENCE.md#selection-query) → every eligible issue (`ready` **or** `changes-requested`) → ordered by priority (Linear native priority; GitHub `work.priorityLabels`).
- **`branch:<name>` → re-sort into [dependency order](../work-implement/REFERENCE.md#dependency-ordering)** — prerequisites before dependents, priority as the tiebreak; **order first, then apply the cap**. Under `worktree` skip this.

### 4. Announce the batch — then drain

**`ai: ready` is already the human's approval** to work an issue — the label means "scoped + approved for an AI agent to pick up". So the drain does **not** gate on a fresh confirmation: **announce** the ordered queue plus the cap, branch strategy and parallel mode (call out any **dependency-forced order**, plus issues **deferred** or **skipped**), then drain. Under `/loop` it runs unattended.

- **Plan-only triggers** ("nur den plan", "dry run", "don't run") still stop after the plan.
- If the ready-gate is **widened** (`labels.ready: false`, so issues were never explicitly opted-in), confirm before working those — there is no per-issue approval to lean on.

### 5. Drain

For each issue, up to `work.cap`, spawn a **fresh worker** that runs [`work-implement`](../work-implement/SKILL.md) on exactly that issue:

- **sequential** (`parallel: false`) — one worker at a time; **re-fetch** the next eligible issue each iteration.
- **parallel** (`parallel: true`) — N workers in isolated git worktrees; for a `branch:<name>` target, pushes are integrated **serialized**; dependent issues never run concurrently. Mechanics: [REFERENCE](../work-implement/REFERENCE.md#branch-strategy).

Each worker returns `review` (pushed, handed to the review loop — the normal outcome), `blocked`, or an error. **`review`/`blocked` → continue** to the next issue; only a **hard error** (git broken, tracker down) stops the drain, releases the lock, and reports.

### 6. Report & release

Release the lock. Summarise each issue and its outcome (handed to `review` / `blocked` reason / skipped), what the reconcile reclaimed, issues **deferred** to a later run, any **dependency cycle** a human must untangle, and any **label/body conflict** a worker flagged.

Issues now in `review` are the drain's hand-off — the [`work-review-queue`](../work-review-queue/SKILL.md) picks them up. Name the count.

## Config

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# $skill is this skill's own directory — the one this file was loaded from,
# not the repo being worked on. The resolver reads the repo's config itself.
resolved=$(sh "$skill/templates/resolve-config.sh") || resolved=
[ -n "$resolved" ] || resolved='{}'
```

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `2` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

## Guardrails

- **Single-flight** — one implement-drain per repo at a time (separate from the review lock).
- **Reconcile first, select second** — never re-work an issue the sweep is about to reclaim.
- **Claim-before-work, fresh fetch each iteration** — the worker leases each issue; the loop never snapshots the queue.
- **The cap is mandatory** — never drain unbounded, and apply it **after** the ordering.
- **Never work a dependent before its prerequisite** — order the graph, defer what depends on work not landing this run, skip cycles for a human.
- **This loop never reviews.** It produces `review`/`blocked` only; `done`/`changes-requested`/`needs human` are the review loop's and the human's.
- Inherits [`work-implement`](../work-implement/SKILL.md)'s attribution-free, secret-free, only-this-issue guardrails.

## Reference

Shared config, the lifecycle, selection query, lease/race rules and branch strategies live with the unit: [`work-implement/REFERENCE.md`](../work-implement/REFERENCE.md). The review half: [`work-review-queue`](../work-review-queue/SKILL.md). Why it is shaped this way: [`work-implement/DESIGN.md`](../work-implement/DESIGN.md).
