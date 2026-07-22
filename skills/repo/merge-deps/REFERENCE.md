# merge-deps — Reference

Mechanics for the [`merge-deps`](SKILL.md) skill. **GitHub (`gh`) is the only forge in v1.** The queue it works is defined by **authorship** (`app/dependabot`) and nothing else — see [Decisions](#decisions).

## Config

`mergeDeps.*` in the repo-root `.tituskirch-skills.json`, or `mergeDeps: false` to disable the skill for the repo. Resolution per setting: **config → detected → built-in default**. Read with `jq`. Every key, type, enum and default lives once in the repo-root [`tituskirch-skills.schema.json`](../../../tituskirch-skills.schema.json) — the single source of truth.

```json
{
  "forge": "github",
  "mergeDeps": {
    "merge": "grouped",
    "verify": "pnpm check",
    "cap": 5
  }
}
```

| Key                | Effect                                                                                                 |
| :----------------- | :----------------------------------------------------------------------------------------------------- |
| `forge` _(root)_   | Forge, a shared root key read by all forge-aware skills. v1 supports only `github`. Default: `github`. |
| `mergeDeps.merge`  | What may be merged after confirmation — see [Merge modes](#merge-modes). Default: `false`.             |
| `mergeDeps.verify` | Command run against the PR's own head before merging. Default: `work.verify`, else nothing.            |
| `mergeDeps.cap`    | Max PRs merged per run. Default: 5.                                                                    |

Also reads the shared root `language` (report wording).

**`mergeDeps.verify` falls back to `work.verify`.** Both answer the same question — "does this repo still pass its own checks?" — and a repo that has already written one should not write it twice. A repo needing a different command for dependency updates (a full install, an audit) sets `mergeDeps.verify` explicitly.

**The fallback has to survive `work: false`.** That value disables the four `work-*` skills and says nothing about this one, so read the section defensively rather than indexing into a boolean:

```bash
verify=$(jq -er '.mergeDeps.verify // (if (.work | type) == "object" then .work.verify else null end) // empty' "$config" 2>/dev/null) || verify=
```

## Merge modes

`mergeDeps.merge` answers one question — **what may this skill merge, once the human confirms?** It is a permission ladder, narrowest first:

| Mode                | Merges                                                                                        |
| :------------------ | :-------------------------------------------------------------------------------------------- |
| `false` _(default)_ | **Nothing.** Triage and report only. Every PR is listed with its facts; none is commented on. |
| `"patch"`           | Patch-level updates only. The narrowest thing that still moves.                               |
| `"grouped"`         | Dependabot's grouped minor+patch PRs, plus everything `"patch"` allows.                       |
| `"all"`             | Everything selected, majors included.                                                         |

**`false` is the default because merging is the consequential act.** Same reasoning as [`release.promote`](../release/REFERENCE.md#decisions): the only mode that touches nothing is what a repo gets until it says otherwise. Reading the queue is free; merging is not. A repo that wants unattended-after-confirmation merges writes a `mergeDeps` block.

**A mode is a ceiling, never a trigger.** `"all"` does not mean "merge everything" — it means nothing is excluded _by mode_. Every PR still has to clear [assessment](#assessment-checklist) and the human still has to confirm.

## The two bases

The single most important fact about a Dependabot queue: **it is not all on one base.**

- **Version updates** honour `target-branch` in `.github/dependabot.yml`. Where a repo sets `target-branch: dev`, they arrive on `dev`.
- **Security updates do not honour `target-branch`.** They are raised against the repo's **default branch** — see [dependabot-core#2767](https://github.com/dependabot/dependabot-core/issues/2767) and GitHub's options reference, which caveats option after option with "unless `target-branch` defines updates to a non-default branch".

So a repo with `target-branch: dev` and a `main` default gets version-update PRs on `dev` and security-update PRs on `main`, from the same bot, in the same queue. **Read `baseRefName` per PR.** Any rule that assumes one base is wrong for half the queue.

This is why [assessment](#assessment-checklist) resolves checks **per PR against its own base**, and it is why "the repo's CI" is not a single answer:

> A workflow gated on `on.pull_request.branches: [main]` runs for the security PR and **not** for the version PR. Two PRs from the same bot, one verified by CI and one not verified at all — and the unverified one shows a check list that is merely _shorter_, not obviously empty. That is the trap.

**Corollary worth reporting:** a repo whose version updates land on a base its checks ignore has a **CI gap**, not a skill problem. The skill compensates with `mergeDeps.verify`; it should still [name the gap](SKILL.md#6-report), because extending the workflow to that base is the real fix.

## gh / git recipes

**Select the queue** — author, never label or title:

```bash
gh pr list --state open --search "author:app/dependabot" \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus
```

**Re-assert authorship** before touching any PR:

```bash
test "$(gh pr view "$n" --json author --jq '.author.login')" = "app/dependabot"
```

**Which checks does this base even trigger?** Compare the workflows' PR triggers against the PR's base before reading `gh pr checks`:

```bash
gh pr view "$n" --json baseRefName --jq '.baseRefName'
grep -A3 'pull_request' .github/workflows/*.yml   # read on.pull_request.branches
gh pr checks "$n"
```

**Verify the PR's head without touching the user's tree** — a throwaway worktree, removed whatever happens:

```bash
git fetch origin "pull/$n/head:merge-deps-$n"
git worktree add "$tmp" "merge-deps-$n"
( cd "$tmp" && eval "$verify" )        # exit status is the gate
git worktree remove --force "$tmp" && git branch -D "merge-deps-$n"
```

**Merge — by comment, never directly:**

```bash
gh pr comment "$n" --body "@dependabot squash and merge"
gh pr comment "$n" --body "@dependabot rebase"          # conflicts only
```

**Open alerts, and which have no PR:**

```bash
gh api "repos/$owner/$repo/dependabot/alerts" --paginate \
  --jq '.[] | select(.state=="open") | {number, pkg: .dependency.package.name, sev: .security_advisory.severity, fix: .security_vulnerability.first_patched_version}'
```

## Assessment checklist

The skill **gathers**; the human **decides**. Every row is a fact to show in the plan, not a gate to auto-clear:

| Check       | Fact to show                                                                       |
| :---------- | :--------------------------------------------------------------------------------- |
| Identity    | `author.login` is `app/dependabot` — re-read per PR, not inherited from the search |
| Base        | `baseRefName`, and which workflows that base actually triggers                     |
| Checks      | what ran and its verdict — plus, explicitly, **what did not run**                  |
| Verify      | `mergeDeps.verify` exit status against the PR's own head                           |
| Mergeable   | `mergeStateStatus`; `UNKNOWN` is unresolved, not clean                             |
| Update type | grouped / patch / minor / major, from the branch group and the body's diff lines   |

Any gap — an `unknown` check list, an undeterminable update type, a failed verify, a conflict — is **reported and held, never merged around**.

## Decisions

The issue that specified this skill left its defaults open. What was settled, and why:

- **Name `merge-deps`** — verb-noun, matching `write-docs` / `compact-readme`, and it names the consequential act the way `release` does. Rejected: `work-dependabot` and `work-deps` — the `work-*` prefix is spoken for by `work-implement` / `work-implement-queue`, whose whole shape is the issue lifecycle (lease, label, branch, PR). This skill shares none of that machinery, and borrowing the prefix would promise it. The config section is named `mergeDeps`, not `deps`, to disambiguate it from the separate `update-deps` skill — a bare `deps` would read as dependency updates rather than Dependabot-PR merging. A section name still need not equal the skill name (`pr` ↔ `pull-request` shows that), but here the fuller `mergeDeps` is chosen for clarity.
- **Its own skill, not a `work-implement-queue` mode** — the resemblance ("select a queue, cap it, work it, report") is real but shallow. `work-implement-queue` drains _issues_ through a lifecycle it owns end to end: it leases with a label, branches, commits, and delegates to `work-implement`. Not one of those steps exists here — there is no label, no lease, no branch, no commit, and the artifact already exists and belongs to a bot. The shared part is a `for` loop over a capped list; the rest is disjoint. Folding them would put "never touch a PR that isn't Dependabot's" inside a skill whose day job is opening PRs.
- **Selection is by author, and that is not a config key** — a `mergeDeps.selector` would only let a repo widen the one constraint that must not widen. The `dependencies` label and a `build(deps)` title are settable by any contributor; `author.login` is settable by nobody. Live proof in the specifying repo: `app/github-actions` also has an open PR there, and it must stay invisible to this skill for exactly the same reason a human's PR must.
- **`merge` defaults to `false`** — merging is opt-in, mirroring [`release.promote`](../release/REFERENCE.md#decisions) exactly and for the same reason: the consequential act is the merge, so the default is the mode that performs none. A repo that wants merges says so.
- **The skill verifies locally; it does not wait for a CI fix** — the issue asked whether the repo's CI gap is a prerequisite. It is not. Making a skill's correctness depend on a workflow edit in one repo would make it wrong in every repo whose CI happens not to cover its integration branch — and that is a whole class, not one repo. `mergeDeps.verify` is the **primary** gate and CI is corroboration, which is the only arrangement that holds regardless of a given repo's workflow triggers. The gap still gets reported, because the workflow edit remains the better fix; it is just not this skill's dependency.
- **An empty check list is `unknown`, not `green`** — the inverse of [`release`'s draft rule](../release/SKILL.md#2-promote-head--base-config-gated), which learned that a draft PR's checks have not run _yet_. Here they will never run at all. Both collapse to one rule: **absence of a verdict is not a pass.** This is the single most load-bearing line in the skill, because the failure it prevents is silent — the check list looks short, not empty, and CodeQL passing on a lockfile bump reads exactly like success.
- **Squash, by comment, and fixed** — `@dependabot squash and merge` rather than a direct `gh pr merge`, so Dependabot owns the rebase and close-out. Squash because a grouped PR is one logical change and `build(deps)` is hidden from release-please's changelog either way, so nothing downstream needs the individual commits — unlike the promotion merge, where preserving them is [mechanically required](../release/REFERENCE.md#decisions). Since neither choice is load-bearing, neither is a config key. **The most discretionary call here** — a repo preferring merge commits for bump forensics has a real argument, and this is the decision to revisit first.
- **Majors are never merged by default** — `"grouped"` and `"patch"` both exclude them, so a major needs an explicit `"all"`. A major bump is a semver-declared breaking change; a green lint run is not evidence it is safe, only that it is syntactically fine.
- **Nothing to do downstream after a merge** — the specifying repo's rollup PR is refreshed by a workflow on push to the integration branch, so the merge is already the whole act. The skill has no post-merge step and needs none.
- **Alerts without a fix are reported every run** — the alternative (stay quiet until a patch exists) hides exactly the alerts that most need a human, since "no fix available" is a decision to make, not a wait to sit out. Repetition is the cheapest part of the report.
- **Forge via the shared root `forge` key, `github`-only enum** — one key read by `pull-request`, `release` and this skill rather than a per-skill `backend`, so a second forge is a value, not a schema break.
