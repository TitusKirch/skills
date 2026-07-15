# release — Reference

Mechanics for the [`release`](SKILL.md) skill. **GitHub (`gh`) is the only backend in v1.** The release tool it drives is **release-please**, detected from the repo rather than configured — see [Decisions](#decisions).

## Config

`release.*` in the repo-root `.tituskirch-skills.json`, or `release: false` to disable the skill for the repo. Resolution per setting: **config → detected → built-in default**. Read with `jq`. Every key, type, enum and default lives once in the repo-root [`tituskirch-skills.schema.json`](../../tituskirch-skills.schema.json) — the single source of truth.

```json
{
  "release": {
    "backend": "github",
    "promote": "auto",
    "base": "main",
    "head": "dev",
    "timeout": 600
  }
}
```

| Key               | Effect                                                                                                        |
| :---------------- | :------------------------------------------------------------------------------------------------------------ |
| `release.backend` | Forge. v1 supports only `github`; the slot exists for a later platform-neutral rename (mirrors `pr.backend`). |
| `release.promote` | `"auto"` / `"create"` / `false` — see [Promotion modes](#promotion-modes). Default: `"auto"`.                 |
| `release.base`    | Release branch, where releases are cut. Default: the repo's default branch.                                   |
| `release.head`    | Integration branch, what gets promoted. Default: `pr.base`, else the repo's default branch.                   |
| `release.timeout` | Seconds to bound **each** wait (release PR appearing, checks finishing). Default: 600.                        |

Also reads `pr.base` (the `head` fallback) and the shared root `language` (report wording).

**Minimal config wins.** Every key has a working default: a repo that integrates onto `pr.base`, releases from its default branch, and already has automation opening the rollup PR needs **no `release` block at all**. Write only what deviates.

## Promotion modes

`release.promote` answers one question — **who opens the `head` → `base` PR?** — and nothing else. All three modes share the [skip rule](SKILL.md#2-promote-head--base-config-gated): `head` not ahead of `base` → nothing to promote.

### `"auto"` (default)

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

### `false`

Release-only. Never touch `head` → `base`; go straight to waiting for the release PR. For repos where promotion is a human's call, or where `base` is the only branch.

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
- **`promote` defaults to `"auto"`** — it is the mode that _cannot_ open a PR, so it is the conservative default. The "it would report every time" worry needs a repo that has an integration branch **but** no automation; with no integration branch, `head` defaults to `pr.base` → the default branch → `head == base` → the skip rule fires and the mode never comes up.
- **`backend` key, `github`-only enum** — mirrors `pr.backend` exactly: the slot exists now so a second forge is a value, not a schema break.
- **Opposite, fixed merge strategies** — merge commit for the promotion so release-please can see the individual commits; squash for the release PR per release-please's own convention. Both are mechanical, so neither is a config key.
- **`"create"` delegates to `pull-request`** — same reason `work-issue` does: one skill owns PR creation. It also inherits that skill's refusal to touch automation's PRs, which is precisely the `"auto"` guard.
- **`timeout` bounds each wait, not the run** — the unbounded risk is the release PR that never appears; a check run ends on its own. Default 600s.
