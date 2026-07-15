---
name: work-queue
summary: Drains the ready issue queue — selects, prioritises and works each issue to a PR, sequentially or in parallel.
description: Drains a repo's queue of ready issues across GitHub (gh) or Linear (MCP) — selects every issue matching the configured labels, team and statuses, orders them by priority (and, on a shared branch, by dependency so prerequisites land first), then works each one to a reviewable pull request by delegating to work-issue. Starts by reconciling issues an earlier run left awaiting review — a merged PR moves its issue to done. Honours a per-run cap, runs sequentially or in parallel per config, and is safe to repeat (claim-before-work, single-flight lock). Backend and rules come from the committed config (.tituskirch-skills.json). Use when the user wants to batch-process, drain, or auto-work the open or ai-ready issues, run the issue loop, says things like "work the issues", "arbeite die Issues ab", "drain the queue", or runs it under /loop.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
---

# work-queue

Drain the repo's queue of **ready** issues — select, prioritise, and carry each one to a reviewable PR by delegating to [`work-issue`](../work-issue/SKILL.md). The loop is **thin**: the tracker is the queue and each issue is worked in a **fresh worker** so nothing accumulates across issues. Run it under `/loop work-queue` for continuous operation — the temporal repeat is the harness's job, the drain is this skill's.

## Workflow

### 1. Load config & lock

- Config + backend as in [`work-issue`](../work-issue/SKILL.md) (the `work.*` section; [REFERENCE](../work-issue/REFERENCE.md#config)).
- Acquire the **single-flight lock** — a file in the git common dir; a second drain in the same repo sees it and exits.

### 2. Reconcile — first, before the queue is built

Close out what an earlier run left waiting. For every issue sitting in `review`, read its PR — **merged → `done`**, **closed unmerged → `blocked`** + comment, **open (or no PR) → leave it**. Full rules: [REFERENCE](../work-issue/REFERENCE.md#reconcile).

This is the safety net for the terminal state: [`done` is the human's sign-off](../work-issue/REFERENCE.md#terminal-done), given in the session that ran the worker, so a session that ended before the human looked leaves the issue parked. The drain is the right home because **drains run anyway** — no dedicated trigger, which is exactly what the old "reconcile on a later run" promise lacked.

It runs **before selection**, so a just-reconciled issue is never re-worked, and it is **idempotent** — nothing to close out is the normal outcome, not an error.

### 3. Build the queue

- The [selection query](../work-issue/REFERENCE.md#selection-query) → every eligible issue → ordered by priority (Linear native priority; GitHub `work.priorityLabels`).
- **`branch:<name>` → re-sort into [dependency order](../work-issue/REFERENCE.md#dependency-ordering)** — prerequisites (blocked-by / parent) before dependents, priority as the tiebreak; **order first, then apply the cap**. The shared branch accumulates, so a dependent issue picks up its prerequisite's commits for free. Under `worktree` skip this — the `ready` gate is the dependency mechanism there.

### 4. Confirm the batch — once

Show the ordered queue plus the cap, branch strategy and parallel mode — call out any **dependency-forced order**, plus issues **deferred** (prerequisite not in this run) or **skipped** (dependency cycle). **One** confirmation for the whole batch, then run autonomously — the per-issue review happens later on each PR. Plan-only triggers ("nur den plan", "dry run", "don't run") → print the plan and stop.

### 5. Drain

For each issue, up to `work.cap`, spawn a **fresh worker** that runs [`work-issue`](../work-issue/SKILL.md) on exactly that issue:

- **sequential** (`parallel: false`) — one worker at a time; **re-fetch** the next eligible issue each iteration (never a stale snapshot).
- **parallel** (`parallel: true`) — N workers in isolated git worktrees; for a `branch:<name>` target, results are integrated **serialized** (no concurrent-commit race) and dependent issues never run concurrently — the graph is drained in **topological levels**, each level landing before the next starts. Mechanics: [REFERENCE](../work-issue/REFERENCE.md#branch-strategy).

Each worker returns `review`, `done`, `blocked`, or an error:

- **`review`** — the normal outcome: the PR is up and waiting on a human. Nobody is waiting on the worker, so **continue**; a verdict that never arrives this session is swept by the next drain's reconcile.
- **`done`** — a `branch:<name>` target with no PR ([why](../work-issue/REFERENCE.md#terminal-done)); **continue**.
- **`blocked`** — the worker has already labelled and commented it; **continue** to the next issue.
- **hard error** (git broken, backend down) — stop the drain, release the lock, report.

### 6. Report & release

Release the lock. Summarise each issue and its outcome (PR url / blocked reason / skipped), what the [reconcile](../work-issue/REFERENCE.md#reconcile) closed out (`done`) or sent to `blocked`, issues **deferred** to a later run, any **dependency cycle** a human needs to untangle, and any **label/body conflict** a worker flagged ([precedence](../work-issue/REFERENCE.md#label-vs-body-precedence)) — the drain runs unattended, so a warning it swallows never reaches anyone.

Issues left in `review` are the drain's **actual ask**: each wants a human verdict to reach `done`. Name them.

## Guardrails

- **Single-flight** — one drain per repo at a time.
- **Reconcile first, select second** — never re-work an issue the sweep is about to close out.
- **`done` only on evidence** — an observed merge, or the worker's no-PR commit. A stale `review` is a human's to answer, never the drain's to tidy away.
- **Claim-before-work, fresh fetch each iteration** — the worker leases each issue; the loop never snapshots the queue.
- **The cap is mandatory** — never drain unbounded, and apply it **after** the ordering, never before.
- **Never work a dependent before its prerequisite** — order the graph, defer what depends on work that is not landing this run, skip cycles for a human. Relations come from the tracker, never guessed from issue text.
- **`blocked` continues; only a skill error stops.** One hard issue must not kill the whole drain.
- Inherits [`work-issue`](../work-issue/SKILL.md)'s attribution-free, secret-free, only-this-issue guardrails — it does the actual writing.

## Reference

Shared config, the lifecycle, selection query, lease/race rules and branch strategies all live with the unit: [`work-issue/REFERENCE.md`](../work-issue/REFERENCE.md). Why it is shaped this way: [`work-issue/DESIGN.md`](../work-issue/DESIGN.md).
