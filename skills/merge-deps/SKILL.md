---
name: merge-deps
summary: Triages the open Dependabot pull requests — verifies each one on its own branch, then merges what the repo's config allows.
description: Triages and merges a repo's open Dependabot pull requests, selected strictly by author (app/dependabot) so no human's and no other bot's PR is ever touched. Verifies each update on its own branch first, because a Dependabot PR into an integration branch often runs no meaningful CI at all — and an empty check list is never read as green. Merging is opt-in per repo via mergeDeps.merge and always waits for confirmation. Forge chosen per-repo by config (root forge key); v1 is GitHub via the gh CLI. Invoke manually only — this skill never fires proactively and never opens a pull request. Use when the user asks to triage, review or merge Dependabot PRs or dependency updates, mentions the Dependabot queue, dependency bumps or Dependabot alerts, or says things like "merge the dependabot PRs", "check the dependency updates", "Dependabot PRs mergen", "Abhängigkeiten aktualisieren".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# merge-deps

Work the **Dependabot queue** — read the open Dependabot pull requests and the repo's Dependabot alerts, establish which updates are actually safe, and merge the ones the repo has opted into. **Manual invocation only**: nothing here fires on its own, and every merge waits for a human. The backend is chosen by config (the root `forge` key); **GitHub (via `gh`) is the only backend implemented in v1**.

**Opted out?** If the repo config sets `mergeDeps` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the merge-deps skill is turned off in `.tituskirch-skills.json`. An _absent_ `mergeDeps` block is **not** disabled; it means [report-only](REFERENCE.md#merge-modes). Check `jq -e '.mergeDeps == false'` before any action.

## Workflow

### 1. Detect (read the repo — never assume)

- **Backend** — from the root `forge` key (v1: only `github` is implemented; any other value → say it is not supported yet and stop). Confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop**.
- **Dependabot config** — read `.github/dependabot.yml` for **context only**: which ecosystems exist, their `target-branch`, their `groups`, their `cooldown`. It tells you what to _expect_; it is **never** a selection input. No `dependabot.yml` → Dependabot may still be raising security PRs; carry on.
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed). Keys: [REFERENCE.md](REFERENCE.md#config).

### 2. Select — Dependabot only

**Select strictly by author.** This is the skill's one hard constraint and it has no exceptions:

```bash
gh pr list --state open --search "author:app/dependabot" \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus
```

- **Re-assert the author per PR** before touching it — `gh pr view <n> --json author --jq '.author.login'` must equal `app/dependabot`. The search narrows; this is what proves it.
- **Never select by label or title.** The `dependencies` label and a `build(deps)` title are settable by anyone; authorship is not. A human's PR wearing the `dependencies` label must come back from step 2 empty-handed.
- **Everything else is invisible** — not merged, not commented on, not closed, not rebased, and **not reported on**. Other automation counts: a rollup or release PR authored by `app/github-actions` is another bot's PR, and this skill has nothing to say about it either.

Nothing selected → say so and stop. That is the normal, healthy result.

### 3. Assess — "green" is a claim you have to earn

Per selected PR, gather facts. **Never merge on a heuristic.**

- **Base branch** — read `baseRefName` **per PR**; never assume one base. Version updates follow `target-branch` (e.g. `dev`), but **security updates ignore `target-branch` and target the default branch** ([why this matters](REFERENCE.md#the-two-bases)). The queue is routinely mixed.
- **Mergeability** — `mergeable` / `mergeStateStatus`. `CONFLICTING` → step 4's rebase path. `UNKNOWN` means GitHub has not computed it yet, **not** that it is fine — re-poll.
- **Checks** — `gh pr checks <n>`, then the question that matters: **which checks does this PR's base actually trigger?** Read the workflows (`.github/workflows/*.yml`) and compare their `on.pull_request.branches` against `baseRefName`.

> **An empty or irrelevant check list is `unknown`, never `green`.** A workflow gated on `branches: [main]` does not run for a PR into `dev`, so its absence is not a pass — there was no verdict at all. A suite that only scans source for vulnerabilities (CodeQL) says nothing about whether a lockfile still installs or the repo still lints. Counting either as "checks green" is how an unverified bump gets merged. **Never merge on `unknown`.**

- **Verify locally** — this is the **primary** gate, not a fallback. Run `mergeDeps.verify` against the PR's own head in a throwaway worktree, so the user's tree is never touched ([recipe](REFERENCE.md#gh--git-recipes)). CI, where it genuinely ran, is corroboration.
- **Update type** — grouped / patch / minor / major, read from Dependabot's own artifacts (the group name in the head branch, the `Updates X from A to B` lines in the body). **Cannot be determined with confidence → hold the PR.** Do not guess a bump level.

**No `mergeDeps.verify` configured _and_ the base's checks don't cover the change → hold and report.** The skill has no basis to call it safe, and says so rather than merging.

### 4. Merge — hand the merge back to Dependabot

Gated by `mergeDeps.merge` ([modes](REFERENCE.md#merge-modes)) and, always, by confirmation. Default is `false` — **report-only**; merging is opt-in.

- **Comment, don't merge directly** — `gh pr comment <n> --body "@dependabot squash and merge"`. Dependabot then owns the rebase, the merge and the branch close-out, which is the thing it is actually good at. Squash keeps one `build(deps)` commit per group; [why squash](REFERENCE.md#decisions).
- **Dependabot merges once checks pass — including when there are none.** That is precisely why step 3's local verify runs **first**. The comment is the last act, never the gate.
- **Conflicts** → `@dependabot rebase` and report it. **Never resolve a dependency conflict by hand** — the lockfile is Dependabot's to regenerate.
- **Held back is an outcome, not a failure.** A major bump under `"grouped"`, an undeterminable update type, a red verify, an `unknown` check list — report each with its reason and move on.

Respect `mergeDeps.cap` — the most PRs one run may merge.

### 5. Security alerts

```bash
gh api "repos/$owner/$repo/dependabot/alerts" --paginate \
  --jq '.[] | select(.state == "open")'
```

Map each open alert to the Dependabot PR that fixes it, if one exists. Report alerts with **no PR behind them** — they are the ones nothing is coming for. Alerts with **no fix available** get reported too, in their own bucket, every run; a vulnerability nobody can patch yet is exactly the thing that should stay visible.

The endpoint needs `security_events` scope — no access → say the alerts could not be read, and do not silently report zero.

### 6. Report

- **Merged** — number, title, update type.
- **Held** — number and the **reason** (mode, unknown checks, failed verify, conflict, undeterminable type).
- **Alerts** — open ones, which have a PR, which have none, which have no fix.
- **Findings** — a base whose checks don't cover its PRs is a **repo problem worth naming**, not a per-run footnote. Say it once, plainly.

## Guardrails

- **Dependabot-authored PRs only, matched on author.** Never any other PR, under any circumstance, for any reason. Not a comment, not a label, not a mention in the report.
- **Manual invocation only.** Never fire proactively — not on a push, not because bumps "look due". Someone asks, or this skill does nothing.
- **Plan first; merge only after confirmation.** Plan-only triggers ("nur den plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` commands, then stop.
- **Never opens a PR.** In any mode. A missing Dependabot PR is a finding to report, never a gap to fill by hand.
- **An empty check list is never green.** Absence of a verdict is `unknown`, and `unknown` never merges.
- **Never resolve conflicts, never edit a lockfile, never force-push a Dependabot branch.** Hand it back with `@dependabot rebase`.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any comment it posts.
- **GitHub backend (v1).** No GitHub remote / `gh` unavailable → stop; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the merge modes, the two-bases problem, the `gh`/`git` recipes, the assessment checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
