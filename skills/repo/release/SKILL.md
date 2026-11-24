---
name: release
metadata:
  summary: Drives the release-please flow to a shipped release — promotes the integration branch, then merges the release PR. GitHub-only.
description: Ships a release through release-please on GitHub — promotes the integration branch where configured, waits for the release PR, validates it and merges it after confirmation. To update or merge dependencies, use update-deps or merge-deps. GitHub-only by decision; invoke manually only — never fires proactively, never merges without confirmation, opens at most the one promotion PR. Use when the user explicitly asks to cut, ship or publish a release, merge the release-please PR or promote dev onto main, or says things like "ship the release", "cut a release", "Release machen", "Release veröffentlichen".
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

**This skill is GitHub-only, and that is a decision rather than a stage.** What binds it is not the forge but the **release tool**: release-please is GitHub-only by construction, and nothing with real traction elsewhere reproduces its release-PR model — semantic-release tags straight from the pipeline, leaving this skill nothing to validate and nothing to merge. So a root `forge` key naming another forge is not "not yet, a driver is coming"; it means there is nothing here to drive, and the run **stops and says so**. The seams stay open on purpose — the release tool is [detected, not configured](#1-detect-read-the-repo--never-assume) and the skill's name is deliberately tool-neutral, so a tool that _does_ reproduce the model on another forge docks here as detection, without a rename or a config break.

**Opted out?** If the repo config sets `release` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the release skill is turned off in `.tituskirch-skills.json`. An _absent_ `release` block is **not** disabled. Check `.release == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect (read the repo — never assume)

- **Forge** — from the root `forge` key. **`github` is the only value this skill drives**, so any other value **stops the run** — and the message says _why_: this skill is GitHub-only because **release-please is**, not because a driver is pending. Never say "not supported yet"; that promises something nobody is building. Say instead that the skill drives a release-PR model no tool on another forge reproduces, and that a repo there drives its own flow. Then confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop**.
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
- **Checks green, then merge with a merge commit** — `gh pr merge <n> --merge --match-head-commit <assessed-sha>`, never `--squash`. Record the full head before gathering the promotion evidence, recheck its identity afterwards and show it in the confirmation plan. A changed head requires new validation and confirmation ([binding the head](REFERENCE.md#gh-recipes)). The individual `feat:`/`fix:` commits must stay visible or release-please cannot compute the bump. Fixed, not a preference — and it holds at **every** edge, which is what keeps a multi-stage chain's release artifacts conflict-free ([why](REFERENCE.md#promotion-chains)). A `base` whose ruleset forbids `merge` breaks release-please itself — **report that and stop**; it is a repo misconfiguration, not something to squash around.
- **Then mark what shipped** — when this edge's `base` **is** the repo's default branch, the merge is the moment the promoted work reaches it, so the issues it carries become shipped. On **Linear** that is the one moment `work.linear.states.done` is written, by this skill and nothing else; on GitHub, and wherever the config leaves a precondition unmet — a mapping absent, a candidate filter that does not resolve — the step is **inert**, and inert is the only safe degradation: a query missing a filter selects more issues, not fewer, and this step ends in a write. It is bookkeeping for a merge the human already confirmed, so it is **listed in that merge's plan** rather than confirmed again — and a failure here is **reported, never retried into the merge**. Mechanics, and which issues qualify: [Marking shipped](REFERENCE.md#marking-shipped).

### 3. Wait for the release PR

The push to `base` triggers the release-please workflow, which opens **or updates** the release PR. Poll for it — head branch `release-please--*`, label `autorelease: pending` — bounded by `release.timeout` (default 600s), polling about every 20s. Recipe: [REFERENCE.md](REFERENCE.md#gh-recipes).

Already open before step 2? Expected — release-please updates its existing PR rather than opening a second one. Re-read it after the promotion lands, don't trust a pre-merge snapshot.

### 4. Validate (gather facts — the human decides)

Never merge on a heuristic. Record the PR’s full head SHA and target identity before collecting evidence; re-read them afterwards and stop if they changed. The diff and checks must describe that head. Show the recorded SHA with the plan and confirmation ([recipe](REFERENCE.md#gh-recipes)). Collect and show:

- **It is release-please's PR** — `release-please--*` head, `autorelease: pending`, authored by the release app. Anything else → not this skill's PR; stop.
- **Checks** — `gh pr checks <n>`; every required check green.
- **The bump** — the version in the PR's `.release-please-manifest.json` diff against the one on `base`, and whether it follows the commits since the last tag (`feat` → minor, `fix` → patch; `bump-minor-pre-major` holds a breaking change to a minor pre-1.0).
- **The changelog** — the `CHANGELOG.md` diff is non-empty and its entries match those same commits.

Anything unexplained — a bump the commits don't justify, an empty changelog, a red check — **report it and stop**. The plan states facts; the merge waits for the human.

### 5. Merge, then report

After confirmation, merge it with a method the **release branch actually allows** — ask the forge, never assume ([recipe](REFERENCE.md#gh-recipes)):

- **Squash if allowed** — release-please's own convention, and right here for the mirror-image reason a merge commit is right in step 2: the release PR is one generated `chore(main): release …` commit and nothing downstream reads its history.
- **Otherwise a merge commit.** A release branch that is also a **promotion target** is typically pinned to `merge` — the ruleset that keeps a promotion's individual commits visible binds every PR into that branch, release-please's included. Squashing there is not a preference the skill can hold; it is a merge the forge rejects.

Both methods pass `--match-head-commit` with the full SHA from the confirmed assessment. Restore it from the run record in the current command; never query the latest head to populate the guard. Missing identity, an unsupported guard or a mismatch stops this run. A changed head needs fresh validation and confirmation, not a retry with a replacement SHA.

Either way release-please then tags the release, and the workflow deletes the merged `release-please--*` branch.

Report the version, the tag, the release url, and every PR touched — **led** by the version and whether it shipped, before the detail. **Leading the report** below binds the form, and it binds step 6's timeout report too.

### 6. Report instead of hanging

Every wait is bounded. On timeout, **stop and report what was observed** — never poll on silently. The common benign case is that **nothing is release-worthy**: every commit since the last tag is typed `chore`/`refactor`/`docs`, so release-please opens no PR at all. Say that, with the commit types you actually saw, rather than "timed out".

<skills-plan>

## Presenting the plan

Whatever this skill puts in front of a human to decide on — a plan, a preview, a candidate list, a
findings report — is read **once, in a terminal**, so **every part of it renders on arrival**.

- **Never fold it behind a control.** A terminal cannot open `<details>`/`<summary>`, a tab or a
  "show more": only the summary line prints, and the human confirms a plan whose body never
  reached them.
- **Shorten instead of hiding.** Show every item that needs a decision, each with a visible id and
  its effect. Group the rest by something the reader already thinks in (kind, verdict, ecosystem)
  with a count and a reason, and name the command that shows them in full.
- **This binds the message, not the files it writes.** A `<details>` block in a README, an issue,
  a pull request or a docs page renders in a browser and is fine there.

</skills-plan>

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, so it **opens with its result**:
a `## TL;DR` section before every other heading — `## Kurzfassung` in a German run — holding, in a
few lines:

- **the counts**, per group, in the words the groups below use, with the total stated;
- **what the run acted on**, or proposes to — or that it acted on nothing;
- **the decision asked for**, said plainly, or **no decision needed**;
- **whatever the run could not establish** — a check that never ran, a list it could not read —
  because a reader who stops here must not leave with a picture the rest would correct.

**The lead opens the detail, it does not replace it.** Every item that needs action renders in full
below. A group that needs none may be counted with its reason and the command that lists it.
**"Nothing found" is a result too:** one line, naming the scope that was searched. The `tldr`
skill fixes the same opening for the summaries it writes on request.

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

**Open it at step 2** for the promotion modes and the chains a repo with more than two stages walks — that is what decides whether this run opens a promotion PR at all, or none. **At step 4** for the validation checklist the human's decision rests on, and **at step 5** for the `gh` recipes and how a release is marked shipped. It also states why the skill drives GitHub alone and stops on any other `forge` value, which is a settled decision rather than a gap: [REFERENCE.md](REFERENCE.md).
