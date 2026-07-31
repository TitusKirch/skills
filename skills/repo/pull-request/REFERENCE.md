# pull-request — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow. The forge is chosen by the root `forge` key; v1 implements the **GitHub forge**, which goes through the GitHub CLI (`gh`) against the `origin` remote. Other forges (e.g. GitLab merge requests) would dock as additional forges — none implemented yet.

## Detecting conventions

### GitHub + base branch

```bash
gh repo view --json nameWithOwner,defaultBranchRef \
  --jq '{repo: .nameWithOwner, base: .defaultBranchRef.name}'
git branch --show-current        # head
```

If `gh repo view` errors, the repo has no GitHub remote or `gh` is not authenticated → **stop** (GitHub is the only forge in v1). Default the PR base to `defaultBranchRef.name`; never hardcode `main`/`dev`. Confirm `base ← head` in the plan and let the user override (`--base <other>`).

### PR template

Look in priority order: `.github/pull_request_template.md` → `.github/PULL_REQUEST_TEMPLATE.md` → `.github/PULL_REQUEST_TEMPLATE/*.md` (several → pick by name or ask) → `PULL_REQUEST_TEMPLATE.md` / `docs/PULL_REQUEST_TEMPLATE.md` → repo root. Use it verbatim as the body skeleton: fill its sections, keep its checklists and comments-as-prompts. No template → fall back to `## Summary`, `## Changes`, `## Related issues`.

### Title convention (shared convention cache)

The commit convention **is** the PR-title convention, so reuse the cache that `atomic-commit` already writes — validated exactly as `atomic-commit` validates it, so both skills agree. It lives at `$(git rev-parse --git-common-dir)/tituskirch-skills/conventions` and holds only the shared convention block:

```bash
cache="$(git rev-parse --git-common-dir)/tituskirch-skills/conventions"
now=$(date +%s)
cfg=$(ls commitlint.config.* .commitlintrc* 2>/dev/null | head -1)
if [ -n "$cfg" ]; then hash=$(cksum "$cfg" | cut -d' ' -f1)
elif grep -q '"commitlint"' package.json 2>/dev/null; then hash=$(cksum package.json | cut -d' ' -f1)
else hash=none; fi

if [ -f "$cache" ]; then
  detected_at=$(grep '^detected_at=' "$cache" | cut -d= -f2)
  cached_hash=$(grep '^commitlint_hash=' "$cache" | cut -d= -f2)
  # A hash match proves the conventions are unchanged when a config source
  # exists — reuse regardless of age. With no hashable source (hash=none,
  # conventions inferred from git log) the 3-day TTL is the only staleness signal.
  if [ "$hash" = "$cached_hash" ] && { [ "$hash" != none ] || [ $(( now - detected_at )) -lt 259200 ]; }; then
    is_conventional=$(grep '^types=' "$cache" >/dev/null && echo yes)   # cache hit
    header_max=$(grep '^header_max_length=' "$cache" | cut -d= -f2-)
  fi
fi
```

- **Cache hit** → use `types`/`scopes`/`language`/`header_max_length` for the title; skip detection. A commitlint-config hash match means reuse **regardless of age**; only when there is no hashable config (`hash=none`) does the 3-day TTL (259200 s) decide freshness — the same rule `atomic-commit` applies.
- **Miss/stale** → detect (commitlint config + history, exactly as `atomic-commit` does) and **write the same block** back (`detected_at`, `commitlint_hash`, `scopes`, `scope_count`, `types`, `scope_vocab`, `language`, `header_max_length`, `commitlint`), so the next run of either skill reuses it. Create the dir first (`mkdir -p`).
- A commitlint config (or a Conventional-Commits history) means the PR title is Conventional too — many repos lint it with actions like `amannn/action-semantic-pull-request`, and templates often say so outright. Honor the cached `header_max_length`.
- `pr.title.convention: plain` in `.tituskirch-skills.json` overrides this to a non-Conventional title.

`base` and `template` are **not** cached: `gh repo view … defaultBranchRef` already runs every time (the forge availability check), and the template is a local glob — both are cheap to read fresh.

### Existing PR (and who owns it)

```bash
me=$(gh api user --jq .login)
gh pr list --head "$(git branch --show-current)" --state open \
  --json number,author,isDraft,title --jq '.[0]'
```

- No result → **create**.
- `author.login == $me` → offer to **update its body only**.
- `author.login != $me` (a teammate, or a `*[bot]` / automation such as a `dev → main` rollup) → **leave it untouched**; report number + author and stop.

### Stacked branches

GitHub's [stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) are a chain: the bottom PR targets the trunk, and **"each subsequent pull request targets the branch of the pull request below it."** This skill **reads** that shape to pick a base. It never creates, extends, dissolves or reorders a stack — that is the forge's job and `gh stack`'s, not this skill's.

**Why it has to look at all.** Base a PR on the trunk when the branch is really built on another open PR's branch, and the diff carries that PR's unmerged commits as if this change had made them. Nothing errors: a PR opens, it is simply wrong, and the reviewer reads a diff that is mostly someone else's work. Because the failure is silent, the check runs on **every** branch — there is no "this repo uses stacks" flag to gate it on, and a branch built on a colleague's open PR has the same wrong diff whether or not anyone called it a stack.

**The signal is git ancestry, read through branch names.** Only two things are consulted: which branches the open PRs point at, and which commits this branch descends from. No PR body, title or comment is read, so nothing here rests on prose a third party wrote — and nothing rests on a preview API either.

```bash
base=<the base step 1 resolved>          # pr.base, else defaultBranchRef.name
head=$(git branch --show-current)
default=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)

# Candidate parents: open PRs whose head is neither this branch, the base, nor the default branch.
# Excluding the last two matters — a dev → main rollup PR has head `dev`, an ancestor of everything.
gh pr list --state open --json number,headRefName,baseRefName,isCrossRepository \
  --jq ".[] | select(.headRefName != \"$head\" and .headRefName != \"$base\" and .headRefName != \"$default\")"

# Then classify each candidate branch B against HEAD:
tip=$(git rev-parse "origin/$B") || exit    # ref missing → not fetched, see the table
mb=$(git merge-base "origin/$B" HEAD)
if [ "$mb" = "$tip" ]; then
  : # B is an ancestor of HEAD → a real parent candidate
elif [ "$mb" = "$(git rev-parse HEAD)" ]; then
  : # HEAD is an ancestor of B → B sits ABOVE this branch, not below → ignore it
elif git merge-base --is-ancestor "$mb" "origin/$base"; then
  : # they meet on the trunk only → unrelated branch, not a parent
else
  : # they share commits that are NOT on the trunk → out of sync (below)
fi
```

**The direction matters as much as the overlap.** Only a branch **below** this one is a base; a branch someone stacked **on top** shares exactly the same commits, differing only in which is the ancestor of which — hence the second arm above. Skipping that test turns every branch with a layer above it into an out-of-sync refusal, which would block the bottom of a healthy stack from ever opening its PR.

**The nearest candidate is the base**, not the first one found: in a chain each layer is an ancestor of the one above, so several may qualify. The nearest is the candidate that has **every other candidate as its own ancestor** — settle it pairwise with `git merge-base --is-ancestor origin/A origin/B`, never by counting commits.

| What the candidates say                                                                | Base               | Action                                                                                                                                                                           |
| :------------------------------------------------------------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **None** — no open PR's branch is an ancestor                                          | the resolved trunk | proceed exactly as before; this is the ordinary case and it stays silent                                                                                                         |
| **A unique nearest** candidate                                                         | that branch        | proceed; the plan names the PR below (see [Plan output](#plan-output))                                                                                                           |
| **Two or more**, none an ancestor of the others                                        | —                  | **stop**: name both PRs and ask for an explicit `--base`; a merge in the history makes "below" undefined                                                                         |
| **Out of sync** — shared commits that are not on the trunk, but the tip is no ancestor | —                  | **stop**: the branch below moved (a rebase, or the bottom PR merging), so this branch's parent no longer exists as pushed. Ask for a rebase onto the current parent, then re-run |
| **Cross-fork** (`isCrossRepository: true`)                                             | —                  | **stop**: "Stacked pull requests require all branches to be in the same repository. Cross-fork stacks are not supported."                                                        |
| **`origin/<B>` missing** locally                                                       | —                  | **stop**: the candidate is unfetched, so ancestry cannot be judged. Say which ref, and that `git fetch origin` fixes it                                                          |

Every refusal row **stops before creating anything** and says which PRs it saw. That asymmetry is the whole design: the cost of stopping is one round trip, the cost of guessing is a PR whose diff is someone else's work.

**A base the user named wins outright.** An explicit `--base <branch>` (or a base given in the request) is an answer, not a guess — take it, skip the detection, and mention at most in passing what the check would have picked. The refusals above exist because there is no answer, so they never override one.

**Merge order and re-targeting belong to the forge.** Stacked PRs "must merge from the bottom up", and when the bottom merges "the remaining branches are automatically rebased so the next pull request targets the default base branch." Two consequences here, both about staying out of the way:

- The plan says the PR is stacked so the human knows its merge is gated on the one below. This skill [never merges](SKILL.md), so ordering is theirs to act on.
- An **existing** PR whose base is not what this run would compute is **not** drift to correct. GitHub re-targets it when the PR below merges, and the skill already leaves an existing PR's base alone unless asked. Report the difference, change nothing.

**Why not the stacks preview API.** The preview also exposes read-only `stack` fields on a pull request in GraphQL, plus REST endpoints to list, create, extend and dissolve stacks — reachable with plain `gh api`, no extension needed. This skill uses neither, for two reasons pointing the same way:

- The feature is stated to be **"in public preview and subject to change"**, while git ancestry is not. Reading the base chain is stable ground; the fields describing it are not yet.
- Reaching them means granting `Bash(gh api graphql:*)`, which pre-approves every GraphQL **mutation** — precisely the surface the [`gh api user` narrowing](#config) exists to keep shut — to learn something ancestry already answers. `git merge-base` buys the same fact with a read-only grant.

The `gh stack` CLI extension is out for a third reason: every other call this skill makes is plain `gh`, which is present wherever the skill runs, and an extension is not. Requiring one would trade a silent mis-based PR for a skill that cannot run at all.

## Config

`.tituskirch-skills.json` at the repo root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. Absent → behave exactly as before. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Resolution per setting: **config → native → built-in default**.

Keys this skill reads:

| Key                   | Effect                                                                                                                                       |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr.language`         | PR title/body language — any code/name or `match`; overrides root + detection                                                                |
| `language` (root)     | shared default language; used when `pr.language` is unset; shared with `atomic-commit`                                                       |
| `pr.base`             | PR base branch — overrides `defaultBranchRef.name` (e.g. a `feature → dev` flow)                                                             |
| `pr.title.convention` | `conventional` (default) or `plain`                                                                                                          |
| `pr.instructions`     | free-text wording guidance for the PR title/body — additive, never overrides guardrails                                                      |
| `forge` (root)        | forge for PRs/releases — repo-root key, github-only in v1; shared with the `release` and `merge-deps` skills, so other forges can dock later |

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
base=$(printf '%s' "$resolved" | jq -er '.pr.base // empty' 2>/dev/null) || base=
title_conv=$(printf '%s' "$resolved" | jq -er '.pr.title.convention // empty' 2>/dev/null) || title_conv=
lang=$(printf '%s' "$resolved" | jq -er '.pr.language // .language // empty' 2>/dev/null) || lang=
instructions=$(printf '%s' "$resolved" | jq -er '.pr.instructions // empty' 2>/dev/null) || instructions=
```

`language` is a shared root key; `pr.*` are this skill's section. `pr.language` overrides the root `language` for the PR title/body, mirroring `commit.language` / `issue.language`. `pr.instructions` mirrors `commit.instructions` / `issue.instructions` — additive wording guidance that never overrides the template, detection, or guardrails. Full schema: the repo-root `tituskirch-skills.schema.json`.

**What the grant leaves out, and why that is the point.** This skill's `allowed-tools` names the commands it drives rather than granting `Bash` outright — `git rev-parse`, `git branch --show-current`, `git log`, `git diff` and `git merge-base` for the branch, its commits and the [ancestry a stacked base rests on](#stacked-branches), `gh pr list` / `view` / `diff`, `gh repo view` and `gh api user` for the forge side, plus `jq`, `printf` and `mkdir` for the config and the shared conventions cache, and the `date`, `ls`, `head`, `cksum`, `cut` and `grep` that cache's own hash and TTL check runs on every invocation. **`gh pr create`, `gh pr edit`, `gh pr ready` and `git push` are deliberately absent.** Everything that reads is pre-approved; everything that changes the forge or the remote asks, which matches a skill that [presents the full plan and creates only after confirmation](SKILL.md). The `git branch` grant is written at `--show-current` for that same reason: the branch is only ever read here, while the bare subcommand would also pre-approve the creation, deletion, rename and upstream rewiring this skill never performs. `git push` is also an exec route in its own right (`--receive-pack=<cmd>`), so no clear could cover it.

**`gh api` is written at `gh api user`, and that narrowing is real without being complete.** The skill's one call is `gh api user --jq .login`, while the bare `Bash(gh api:*)` would pre-approve `gh api repos/{owner}/{repo}/pulls --method POST` — which **creates a pull request**, the very action the paragraph above names first as one that must ask. `gh pr create` asking while the same act spelled as an API call did not was the gap, and the narrowed rule closes it. What it does **not** close: a permission rule matches the command **string**, so `gh api user` also covers `gh api user/repos --method POST`. That surface is small and it is not nothing, and on a page whose subject is grants that describe themselves accurately it belongs here rather than in the next reviewer's notes.

**What the list is, and is not.** It documents what this skill drives and keeps the unattended surface small; it is **not** a restriction — an unlisted command still runs once a person says yes.

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

## Title derivation (umbrella)

- **One commit** → use its subject verbatim.
- **Multiple commits** → one Conventional summary covering the branch:
  - **type** = the most significant present: `feat` > `fix` > `refactor`/`perf` > `docs`/`test`/`build`/`ci`/`chore`.
  - **scope** = the shared scope if every commit shares one; otherwise omit.
  - **subject** = imperative summary of the branch's net change, within the header limit.
  - any breaking commit (`!` or a `BREAKING CHANGE:` footer) → mark the title with `!`.
- Example: `feat(x): …` + `test(x): …` + `docs(x): …` → `feat(x): <summary>`.

## Body — filling the template

- **Summary** — what changed and why, from `git log <base>..HEAD` bodies + `git diff --stat <base>...HEAD`. Plain prose, no filler.
- **Type of change** — tick the box matching the umbrella type (feat → new skill/feature, fix → bug fix, docs → documentation, breaking → breaking change, chore → internal).
- **Checklist** — pre-tick only what you actually verified (e.g. `pnpm check` was run); leave the rest for the human.
- **Closing keywords (at the end)** — gather every issue the branch resolves (commit `Refs/Closes #N` footers, the branch name, the session) and put them **last in the body**, one per line: `Closes #1` / `Closes #2` … Each issue needs its own `Closes` keyword — GitHub does not parse `Closes #1, #2`. Use `Refs #N` for issues it relates to but doesn't close. Note: GitHub auto-closes only when the PR merges into the **default branch**; for a `feature → dev` PR the link is recorded but the close happens once it reaches the default branch.
- Write the body to a temp file and pass `--body-file <file>` so multi-line markdown survives the shell.

## Plan output

Present this before creating:

```text
PR plan
  base ← head : main ← feat/cache      (base = repo default)
  title       : feat(atomic-commit): cache detected conventions
  state       : ready
  existing    : none → will create
  body ▼
    ## Summary
    …
Run: gh pr create --base main --head feat/cache --title "…" --body-file <tmp>
```

For an existing PR you own: `existing : #42 by you → will update body`, and the command becomes `gh pr edit 42 --body-file <tmp>`. For a PR owned by someone else: `existing : #42 by github-actions[bot] → leaving untouched` and stop.

On a [stacked branch](#stacked-branches) the base line carries the PR below, so the human reads the merge order off the plan:

```text
  base ← head : feat/api-client ← feat/api-cache   (stacked on #41 — merges after it)
```

A refusal prints the same header and then stops, naming what it saw rather than a bare "cannot determine":

```text
PR plan
  base ← head : ? ← feat/api-cache
  stacked     : ambiguous — #41 (feat/api-client) and #43 (feat/api-store) are both ancestors,
                neither below the other
  → not creating. Name the base explicitly (--base <branch>) and re-run.
```

## Worked example

Branch `feat/cache` with `feat(atomic-commit): add convention cache` + `docs(atomic-commit): document the cache`. Detected: base `main`, Conventional titles, PR template present, no open PR.

- Title: `feat(atomic-commit): cache detected conventions`
- Body: template Summary (cache + 3-day TTL + config hash, from the commits), "Skill update" and "Documentation" ticked, no linked issue.
- After confirmation: `gh pr create --base main --head feat/cache --title "feat(atomic-commit): cache detected conventions" --body-file /tmp/pr-body.md`.
