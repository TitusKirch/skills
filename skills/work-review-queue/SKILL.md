---
name: work-review-queue
summary: Drains the awaiting-review queue — reviews each pushed issue with a fresh agent, routing to done/changes/needs-human.
description: Drains a repo's queue of issues awaiting AI review across GitHub (gh) or Linear (MCP) — selects every issue in review, then reviews each with a fresh, independent agent by delegating to work-review, routing each to done, changes-requested (back to the implement loop), needs-human, or blocked. Starts by reconciling issues whose PR a human merged or closed out-of-band. Honours a per-run cap, single-flight-locked with a lock separate from the implement loop's, so review and implement drains run concurrently. Use when the user wants to review, drain, or auto-review the pushed AI work, run the review loop, says things like "review the queue", "reviewe die Issues", "drain the review queue", or runs it under /loop.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
---

# work-review-queue

Drain the repo's queue of issues **awaiting review** — every issue in `review` — and give each a verdict by delegating to [`work-review`](../work-review/SKILL.md). The **review half** of the two-loop workflow: it consumes what [`work-implement-queue`](../work-implement-queue/SKILL.md) pushed, and each issue leaves as `done`, `changes-requested` (back to the implement loop), `needs human`, or `blocked`. Each issue is reviewed by a **fresh worker** — a different agent than the one that built it. Run it under `/loop work-review-queue` for continuous operation, alongside the implement loop.

**Opted out?** If the repo config sets `work` to `false`, all `work-*` skills are **disabled** — stop and tell the user they are turned off in `.tituskirch-skills.json`. Check `jq -e '.work == false'` before acquiring the lock or building the queue.

## Workflow

### 1. Load config & lock

- Config + tracker as in [`work-implement`](../work-implement/SKILL.md) (the `work.*` section; `work.review.maxRounds` governs escalation).
- Acquire the **review single-flight lock** — a **separate** lock file from the implement loop's, so an implement-drain and a review-drain can run at the same time in the same repo.

### 2. Reconcile — close out out-of-band human actions

Before building the queue, for every issue in `review`, check whether a human acted on its PR out-of-band:

- **PR merged** → set `done` — a human merge is implicit acceptance.
- **PR closed, unmerged** → set `blocked` + comment — a human closed it without merging.
- **PR open / no PR** → leave it — it is a normal review candidate (the drain will review it).

Idempotent; nothing to close out is the normal outcome. `needs human` issues are left untouched — they wait on a human, not on this drain.

### 3. Build the queue

The [selection query](../work-review/REFERENCE.md#selection-query) → every issue in `review` → ordered by priority (Linear native priority; GitHub `work.priorityLabels`). No dependency re-sort — review order is priority only.

### 4. Confirm the batch — once

Show the ordered queue plus the cap. **One** confirmation, then run autonomously. Plan-only triggers ("nur den plan", "dry run", "don't run") → print the plan and stop.

### 5. Drain

For each issue, up to `work.cap`, spawn a **fresh worker** that runs [`work-review`](../work-review/SKILL.md) on exactly that issue. **Sequential** re-fetches the next `review` issue each iteration; **parallel** reviews N concurrently (review is read-only, so no integration race).

Each worker returns a verdict — `done`, `changes-requested`, `needs human`, or `blocked` — or an error. Any verdict → **continue**; only a **hard error** (git broken, tracker down) stops the drain, releases the lock, and reports.

### 6. Report & release

Release the lock. Summarise each issue and its verdict, what the reconcile closed out. Name specifically:

- **`changes-requested`** — back in the implement queue; the next implement-drain re-works them.
- **`needs human`** — the drain's **actual ask**: each wants a human verdict (via `/work-review <n>`) to reach `done` or go back for changes.
- **`blocked`** — need a human call.

## Guardrails

- **Single-flight, separate lock** — one review-drain per repo, independent of the implement lock; the two loops run concurrently.
- **Reconcile first, select second.**
- **The cap is mandatory** — apply it after the ordering.
- **Fresh worker per issue, never the implementer.** Review value comes from independence; the drain spawns a new reviewer each time.
- **This loop never implements.** It produces verdicts only; the fix is the implement loop's job.
- Inherits [`work-review`](../work-review/SKILL.md)'s read-only, attribution-free, secret-free guardrails.

## Reference

The review unit, selection query, round-count, escalation policy and feedback recipes: [`work-review/REFERENCE.md`](../work-review/REFERENCE.md). The implement half: [`work-implement-queue`](../work-implement-queue/SKILL.md). Lifecycle and design: [`work-implement/DESIGN.md`](../work-implement/DESIGN.md).
