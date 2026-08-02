---
name: merge-deps
metadata:
  summary: Triages a repo's open Dependabot PRs, verifying each on its own branch before merging.
description: Triages and merges a repo's open Dependabot pull requests, selected strictly by author (app/dependabot) so no human's and no other bot's PR is ever touched. Verifies each update on its own branch first, because a Dependabot PR into an integration branch often runs no meaningful CI at all. Merging is opt-in per repo via mergeDeps.merge; once opted in, mergeDeps.confirm (default major) lets the low-risk tier merge on that standing opt-in while major bumps still wait for a human. Forge chosen per-repo by config (root forge key); v1 is GitHub via the gh CLI. Invoke manually only — this skill never fires proactively and never opens a pull request. Use when the user asks to triage, review or merge Dependabot PRs or dependency updates, mentions the Dependabot queue, dependency bumps or Dependabot alerts, or says things like "merge the dependabot PRs", "check the dependency updates", "Dependabot PRs mergen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# merge-deps

Work the **Dependabot queue** — read the open Dependabot pull requests and the repo's Dependabot alerts, establish which updates are actually safe, and merge the ones the repo has opted into. **Manual invocation only**: nothing here fires on its own; merging is opt-in, and a **major bump always waits for a human**. The forge is chosen by config (the root `forge` key); **GitHub (via `gh`) is the only forge implemented in v1**.

**Opted out?** If the repo config sets `mergeDeps` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the merge-deps skill is turned off in `.tituskirch-skills.json`. An _absent_ `mergeDeps` block is **not** disabled; it means [report-only](REFERENCE.md#merge-modes). Check `.mergeDeps == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

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

- **Verify locally** — this is the **primary** gate, not a fallback. Run `mergeDeps.verify` against the PR's own head in a throwaway worktree, so the user's tree is never touched ([recipe](REFERENCE.md#gh--git-recipes)). **Install the head's lockfile first** — an uninstalled worktree resolves the command against whatever is on `PATH`, which is green or red by accident and never touches the versions the PR pins ([how](REFERENCE.md#running-the-repos-checks)). CI, where it genuinely ran, is corroboration.
- **Update type** — grouped / patch / minor / major, read from Dependabot's own artifacts (the group name in the head branch, the `Updates X from A to B` lines in the body). **Cannot be determined with confidence → hold the PR.** Do not guess a bump level.

**No `mergeDeps.verify` configured _and_ the base's checks don't cover the change → hold and report.** The skill has no basis to call it safe, and says so rather than merging.

### 4. Merge — directly, with `gh pr merge`

Gated by `mergeDeps.merge` ([modes](REFERENCE.md#merge-modes)); default `false` — **report-only** — so merging is opt-in. Once opted in, `mergeDeps.confirm` ([when it asks](REFERENCE.md#confirmation)) decides which merges still wait for a human: a **major always does**; the low-risk tier the mode allows (patch / minor / grouped) rides the opt-in unless `confirm` is `"always"`.

- **Confirm where it counts, not on every merge.** At the default `mergeDeps.confirm` of `"major"`, a patch/minor/grouped PR that has cleared [assessment](REFERENCE.md#assessment-checklist) merges on the standing opt-in — no second yes — while a major waits for an explicit one. `"always"` restores a confirmation on every merge. The plan/report is shown first either way; `confirm` never raises the [ceiling](REFERENCE.md#merge-modes) or lowers a gate.
- **Merge directly; never by comment.** GitHub **removed** the `@dependabot merge` / `squash and merge` comment commands on 27 January 2026. The comment still posts, nothing listens, and nothing errors — a silent no-op that reads as success ([why](REFERENCE.md#decisions)). `@dependabot rebase` and `recreate` are unaffected.
- **The merge method comes from the base's ruleset, never a hardcoded default** — read `allowed_merge_methods` for the PR's own `baseRefName`, the same source `release` reads; unrestricted → prefer squash, keeping one `build(deps)` commit per group. Add `--delete-branch`: the branch close-out was Dependabot's and is now this skill's ([recipe](REFERENCE.md#gh--git-recipes)).
- **The merge is the authenticated user's act, not a bot's** — and for the auto-merged low-risk tier nothing stands between assessment and the merged commit at all. That is exactly why step 3's local verify is **the** gate, `mergeDeps.merge` defaults to `false`, and a **major never auto-merges**: a green check run is not evidence a semver-breaking change is safe.
- **Merging one PR stales the rest — drive the rebase.** Dependabot used to cascade that itself. After each merge, `@dependabot rebase` every remaining selected PR on that base and re-read mergeability before the next one ([cascading rebase](REFERENCE.md#cascading-rebase)).
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

- **TL;DR** — first, before any group: how many Dependabot PRs were merged, how many were held and how many open advisories remain, plus the one thing waiting on the reader — a major bump needing a human, or nothing. **Leading the report** below binds the form.
- **Merged** — number, title, update type.
- **Held** — number and the **reason** (mode, unknown checks, failed verify, conflict, undeterminable type).
- **Alerts** — open ones, which have a PR, which have none, which have no fix.
- **Findings** — a base whose checks don't cover its PRs is a **repo problem worth naming**, not a per-run footnote. Say it once, plainly.

<skills-plan>

## Presenting the plan

Everything this skill puts in front of a human — plan, preview, candidate list, findings report —
is read **once, in a terminal**, and answered there. So **every section of it renders on arrival**,
with no interaction needed to reveal it: prose, lists, tables, fenced code.

**Never fold content behind a control.** `<details>`/`<summary>` is a browser widget, and a
terminal has no way to open it: the summary line prints and everything under it does not. The plan
then arrives as headings with nothing beneath them, and the failure is silent on **both** sides —
the skill believes it reported, and the reader sees no marker saying anything is missing, so a
human confirms a plan whose contents never reached them. What gets folded is whatever ran long,
which is to say the part the decision actually rested on. The same holds for anything else needing
a click: a tab strip, an accordion, a "show more".

**Length is handled by shortening, never by hiding.** This is a fixed rule of the skill, not a
per-run judgement, so it holds however long the list runs. Trim to what the decision needs, group
the rest by something the reader already thinks in (ecosystem, kind, verdict) with a count per
group, or split it across sections. What is left out is left out **visibly**: say how many, why,
and the exact command that shows the rest.

**This binds what the skill presents, not what it writes.** A `<details>` block inside a README, an
issue body, a pull request description or a docs page is rendered by a browser and is entirely
legitimate there. The rule is about the message a human reads to decide — never about the content
of a file.

</skills-plan>

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, by someone deciding what happens
next. So it **opens with its result**: a `## TL;DR` section, before every other heading, carrying
the whole answer in a few lines. A report that opens with its first group makes the reader
reconstruct the total by reading every group and adding it up — which is the one thing they needed
before deciding whether to read any of them.

**Three things belong in the lead, and nothing else does:**

- **The counts** — how much was found, per group, in the same words the groups below use. The
  total is stated, never left to be summed.
- **What the run acted on, or proposes to** — the preselected set, the merged set, the changed
  set: the part that is not merely listed. Where nothing was acted on, say so in those words.
- **The decision being asked for** — the one thing the reader is expected to do, said plainly, or
  **no decision needed** where the run is finished. An ask that is only inferable from the groups
  is an ask the reader has to assemble.

**It leads the detail, it never replaces it.** Every group still renders in full underneath, and
nothing is dropped, shortened or folded for having been counted above. The lead is an entry point;
a summary that licenses hiding what it summarises is the failure this repo already forbids
elsewhere.

**Whatever the run could not establish belongs in the lead too**, not only in the section that
holds it — a check that never ran, a list that could not be read, a tier the run declined to
judge. Each changes what the counts mean, and a reader who stops after four lines must not stop
with a picture the rest of the report would have corrected.

**A run that found nothing still leads with it.** "Nothing found" is a result, and it belongs where
every other result does: one line, naming the scope that was actually searched, so an empty report
and an empty search are told apart.

**The heading follows the output language**, as the rest of the report does — a German run reads
`## Kurzfassung`. What is fixed is the position, not the wording. The `tldr` skill fixes this same
opening for the summaries it writes on request; one house frame, reached two ways.

</skills-tldr>

## Guardrails

- **Dependabot-authored PRs only, matched on author.** Never any other PR, under any circumstance, for any reason. Not a comment, not a label, not a mention in the report.
- **Manual invocation only.** Never fire proactively — not on a push, not because bumps "look due". Someone asks, or this skill does nothing.
- **Plan first; then merge only what the config authorizes.** The plan/report is always shown before any merge. A **major bump waits for an explicit confirmation** even when opted in; the low-risk tier merges on the standing opt-in unless `mergeDeps.confirm` is `"always"`. Plan-only triggers ("nur den Plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` commands, then stop.
- **Never opens a PR.** In any mode. A missing Dependabot PR is a finding to report, never a gap to fill by hand.
- **An empty check list is never green.** Absence of a verdict is `unknown`, and `unknown` never merges.
- **Never resolve conflicts, never edit a lockfile, never force-push a Dependabot branch.** Hand it back with `@dependabot rebase`.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any comment it posts.
- **GitHub forge (v1).** No GitHub remote / `gh` unavailable → stop; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the merge modes, the two-bases problem, the `gh`/`git` recipes, the assessment checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
