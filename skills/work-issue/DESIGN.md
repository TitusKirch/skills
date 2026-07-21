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
- **The label is operative for eligibility; the body governs scope.** Both are live and can disagree — a creation-time "not ready yet" note outlives the label a human flipped days later, and a run that trusts the older text hands back a decision the human already made. The label is the queue's contract and the deliberate act, so it decides _whether_ to work an issue; the body decides _what_ the work is. A contradiction is **surfaced as a warning**, never a silent self-block: flagging it lets the human fix the wrong side, whereas blocking on it buries a live decision under stale prose. Rejected: **arbitrating by timestamp** ("newer human act wins", via the tracker's timeline/history API) — an operative label never asks which side is newer, so the comparison costs an API call per issue to answer a question the rule does not pose, and re-opens as a race the thing the rule settles by construction.
- **One PR per issue by default** (`branch: worktree`) — independent, reviewable, revertable; revisions stay isolated. The branch base is always the clean `pr.base`.
- **Branch strategy is two independent knobs** — `branch` (`worktree` | `branch:<name>`) × `parallel` (bool). Worktrees are the _mechanism_ of `parallel`, not a mode; a shared `branch:<name>` + `parallel` is made safe by **serialized integration** (so `branch:dev` + `parallel` works).
- **Dependencies are an _ordering_ problem on a shared branch, a _branching_ problem in worktrees.** Under `branch:<name>` the branch accumulates, so working prerequisites first is the entire mechanism — topological order, priority as tiebreak, cap applied after. Under `worktree` nothing accumulates, so the `ready` gate still governs there. Cheap where it is cheap; still deferred where it is not.
- **`done` is the human's sign-off, not the merge.** The skill still never merges — but native tracker automation cannot be the terminal signal: GitHub's `Closes #<n>` and Linear's GitHub integration fire only on a **default-branch** merge, so every repo whose `pr.base` is an integration branch had an **unreachable terminal state** (issues read `done` never, or read `done` while still open). So `review` became a real waiting state the worker stops at, and the human's verdict in the **same session that ran the skill** advances it — "looks good" → `done`, feedback → back to `working`. That session is the actual working mode, which is why no external trigger is needed. **Accepted in exchange:** `done` means **accepted**, not merged — under `worktree` the PR may still be open when the issue reads `done`. Deliberate: the queue's business is the work; shipping is the rollup merge's business. Rejected: **the worker sets `done` when it observes the merge** — still needs a run at merge time, inheriting the same trigger gap; and **only making the docs honest** ("`done` is manual with a non-default `pr.base`") — accurate, but leaves the terminal state a chore. Deferred: hanging the terminal on the **rollup merge to the default branch**, which the [`release`](../release/SKILL.md) skill now drives — viable as a later refinement.
- **The reconcile is the drain's first step, not a new trigger.** A session that ends before the human looks parks the issue in `review`; the next `work-queue` drain sweeps it (merged → `done`, closed-unmerged → `blocked`). This is the only place the old "reconciled on a later run" line could be made true: it assumed a `work-issue` run aimed at a finished issue, which nobody ever triggers _because_ it is finished. Drains, by contrast, run anyway. **Closed-unmerged → `blocked`** because a human closed that PR and only they know whether it means rework, superseded, or abandoned — the side-exit's exact purpose, and it stops `review` from becoming the new permanent parking spot.
- **No PR → no `review` stop.** A `branch:<name>` target with no PR (e.g. `branch:dev`) still goes straight to `done` at commit time. Three reasons it is not an inconsistency: there is **no artifact** to review; there is **no merge** for the reconcile to observe, so a waiting state would strand the issue exactly the way this rule exists to prevent; and a per-issue stop would contradict `work-queue`'s **single batch confirmation**, making an autonomous drain interactive. That batch confirmation _is_ the sign-off here, and the code review happens on the rollup PR.
- **Verify before the PR** so `review` is honest; red-and-unfixable → `blocked`. `blocked` continues the drain — only a skill error stops it.
- **Feedback is a conversational argument, not a mechanism** — `work-issue 42, change X`. You are in the loop typing it, so there is no trust filter, no thread-resolution ledger, no auto-detect. (Code review still happens on the GitHub PR; CI / chat are equally valid revision channels.)
- **Linear repo scope = a stable label** (`work.labels.repo`), the single source of truth read by `work` (to filter) and `issue` (to tag). Projects are unsuitable — they are completable. No scope on Linear → the drain refuses.
- **One tracker per repo**, never both. If labels mirror GitHub↔Linear, that is the integration's job; the agent writes only the configured side.

## Deferred (v2)

- **Stacked branches for dependent issues (`worktree` mode)** — branch-off-parent, PR base retargeting and a revision cascade fight the stateless model; `worktree` leans on the `ready` gate instead. Only the `branch:<name>` half is implemented ([dependency ordering](REFERENCE.md#dependency-ordering)) — accumulation makes it pure ordering, with none of that machinery.
- **`branch` extensions** — `dev`/named-branch grammar is designed in (`branch:<name>`); richer targets later.
- **Structured PR-feedback ingestion** (thread resolution, author trust, auto-detect) — only if conversational feedback proves insufficient.

(The tag side of repo scope — the [`issue`](../issue/SKILL.md) skill pinning `work.labels.repo` on Linear create — is implemented, not deferred.)
