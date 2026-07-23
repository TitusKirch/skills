# release — Reference

Mechanics for the [`release`](SKILL.md) skill. **GitHub (`gh`) is the only forge in v1.** The release tool it drives is **release-please**, detected from the repo rather than configured — see [Decisions](#decisions).

## Config

`release.*` in the repo-root `.tituskirch-skills.json`, or `release: false` to disable the skill for the repo. Resolution per setting: **config → detected → built-in default**. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Every key, type, enum and default lives once in the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json) — the single source of truth.

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

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

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

**Merge it** — with a method the release branch allows, read from the forge rather than assumed:

```bash
methods=$(gh api "repos/{owner}/{repo}/rules/branches/$base" \
  --jq '[.[] | select(.type == "pull_request") | .parameters.allowed_merge_methods] | add')
# ["squash"] → --squash   ["merge"] → --merge   empty/null → unrestricted, prefer --squash
```

```bash
gh pr merge "$n" --squash        # preferred — release-please's own convention
gh pr merge "$n" --merge         # when the branch is pinned to merge commits
```

`rules/branches/<branch>` returns the **effective** rules for that branch — every ruleset that applies, already resolved — so it answers for `~DEFAULT_BRANCH` targeting and overlapping rulesets alike, which a raw `rulesets` listing does not. Why a release branch commonly answers `["merge"]`: [SKILL.md](SKILL.md#5-merge-then-report).

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
- **Opposite merge strategies — one fixed, one read from the forge** — the promotion **must** merge so release-please sees the individual commits; that is mechanical, so it stays fixed and a ruleset contradicting it is a misconfiguration to report. The release PR was originally fixed to squash on the same footing, and that was wrong: it is a _convention_, not a requirement — release-please tags the release either way, since nothing downstream reads the history of a single generated commit. Meanwhile a release branch that is also a promotion target is routinely pinned to `merge`, because `allowed_merge_methods` binds a branch, not a PR's provenance — so the ruleset that protects the promotion also rejects the squash. Two mechanical requirements cannot both hold on the same branch, so the softer one yields: query `rules/branches/<base>` and use what it permits. Still not a config key — the forge already knows the answer, and a config key could only be a way to contradict it.
- **`"create"` delegates to `pull-request`** — same reason `work-implement` does: one skill owns PR creation. It also inherits that skill's refusal to touch automation's PRs, which is precisely the `"auto"` guard.
- **`timeout` bounds each wait, not the run** — the unbounded risk is the release PR that never appears; a check run ends on its own. Default 600s.
- **A chain is an ordered array, not named slots or an edge list** — `release.stages` (last element = release branch) scales to N stages and degenerates to `[head, base]` with **zero migration**, so `head`/`base` stay the two-branch sugar. Rejected: named `staging`/`head`/`base` slots (hard-cap at three, order implicit in key names) and an explicit edge list (over-general — it buys non-linear graphs at the cost of a cycle/fork validator no linear chain needs).
- **One edge per invocation** — the skill promotes the topmost pending edge and stops, so "at most one PR, ever" generalises to **at most one _open_ promotion PR at a time**, one human confirmation per merge. Walking the whole chain in a single run would collapse several deliberate human gates — the opposite of why this skill is manual-only.
- **`staging` is a gate, not a prerelease point (deferred)** — release-please owns versioning on `base` alone; earlier stages accumulate and promote but never version. A second release-please on `staging` is separable, needs real manifest-ownership design, and is the **one** thing that would break the merge-commit flow-back invariant — so it stays out of the chain's first cut.
- **Workflow triggers stay the repo's own — documented, not shipped** — `on.*.branches` is static YAML parsed before any job runs, so it cannot read this config; the skill documents the trigger-broad/gate-in-a-step pattern instead of shipping workflows. The same removal of hardcoded branch names is what lets a release branch named `master` (or anything) work uniformly, since the skill already defaults `base` to the repo's own default branch.
