# release — Reference

Mechanics for the [`release`](SKILL.md) skill. **GitHub (`gh`) is the only forge in v1.** The release tool it drives is **release-please**, detected from the repo rather than configured — see [Decisions](#decisions).

## Config

`release.*` in the repo-root `.tituskirch-skills.json`, or `release: false` to disable the skill for the repo. Resolution per setting: **config → detected → built-in default**. Read with `jq`. Every key, type, enum and default lives once in the repo-root [`tituskirch-skills.schema.json`](../../tituskirch-skills.schema.json) — the single source of truth.

```json
{
  "release": {
    "promote": "auto",
    "base": "main",
    "head": "dev",
    "timeout": 600
  }
}
```

| Key               | Effect                                                                                                                                                                                                            |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release.promote` | `false` / `"auto"` / `"create"` — see [Promotion modes](#promotion-modes). Default: `false`.                                                                                                                      |
| `release.stages`  | Ordered promotion chain, integration branch first, release branch last — see [Promotion chains](#promotion-chains). The N-stage form of `head`/`base`; wins over both when set. Default: absent → `[head, base]`. |
| `release.base`    | Release branch, where releases are cut — `stages`' last element when set. Default: the repo's default branch.                                                                                                     |
| `release.head`    | Integration branch, what gets promoted — `stages`' first element when set. Default: `pr.base`, else the default branch.                                                                                           |
| `release.timeout` | Seconds to bound **each** wait (release PR appearing, checks finishing). Default: 600.                                                                                                                            |

Also reads `pr.base` (the `head` fallback) and the shared root `language` (report wording).

**Minimal config wins — except for promotion.** Branches and timeout have working defaults, so a repo that integrates onto `pr.base` and releases from its default branch writes neither. `promote` is the deliberate exception: it defaults to `false`, so **a repo that wants `head` → `base` promoted must say so**. Merging onto the release branch is opt-in, never inherited from a default.

## Promotion modes

`release.promote` answers one question — **who opens the promotion PR** for the edge being promoted? — and nothing else. All three modes share the [skip rule](SKILL.md#2-promote-along-the-chain-config-gated): the edge's `head` not ahead of its `base` → nothing to promote. On a [multi-stage chain](#promotion-chains) the mode governs **each** edge identically; the skill still opens at most one promotion PR at a time.

### `"auto"`

Automation opens the rollup PR; the skill **finds** it. It undrafts and merges it, and **never creates one** — that is the whole point of the mode. No PR found → report it (with the mode, the branches, and `"create"` as the fix) and stop.

The reference shape is a workflow on push to `head` that opens a **draft** `base ← head` PR. Because such a repo's CI typically skips drafts, the draft has **no checks at all** — undrafting is what starts them:

```bash
gh pr list --base "$base" --head "$head" --state open --json number,isDraft,author,title
gh pr ready "$n"                 # starts CI where checks skip drafts
gh pr checks "$n" --watch        # bounded by release.timeout
gh pr merge "$n" --merge         # merge commit — never squash
```

### `"create"`

No such automation, so the skill may open the PR itself — delegating to [`pull-request`](../pull-request/SKILL.md) with an explicit `base ← head` override (the inverse of that skill's usual `pr.base` default). This is the **only** PR the release skill ever opens, in any mode.

Produce the same PR the automation would: a `chore: merge <head> into <base>` rollup title and a body that states the merge-commit requirement. Ready, not draft — there is no automation to hand off to, so there is nothing to wait for.

### `false` (default)

Release-only. Never touch `head` → `base`; go straight to waiting for the release PR. For repos where promotion is a human's call, where `base` is the only branch — and for every repo that has not opted in, because this is the default.

## Promotion chains

A repo with a pre-production stage promotes along a **chain** — `dev → staging → main` — not a single edge. `release.stages` is that chain as an **ordered array**: lowest integration branch first, **release branch last** (the only branch release-please runs on). Consecutive pairs are the promotion **edges**.

```json
{ "release": { "promote": "auto", "stages": ["dev", "staging", "main"] } }
```

`stages` is the canonical, N-stage form of `head`/`base` and **subsumes** today's two-branch world — so nothing already configured changes:

| `stages`                     | Edges                             | Meaning                                                      |
| :--------------------------- | :-------------------------------- | :----------------------------------------------------------- |
| _(absent)_                   | `head → base`                     | resolves to `[head, base]` — the default two-branch flow     |
| `["dev", "main"]`            | `dev → main`                      | the two-branch flow, written out                             |
| `["dev", "staging", "main"]` | `dev → staging`, `staging → main` | a three-stage chain                                          |
| `["main"]`                   | none                              | single-branch — release cut directly on `base`, no promotion |

**Resolution.** `stages` when set (it wins over `head`/`base`); else `[head, base]` from their own resolution; a one-element chain has no edge to promote. **Validate before use:** non-empty, branches distinct, each a real ref — a malformed `stages` is a config error to **report, not guess around**.

**Promotion model — one edge per invocation.** The skill promotes a **single** edge and stops, defaulting to the **topmost pending edge** (the one nearest `base` whose `head` is ahead of its `base`) so an invocation drives a release forward; an explicit edge overrides. A full `dev → main` release is therefore N−1 human-confirmed invocations — which is the skill's whole ethos: every merge waits for a human, and a chain simply has more of them. The `release.promote` mode and the fixed **merge-commit** strategy apply to **every** edge identically. release-please still fires only on the **last** stage.

**`staging` is a gate, not a release point.** By default no earlier stage cuts its own release — release-please owns versioning on `base` alone. Cutting `-rc`/`-beta` prereleases on `staging` would mean a **second** release-please instance with its own manifest, and two branches editing `CHANGELOG.md`/manifest is a conflict this design deliberately avoids ([Decisions](#decisions)).

**No flow-back step is needed** — while every edge uses a merge commit. The release artifacts (`CHANGELOG.md`, `.release-please-manifest.json`) live on `base` only; no earlier stage edits them, so the merge-commit history stays an ancestor through each later promotion and stages merge forward conflict-free. The stale version on `dev`/`staging` is harmless — they do not run release-please.

**Workflow triggers (consuming-repo setup).** GitHub's `on.push.branches` / `on.pull_request.branches` are **static YAML parsed before any job runs** — they cannot read this config, so a chain's branch names cannot be config-driven at the trigger. The skill does not ship these workflows; a repo adding a stage wires them itself. The robust pattern is **trigger broad, gate in a job step**:

| Workflow                   | For a chain                                                                                                        |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| CI / lint                  | Drop the base-branch filter — run on **every** PR. A `dev → staging` PR then gets CI; scoping it buys nothing.     |
| CodeQL / security          | Same — analyse all pushes/PRs (or a glob); security scanning is never stage-specific.                              |
| release-please             | Must run on the **release branch** (last stage). Trigger on all pushes, gate a step on `ref_name == <last stage>`. |
| rollup-PR opener           | Maintain a standing rollup PR **per edge** — a step reads `stages` and loops (`dev → staging`, `staging → main`).  |
| dependabot `target-branch` | The **first** stage. Still static YAML with no config hook — a documented, drift-checked hand-edit.                |

Removing the hardcoded branch names is also what lets `base` be named `master` (or anything) uniformly — the skill layer already defaults `base` to the repo's own default branch; only the static workflow YAML ever hardcodes it.

## gh recipes

**Is there anything to promote?**

```bash
git fetch --prune
git rev-list --count "origin/$base..origin/$head"   # 0 → nothing to promote
```

**Find the release PR** (poll until found or `release.timeout` elapses, ~20s apart):

```bash
gh pr list --base "$base" --state open \
  --json number,headRefName,labels,author,title \
  --jq '.[] | select(.headRefName | startswith("release-please--"))'
```

**Why is there no release PR?** Before reporting a timeout, look at what has landed — an all-`chore`/`refactor`/`docs` window is the benign, expected answer:

```bash
git log "$(git describe --tags --abbrev=0)..origin/$base" --pretty='%s'
```

**Validate the release PR:**

```bash
gh pr checks "$n"
gh pr diff "$n" -- .release-please-manifest.json CHANGELOG.md
```

**Merge it:**

```bash
gh pr merge "$n" --squash
```

## Validation checklist

The skill **gathers**; the human **decides**. Every box is a fact to show in the plan, not a gate to auto-clear:

| Check     | Fact to show                                                                         |
| :-------- | :----------------------------------------------------------------------------------- |
| Identity  | head is `release-please--*`, label `autorelease: pending`, author is the release app |
| Checks    | every required check green (`gh pr checks`)                                          |
| Bump      | manifest diff vs. `base`, and the commit types since the last tag that justify it    |
| Changelog | `CHANGELOG.md` diff non-empty, entries match those commits                           |

Any mismatch — a bump the commits don't justify, an empty changelog, a red or missing check — is **reported, never merged around**.

## Decisions

The issue that specified this skill left its defaults open. What was settled, and why:

- **Name `release`** — the noun matches its siblings (`issue`, `pull-request`) and the `release.*` config section. `release-please` would bake the tool into the name, which is exactly what must stay swappable.
- **Release tool is detected, not configured** — `release-please-config.json` and the workflow already say which tool the repo uses; a `release.tool` key would only let the config contradict the repo. If changesets ever arrives, it arrives as detection plus a branch in the workflow, not a config break.
- **`promote` defaults to `false`** — promotion is opt-in. `"auto"` was the first answer, on the grounds that it is the mode that _cannot_ open a PR; that argument measures the wrong risk. The consequential act is **merging onto the release branch**, and `"auto"` does that — not creating a PR. `false` is the only mode that touches nothing, so it is what a repo gets until it says otherwise. The cost is real and accepted: every repo wanting the ordinary `head` → `base` flow now writes a `release` block. Rejected alternative: default `"auto"` and rely on the skip rule (`head == base` → nothing to promote) to protect repos without an integration branch. It does protect them, but it makes the blast radius a function of repo layout rather than of an explicit choice.
- **Forge lives once at the repo root** — the forge axis is the root `forge` key (`github`-only enum in v1), shared by `pull-request`, `release` and `merge-deps`, not a per-skill `backend` slot. One home means a second forge docks there as a value, not a schema break — and no per-section keys to keep in sync.
- **Opposite, fixed merge strategies** — merge commit for the promotion so release-please can see the individual commits; squash for the release PR per release-please's own convention. Both are mechanical, so neither is a config key.
- **`"create"` delegates to `pull-request`** — same reason `work-issue` does: one skill owns PR creation. It also inherits that skill's refusal to touch automation's PRs, which is precisely the `"auto"` guard.
- **`timeout` bounds each wait, not the run** — the unbounded risk is the release PR that never appears; a check run ends on its own. Default 600s.
- **A chain is an ordered array, not named slots or an edge list** — `release.stages` (last element = release branch) scales to N stages and degenerates to `[head, base]` with **zero migration**, so `head`/`base` stay the two-branch sugar. Rejected: named `staging`/`head`/`base` slots (hard-cap at three, order implicit in key names) and an explicit edge list (over-general — it buys non-linear graphs at the cost of a cycle/fork validator no linear chain needs).
- **One edge per invocation** — the skill promotes the topmost pending edge and stops, so "at most one PR, ever" generalises to **at most one _open_ promotion PR at a time**, one human confirmation per merge. Walking the whole chain in a single run would collapse several deliberate human gates — the opposite of why this skill is manual-only.
- **`staging` is a gate, not a prerelease point (deferred)** — release-please owns versioning on `base` alone; earlier stages accumulate and promote but never version. A second release-please on `staging` is separable, needs real manifest-ownership design, and is the **one** thing that would break the merge-commit flow-back invariant — so it stays out of the chain's first cut.
- **Workflow triggers stay the repo's own — documented, not shipped** — `on.*.branches` is static YAML parsed before any job runs, so it cannot read this config; the skill documents the trigger-broad/gate-in-a-step pattern instead of shipping workflows. The same removal of hardcoded branch names is what lets a release branch named `master` (or anything) work uniformly, since the skill already defaults `base` to the repo's own default branch.
