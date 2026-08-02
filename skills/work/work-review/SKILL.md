---
name: work-review
metadata:
  summary: Reviews one issue's pushed work as an independent agent — verdict routes to done, changes, needs-human, or blocked.
description: Reviews a single tracked issue's pushed implementation across GitHub (gh), GitLab (glab), Linear (MCP) or local issue files as a fresh, independent agent — reads the issue's requirements and the pushed diff, adversarially checks whether the work is correct and complete, and writes a verdict that routes the issue to done (accepted), changes-requested (feedback, back to the implement loop), needs-human (escalation), or blocked. It never implements or fixes anything — review only. It also applies a human's verdict on a needs-human issue. Tracker, labels and the round cap come from the committed config (.tituskirch-skills.json). Use when the user wants to review, check, or sign off one specific issue's AI work, mentions an issue awaiting review, or says things like "review issue 42", "check the work on issue 42", "reviewe Issue 42", or gives a verdict on an escalated issue.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# work-review

Take **one** issue that an implementer pushed and **review it** — the stateless review-unit behind `work-review-queue`, and the deliberate counterweight to `work-implement`. A **different** agent, with **fresh context**: it did not build this and carries no "it works because I wrote it" bias. State lives in the issue's **lifecycle label**; the review is **read-only** and idempotent, so a crashed review just re-runs.

This skill is the **review half** of the two-loop workflow. It **never implements, edits, commits, or merges** — its only outputs are a **verdict** (a label move plus a comment): `done`, `changes-requested`, `needs human`, or `blocked`.

**Opted out?** If the repo config sets `work` to `false`, all `work-*` skills are **disabled** — stop and tell the user they are turned off in `.tituskirch-skills.json`. Check `.work == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Load config & resolve tracker

Resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included); the `work.*` section holds tracker, labels, `work.review.maxRounds` (default 3) and `work.feedback` — where the verdict's comment is written ([feedback recipes](REFERENCE.md#feedback-recipes); it defaults from `work.branch`, the full rule being **Feedback destination** in `work-implement`'s REFERENCE). Resolve the tracker (`work.tracker`, falling back to `issue.tracker`); reuse the `issue` catalog cache. Config + mechanics: [REFERENCE.md](REFERENCE.md).

### 2. Resolve the target issue

- **Explicit** — an id/number/key (`/work-review 42`, `ENG-123`).
- **Self-select** — none given → the [selection query](REFERENCE.md#selection-query): the single highest-priority issue in `reviewRequested`. None → say so and stop.

### 3. Read the state → pick the action

- **`reviewRequested`** → claim it (step 4) then review the pushed work (steps 5–7). The normal path.
- **`reviewing` assigned to this runner** → a previous review leased it and crashed; **resume** — review is read-only and idempotent, so just re-run steps 5–7 (no re-claim needed). `reviewing` held by a **different** runner → in-flight elsewhere, not ours.
- **`needs human` + a human verdict this session** → apply the human's call: "looks good" → `done`; feedback → `changes-requested` (record the feedback). This is the one place a human's word resolves an escalation.
- **anything else** (`ready` / `working` / `changes-requested` / `done` / `blocked`) → not ours; nothing to do.

### 4. Claim the review (lease) — when `reviewing` is configured

If `work.labels.reviewing` resolves to a **label string**, flip `reviewRequested → reviewing` and assign the issue to the runner **before** reading the diff — on `github` and `linear`, the tracker-global claim that stops a second clone reviewing the same issue and writing a competing verdict (the review lock only proves no live reviewer **in this checkout**). **On `local` it is not tracker-global** — the store is a directory inside the checkout, so the lease reaches no further than the lock does and the competing-verdict hazard stays open; the flip still works and is still worth having within a checkout, but read **The `reviewing` lease** in REFERENCE.md before enabling `labels.reviewing` there (its recommendation is to leave it off). Honour the review single-flight lock (the **Lease & race rules** and **The single-flight lock** in `work-implement`'s REFERENCE) — take it (direct run) or run under the drain's (queue).

**When `reviewing` is `false`/unset (the default), skip this step entirely** — there is no lease label, so the review loop behaves exactly as before: the lock alone, reviewing straight off `reviewRequested`. The verdict at step 7 then moves the label off `reviewRequested`; when the lease is on, it moves off `reviewing`. Either way the verdict label move clears the in-flight state.

### 5. Gather the work

- **Requirements** — re-read the issue **body** (what was asked) and any **prior review feedback** on the issue **and** the PR (so a re-review checks the last round was addressed). Look in both regardless of `work.feedback`: it routes where feedback is _written_, never where it is read, and rounds written before the mode changed stay where they were posted.
- **The pushed diff** — the artifact to review, scoped to _this_ issue:
  - **PR present** (`worktree`) → the PR's diff (`gh pr diff <n>`).
  - **No PR** (`branch:<name>`, e.g. `branch:dev`) → the issue's own commit range on the branch (the commits referencing this issue since it was last picked up). See [review-after-land](REFERENCE.md#review-after-land).
- **Checks** — the pushed head must be green on the repo's **own** gate, and this review **establishes** that rather than inheriting it. Two sources, in this order:
  - **The forge's checks**, but only where the head's base actually triggers them. Read which workflows the base runs _before_ reading their result — an empty or irrelevant check list is `unknown`, never green.
  - **The repo's `verify`, run here.** Under `branch:<name>` there is no PR and CI commonly never ran at all, so this is the only source that exists. Run it against the pushed head in a **throwaway worktree** — the review is read-only towards the user's tree, which is not the same as running nothing ([recipe](REFERENCE.md#verifying-the-pushed-head)).

  **The implementer's own green run is not a source.** It proves a tree passed _before_ the push, and on a shared branch that tree has since moved. Re-running is the whole point of a second agent: same gate, different tree, no inherited verdict.

  Red, or a gate that could not be run at all → a review finding, never a pass.

### 6. Review — adversarially

You are the skeptic. Judge, in this order:

- **Does it do what the issue asked?** Match the diff against the body's requirements — nothing missing, nothing out of scope.
- **Is it correct?** Look for real defects: wrong logic, edge cases, broken references, secrets, regressions.
- **Is a human needed?** Apply the [escalation policy](REFERENCE.md#escalation-to-needs-human) — sensitive surfaces (via CODEOWNERS / branch protection), ambiguous intent you cannot confirm, a change too large/risky to sign off confidently, or checks red without a clear cause.

### 7. Verdict — one label move + a comment

Count the review rounds first — the number of times this issue has entered `reviewRequested` ([recipe](REFERENCE.md#round-count)) — and compare to `work.review.maxRounds`. A count that could not be read is **not** zero rounds: escalate to `needs human` rather than let the loop run uncapped. Then:

| Verdict                 | When                                                                                                           | Action                                                                                                                                                                              |
| :---------------------- | :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`done`**              | correct, complete, low-risk                                                                                    | set `done` — accepted                                                                                                                                                               |
| **`needs human`**       | correct but **risky/sensitive**, OR you cannot confidently judge, OR round ≥ `maxRounds` and still not passing | set `needs human` + comment why a human is needed                                                                                                                                   |
| **`changes-requested`** | fixable problems, round < `maxRounds`                                                                          | **post the feedback** at the configured destination (`gh pr comment`, or an issue/Linear comment referencing the commit), then set `changes-requested` — back to the implement loop |
| **`blocked`**           | broken beyond a fixable change / a hard human call                                                             | set `blocked` + comment                                                                                                                                                             |

**The label move always lands on the issue; the comment goes where `work.feedback` says** — the PR's thread (`pr`) or the issue's comments (`issue`), so a three-round review does not turn the requirement into a log ([recipes](REFERENCE.md#feedback-recipes)). In `pr` mode the **comment** (`gh pr comment`) is the primitive that carries every verdict; `gh pr review --request-changes` is an optional upgrade GitHub **refuses on a self-authored PR**, which is the normal case wherever both loops run as one identity. Two fallbacks, both reported in the run: **no PR to write to** → post to the issue; **the review call refused** → post the same body as a PR comment.

Report the verdict and the reasoning. Inside a `work-review-queue` drain, return the verdict and let the drain move on.

## Guardrails

- **Review only — never implement.** No `Edit`/`Write`/commit/merge/push. If the fix is obvious, describe it in the feedback; do not apply it. The implement loop applies it.
- **A different agent than the implementer.** Review as a fresh skeptic; when in doubt, `needs human` — never rubber-stamp.
- **Lease before review, when `reviewing` is configured.** Claim `reviewRequested → reviewing` + assign before reading the diff, so a second clone cannot review the same issue and write a competing verdict — the review loop's counterpart of the implement lease. With `labels.reviewing` off (the default), the review lock alone applies: today's behaviour, unchanged.
- **Read-only and idempotent.** A crashed review re-runs; posting feedback, dedupe against feedback you already left.
- **`done` is a real acceptance**, given by AI review (low-risk) or by a human (via `needs human`). Never set `done` on a change you could not confidently review — escalate instead.
- **The round cap is a floor for the human, not a ceiling on quality** — at `maxRounds`, escalate to `needs human`; never quietly accept unfinished work to end the loop.
- **Attribution-free & secret-free** — no `Generated with`/🤖 line, no agent self-naming in comments; scan the diff for secrets and flag them.

## Reference

Config, the selection query, the round-count recipe, the escalation policy, review-after-land, and the feedback recipes: [REFERENCE.md](REFERENCE.md). The implement half and the shared lifecycle: `work-implement`.
