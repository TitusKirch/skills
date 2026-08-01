---
name: work-implement
metadata:
  summary: Implements one tracked issue and pushes it for AI review — claim, implement, verify, push, hand off.
description: Implements a single tracked issue across GitHub (gh) or Linear (MCP) — claims it via the lifecycle label, implements on a branch (fresh from ready, or re-work from changes-requested after review feedback), runs the repo's checks, commits and PUSHES, and hands the issue to the review loop by advancing the label to review. It never reviews its own work — the separate work-review skill does that. Tracker, label lifecycle and branch strategy come from the committed config (.tituskirch-skills.json). Use when the user wants to work, implement, action or pick up one specific issue or ticket, mentions an ai-ready issue, or says things like "work issue 42", "arbeite Issue 42 ab", "implementiere Ticket X", or "address the review feedback on issue Y".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
---

# work-implement

Take **one** tracked issue, implement it, and push it so a **different** agent can review it — the stateless implement-unit behind `work-implement-queue`. One issue, one tracker (**GitHub** via `gh` or **Linear** via its MCP), picked per-repo by the same committed config the `issue` skill uses. State lives in the issue's **lifecycle label**, never in the agent — so a crashed run **resumes** instead of restarting.

This skill is the **implement half** of a two-loop workflow: it builds and pushes; `work-review` then reviews the pushed work. It **never reviews its own output** and never sets `done` — its terminal outputs are `reviewRequested` (handed to the review loop) or `blocked`.

**Opted out?** If the repo config sets `work` to `false`, this skill is **disabled** for the repo (as are the other `work-*` skills) — stop immediately and tell the user the work skills are turned off in `.tituskirch-skills.json`. An _absent_ `work` block is **not** disabled (it falls back to defaults). Check `.work == false` on the resolved config before any action — and before indexing `.work.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & resolve tracker

Resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included); the `work.*` section holds tracker, label lifecycle, branch strategy and Linear scope. Resolution per setting: **config → default**. Determine the tracker (`work.tracker`, falling back to `issue.tracker`) and confirm it is available/authenticated. Reuse the `issue` catalog cache for labels/teams/states.

Config schema, the full lifecycle and all mechanics: [REFERENCE.md](REFERENCE.md).

### 2. Resolve the target issue

- **Explicit** — an id/number/key the user names (`/work-implement 42`, `ENG-123`). A human naming the issue is the opt-in, so an **unlanded prerequisite** does not veto it — say so in the report and work it, the way a [body contradicting the label](REFERENCE.md#label-vs-body-precedence) is surfaced rather than obeyed.
- **Self-select** — none given → run the [selection query](REFERENCE.md#selection-query) and take the single highest-priority eligible issue (a `ready` **or** a `changes-requested` issue). That query **defers** an issue whose prerequisite has not landed — under `worktree` too, since branching off a clean `pr.base` cannot see it ([dependency ordering](REFERENCE.md#dependency-ordering)). None eligible → say so and stop.

### 3. Read the issue's state → pick the action

The lifecycle label decides what this run does — this skill is a **state machine over one issue**, and it only acts on the states it owns:

- **fresh** (`ready`) → claim and implement from the body (steps 4–8).
- **re-work** (`changes-requested`) → claim and implement from the body **plus the review feedback** (the reviewer's PR review / issue comment) — steps 4–8.
- **resume** (`working`) → a previous run leased it and crashed; continue where it left off (re-assert a clean tree first).
- **not ours** (`reviewRequested` / `reviewing` / `needs human` / `done`) → nothing to do here; `reviewRequested`, `reviewing` and `needs human` belong to `work-review` and the human. `blocked` → leave it unless the user explicitly re-runs it; report why it was blocked.

### 4. Claim the issue (lease) — before any work

Flip the label to `working` (`ready → working` or `changes-requested → working`) and assign the issue to the runner **first**, then start. The claim is the race-breaker: a second consumer sees it is no longer eligible and skips it. Honour the [single-flight lock](REFERENCE.md#lease--race-rules) — take it (direct run) or run under the drain's (queue). Already `working` with committed work → this is a **resume**, not a double-claim.

### 5. Prepare the branch

Assert a **clean tree** first. Then per `work.branch`:

- **`worktree`** — a fresh branch off `pr.base` (e.g. `dev`) named for the issue (`ai/<ref>-<slug>`). Own branch → own PR. For a **re-work**, check out the issue's existing branch instead of branching fresh.
- **`branch:<name>`** — work on that shared branch (e.g. `branch:dev`); commits land there directly (review happens **after** they land — see [review-after-land](REFERENCE.md#review-after-land)).

Branch naming, parallel/worktree handling and serialized integration: [REFERENCE.md](REFERENCE.md#branch-strategy).

### 6. Implement

**Re-read the issue body each run** — live tracker state, not a cached memory. The body is the source of truth for **scope and requirements**; it is not the source of truth for **eligibility** — the lifecycle label settled that at step 3 and stays [operative](REFERENCE.md#label-vs-body-precedence). A body line contradicting the current label ("early idea", "intentionally not `ai: ready`") is stale text, not a veto: **do the work and surface the conflict** — warn in the run's report and note it on the issue. Never let it silently override the label into a block.

- **fresh** → do the work the body describes.
- **re-work** (`changes-requested`) → **read the review feedback first** (the reviewer's `changes-requested` PR review or issue/Linear comment), address exactly that, then the body. The feedback is why this issue came back.

**Test-drive whatever a test can reach.** Where the change touches **code**, drive the `tdd` skill and run its loop in full — red before green, one vertical slice at a time, tests at seams rather than internals. `tdd` has the human confirm the seams before any test is written, and unattended there is nobody to ask: **the issue body stands in for the human**, so the requirements and acceptance criteria _are_ the agreed seams (`ai: ready` is already a human's approval). **Code touched and the body yields no seams → `blocked`** (step 7's exit) — never seams the run picked for itself. A **prose-only** change (a `SKILL.md` edit, a README) drives `tdd` **not at all**, and that is explicitly not a block: a missing seam only blocks when there is code behind it. Red **inside this step** is the loop working as designed and never blocks — step 7 stays the only gate. **`tdd` is optional**: not installed → implement exactly as today, no discipline driven and no block. Note what was driven, and what came of it, on the issue / PR at step 8 — it tells `work-review`, it does not bind its verdict. Mechanics: [REFERENCE.md](REFERENCE.md#test-discipline-tdd).

**When the issue itself is a bug, the work _is_ the diagnosis** — drive `diagnosing-bugs` and build a feedback loop that goes red on this bug **before** hypothesising, instead of reading code for a theory. **Optional call**: not installed, implement as today. What it changes here, and the rung of its ladder an unattended run cannot reach: [REFERENCE.md](REFERENCE.md#diagnosis-discipline).

Keep the change scoped to this one issue.

### 7. Verify

Run the repo's checks (the root `verify` key, else detected — tests, lint, build). **Working in a worktree** (`parallel: true`) means a tree with **no dependencies installed** — `git worktree` checks out tracked files only — so **install from the lockfile there first**, or the gate never touches the versions this branch pins ([how](REFERENCE.md#running-the-repos-checks)). A run in the working tree already has them and skips it. Green → continue. **Red and unfixable, spec ambiguous, or a genuine human decision needed → set `blocked`**, comment the reason on the issue, stop — a code change whose body yields no [seams](REFERENCE.md#test-discipline-tdd) is one such ambiguity, raised at step 6 and exiting here. `blocked` is a real outcome, not a failure to hide.

Red is the one limb of the block clause with a procedure behind it: **red → drive `diagnosing-bugs` before calling it unfixable.** "Unfixable" is the cheapest legitimate exit from a drain — it ends a run without failing it — so it is **earned by a loop that was actually built**, never asserted. **Spec ambiguous or a genuine human decision needed → set `blocked` straight away**; neither is a bug case, and no reproduction answers them. When the diagnosis lands on a cause outside this issue's scope, or **no loop can be constructed at all** (the skill's own stop rule), **set `blocked`** — commenting **which loop constructions were tried and how each failed**, not merely the conclusion — and stop. **Optional call**: not installed, block exactly as today. `blocked` is a real outcome, not a failure to hide. Entry points, the unreachable rung and what the comment carries: [REFERENCE.md](REFERENCE.md#diagnosis-discipline).

### 8. Commit, PUSH, hand off to review

The **push** is the moment the work becomes reviewable — it is the boundary between `working` and `reviewRequested`.

- Commit via `atomic-commit`; reference the issue so the tracker links it (`Refs #42` / the Linear key). **`atomic-commit` is optional** — not installed, commit directly in the repo's own Conventional Commits conventions, carrying the same reference line.
- **PUSH** the work: open/update the PR via `pull-request` (worktree), or push the commit(s) to the shared branch (`branch:<name>`). **`pull-request` is optional too**, and only the `worktree` path reaches it at all — not installed, open the PR with the forge CLI directly, same base and head. Until this succeeds the issue stays `working` (a crash before the push is reclaimed as a [working-orphan](REFERENCE.md#reconcile)).
- Record what [step 6's test discipline](REFERENCE.md#test-discipline-tdd) did — the seams read out of the body and the slices `tdd` drove, or that the change was prose-only or `tdd` absent — in the PR body (`worktree`) or an issue comment (`branch:<name>`). It **informs** the reviewer; it is never a verdict, and `work-review` still judges the diff against the requirements.
- Move the label `working → reviewRequested` — the handoff to `work-review`. Report the issue id / PR url.
- The skill **never merges**, never reviews, and **never sets `done`, `changes-requested` or `needs human`** — those are the review loop's and the human's outputs.

Inside a `work-implement-queue` drain nobody waits on this worker — return `reviewRequested` and let the drain move on. The review loop picks the issue up next.

## Guardrails

- **Lease before work.** Never implement an issue you have not first flipped to `working`.
- **Push before handoff.** Only flip to `reviewRequested` once the work is pushed and visible to a reviewer; local-only work stays `working`.
- **Stateless & resumable.** Read state from the tracker + git every run; carry nothing between runs.
- **Only this issue.** Never touch sibling issues, never merge, never close anything you were not asked to.
- **Never review your own work.** This skill only produces `reviewRequested` or `blocked`; it never sets `done`, `changes-requested`, or `needs human`.
- **"Unfixable" is earned, not asserted.** Red exits to `blocked` only after a diagnosis loop was attempted, and the **attempt** is what the issue comment records — which loop constructions were tried, how each failed, and that the human-in-the-loop rung was unreachable unattended. A `blocked` with a failed loop construction behind it is **evidence**; one without is an opinion, and the two read identically on the issue.
- **A missing hand-off helper degrades, never blocks.** `atomic-commit` and `pull-request` are **optional** calls, not preconditions: without them, commit in the repo's own conventions and open the PR with the forge CLI. Verified work is never left uncommitted or unpushed because a helper skill is absent — the push is what the lifecycle turns on.
- **Test-drive code, not prose.** A change touching code runs `tdd`'s red-green loop with the issue body as the confirmed seams; a prose-only change runs it not at all, and that is not a block. Code with no seams in the body **is** a block — the run never picks its own seams, because seams chosen after the fact land exactly where the implementation already is. A missing `tdd` degrades to implementing as today, never to a block.
- **Attribution-free & secret-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in branches, commits, PRs or comments; scan the change and context for secrets and exclude them.
- **`ai: ready` is the approval.** A human marking an issue `ai: ready` ("scoped + approved for an AI agent to pick up") is the opt-in, so the drain — and a direct `/work-implement 42` on an already-`ready`/`changes-requested` issue — works it **without re-confirming**. Confirm first only when there is no such opt-in (an issue not in an approved state, or a ready-gate widened to `false`).

## Reference

Config schema, the lifecycle state machine, selection query, lease & race rules, the test discipline `tdd` carries, branch strategies (`worktree` / `branch:<name>`, sequential & parallel) and the two tracker recipes: [REFERENCE.md](REFERENCE.md). Why it is shaped this way: [DESIGN.md](DESIGN.md).
