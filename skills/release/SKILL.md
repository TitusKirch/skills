---
name: release
summary: Drives the release-please flow to a shipped release — promotes the integration branch, then merges the release PR.
description: Drives a repo's release-please flow to a shipped release — promotes the integration branch onto the release branch (config-gated), waits for the release PR release-please opens, validates it, and merges it. Backend chosen per-repo by config (release.backend); v1 is GitHub via the gh CLI. Invoke manually only — this skill never fires proactively, never merges without confirmation, and opens at most one pull request (the promotion PR, and only where configured to create it). Use when the user explicitly asks to cut, ship or publish a release, to merge the release-please PR, to promote dev onto main for a release, or says things like "ship the release", "cut a release", "merge the release PR", "Release machen", "Release veröffentlichen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# release

Drive the repo's **release-please** flow to a shipped release — get the integration branch onto the release branch, wait for the release PR release-please opens, validate it, merge it. **Manual invocation only**: nothing here ever fires on its own, and every merge waits for a human. The backend is chosen by config (`release.backend`); **GitHub (via `gh`) is the only backend implemented in v1**.

**Opted out?** If the repo config sets `release` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the release skill is turned off in `.tituskirch-skills.json`. An _absent_ `release` block is **not** disabled. Check `jq -e '.release == false'` before any action.

## Workflow

### 1. Detect (read the repo — never assume)

- **Backend** — from `release.backend` (v1: only `github` is implemented; any other value → say it's not supported yet and stop). Confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop**.
- **Release tool** — the tool is **detected, not configured**. v1 recognises exactly one: release-please (`release-please-config.json` + `.release-please-manifest.json`, plus a workflow running `googleapis/release-please-action` on the release branch). None recognised → stop and report that **no supported release tool was detected**, naming what v1 supports. This skill drives a release tool; it does not invent a release process.
- **Branches** — `head` = `release.head`, else `pr.base`, else the default branch; `base` = `release.base`, else the repo default branch. Never hardcode `dev`/`main`. `git fetch` first, then show `base ← head` in the plan.
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed). Keys: [REFERENCE.md](REFERENCE.md#config).

### 2. Promote `head` → `base` (config-gated)

**Nothing to promote → skip to step 3.** If `head` and `base` are the same branch, or `head` is not ahead of `base` (`git rev-list --count origin/<base>..origin/<head>` is `0`), there is nothing to release from `head` — say so and move on.

Otherwise, by `release.promote` ([detail](REFERENCE.md#promotion-modes)):

| Mode                | The promotion PR                                                                                                                                                                            |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `false` _(default)_ | Release-only — never touch `head` → `base`. Skip to step 3. Promotion is **opt-in**: a repo says so in its config or this skill leaves `base` alone.                                        |
| `"auto"`            | Automation already opens it, so **never create one**. Find the open `base ← head` PR, take it out of draft, merge it. None found → **report and stop**, naming `"create"` as the fix.       |
| `"create"`          | No such automation — the skill may open the PR itself, via [`pull-request`](../pull-request/SKILL.md) with base `base` and head `head`. **The only PR this skill ever opens, in any mode.** |

- **Undrafting is what starts CI.** Where the repo's checks skip drafts (`if: github.event.pull_request.draft == false` + a `ready_for_review` trigger), the draft rollup PR has run **nothing**. Undraft first (`gh pr ready <n>`), _then_ wait for the checks that undrafting triggers — never read a draft's empty check list as "green".
- **Checks green, then merge with a merge commit** — `gh pr merge <n> --merge`, never `--squash`. The individual `feat:`/`fix:` commits must stay visible or release-please cannot compute the bump. Fixed, not a preference.

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

After confirmation: `gh pr merge <n> --squash`. Squash is release-please's own convention and is right here for the mirror-image reason a merge commit is right in step 2 — the release PR is one generated `chore(main): release …` commit and nothing downstream reads its history. release-please then tags the release; the workflow deletes the merged `release-please--*` branch.

Report the version, the tag, the release url, and every PR touched.

### 6. Report instead of hanging

Every wait is bounded. On timeout, **stop and report what was observed** — never poll on silently. The common benign case is that **nothing is release-worthy**: every commit since the last tag is typed `chore`/`refactor`/`docs`, so release-please opens no PR at all. Say that, with the commit types you actually saw, rather than "timed out".

## Guardrails

- **Manual invocation only.** Never fire proactively — not after a merge, not after a green CI run, not because a release "looks due". Someone asks, or this skill does nothing.
- **Plan first; merge only after confirmation.** The promotion merge and the release merge are **two separate confirmations**. Plan-only triggers ("nur den plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` commands, then stop.
- **At most one PR, ever** — the promotion PR, and only in `"create"` mode. In `"auto"` mode this skill creates nothing; a missing rollup PR is a finding to report, never a gap to fill.
- **Only its own two PRs.** The rollup PR and release-please's release PR are the only PRs it may undraft or merge — both opened by automation, and named here as the sole, deliberate exceptions to the sibling rule that automation's PRs are untouchable. Any other PR → leave it alone.
- **Merge strategies are fixed** — merge commit for `head` → `base`, squash for the release PR. Both are mechanical requirements, not taste; neither is a config key.
- **Never force-push, never tag by hand, never edit the version or `CHANGELOG.md`.** release-please owns all three; racing it corrupts the manifest.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any PR, comment, or commit it produces.
- **GitHub backend (v1).** No GitHub remote / `gh` unavailable → stop; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the promotion modes in detail, the `gh` recipes, the validation checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
