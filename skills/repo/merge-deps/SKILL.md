---
name: merge-deps
metadata:
  summary: Triages a repo's open dependency-bot requests, verifying each on its own branch before merging.
description: Triages and merges a repo's open dependency-bot pull requests — on GitLab, merge requests — selected strictly by author so no human's and no other bot's request is ever touched. On GitHub that author is the constant app/dependabot; on GitLab it is the one identity mergeDeps.gitlab.bot names, since Renovate is self-run there. Verifies each update on its own branch first, because such a request into an integration branch often runs no meaningful CI at all. Merging is opt-in per repo via mergeDeps.merge; mergeDeps.confirm (default major) then lets the low-risk tier ride that opt-in while major bumps wait for a human. Forge per-repo by config (root forge key) — GitHub via gh, GitLab via glab. Invoke manually only — never fires proactively and never opens a request. Use when the user asks to triage, review or merge Dependabot or Renovate requests, dependency updates or bumps, or says things like "merge the dependabot PRs", "Dependabot PRs mergen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# merge-deps

Work the **dependency-bot queue** — read the bot's open requests and the repo's security advisories, establish which updates are actually safe, and merge the ones the repo has opted into. **Manual invocation only**: nothing here fires on its own; merging is opt-in, and a **major bump always waits for a human**. The forge is chosen by config (the root `forge` key): **GitHub** through `gh`, where the queue is Dependabot's, and **GitLab** through `glab`, where it is [the one account the config names](REFERENCE.md#the-queues-author).

**Opted out?** If the repo config sets `mergeDeps` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the merge-deps skill is turned off in `.tituskirch-skills.json`. An _absent_ `mergeDeps` block is **not** disabled; it means [report-only](REFERENCE.md#merge-modes). Check `.mergeDeps == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect (read the repo — never assume)

- **Forge and host** — from the root `forge` key (`github` → `gh`, `gitlab` → `glab`; anything else → say it is not supported and stop) plus the host resolved per repo: `forgeHost`, else the `origin` remote, else whatever the CLI is already authenticated against ([REFERENCE.md](REFERENCE.md#the-forge-and-its-host)). Confirm the repo is reachable — `gh repo view --json nameWithOwner,defaultBranchRef` or `glab repo view`. If it fails (no remote on that forge, wrong host, or the CLI not authenticated), **stop**, naming the host tried.
- **The bot's own config** — `.github/dependabot.yml`, or Renovate's config (`renovate.json`, `.gitlab/renovate.json`, the `renovate` key in `package.json`), for **context only**: which ecosystems exist, their base branches, their groups, their cooldown. It tells you what to _expect_; it is **never** a selection input and never a tier input. No such file → the bot may still be raising requests from a preset or a group-level config; carry on.
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed). Keys: [REFERENCE.md](REFERENCE.md#config).

### 2. Select — the dependency bot only

**Select strictly by author.** This is the skill's one hard constraint and it has no exceptions. The author is a **constant on GitHub** and a **configured identity on GitLab**, and the reasoning behind that asymmetry — including why the key can only ever narrow — is [The queue's author](REFERENCE.md#the-queues-author):

```bash
# GitHub — the constant, named here and deliberately not a config key.
gh pr list --state open --search "author:app/dependabot" \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus

# GitLab — narrow on the login for readability, prove on the id. Pages cap at 100.
glab mr list --all --per-page 100 --output json --author "$bot_login"
```

- **Re-assert the author per request** before touching it — `author.login` must equal `app/dependabot` on GitHub; `author.id` must equal `mergeDeps.gitlab.bot.id` on GitLab. The list narrows; this is what proves it. On GitLab the login the list was narrowed with is **not** the proof: a username is reusable after a rename, so a login that disagrees with its id is the rename signal — report it and leave the MR alone.
- **No `mergeDeps.gitlab.bot` under `forge: gitlab` → stop**, saying the key is unset and that the queue cannot be identified without it. Never infer the author from a branch prefix, a label or a title, and never report an unidentifiable queue as an empty one — an empty queue reads as a healthy run.
- **Never select by label, title or branch.** The `dependencies` label, a `build(deps)` title and a `renovate/*` branch are settable by anyone; authorship is not. A human's request wearing the `dependencies` label must come back from step 2 empty-handed.
- **Everything else is invisible** — not merged, not commented on, not closed, not rebased, and **not reported on**. Other automation counts: a rollup or release request authored by another bot is another bot's, and this skill has nothing to say about it either.

Nothing selected → say so and stop. That is the normal, healthy result.

### 3. Assess — "green" is a claim you have to earn

Per selected request, gather facts. **Never merge on a heuristic.**

- **Base branch** — read the base **per request** (`baseRefName` / `target_branch`); never assume one base. On GitHub, version updates follow `target-branch` while **security updates ignore it and target the default branch**; on GitLab, Renovate's `baseBranches` can spread the queue the same way ([why this matters](REFERENCE.md#the-two-bases)). The queue is routinely mixed.
- **Mergeability** — GitHub: `mergeable` / `mergeStateStatus`, where `CONFLICTING` → step 4's hand-back and `UNKNOWN` means it has not been computed yet, **not** that it is fine. GitLab: `detailed_merge_status`, where `conflict` / `need_rebase` → the hand-back and `checking` is the `UNKNOWN` counterpart. Re-poll either.
- **Checks** — GitHub: `gh pr checks <n>` against the workflows' `on.pull_request.branches`. GitLab: the MR's pipelines against the jobs' `rules:` — a job runs for an MR only where it admits `merge_request_event`, so a repo without that produces **no MR pipeline at all**. Either way the question is the same: **which checks does this request's base actually trigger?**

> **An empty or irrelevant check list is `unknown`, never `green`.** A workflow gated on `branches: [main]` does not run for a PR into `dev`, and a `.gitlab-ci.yml` that says nothing about merge requests runs nothing for an MR — so the absence is not a pass, there was no verdict at all. A suite that only scans source for vulnerabilities (CodeQL) says nothing about whether a lockfile still installs or the repo still lints. Counting either as "checks green" is how an unverified bump gets merged. **Never merge on `unknown`.**

- **Verify locally** — this is the **primary** gate, not a fallback. Run `mergeDeps.verify` against the request's own head in a throwaway worktree, so the user's tree is never touched ([recipe](REFERENCE.md#forge--git-recipes)). **Install the head's lockfile first** — an uninstalled worktree resolves the command against whatever is on `PATH`, which is green or red by accident and never touches the versions the request pins ([how](REFERENCE.md#running-the-repos-checks)). CI, where it genuinely ran, is corroboration.
- **Update type** — grouped / patch / minor / major, read from the **bot's own artifacts**: Dependabot's `Updates X from A to B` lines and branch group, or Renovate's update table and branch. **Cannot be determined with confidence → hold the request.** Do not guess a bump level. And on a grouped request, **the highest bump in it sets its tier** — Renovate's groups are broad enough to carry a major among the patches ([how to read both](REFERENCE.md#reading-the-bump-level)).

**No `mergeDeps.verify` configured _and_ the base's checks don't cover the change → hold and report.** The skill has no basis to call it safe, and says so rather than merging.

### 4. Merge — directly, with the forge's own CLI

Gated by `mergeDeps.merge` ([modes](REFERENCE.md#merge-modes)); default `false` — **report-only** — so merging is opt-in. Once opted in, `mergeDeps.confirm` ([when it asks](REFERENCE.md#confirmation)) decides which merges still wait for a human: a **major always does**; the low-risk tier the mode allows (patch / minor / grouped) rides the opt-in unless `confirm` is `"always"`.

- **Confirm where it counts, not on every merge.** At the default `mergeDeps.confirm` of `"major"`, a patch/minor/grouped request that has cleared [assessment](REFERENCE.md#assessment-checklist) merges on the standing opt-in — no second yes — while a major waits for an explicit one. `"always"` restores a confirmation on every merge. The plan/report is shown first either way; `confirm` never raises the [ceiling](REFERENCE.md#merge-modes) or lowers a gate.
- **Merge directly; never by comment.** GitHub **removed** the `@dependabot merge` / `squash and merge` comment commands on 27 January 2026. The comment still posts, nothing listens, and nothing errors — a silent no-op that reads as success ([why](REFERENCE.md#decisions)). `@dependabot rebase` and `recreate` are unaffected. Renovate never had a merge command at all.
- **The merge method comes from the forge, never a hardcoded default.** GitHub binds it to the **base's ruleset** — read `allowed_merge_methods` for the request's own base, the same source `release` reads. GitLab binds it to the **project** — `merge_method` and `squash_option`, read once per run, where `ff` requires a rebase and `squash_option: "never"` makes `--squash` a rejection rather than a preference. Unrestricted → prefer squash, keeping one `build(deps)` commit per group. Close the branch out (`--delete-branch` / `--remove-source-branch`): that was the bot's job and is now this skill's ([recipes](REFERENCE.md#forge--git-recipes)).
- **The merge is the authenticated user's act, not a bot's** — and for the auto-merged low-risk tier nothing stands between assessment and the merged commit at all. That is exactly why step 3's local verify is **the** gate, `mergeDeps.merge` defaults to `false`, and a **major never auto-merges**: a green check run is not evidence a semver-breaking change is safe.
- **Merging one request stales the rest — drive the rebase.** After each merge, hand back every remaining selected request on that base and re-read mergeability before the next one ([cascading rebase](REFERENCE.md#cascading-rebase)).
- **Conflicts** → hand it back and report it. **Never resolve a dependency conflict by hand** — the lockfile is the bot's to regenerate. The verb differs: `@dependabot rebase` on GitHub, Renovate's `<!-- rebase-check -->` checkbox in the MR's description on GitLab. **GitLab's native `/rebase` is not a substitute** — it rebases without regenerating anything, which is the hand-editing this rule forbids, arrived at through a button ([both verbs](REFERENCE.md#handing-a-request-back)).
- **A hand-back on GitLab is reported, never waited on.** Renovate is self-run, so it acts on its own schedule rather than in seconds; the next run picks up whatever it has done.
- **Held back is an outcome, not a failure.** A major bump under `"grouped"`, an undeterminable update type, a red verify, an `unknown` check list — report each with its reason and move on.

Respect `mergeDeps.cap` — the most requests one run may merge.

### 5. Security advisories

```bash
# GitHub — needs security_events scope.
gh api "repos/$owner/$repo/dependabot/alerts" --paginate \
  --jq '.[] | select(.state == "open")'
```

Map each open advisory to the request that fixes it, if one exists. Report advisories with **no request behind them** — they are the ones nothing is coming for. Advisories with **no fix available** get reported too, in their own bucket, every run; a vulnerability nobody can patch yet is exactly the thing that should stay visible.

**No access → say they could not be read, and never silently report zero.** On GitHub that is a missing scope. **On GitLab it is normally a tier fact, not a fault**: dependency scanning and the vulnerability APIs are **Ultimate-only**, so say which tier rather than which error, and report the list as `unknown` — never as clean ([the tier statement](REFERENCE.md#security-advisories-are-a-tier-not-a-feature)).

### 6. Report

Use the forge's own vocabulary throughout — **pull request** on GitHub, **merge request** on GitLab — and name the host wherever it is not the forge's public one.

- **TL;DR** — first, before any group: how many requests were merged, how many were held and how many open advisories remain, plus the one thing waiting on the reader — a major bump needing a human, or nothing. Where the advisory list could not be read, say so **here**, not only below. **Leading the report** further down binds the form.
- **Merged** — number, title, update type.
- **Held** — number and the **reason** (mode, unknown checks, failed verify, conflict, undeterminable type, handed back and awaiting the bot).
- **Advisories** — open ones, which have a request, which have none, which have no fix — or the tier/scope that put them out of reach.
- **Findings** — a base whose checks don't cover its requests is a **repo problem worth naming**, not a per-run footnote. Say it once, plainly. An id/login disagreement on the configured GitLab identity belongs here too.

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

- **Bot-authored requests only, matched on author.** Never any other request, under any circumstance, for any reason. Not a comment, not a label, not a mention in the report. The author is `app/dependabot` on GitHub and `mergeDeps.gitlab.bot`'s **id** on GitLab — one identity either way, and never a selector.
- **An unidentifiable queue is a stop, never an empty one.** `forge: gitlab` with no `mergeDeps.gitlab.bot` → say the key is unset and stop. Never infer the author from a branch prefix, a label or a title, and never let "selected nothing" stand in for "could not tell whose".
- **Manual invocation only.** Never fire proactively — not on a push, not because bumps "look due". Someone asks, or this skill does nothing.
- **Plan first; then merge only what the config authorizes.** The plan/report is always shown before any merge. A **major bump waits for an explicit confirmation** even when opted in; the low-risk tier merges on the standing opt-in unless `mergeDeps.confirm` is `"always"`. Plan-only triggers ("nur den Plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` / `glab` commands, then stop.
- **Never opens a request.** In any mode. A missing dependency request is a finding to report, never a gap to fill by hand.
- **An empty check list is never green.** Absence of a verdict is `unknown`, and `unknown` never merges. The same holds for an advisory list that could not be read.
- **Never resolve conflicts, never edit a lockfile, never force-push the bot's branch.** Hand it back to the bot that owns it — and on GitLab that means Renovate's rebase checkbox, **not** the native `/rebase`, which rebases without regenerating.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any comment or description it writes.
- **Two forges, and a third is a stop.** A `forge` this skill does not implement ends the run with a message, never a guess. No remote on that forge, or the CLI unavailable or unauthenticated → stop, naming the host tried; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the queue's author on each forge, the merge modes, the two-bases problem, the `gh`/`glab`/`git` recipes, the assessment checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
