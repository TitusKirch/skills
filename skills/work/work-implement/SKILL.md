---
name: work-implement
metadata:
  summary: Implements one tracked issue and pushes it for AI review — claim, implement, verify, push, hand off.
description: Implements a single tracked issue across GitHub (gh), GitLab (glab), Linear (MCP) or local issue files — claims it via the lifecycle label, implements on a branch (fresh from ready, or re-work from changes-requested after review feedback), runs the repo's checks, commits and PUSHES, and hands the issue to the review loop by advancing the label to review. It never reviews its own work — the separate work-review skill does that. Tracker, label lifecycle and branch strategy come from the committed config (.tituskirch-skills.json). Use when the user wants to work, implement, action or pick up one specific issue or ticket, mentions an ai-ready issue, or says things like "work issue 42", "arbeite Issue 42 ab", "implementiere Ticket X", or "address the review feedback on issue Y".
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

This skill is the **implement half** of a two-loop workflow: it builds and pushes; `work-review` then reviews the pushed work. It **never reviews its own output** and never sets `done` — its terminal outputs are `reviewRequested` (handed to the review loop), `blocked`, or `skipped` (contradictory labels — reported, tracker untouched).

**Opted out?** If the repo config sets `work` to `false`, this skill is **disabled** for the repo (as are the other `work-*` skills) — stop immediately and tell the user the work skills are turned off in `.tituskirch-skills.json`. An _absent_ `work` block is **not** disabled (it falls back to defaults). Check `.work == false` on the resolved config before any action — and before indexing `.work.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & resolve tracker

Resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included); the `work.*` section holds tracker, label lifecycle, branch strategy, the [feedback destination](REFERENCE.md#feedback-destination) and Linear scope. Resolution per setting: **config → default**. Determine the tracker (`work.tracker`, falling back to `issue.tracker`) and confirm it is available/authenticated. Reuse the `issue` catalog cache for labels/teams/states.

Config schema, the full lifecycle and everything a run needs whatever its tracker: [REFERENCE.md](REFERENCE.md). The tracker recipes are one file each, and this step settles which: [`trackers/github.md`](trackers/github.md), [`trackers/gitlab.md`](trackers/gitlab.md), [`trackers/linear.md`](trackers/linear.md), [`trackers/local.md`](trackers/local.md).

### 2. Resolve the target issue

- **Explicit** — an id/number/key the user names (`/work-implement 42`, `ENG-123`). A human naming the issue is the opt-in, so an **unlanded prerequisite** does not veto it — say so in the report and work it, the way a [body contradicting the label](REFERENCE.md#label-vs-body-precedence) is surfaced rather than obeyed.
- **Self-select** — none given → run the [selection query](REFERENCE.md#selection-query) and take the single highest-priority eligible issue (a `ready` **or** a `changes-requested` issue). That query **defers** an issue whose prerequisite has not landed — under `worktree` too, since branching off a clean `pr.base` cannot see it ([dependency ordering](REFERENCE.md#dependency-ordering)). None eligible → say so and stop.

### 3. Read the issue's state → pick the action

The lifecycle label decides what this run does — this skill is a **state machine over one issue**, and it only acts on the states it owns:

- **fresh** (`ready`) → claim and implement from the body (steps 4–8).
- **re-work** (`changes-requested`) → claim and implement from the body **plus the review feedback** (the reviewer's PR review / issue comment) — steps 4–8.
- **resume** (`working`) → a previous run leased it and crashed; continue where it left off (re-assert a clean tree first).
- **not ours** (`reviewRequested` / `reviewing` / `needs human` / `done`) → nothing to do here; `reviewRequested`, `reviewing` and `needs human` belong to `work-review` and the human. `blocked` → leave it unless the user explicitly re-runs it; report why it was blocked.

**Read the whole label set, not just the lifecycle one.** An issue carrying `labels.needsTriage` (when the repo configures it) _alongside_ `ready` or `changes-requested` is two humans contradicting each other — "nobody has assessed this" against "approved, pick it up". **Skip it: no lease, no label, no assignee, no comment** — and name the contradiction in the run's report so a human clears it. Do **not** obey the more permissive label, and do **not** write `blocked` — the work is not blocked, a label is wrong ([contradictory labels](REFERENCE.md#contradictory-labels)). This is a third terminal output alongside `reviewRequested` and `blocked`, and the one that leaves the tracker untouched. The check runs here, at claim time, even when a drain already partitioned the queue — the label can be added between the queue build and the lease.

### 4. Claim the issue (lease) — before any work

Flip the label to `working` (`ready → working` or `changes-requested → working`) and assign the issue to the runner **first**, then start. The claim is the race-breaker: a second consumer sees it is no longer eligible and skips it. Honour the [single-flight lock](REFERENCE.md#lease--race-rules) — take it (direct run) or run under the drain's (queue). Already `working` with committed work → this is a **resume**, not a double-claim.

### 5. Prepare the branch

Assert a **clean tree** first. Then per `work.branch`:

- **`worktree`** — a fresh branch off `pr.base` (e.g. `dev`) named for the issue. **The name carries the run's queue mode**: `ai/<ref>-<slug>` normally, `ai/queue/<ref>-<slug>` when [`work.queueBranch`](REFERENCE.md#queue-branch) is on — that prefix is the only signal the repo's grouping workflow ever gets, so it is what decides whether this PR is grouped. Own branch → own PR. For a **re-work**, check out the issue's existing branch instead of branching fresh — which is why the mode binds to the **issue**, not to the round. Where the branch is **cut from** is `pr.base` either way; `queueBranch` moves only the name here and the **PR's base** at step 8.
- **`branch:<name>`** — work on that shared branch (e.g. `branch:dev`); commits land there directly (review happens **after** they land — see [review-after-land](REFERENCE.md#review-after-land)).

Branch naming, parallel/worktree handling and serialized integration: [REFERENCE.md](REFERENCE.md#branch-strategy).

### 6. Implement

**Re-read the issue body each run** — live tracker state, not a cached memory. The body is the source of truth for **scope and requirements**; it is not the source of truth for **eligibility** — the lifecycle label settled that at step 3 and stays [operative](REFERENCE.md#label-vs-body-precedence). A body line contradicting the current label ("early idea", "intentionally not `ai: ready`") is stale text, not a veto: **do the work and surface the conflict** — warn in the run's report and note it at the [feedback destination](REFERENCE.md#feedback-destination). Never let it silently override the label into a block.

**Read the comments too, and settle body against comment by rule rather than by escalating.** The body is the scope, so a newer body edit supersedes an older comment — _unless_ that comment explicitly revised a named earlier decision ("this revises the comment above") and the body never mentions the revision, in which case the revision is the live decision and the body is the stale text. Follow the surviving statement, and **name both** — the two statements, their timestamps and which one this run followed — in the report and at the feedback destination: [body vs comment precedence](REFERENCE.md#body-vs-comment-precedence).

- **fresh** → do the work the body describes.
- **re-work** (`changes-requested`) → **read the review feedback first** (the reviewer's `changes-requested` PR review or issue/Linear comment — look in **both** places, since `work.feedback` routes only where feedback is _written_), address exactly that, then the body. The feedback is why this issue came back.

**Test-drive whatever a test can reach.** Where the change touches **code**, drive the `tdd` skill and run its loop in full — red before green, one vertical slice at a time, tests at seams rather than internals. `tdd` has the human confirm the seams before any test is written, and unattended there is nobody to ask: **the issue body stands in for the human**, so the requirements and acceptance criteria _are_ the agreed seams (`ai: ready` is already a human's approval). **Code touched and the body yields no seams → `blocked`** (step 7's exit) — never seams the run picked for itself. A **prose-only** change (a `SKILL.md` edit, a README) drives `tdd` **not at all**, and that is explicitly not a block: a missing seam only blocks when there is code behind it. Red **inside this step** is the loop working as designed and never blocks — step 7 stays the only gate. **`tdd` is optional**: not installed → implement exactly as today, no discipline driven and no block. Note what was driven, and what came of it, on the issue / PR at step 8 — it tells `work-review`, it does not bind its verdict. Mechanics: [REFERENCE.md](REFERENCE.md#test-discipline-tdd).

**When the issue itself is a bug, the work _is_ the diagnosis** — drive `diagnosing-bugs` and build a feedback loop that goes red on this bug **before** hypothesising, instead of reading code for a theory. **Optional call**: not installed, implement as today. What it changes here, and the rung of its ladder an unattended run cannot reach: [REFERENCE.md](REFERENCE.md#diagnosis-discipline).

Keep the change scoped to this one issue.

### 7. Verify

Run the repo's checks (the root `verify` key, else detected — tests, lint, build). **Working in a worktree** (`parallel: true`) means a tree with **no dependencies installed** — `git worktree` checks out tracked files only — so **install from the lockfile there first**, or the gate never touches the versions this branch pins ([how](REFERENCE.md#running-the-repos-checks)). A run in the working tree already has them and skips it. Green → continue. **Red and unfixable, spec ambiguous, or a genuine human decision needed → set `blocked`**, comment the reason at the [feedback destination](REFERENCE.md#feedback-destination) — a run that blocks here has pushed no PR yet, so in `pr` mode that falls back to the issue — and stop; a code change whose body yields no [seams](REFERENCE.md#test-discipline-tdd) is one such ambiguity, raised at step 6 and exiting here. `blocked` is a real outcome, not a failure to hide.

Red is the one limb of the block clause with a procedure behind it: **red → drive `diagnosing-bugs` before calling it unfixable.** "Unfixable" is the cheapest legitimate exit from a drain — it ends a run without failing it — so it is **earned by a loop that was actually built**, never asserted. **Spec ambiguous or a genuine human decision needed → set `blocked` straight away**; neither is a bug case, and no reproduction answers them. When the diagnosis lands on a cause outside this issue's scope, or **no loop can be constructed at all** (the skill's own stop rule), **set `blocked`** — commenting **which loop constructions were tried and how each failed**, not merely the conclusion — and stop. **Optional call**: not installed, block exactly as today. `blocked` is a real outcome, not a failure to hide. Entry points, the unreachable rung and what the comment carries: [REFERENCE.md](REFERENCE.md#diagnosis-discipline).

### 8. Commit, PUSH, hand off to review

The **push** is the moment the work becomes reviewable — it is the boundary between `working` and `reviewRequested`.

- Commit via `atomic-commit`; reference the issue so the tracker links it (`Refs #42` / the Linear key). **`atomic-commit` is optional** — not installed, commit directly in the repo's own Conventional Commits conventions, carrying the same reference line.
- **PUSH** the work: open/update the PR via `pull-request` (worktree), or push the commit(s) to the shared branch (`branch:<name>`). **`pull-request` is optional too**, and only the `worktree` path reaches it at all — not installed, open the PR with the forge CLI directly, same base and head. The base is `pr.base`, **unless [`work.queueBranch`](REFERENCE.md#queue-branch) is on and exactly one `ai/queue-*` PR is open against `pr.base`** — then it is that PR's head. Resolve it **here, per issue**, never once for the drain: the repo's workflow cuts the queue branch in response to the first worker PR, so it can appear mid-drain. **None open is not an error** — open against `pr.base` and carry on. Report the base you **set**; a workflow moving it afterwards is the design working, not drift, and is never corrected. Until this succeeds the issue stays `working` (a crash before the push is reclaimed as a [working-orphan](REFERENCE.md#reconcile)).
- **Open that PR as a _draft_, and leave it a draft** — every round, whether `pull-request` opened it (it opens ready by default, so ask it for a draft) or the forge CLI did. This skill **never marks a PR ready for review**: that flip means _the review believes this is finished_, which is not something the author of the change gets to say, and it is `work-review`'s to make. A re-work pushes onto whatever draft state the PR already carries and **leaves it exactly as found** — an already-ready PR stays ready, never goes back into draft. Why, and what a repo's workflows owe the mechanic: [the draft gate](REFERENCE.md#the-draft-gate). Under `branch:<name>` there is no PR and nothing here applies.
- Record what [step 6's test discipline](REFERENCE.md#test-discipline-tdd) did — the seams read out of the body and the slices `tdd` drove, or that the change was prose-only or `tdd` absent — in the PR body (`worktree`) or an issue comment (`branch:<name>`). It **informs** the reviewer; it is never a verdict, and `work-review` still judges the diff against the requirements.
- **A rebase conflict on a shared branch stops the run, it does not retry.** Under `branch:<name>` the push rebases onto the branch's new tip, and `push → rebase → retry` answers only the race — a rebase that halts on **conflicted files** collides again on the next attempt. Resolve it out of the two sides' **intents**, driving `resolving-merge-conflicts` when installed and handing in the sibling issue as the other side's primary source, then **re-run the checks** on the resolved tree. Intents that do not carry, or checks that come back red → **`blocked`**. Never resolve by guessing on a branch others land on: [REFERENCE.md](REFERENCE.md#rebase-conflicts).
- Move the label `working → reviewRequested` — the handoff to `work-review`. Report the issue id / PR url.
- The skill **never merges**, never reviews, and **never sets `done`, `changes-requested` or `needs human`** — those are the review loop's and the human's outputs.

Inside a `work-implement-queue` drain nobody waits on this worker — return `reviewRequested` and let the drain move on. The review loop picks the issue up next.

## Guardrails

- **Lease before work.** Never implement an issue you have not first flipped to `working`.
- **Push before handoff.** Only flip to `reviewRequested` once the work is pushed and visible to a reviewer; local-only work stays `working`.
- **Stateless & resumable.** Read state from the tracker + git every run; carry nothing between runs.
- **Only this issue.** Never touch sibling issues, never merge, never close anything you were not asked to.
- **Never review your own work.** This skill only produces `reviewRequested`, `blocked` or `skipped`; it never sets `done`, `changes-requested`, or `needs human`.
- **The draft state is the review's to flip.** Open every PR as a draft and never mark one ready — "ready for review" is a statement about the work being finished, and this skill is the one party that cannot make it. Leave an already-ready PR ready on a re-work; never push one back into draft ([the draft gate](REFERENCE.md#the-draft-gate)).
- **Contradicting labels are refused, not resolved.** `needsTriage` plus a lifecycle label → skip and report, writing nothing to the tracker. Never work the issue on the more permissive label, never mark it `blocked`, never strip either label to settle it.
- **"Unfixable" is earned, not asserted.** Red exits to `blocked` only after a diagnosis loop was attempted, and the **attempt** is what the issue comment records — which loop constructions were tried, how each failed, and that the human-in-the-loop rung was unreachable unattended. A `blocked` with a failed loop construction behind it is **evidence**; one without is an opinion, and the two read identically on the issue.
- **Test-drive code, not prose.** A change touching code runs `tdd`'s red-green loop with the issue body as the confirmed seams; a prose-only change runs it not at all, and that is not a block. Code with no seams in the body **is** a block — the run never picks its own seams, because seams chosen after the fact land exactly where the implementation already is. A missing `tdd` degrades to implementing as today, never to a block.
- **Every optional call carries a stated fallback.** `atomic-commit`, `pull-request` and `resolving-merge-conflicts` are **optional** calls, not preconditions: without them, commit in the repo's own conventions, open the PR with the forge CLI, and treat an unresolvable rebase conflict as `blocked`. A missing **commit or PR** helper never leaves verified work uncommitted or unpushed — the push is what the lifecycle turns on; a missing `resolving-merge-conflicts` takes its stated fallback, and that fallback **is** `blocked`, leaving the work unpushed on purpose. The fallback is always **stated**, never always a **degrade** — and whichever one a run took is **named in its report**, never left silent. One rule, one place: [REFERENCE.md](REFERENCE.md#optional-skill-calls).
- **Attribution-free & secret-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in branches, commits, PRs or comments; scan the change and context for secrets and exclude them.
- **`ai: ready` is the approval.** A human marking an issue `ai: ready` ("scoped + approved for an AI agent to pick up") is the opt-in, so the drain — and a direct `/work-implement 42` on an already-`ready`/`changes-requested` issue — works it **without re-confirming**. Confirm first only when there is no such opt-in (an issue not in an approved state, or a ready-gate widened to `false`) — and treat it as **no opt-in at all** when `needsTriage` sits beside it, since the two labels then disagree about whether anyone assessed the issue.

## Reference

Config schema, the lifecycle state machine, selection query, lease & race rules, the test discipline `tdd` carries and the branch strategies (`worktree` / `branch:<name>`, sequential & parallel) — everything a run needs whatever its tracker: [REFERENCE.md](REFERENCE.md). Why it is shaped this way: [DESIGN.md](DESIGN.md).

**One file per tracker recipe, and a repo reads exactly one.** `work.tracker` (falling back to `issue.tracker`) is a single value, so step 1 settles the branch before any recipe is opened: [`trackers/github.md`](trackers/github.md), [`trackers/gitlab.md`](trackers/gitlab.md), [`trackers/linear.md`](trackers/linear.md), [`trackers/local.md`](trackers/local.md).
