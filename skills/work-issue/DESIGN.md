# work-issue / work-queue — Design

The decision record behind the two skills. The "why"; the [REFERENCE](REFERENCE.md) holds the "how". Captured from the design session so the rationale survives.

## Core principle

**The queue is the tracker; the worker is stateless.** State lives in the issue's lifecycle label, not the agent. Each run reads tracker + git fresh, so runs are **resumable** (a crash continues, not restarts) and **idempotent** (a repeat is safe). Every decision below serves this.

## Two skills

| Skill                                  | Role                                                                              | Invocation                       |
| :------------------------------------- | :-------------------------------------------------------------------------------- | :------------------------------- |
| [`work-issue`](SKILL.md)               | The unit — one issue → one reviewable PR. A state machine over a single issue.    | model-invocable                  |
| [`work-queue`](../work-queue/SKILL.md) | The drain — select, prioritise, work the queue; delegates each to a fresh worker. | user-invoked, looped via `/loop` |

Split because the unit has **independent value** (`/work-issue 42`) and a fresh worker per issue keeps **context clean**. `work-issue` is model-invocable so the drain (and ad-hoc "work issue 42") can reach it; `work-queue` is user-invoked so a heavy autonomous drain never fires by accident. `/loop` is the temporal layer — the drain logic (claiming, ordering, caps) is too specific to live in the generic primitive.

## Key decisions

- **Concurrency is impossible by construction**, not locked — one live worker per tree, strict sequential `await`, plus a per-repo single-flight lock. Git's `index.lock` is only a backstop.
- **Lease before work** — flip `ready → working` + assign _before_ implementing. The race-breaker for two consumers grabbing one issue.
- **One PR per issue by default** (`branch: worktree`) — independent, reviewable, revertable; revisions stay isolated. The branch base is always the clean `pr.base`.
- **Branch strategy is two independent knobs** — `branch` (`worktree` | `branch:<name>`) × `parallel` (bool). Worktrees are the _mechanism_ of `parallel`, not a mode; a shared `branch:<name>` + `parallel` is made safe by **serialized integration** (so `branch:dev` + `parallel` works).
- **Terminal is `review`; the human merges.** The skill never merges; `done` is the PR merge (native tracker integration + reconcile). Only a `branch:<name>`-with-no-PR target lets the worker set `done` directly.
- **Verify before the PR** so `review` is honest; red-and-unfixable → `blocked`. `blocked` continues the drain — only a skill error stops it.
- **Feedback is a conversational argument, not a mechanism** — `work-issue 42, change X`. You are in the loop typing it, so there is no trust filter, no thread-resolution ledger, no auto-detect. (Code review still happens on the GitHub PR; CI / chat are equally valid revision channels.)
- **Linear repo scope = a stable label** (`work.labels.repo`), the single source of truth read by `work` (to filter) and `issue` (to tag). Projects are unsuitable — they are completable. No scope on Linear → the drain refuses.
- **One backend per repo**, never both. If labels mirror GitHub↔Linear, that is the integration's job; the agent writes only the configured side.

## Deferred (v2)

- **Stacked branches for dependent issues** — fights the stateless model and cascades through revisions; v1 leans on the `ready` gate instead.
- **`branch` extensions** — `dev`/named-branch grammar is designed in (`branch:<name>`); richer targets later.
- **Structured PR-feedback ingestion** (thread resolution, author trust, auto-detect) — only if conversational feedback proves insufficient.

(The tag side of repo scope — the [`issue`](../issue/SKILL.md) skill pinning `work.labels.repo` on Linear create — is implemented, not deferred.)
