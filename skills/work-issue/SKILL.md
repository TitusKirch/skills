---
name: work-issue
summary: Works one tracked issue to a reviewable PR across GitHub or Linear — claim, implement, verify, open PR, sign off.
description: Works a single tracked issue end-to-end across GitHub (gh) or Linear (MCP) — claims it via the lifecycle label, implements on a branch, runs the repo's checks, opens a pull request, and advances the label to review. Tracker, label lifecycle and branch strategy come from the committed config (.tituskirch-skills.json). Review is a real waiting state — the skill also applies free-text revision feedback onto an issue's existing PR branch, and signs an issue off to done once the human approves it. Use when the user wants to work, implement, action, ship or pick up one specific issue or ticket, mentions an ai-ready issue, or says things like "work issue 42", "arbeite Issue 42 ab", "implementiere Ticket X", "address the feedback on issue Y", or "issue 42 looks good".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
---

# work-issue

Take **one** tracked issue and carry it to a reviewable pull request — the stateless unit behind [`work-queue`](../work-queue/SKILL.md). One issue, one tracker (**GitHub** via `gh` or **Linear** via its MCP), picked per-repo by the same committed config the [`issue`](../issue/SKILL.md) skill uses. State lives in the issue's **lifecycle label**, never in the agent — so a crashed run **resumes** instead of restarting.

**Opted out?** If the repo config sets `work` to `false`, this skill is **disabled** for the repo (as is [`work-queue`](../work-queue/SKILL.md)) — stop immediately and tell the user the work skills are turned off in `.tituskirch-skills.json`. An _absent_ `work` block is **not** disabled (it falls back to defaults). Check `jq -e '.work == false'` before any action — and before indexing `.work.*`.

## Workflow

### 1. Load config & resolve tracker

Read `$(git rev-parse --show-toplevel)/.tituskirch-skills.json` with `jq`; the `work.*` section holds tracker, label lifecycle, branch strategy and Linear scope. Resolution per setting: **config → default**. Determine the tracker (`work.tracker`, falling back to `issue.tracker`) and confirm it is available/authenticated. Reuse the [`issue`](../issue/REFERENCE.md#catalog-cache) catalog cache for labels/teams/states.

Config schema, the lifecycle and all mechanics: [REFERENCE.md](REFERENCE.md).

### 2. Resolve the target issue

- **Explicit** — an id/number/key the user names (`/work-issue 42`, `ENG-123`).
- **Self-select** — none given → run the selection query (REFERENCE) and take the single highest-priority eligible issue. None eligible → say so and stop.

### 3. Read the issue's state → pick the action

The lifecycle label decides what this run does. This is the whole skill — a **state machine over one issue**:

- **fresh** (`ready`, no PR) → claim and implement (steps 4–9).
- **revision** (`review`/`working` with an existing PR, plus revision instructions — free-text args and/or feedback on the PR) → move the label back to `working`, check out the existing branch, apply the feedback, re-push, back to `review` (steps 6–9; skip branch creation).
- **sign-off** (`review`, and the human says it is good) → set `done` and stop (step 9).
- **blocked** → leave it unless the user explicitly re-runs it; report why it was blocked.
- **done** → nothing to do.

### 4. Claim the issue (lease) — before any work

Flip the label `ready → working` and assign the issue to the runner **first**, then start. The claim is the race-breaker: a second consumer sees it is no longer ready and skips it. Already `working` with a branch → this is a **resume**, not a double-claim; continue where it left off.

### 5. Prepare the branch

Assert a **clean tree** first. Then per `work.branch`:

- **`worktree`** — a fresh branch off `pr.base` (e.g. `dev`) named for the issue (`ai/<ref>-<slug>`). Own branch → own PR.
- **`branch:<name>`** — work on that shared branch (e.g. `branch:dev`); commits land there, one shared PR (or none, for `dev`).

Branch naming, parallel/worktree handling and serialized integration: [REFERENCE.md](REFERENCE.md#branch-strategy).

### 6. Implement

**Re-read the issue body each run** — live tracker state, not a cached memory. The body is the source of truth for **scope and requirements**; it is not the source of truth for **eligibility** — the lifecycle label settled that at step 3 and stays [operative](REFERENCE.md#label-vs-body-precedence). A body line contradicting the current label ("early idea", "intentionally not `ai: ready`") is stale text, not a veto: **do the work and surface the conflict** — warn in the run's report and note it on the issue. Never let it silently override the label into a block.

Do the work the body describes, plus any revision instructions. Keep the change scoped to this one issue.

### 7. Verify — make `review` honest

Run the repo's checks (`work.verify`, else detected — tests, lint, build). Green → continue. **Red and unfixable, spec ambiguous, or a human decision needed → set `blocked`**, comment the reason on the issue, stop. `blocked` is a real outcome, not a failure to hide.

### 8. Commit, open the PR, advance the label

- Commit via [`atomic-commit`](../atomic-commit/SKILL.md); reference the issue so the tracker links the PR (`Closes #42` / the Linear key). That link is traceability — it is [not what reaches `done`](REFERENCE.md#terminal-done).
- Open or update the PR via [`pull-request`](../pull-request/SKILL.md), base `pr.base`.
- Move the label `working → review`. Report the PR url / issue id.
- The skill **never merges** — that is the human's act.
- **No PR** (`branch:<name>` with no PR, e.g. `branch:dev`) → nothing to review and no merge to observe: set `done` after the commit and stop. [Why](REFERENCE.md#terminal-done).

### 9. Wait for the sign-off — `review` is a real stop

`review` means **waiting on a human**, not finished. **`done` is the human's sign-off, not the merge** — native tracker automation cannot carry a non-default `pr.base`, so the lifecycle no longer waits on it ([why](REFERENCE.md#terminal-done)).

Invoked directly by a human → stop here; they answer in this same session:

- **"looks good"** → set `done` and stop.
- **feedback** → back to `working`, apply it (steps 6–8), re-push, back to `review`.

Inside a [`work-queue`](../work-queue/SKILL.md) drain nobody is waiting on this worker — return `review` and let the drain move on. If the session ends before the human looks, the next drain's [reconcile](REFERENCE.md#reconcile) closes it out.

## Guardrails

- **Lease before work.** Never implement an issue you have not first flipped to `working`.
- **Stateless & resumable.** Read state from the tracker + git every run; carry nothing between runs.
- **Only this issue.** Never touch sibling issues, never merge, never close anything you were not asked to.
- **`done` is the human's word.** Set it on an explicit sign-off, on a [reconcile](REFERENCE.md#reconcile) that observes the PR merged, or straight after the commit on a `branch:<name>` target with no PR — never on your own initiative, and never to tidy a stale `review` away.
- **Attribution-free & secret-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in branches, commits, PRs or comments; scan the change and context for secrets and exclude them.
- **Confirm before writing** when invoked directly by a human; run autonomously when invoked inside a [`work-queue`](../work-queue/SKILL.md) batch (already confirmed once).

## Reference

Config schema, the lifecycle state machine, selection query, lease & race rules, branch strategies (`worktree` / `branch:<name>`, sequential & parallel) and the two tracker recipes: [REFERENCE.md](REFERENCE.md). Why it is shaped this way: [DESIGN.md](DESIGN.md).
