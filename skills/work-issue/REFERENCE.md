# work-issue / work-queue — Reference

Shared mechanics for [`work-issue`](SKILL.md) (the unit) and [`work-queue`](../work-queue/SKILL.md) (the drain). One tracker per repo (GitHub `gh` / Linear MCP), chosen by config. Reuses the [`issue`](../issue/SKILL.md) skill's config file and catalog cache.

## Principle

> The **queue is the tracker**, the **worker is stateless.** Each issue's state lives in its lifecycle label (`ready → working → review → done`, plus `blocked`), not in the agent. Every run reads state fresh from tracker + git, so a crashed run **resumes** instead of restarting and a repeated run is **idempotent**.

## Config

`work.*` in the repo-root `.tituskirch-skills.json`. Resolution per setting: **config → default**. Read with `jq`.

```json
{
  "work": {
    "tracker": "github",
    "cap": 10,
    "branch": "worktree",
    "parallel": false,
    "verify": null,
    "labels": {
      "ready": "ai: ready",
      "working": "ai: working",
      "review": "ai: review",
      "done": "ai: done",
      "blocked": "ai: blocked",
      "repo": false
    },
    "priorityLabels": ["urgent", "high", "medium", "low"],
    "linear": {
      "team": "Engineering",
      "statuses": ["Todo", "In Progress"],
      "states": {
        "ready": "Todo",
        "working": "In Progress",
        "review": "In Review",
        "done": "Done"
      }
    }
  }
}
```

| Key                    | Effect                                                                                                              |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `work.tracker`         | `github` or `linear`; falls back to `issue.tracker`                                                                 |
| `work.cap`             | max issues a single drain works (mandatory bound; default 10)                                                       |
| `work.branch`          | `worktree` (own branch + PR per issue) or `branch:<name>` (all issues on one shared branch, e.g. `branch:dev`)      |
| `work.parallel`        | `false` sequential / `true` concurrent — independent of `branch` (see [Branch strategy](#branch-strategy))          |
| `work.verify`          | check command run before opening the PR (tests/lint/build); `null` → detect from the repo                           |
| `work.labels.*`        | lifecycle label names; each is a **string** or **`false`** (mechanic off — see below)                               |
| `work.labels.repo`     | Linear repo-scope label (a string) or `false`; the [single source](#repo-scope) of "this Linear issue is this repo" |
| `work.priorityLabels`  | GitHub priority labels, highest first; Linear ignores these (native priority field)                                 |
| `work.linear.team`     | Linear team name/key/id, resolved via the cache; falls back to `issue.linear.team`                                  |
| `work.linear.statuses` | Linear workflow states that count as startable                                                                      |
| `work.linear.states`   | lifecycle step → Linear workflow state name; **no default** — see below                                             |

**`false` disables a mechanic:** `labels.ready: false` → no AI gate (any matching issue is eligible); `labels.working: false` → no lease label (weaker race protection); `labels.review: false` → the PR's existence is the signal; `labels.blocked: false` → comment only / Linear state; `labels.repo: false` → no repo filter (GitHub, or a single-repo Linear team).

**`linear.states` needs no `false` — absent already means off.** Every `labels.*` key has a **default** (`ai: ready` …), so absent means "use the default" and `false` is the only way to say "off". `linear.states` has **no default**: Linear state names are per-team (`In Progress` / `Doing` / `Started` …) and nothing in the skill can derive them. So the mapping is off unless the repo writes it, and each step is independent:

| Config                       | Behaviour                                                                         |
| :--------------------------- | :-------------------------------------------------------------------------------- |
| `states` omitted             | no state writes at all — the **lifecycle label alone** carries the issue          |
| a step omitted from `states` | that transition writes the label only and **leaves the workflow state untouched** |
| a step mapped                | the state is written **with** the label, in the same `update_issue` call          |

Leaving the state untouched is a defined outcome, not a degraded one — the label is [operative for eligibility](#label-vs-body-precedence), so the lifecycle is correct either way; the repo just forgoes the Linear board reflecting it. **Guessing a state name is never correct**, with or without a mapping.

Reads `pr.base` (branch base) and the shared root `language` from the same file. Schema: the repo-root `tituskirch-skills.schema.json`.

## Catalog cache

Reuses the [`issue`](../issue/REFERENCE.md#catalog-cache) cache verbatim — `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (labels, teams, projects, states), so label names resolve to ids and teams/states are looked up without re-fetching. Same TTL (~3 days) and `--refresh`.

## Lifecycle state machine

```text
ready ─(lease)─▶ working ─(PR opened)─▶ review ─(human signs off)─▶ done
                  ▲   │                   │                          ▲
                  └───┼────(feedback)─────┘                          │
                      └──(branch:<name> + no PR, e.g. dev: commit)───┘
   blocked ◀── side-exit (spec ambiguous · checks red · needs a human)
```

| Transition         | Who                                                                                                       |
| :----------------- | :-------------------------------------------------------------------------------------------------------- |
| `ready → working`  | the worker, **before** any work (the lease)                                                               |
| `working → review` | the worker, when the PR is opened                                                                         |
| `review → working` | the worker, on revision feedback — re-opened for another pass                                             |
| `review → done`    | the **human's sign-off**, applied by the worker; or a [reconcile](#reconcile) that observes the PR merged |
| `working → done`   | the worker, straight after the commit — **`branch:<name>` with no PR only**                               |
| `* → blocked`      | the worker, when it cannot honestly reach `review`                                                        |

### Terminal `done`

**`done` is the human's sign-off, not the merge.** The worker still never merges — but it does set `done`, on the human's word.

Native tracker automation is **not** the terminal signal. GitHub's `Closes #<n>` and Linear's GitHub integration both fire only on a merge into the **default** branch, so a repo whose `pr.base` is an integration branch (e.g. `dev`) never reaches `done` through them — the terminal state was unreachable for exactly the repos that need an integration branch. Waiting for that automation is what broke it, so the lifecycle no longer waits for it.

So `review` is a **real waiting state**: the worker sets it and stops. The human answers in the **same session** that ran the skill — that is the actual working mode, and it is why no external trigger is needed: the skill is still running when the verdict arrives.

- **"looks good"** → the worker sets `done`. That is the sign-off.
- **feedback** → back to `working`, apply it, re-push, back to `review`. Repeat as often as it takes.

The worker never sets `done` **unasked** — the old rule survives only in that sense.

**Consequence, accepted:** `done` no longer means "merged" — it means **accepted by the human**. Under `worktree` (a PR per issue) the PR may still be open when the issue reads `done`. This is a deliberate redefinition: the queue's business is the work; shipping is the rollup merge's business.

**No PR → no `review` stop.** A `branch:<name>` target with no PR (e.g. `branch:dev`) still goes straight to `done` after the commit. There is no artifact to review, and no merge for the [reconcile](#reconcile) to observe — so parking it in `review` would strand it exactly the way this rule exists to prevent. The batch confirmation is the sign-off, and the code review happens on the rollup PR.

### Reconcile

The safety net for a session that ended before the human looked. It is the **first step of every [`work-queue`](../work-queue/SKILL.md) drain**, before the queue is built — drains run anyway, so it needs no trigger of its own. (This is what the old "reconciled on a later run" promise never had: nothing re-runs `work-issue` on a finished issue, precisely because it is finished.)

For each issue sitting in `review`, find its PR and read the PR's state:

| PR state             | Action                                                                             |
| :------------------- | :--------------------------------------------------------------------------------- |
| **merged**           | set `done` — the sign-off is implicit in the merge                                 |
| **open**             | leave it in `review` — still waiting; this is the normal outcome                   |
| **closed, unmerged** | set `blocked` + comment — a human closed it without merging and only they know why |
| **no PR**            | leave it — nothing to observe; it waits on a human, not on a merge                 |

A closed-unmerged PR is a deliberate human act whose _intent_ the drain cannot read — rework, supersede, or abandon are all live readings. That is the [`blocked` side-exit](#lifecycle-state-machine)'s exact purpose ("needs a human call"), and routing it there keeps `review` from silently becoming the new permanent parking spot.

Reconcile moves **labels only**, never branches, and is **idempotent** — nothing to close out is the normal result, not an error. It never sets `done` on an unmerged PR: that is the human's word, and the drain is not the human.

```bash
# GitHub — the PRs that reference this issue with a closing keyword, merged or not
gh api graphql -f query='
  query($owner:String!,$repo:String!,$n:Int!){
    repository(owner:$owner,name:$repo){
      issue(number:$n){
        closedByPullRequestsReferences(first:10, includeClosedPrs:true){
          nodes{ number state merged baseRefName }
        }
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F n=<n>
```

**Linear** — the GitHub integration links the PR as an **attachment** on the issue; read it via `get_issue` for the PR url, then ask GitHub for the state (`gh pr view <url> --json state,merged`). Whether a PR merged is GitHub's fact, never Linear's.

### Label vs body precedence

Label and body are **both live**, and they can disagree — a body written at creation ("early idea, not ready yet") outlives the label a human flips days later. Split the question in two:

| Question                                            | Decided by              | Why                                                            |
| :-------------------------------------------------- | :---------------------- | :------------------------------------------------------------- |
| **May this issue be worked?** (eligibility)         | the **lifecycle label** | the queue's contract, and the thing a human flips deliberately |
| **What is the work?** (scope, requirements, extent) | the **body**            | the label carries no detail; only the text says what to build  |

**The label is operative.** A body line contradicting the current label — "do not implement yet", "intentionally **not** marked `ai: ready`" — describes the issue as it stood when written; it is **not** a veto over a label a human has since set. It **never** silently overrides the label into a block. Treat it as **stale text** and **surface it**: warn in the run's report and note it on the issue, so the human can correct whichever side is wrong. The agent's job is to flag the contradiction, not to adjudicate it.

This does not disarm the `blocked` side-exit: work whose **requirements** are genuinely ambiguous, or that genuinely needs a human call, still exits to `blocked` — on the **substance** of the work, never on the body's opinion about eligibility.

## Selection query

Eligible = matches **all** configured filters. Self-select (one issue) and drain (all, ordered) use the same query.

- **labels** — has `labels.ready` (unless `false`); never already `working`/`blocked` by someone else. Labels are the **only** eligibility input — issue text is never read for consent ([label vs body](#label-vs-body-precedence)).
- **repo scope** — Linear only: has `labels.repo` (unless `false`). Skipped on GitHub (repo-local by nature).
- **team** — Linear only: `work.linear.team`.
- **status** — Linear: state ∈ `work.linear.statuses`. GitHub: `--state open`.
- **order** — by priority. Linear native priority field; GitHub by `work.priorityLabels` (highest first), then creation order. Under `branch:<name>` this order is then re-sorted so prerequisites come first — [dependency ordering](#dependency-ordering).

```bash
# GitHub eligible issues, by config labels
gh issue list --state open --label "$(jq -r '.work.labels.ready' "$config")" --json number,title,labels,createdAt
```

Linear: `list_issues` filtered by team + label(s) + states; order by the native priority field.

## Lease & race rules

- **Claim before work** — flip `ready → working` + assign, _then_ implement. A second consumer sees "not ready" and skips.
- **Fresh fetch each iteration** — a drain re-queries the next eligible issue every loop; it never snapshots the whole queue (stale `ready` states would be re-worked). [Dependency ordering](#dependency-ordering) plans the _sequence_ up front but does not exempt an issue from that re-check.
- **Single-flight lock** — `work-queue` takes a lock file in the git common dir; a second drain in the same repo exits. This (not the label flip, which is not a true compare-and-swap) is what makes multi-consumer safe **within a repo**; cross-repo isolation on a shared Linear team comes from [repo scope](#repo-scope).
- **Clean-tree assert** between issues; a worker that left the tree dirty halts the drain rather than stacking onto uncommitted work.
- **Git's `index.lock`** is the last-resort backstop; concurrency is made _impossible by construction_ (one live worker per tree), not merely locked.

## Branch strategy

Two **independent** knobs — `work.branch` (where work lands) × `work.parallel` (how it runs):

| `branch` \ `parallel` | `false` (sequential)                      | `true` (parallel)                                           |
| :-------------------- | :---------------------------------------- | :---------------------------------------------------------- |
| **`worktree`**        | own branch + PR per issue, one tree, hops | own branch + PR per issue, **each in its own git worktree** |
| **`branch:<name>`**   | all issues on `<name>`, sequential        | work in worktrees, **integrated serialized** onto `<name>`  |

- **Worktrees are the mechanism of `parallel: true`**, not a separate mode. Sequential runs need none.
- **Serialized integration** — for a shared `branch:<name>` target under `parallel: true`, parallel work is produced in isolated worktrees and landed one commit at a time (push → rebase → retry). This is what makes `branch:dev` + `parallel` race-free.
- **`worktree`** branches off `pr.base`; the worktree with committed+pushed work is removed after the PR is opened (commits live on the remote/branch).
- **Dependencies** — under `branch:<name>` the drain works prerequisites first within the run ([dependency ordering](#dependency-ordering)); the shared branch accumulates, so the dependent issue just sees the code. Under `worktree` each issue branches off a clean `pr.base` and sees nothing of its siblings, so the `ready` gate stays the mechanism — a dependent issue is not `ready` until its parent merges. Stacked branches are a v2 concern (see [DESIGN.md](DESIGN.md)).

## Dependency ordering

**`branch:<name>` only.** A shared branch **accumulates** — every issue commits onto the same branch, so a dependent issue sees its prerequisite's work by simply being worked **after** it. No branch-off-parent, no PR base retarget, no rebase cascade — those are worktree-mode stacking (v2, [DESIGN.md](DESIGN.md)). Single-branch mode needs only the **right order**. Under `worktree` this whole section is inert: each issue branches off a clean `pr.base`, so the `ready` gate remains the dependency mechanism.

### Edges

An edge **A → B** reads "**A must land before B**". Both relation kinds point that way, and both are read straight from the tracker — never inferred from the issue text:

| Edge                              | GitHub                              | Linear                           |
| :-------------------------------- | :---------------------------------- | :------------------------------- |
| **prerequisite** (`A` blocks `B`) | `blockedBy` / `blocking`            | `blocked by` / `blocks` relation |
| **parent → child**                | `parent` / `subIssues` (sub-issues) | `parent` / sub-issues            |

**GitHub — not reachable via `gh issue list` or `gh issue view --json`** (neither exposes a `parent`, `blockedBy` or sub-issue field); use the API per candidate. `blockedBy` may cross repos — keep only same-repo ends:

```bash
gh api graphql -f query='
  query($owner:String!,$repo:String!,$n:Int!){
    repository(owner:$owner,name:$repo){
      issue(number:$n){
        number
        parent{number}
        blockedBy(first:50){nodes{number repository{nameWithOwner}}}
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F n=<n>
```

**Linear** — `list_issues` does **not** return relations; fan out `get_issue(id, includeRelations: true)` per candidate and read the `blocked by` relations plus `parent`.

### Building the order

1. **Candidates** — the eligible issues from the [selection query](#selection-query), in priority order.
2. **Fetch edges** per candidate (the fan-out above).
3. **Keep internal edges only** — drop any edge whose other end is outside the candidate set; those are handled by [cross-set prerequisites](#cross-set-prerequisites) below.
4. **Topological sort**, using the **priority order as the tiebreak** — independent issues keep their priority ranking; only a real edge overrides it.
5. **Then apply `work.cap`.** Order first, cap second: a prefix of a topological order is closed under prerequisites (a child's parent always precedes it, so it is in the prefix too). Capping a priority-ordered list first could strand a child without its parent.

**The order is a plan, not a snapshot** — it does not repeal [fresh fetch each iteration](#lease--race-rules). The sort says which issue is _next_; each iteration still re-checks that issue is _still_ eligible before leasing it, and an issue that went `working`/`blocked`/closed meanwhile is dropped (its dependents then fall to [cross-set](#cross-set-prerequisites) handling). Only the edges may be reused within a run — relations change far slower than lifecycle labels.

### Cross-set prerequisites

A prerequisite that is **not** in the candidate set:

- **closed / merged** → already on the branch, edge satisfied — ignore it.
- **open but not eligible** (not `ready`, `blocked`, someone else's `working`) → its code is _not_ on the branch, so the dependent issue's premise is false. **Defer the dependent issue** — do not work it this run, do not lease it, do not label it `blocked`; report it as deferred. It becomes eligible on a later run once the prerequisite lands.

### Cycles

A dependency cycle (A → B → A) has no valid order and is a **tracker-data error a human must fix**. Detect it, **skip every issue in the cycle** for this run — unleased, unlabelled — and name them in the drain report. Never break a cycle by guessing.

### Parallel

`branch:<name>` + `parallel: true` — dependent issues **cannot** run concurrently. Process the graph in **topological levels**: each level holds mutually independent issues that may run in parallel; levels run **sequentially**, with each level's [serialized integration](#branch-strategy) landing on the branch before the next starts. A chain therefore degenerates to sequential, which is the point.

## Tracker — GitHub (`gh`)

- **Lifecycle** — labels are flat (`ai: ready` …); flip with `gh issue edit <n> --add-label <x> --remove-label <y>`, assign with `--add-assignee`.
- **Dependencies** — `blockedBy` / `parent`, GraphQL-only (see [dependency ordering](#dependency-ordering)).
- **Eligible** — `gh issue list --state open --label …`. Priority via `work.priorityLabels`.
- **PR link** — `Closes #<n>` in the PR body links the PR to the issue, and auto-closes it on merge **into the default branch only**. With a non-default `pr.base` (e.g. `dev`) that merge fires neither, so the keyword is **traceability, not the route to [`done`](#terminal-done)**.
- **Reconcile** — find an issue's PRs with `closedByPullRequestsReferences` (see [reconcile](#reconcile)).
- **Label sync** — if the repo mirrors labels to Linear, that is the **integration's** job; the agent writes only the GitHub side. Never double-write.

## Tracker — Linear (MCP)

Server name varies (`mcp__claude_ai_Linear__*`, `mcp__linear__*`, …) — discover the tools at runtime, do not hardcode.

- **Lifecycle** — `update_issue` to set the lifecycle label + assignee, plus that step's `work.linear.states` state when one is mapped — **one atomic call**, so label and state never drift. Step unmapped, or no `states` at all → write the label + assignee and **leave the state alone**. Never invent a state name: the map is the only source, and `statuses` is an eligibility filter, not a mapping.
- **Eligible** — `list_issues` by team + `labels.ready` + `labels.repo` + `work.linear.statuses`; order by native priority.
- **Dependencies** — `list_issues` returns no relations; fan out `get_issue(includeRelations: true)` (see [dependency ordering](#dependency-ordering)).
- **Which steps write a state** — the worker writes `states.working` on the lease and `states.review` when the PR opens. `states.done` is the **worker's** to set, on the human's [sign-off](#terminal-done), on a [reconcile](#reconcile) that observes the merge, or straight after the commit on a `branch:<name>` target with no PR. Linear's integration may also move the issue on a default-branch merge — a bonus, never the signal waited on. `states.ready` is never written — it records where a human parks a startable issue, and is the anchor `statuses` should contain. The `blocked` side-exit has no state: it is carried by `labels.blocked`.
- **PR lives on GitHub** — even for a Linear-tracked repo, the code PR is a GitHub PR. The branch name / PR carries the **Linear key** (`ENG-123`) so Linear's GitHub integration **links** it. That link is traceability: on a non-default `pr.base` the integration never moves the issue at all, so [`done`](#terminal-done) comes from the sign-off or the reconcile — never from waiting on Linear.
- **Team is required**; resolve `work.linear.team` to its id via the cache. `states` is optional — resolve each mapped name to its id via the cache; a name that matches **no** state in the team is a config error → report it, do not fall back to a guess.

### Repo scope

Linear puts every repo's issues in one team, so the team alone cannot say "this issue is this repo." `work.labels.repo` (a stable label, e.g. `repo: TitusKirch/envprism`) is the discriminator — the **single source of truth** for repo identity in Linear, and the cross-repo race-breaker. It is read here to **filter** and (when the [`issue`](../issue/SKILL.md) skill applies it on create) to **tag** — projects are unsuitable because they are completable. No `labels.repo` configured on Linear → the drain **refuses** rather than reach into another repo's issues.

## Setup

No own setup flow — `work` piggybacks on the [`issue`](../issue/REFERENCE.md#setup-flow-first-run--issue-setup) skill's config + cache and only adds the `work.*` keys. The lifecycle labels must already **exist** on the configured tracker's catalog (the agent filters by them, it does not create them).
