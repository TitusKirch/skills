# work-issue / work-queue — Reference

Shared mechanics for [`work-issue`](SKILL.md) (the unit) and [`work-queue`](../work-queue/SKILL.md) (the drain). One backend per repo (GitHub `gh` / Linear MCP), chosen by config. Reuses the [`issue`](../issue/SKILL.md) skill's config file and catalog cache.

## Principle

> The **queue is the tracker**, the **worker is stateless.** Each issue's state lives in its lifecycle label (`ready → working → review → done`, plus `blocked`), not in the agent. Every run reads state fresh from tracker + git, so a crashed run **resumes** instead of restarting and a repeated run is **idempotent**.

## Config

`work.*` in the repo-root `.tituskirch-skills.json`. Resolution per setting: **config → default**. Read with `jq`.

```json
{
  "work": {
    "backend": "github",
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
    "linear": { "team": "Engineering", "statuses": ["Todo", "In Progress"] }
  }
}
```

| Key                    | Effect                                                                                                              |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `work.backend`         | `github` or `linear`; falls back to `issue.backend`                                                                 |
| `work.cap`             | max issues a single drain works (mandatory bound; default 10)                                                       |
| `work.branch`          | `worktree` (own branch + PR per issue) or `branch:<name>` (all issues on one shared branch, e.g. `branch:dev`)      |
| `work.parallel`        | `false` sequential / `true` concurrent — independent of `branch` (see [Branch strategy](#branch-strategy))          |
| `work.verify`          | check command run before opening the PR (tests/lint/build); `null` → detect from the repo                           |
| `work.labels.*`        | lifecycle label names; each is a **string** or **`false`** (mechanic off — see below)                               |
| `work.labels.repo`     | Linear repo-scope label (a string) or `false`; the [single source](#repo-scope) of "this Linear issue is this repo" |
| `work.priorityLabels`  | GitHub priority labels, highest first; Linear ignores these (native priority field)                                 |
| `work.linear.team`     | Linear team name/key/id, resolved via the cache; falls back to `issue.linear.team`                                  |
| `work.linear.statuses` | Linear workflow states that count as startable                                                                      |

**`false` disables a mechanic:** `labels.ready: false` → no AI gate (any matching issue is eligible); `labels.working: false` → no lease label (weaker race protection); `labels.review: false` → the PR's existence is the signal; `labels.blocked: false` → comment only / Linear state; `labels.repo: false` → no repo filter (GitHub, or a single-repo Linear team).

Reads `pr.base` (branch base) and the shared root `language` from the same file. Schema: the repo-root `tituskirch-skills.schema.json`.

## Catalog cache

Reuses the [`issue`](../issue/REFERENCE.md#catalog-cache) cache verbatim — `$(git rev-parse --git-common-dir)/tituskirch-skills/issue` (labels, teams, projects, states), so label names resolve to ids and teams/states are looked up without re-fetching. Same TTL (~3 days) and `--refresh`.

## Lifecycle state machine

```text
ready ─(lease)─▶ working ─(PR opened)─▶ review ─(PR merged)─▶ done
                   │                                            ▲
                   └──(branch:<name> + no PR, e.g. dev: commit)─┘
   blocked ◀── side-exit (spec ambiguous · checks red · needs a human)
```

| Transition         | Who                                                                             |
| :----------------- | :------------------------------------------------------------------------------ |
| `ready → working`  | the worker, **before** any work (the lease)                                     |
| `working → review` | the worker, when the PR is opened                                               |
| `review → done`    | the **PR merge** — native tracker integration; the worker reconciles stragglers |
| `* → blocked`      | the worker, when it cannot honestly reach `review`                              |

The worker **never merges** and never sets `done` itself in a PR flow — `done` is the merge. Only a `branch:<name>` target with no PR (e.g. `branch:dev`) lets the worker set `done` directly after the commit.

## Selection query

Eligible = matches **all** configured filters. Self-select (one issue) and drain (all, ordered) use the same query.

- **labels** — has `labels.ready` (unless `false`); never already `working`/`blocked` by someone else.
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

## Backend — GitHub (`gh`)

- **Lifecycle** — labels are flat (`ai: ready` …); flip with `gh issue edit <n> --add-label <x> --remove-label <y>`, assign with `--add-assignee`.
- **Dependencies** — `blockedBy` / `parent`, GraphQL-only (see [dependency ordering](#dependency-ordering)).
- **Eligible** — `gh issue list --state open --label …`. Priority via `work.priorityLabels`.
- **PR link** — `Closes #<n>` in the PR body auto-closes the issue on merge → terminal `done` (label set by a repo automation / reconciled).
- **Label sync** — if the repo mirrors labels to Linear, that is the **integration's** job; the agent writes only the GitHub side. Never double-write.

## Backend — Linear (MCP)

Server name varies (`mcp__claude_ai_Linear__*`, `mcp__linear__*`, …) — discover the tools at runtime, do not hardcode.

- **Lifecycle** — `update_issue` to set the lifecycle label + assignee; the configured workflow state.
- **Eligible** — `list_issues` by team + `labels.ready` + `labels.repo` + `work.linear.statuses`; order by native priority.
- **Dependencies** — `list_issues` returns no relations; fan out `get_issue(includeRelations: true)` (see [dependency ordering](#dependency-ordering)).
- **PR lives on GitHub** — even for a Linear-tracked repo, the code PR is a GitHub PR. The branch name / PR carries the **Linear key** (`ENG-123`) so Linear's GitHub integration links it and moves it to Done on merge → terminal `done`.
- **Team is required**; resolve `work.linear.team` to its id via the cache.

### Repo scope

Linear puts every repo's issues in one team, so the team alone cannot say "this issue is this repo." `work.labels.repo` (a stable label, e.g. `repo: TitusKirch/envprism`) is the discriminator — the **single source of truth** for repo identity in Linear, and the cross-repo race-breaker. It is read here to **filter** and (when the [`issue`](../issue/SKILL.md) skill applies it on create) to **tag** — projects are unsuitable because they are completable. No `labels.repo` configured on Linear → the drain **refuses** rather than reach into another repo's issues.

## Setup

No own setup flow — `work` piggybacks on the [`issue`](../issue/REFERENCE.md#setup-flow-first-run--issue-setup) skill's config + cache and only adds the `work.*` keys. The lifecycle labels must already **exist** on the configured backend's catalog (the agent filters by them, it does not create them).
