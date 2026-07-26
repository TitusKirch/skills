---
name: release
metadata:
  summary: Drives the release-please flow to a shipped release — promotes the integration branch, then merges the release PR.
description: Drives a repo's release-please flow to a shipped release — promotes the integration branch onto the release branch (config-gated), waits for the release PR release-please opens, validates it, and merges it. Forge chosen per-repo by config (root `forge` key); v1 is GitHub via the gh CLI. Invoke manually only — this skill never fires proactively, never merges without confirmation, and opens at most one pull request (the promotion PR, and only where configured to create it). Use when the user explicitly asks to cut, ship or publish a release, to merge the release-please PR, to promote dev onto main for a release, or says things like "ship the release", "cut a release", "merge the release PR", "Release machen", "Release veröffentlichen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# release

Drive the repo's **release-please** flow to a shipped release — get the integration branch onto the release branch, wait for the release PR release-please opens, validate it, merge it. **Manual invocation only**: nothing here ever fires on its own, and every merge waits for a human. The forge is chosen by the root `forge` config key; **GitHub (via `gh`) is the only forge implemented in v1**.

**Opted out?** If the repo config sets `release` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the release skill is turned off in `.tituskirch-skills.json`. An _absent_ `release` block is **not** disabled. Check `.release == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect (read the repo — never assume)

- **Forge** — from the root `forge` key (v1: only `github` is implemented; any other value → say it's not supported yet and stop). Confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop**.
- **Release tool** — the tool is **detected, not configured**. v1 recognises exactly one: release-please (`release-please-config.json` + `.release-please-manifest.json`, plus a workflow running `googleapis/release-please-action` on the release branch). None recognised → stop and report that **no supported release tool was detected**, naming what v1 supports. This skill drives a release tool; it does not invent a release process.
- **Branches** — resolve the promotion **chain**: `release.stages` if set (integration branch first, release branch last), else `[head, base]` where `head` = `release.head`, else `pr.base`, else the default branch, and `base` = `release.base`, else the repo default branch. Never hardcode `dev`/`main`. Validate `stages` (non-empty, distinct branches, real refs) — malformed → report and stop. `git fetch` first, then show the whole chain (`dev → … → base`) in the plan. [Chains](REFERENCE.md#promotion-chains).
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed). Keys: [REFERENCE.md](REFERENCE.md#config).

### 2. Promote along the chain (config-gated)

The chain from step 1 is a list of **edges** — `dev → staging → main` is two (`dev → staging`, `staging → main`); the common case is one, `head → base`. Promote **one edge per invocation**: the **topmost pending edge** — nearest `base`, with its `head` ahead of its `base` — so the run drives a release forward. A user-named edge overrides. [Chains](REFERENCE.md#promotion-chains).

**Nothing to promote → skip to step 3.** No edge has its `head` ahead of its `base` (`git rev-list --count origin/<base>..origin/<head>` is `0` for every edge), or the chain is a single branch with no edge at all — say so and move on.

Otherwise, for the chosen edge (its own `head` and `base`), by `release.promote` ([detail](REFERENCE.md#promotion-modes)):

| Mode                | The promotion PR                                                                                                                                                                                                             |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `false` _(default)_ | Release-only — never touch any edge. Skip to step 3. Promotion is **opt-in**: a repo says so in its config or this skill leaves `base` alone.                                                                                |
| `"auto"`            | Automation already opens it, so **never create one**. Find the open `base ← head` PR for this edge, take it out of draft, merge it. None found → **report and stop**, naming `"create"` as the fix.                          |
| `"create"`          | No such automation — the skill may open the PR itself, via `pull-request` with the edge's `base` and `head` (**optional**: absent, open the same PR with `gh` directly). **The only PR this skill ever opens, in any mode.** |

- **Undrafting is what starts CI.** Where the repo's checks skip drafts (`if: github.event.pull_request.draft == false` + a `ready_for_review` trigger), the draft rollup PR has run **nothing**. Undraft first (`gh pr ready <n>`), _then_ wait for the checks that undrafting triggers — never read a draft's empty check list as "green".
- **Checks green, then merge with a merge commit** — `gh pr merge <n> --merge`, never `--squash`. The individual `feat:`/`fix:` commits must stay visible or release-please cannot compute the bump. Fixed, not a preference — and it holds at **every** edge, which is what keeps a multi-stage chain's release artifacts conflict-free ([why](REFERENCE.md#promotion-chains)). A `base` whose ruleset forbids `merge` breaks release-please itself — **report that and stop**; it is a repo misconfiguration, not something to squash around.

### 3. Wait for the release PR

The push to `base` triggers the release-please workflow, which opens **or updates** the release PR. Poll for it — head branch `release-please--*`, label `autorelease: pending` — bounded by `release.timeout` (default 600s), polling about every 20s. Recipe: [REFERENCE.md](REFERENCE.md#gh-recipes).

Already open before step 2? Expected — release-please updates its existing PR rather than opening a second one. Re-read it after the promotion lands, don't trust a pre-merge snapshot.

### 4. Validate (gather facts — the human decides)

Never merge on a heuristic. Collect and show:

- **It is release-please's PR** — `release-please--*` head, `autorelease: pending`, authored by the release app. Anything else → not this skill's PR; stop.
- **Checks** — `gh pr checks <n>`; every required check green.
- **The bump** — the version in the PR's `.release-please-manifest.json` diff against the one on `base`, and whether it follows the commits since the last tag (`feat` → minor, `fix` → patch; `bump-minor-pre-major` holds a breaking change to a minor pre-1.0).
- **The changelog** — the `CHANGELOG.md` diff is non-empty and its entries match those same commits.

Anything unexplained — a bump the commits don't justify, an empty changelog, a red check — **report it and stop**. The plan states facts; the merge waits for the human.

### 5. Merge, then report

After confirmation, merge it with a method the **release branch actually allows** — ask the forge, never assume ([recipe](REFERENCE.md#gh-recipes)):

- **Squash if allowed** — release-please's own convention, and right here for the mirror-image reason a merge commit is right in step 2: the release PR is one generated `chore(main): release …` commit and nothing downstream reads its history.
- **Otherwise a merge commit.** A release branch that is also a **promotion target** is typically pinned to `merge` — the ruleset that keeps a promotion's individual commits visible binds every PR into that branch, release-please's included. Squashing there is not a preference the skill can hold; it is a merge the forge rejects.

Either way release-please then tags the release, and the workflow deletes the merged `release-please--*` branch.

Report the version, the tag, the release url, and every PR touched.

### 6. Report instead of hanging

Every wait is bounded. On timeout, **stop and report what was observed** — never poll on silently. The common benign case is that **nothing is release-worthy**: every commit since the last tag is typed `chore`/`refactor`/`docs`, so release-please opens no PR at all. Say that, with the commit types you actually saw, rather than "timed out".

## Guardrails

- **Manual invocation only.** Never fire proactively — not after a merge, not after a green CI run, not because a release "looks due". Someone asks, or this skill does nothing.
- **Plan first; merge only after confirmation.** The promotion merge and the release merge are **two separate confirmations**. Plan-only triggers ("nur den plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` commands, then stop.
- **At most one _open_ promotion PR at a time** — one edge per invocation, and a PR only in `"create"` mode. In `"auto"` mode this skill creates nothing; a missing rollup PR is a finding to report, never a gap to fill. A [chain](REFERENCE.md#promotion-chains) never fans out — edges are promoted sequentially, one confirmed merge each.
- **Only its own two PRs.** The rollup PR and release-please's release PR are the only PRs it may undraft or merge — both opened by automation, and named here as the sole, deliberate exceptions to the sibling rule that automation's PRs are untouchable. Any other PR → leave it alone.
- **The promotion's merge commit is fixed** — `head` → `base` merges, never squashes, or release-please loses the individual commits it computes the bump from. A ruleset forbidding it is a repo **misconfiguration to report**, not to work around. The **release PR** is the softer case: squash preferred, but the forge's allowed methods decide (step 5). Neither is a config key — one is a mechanical requirement, the other is read from the forge.
- **Never force-push, never tag by hand, never edit the version or `CHANGELOG.md`.** release-please owns all three; racing it corrupts the manifest.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any PR, comment, or commit it produces.
- **GitHub forge (v1).** No GitHub remote / `gh` unavailable → stop; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the promotion modes in detail, the `gh` recipes, the validation checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
