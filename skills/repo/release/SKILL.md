---
name: release
metadata:
  summary: Drives the release-please flow to a shipped release — promotes the integration branch, then merges the release PR. GitHub-only.
description: Drives a repo's release-please flow to a shipped release — promotes the integration branch onto the release branch (config-gated), waits for the release PR release-please opens, validates it, and merges it. GitHub-only by decision, not by staging — release-please, the flow it drives, exists on no other forge, so a repo whose root `forge` key names another one is told why and the run stops. Invoke manually only — this skill never fires proactively, never merges without confirmation, and opens at most one pull request (the promotion PR, and only where configured to create it). Use when the user explicitly asks to cut, ship or publish a release, to merge the release-please PR, to promote dev onto main for a release, or says things like "ship the release", "cut a release", "merge the release PR", "Release machen", "Release veröffentlichen".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(git log:*)
  - Bash(git rev-list:*)
  - Bash(git rev-parse:*)
  - Bash(git describe:*)
  - Bash(gh pr list:*)
  - Bash(gh pr view:*)
  - Bash(gh pr checks:*)
  - Bash(gh repo view:*)
  - Bash(gh api:*)
---

# release

Drive the repo's **release-please** flow to a shipped release — get the integration branch onto the release branch, wait for the release PR release-please opens, validate it, merge it. **Manual invocation only**: nothing here ever fires on its own, and every merge waits for a human.

**This skill is GitHub-only, and that is a decision rather than a stage.** What binds it is not the forge but the **release tool**: release-please is GitHub-only by construction, and nothing with real traction elsewhere reproduces its release-PR model — semantic-release tags straight from the pipeline, leaving this skill nothing to validate and nothing to merge. So a root `forge` key naming another forge is not "not yet, a driver is coming"; it means there is nothing here to drive, and the run **stops and says so**. The alternatives that were weighed and rejected: [Decisions](REFERENCE.md#decisions). The seams stay open on purpose — the release tool is [detected, not configured](#1-detect-read-the-repo--never-assume) and the skill's name is deliberately tool-neutral, so a tool that _does_ reproduce the model on another forge docks here as detection, without a rename or a config break.

**Opted out?** If the repo config sets `release` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the release skill is turned off in `.tituskirch-skills.json`. An _absent_ `release` block is **not** disabled. Check `.release == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect (read the repo — never assume)

- **Forge** — from the root `forge` key. **`github` is the only value this skill drives**, so any other value **stops the run** — and the message says _why_: this skill is GitHub-only because **release-please is**, not because a driver is pending. Never say "not supported yet"; that promises something nobody is building. Point at [Decisions](REFERENCE.md#decisions) for what was weighed. Then confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop**.
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
- **Then mark what shipped** — when this edge's `base` **is** the repo's default branch, the merge is the moment the promoted work reaches it, so the issues it carries become shipped. On **Linear** that is the one moment `work.linear.states.done` is written, by this skill and nothing else; on GitHub, and wherever the config leaves a precondition unmet — a mapping absent, a candidate filter that does not resolve — the step is **inert**, and inert is the only safe degradation: a query missing a filter selects more issues, not fewer, and this step ends in a write. It is bookkeeping for a merge the human already confirmed, so it is **listed in that merge's plan** rather than confirmed again — and a failure here is **reported, never retried into the merge**. Mechanics, and which issues qualify: [Marking shipped](REFERENCE.md#marking-shipped).

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

Report the version, the tag, the release url, and every PR touched — **led** by the version and whether it shipped, before the detail. **Leading the report** below binds the form, and it binds step 6's timeout report too.

### 6. Report instead of hanging

Every wait is bounded. On timeout, **stop and report what was observed** — never poll on silently. The common benign case is that **nothing is release-worthy**: every commit since the last tag is typed `chore`/`refactor`/`docs`, so release-please opens no PR at all. Say that, with the commit types you actually saw, rather than "timed out".

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

- **Manual invocation only.** Never fire proactively — not after a merge, not after a green CI run, not because a release "looks due". Someone asks, or this skill does nothing.
- **Plan first; merge only after confirmation.** The promotion merge and the release merge are **two separate confirmations**. Plan-only triggers ("nur den Plan", "dry run", "just show me", "nicht mergen") → print the plan and the exact `gh` commands, then stop.
- **At most one _open_ promotion PR at a time** — one edge per invocation, and a PR only in `"create"` mode. In `"auto"` mode this skill creates nothing; a missing rollup PR is a finding to report, never a gap to fill. A [chain](REFERENCE.md#promotion-chains) never fans out — edges are promoted sequentially, one confirmed merge each.
- **Only its own two PRs.** The rollup PR and release-please's release PR are the only PRs it may undraft or merge — both opened by automation, and named here as the sole, deliberate exceptions to the sibling rule that automation's PRs are untouchable. Any other PR → leave it alone.
- **The promotion's merge commit is fixed** — `head` → `base` merges, never squashes, or release-please loses the individual commits it computes the bump from. A ruleset forbidding it is a repo **misconfiguration to report**, not to work around. The **release PR** is the softer case: squash preferred, but the forge's allowed methods decide (step 5). Neither is a config key — one is a mechanical requirement, the other is read from the forge.
- **Never force-push, never tag by hand, never edit the version or `CHANGELOG.md`.** release-please owns all three; racing it corrupts the manifest.
- **Only issues the AI work loop already accepted are marked shipped**, and only after the merge that put them on the default branch. An issue referenced by a promoted commit but still mid-lifecycle — working, awaiting review, changes requested, escalated, blocked — is **left alone**: this skill observes a merge, it does not adjudicate a lifecycle. It writes one workflow state and never a label, so nothing here can hand an issue to, or take one from, either work loop.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in any PR, comment, or commit it produces.
- **GitHub-only, by decision.** A `forge` other than `github` → stop, naming release-please as what binds it and not a pending driver; never improvise a release on a forge whose tooling has no release PR to validate. No GitHub remote / `gh` unavailable → stop as well; never fall back to raw `git` plumbing or the API by hand.

## Reference

Config keys, the promotion modes in detail, the `gh` recipes, the validation checklist, and the reasoning behind the defaults: [REFERENCE.md](REFERENCE.md).
