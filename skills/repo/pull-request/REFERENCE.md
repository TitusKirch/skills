# pull-request — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow. The forge is chosen by the root `forge` key and the host it lives on is resolved per repo — [The forge and its host](#the-forge-and-its-host). Two forges are implemented: **GitHub** through `gh` and **GitLab** through `glab`, both against the `origin` remote. Everything outside the two forge sections below is forge-neutral: the title derivation, the template filling, the stacked-branch reading and the plan output are the same work either way.

## Detecting conventions

### Forge + base branch

```bash
# GitHub
gh repo view --json nameWithOwner,defaultBranchRef \
  --jq '{repo: .nameWithOwner, base: .defaultBranchRef.name}'

# GitLab — against the resolved host, never gitlab.com by assumption
GITLAB_HOST=<host> glab repo view --output json \
  | jq '{repo: .path_with_namespace, base: .default_branch}'

git branch --show-current        # head
```

If the forge's own view command errors, the repo has no remote on that forge, the host is wrong, or the CLI is not authenticated → **stop**, naming the forge, the host that was tried and the login command that fixes it. Default the base to the forge's default branch; never hardcode `main`/`dev`. Confirm `base ← head` in the plan and let the user override (`--base <other>`).

### Merge-request template

Each forge keeps its templates in its own directory, and a repo migrated between the two often carries both. **Read the forge's own convention first, and fall back to the other only when the forge's own yields nothing** — a repo that kept its old directory around still wants its current forge's templates to win.

- **GitHub** — `.github/pull_request_template.md` → `.github/PULL_REQUEST_TEMPLATE.md` → `.github/PULL_REQUEST_TEMPLATE/*.md` (several → pick by name or ask) → `PULL_REQUEST_TEMPLATE.md` / `docs/PULL_REQUEST_TEMPLATE.md` → repo root.
- **GitLab** — `.gitlab/merge_request_templates/*.md` (several → pick by name or ask) → `.gitlab/merge_request_templates/Default.md`, which GitLab itself treats as the default.

Use the chosen file verbatim as the body skeleton: fill its sections, keep its checklists and comments-as-prompts. No template on either → fall back to `## Summary`, `## Changes`, `## Related issues`.

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

`base` and `template` are **not** cached: the forge's repo view already runs every time (the availability check), and the template is a local glob — both are cheap to read fresh.

### Existing PR / MR (and who owns it)

```bash
# GitHub
me=$(gh api user --jq .login)
gh pr list --head "$(git branch --show-current)" --state open \
  --json number,author,isDraft,title --jq '.[0]'

# GitLab — the head branch is the *source* branch, and `draft` is a title prefix, not a field
me=$(glab api user --jq .username)
glab mr list --source-branch "$(git branch --show-current)" --output json \
  | jq '.[0] | {number: .iid, author: .author.username, draft, title}'
```

- No result → **create**.
- author == `$me` → offer to **update its body only**.
- author != `$me` (a teammate, or a bot / automation such as a `dev → main` rollup) → **leave it untouched**; report number + author and stop.

**Two spellings of the same number.** GitHub's `number` and GitLab's `iid` are both the per-project number a human writes as `#42`; GitLab additionally has a global `id` that is **not** what any command takes. Read `iid`, show `!42` (GitLab's own sigil for a merge request) in the plan, and never pass `id` to `glab mr`.

### Creating and updating

| Step                        | GitHub                                                         | GitLab                                                                                        |
| :-------------------------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| Create                      | `gh pr create --base <b> --head <h> --title … --body-file <f>` | `glab mr create --target-branch <b> --source-branch <h> --title … --description "$(cat <f>)"` |
| Update your own description | `gh pr edit <n> --body-file <f>`                               | `glab mr update <iid> --description "$(cat <f>)"`                                             |
| Open as a draft             | `--draft`                                                      | `--draft`                                                                                     |

**`glab` has no `--body-file`**, so a multi-line body is passed through a command substitution from the same temporary file the GitHub path writes — the body is built once, forge-neutrally, and only how it is handed over differs. **Ready by default** on both; draft only if asked.

### Stacked branches

GitHub's [stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) are a chain: the bottom PR targets the trunk, and **"each subsequent pull request targets the branch of the pull request below it."** This skill **reads** that shape to pick a base. It never creates, extends, dissolves or reorders a stack — that is the forge's job and `gh stack`'s, not this skill's.

**Why it has to look at all.** Base a PR on the trunk when the branch is really built on another open PR's branch, and the diff carries that PR's unmerged commits as if this change had made them. Nothing errors: a PR opens, it is simply wrong, and the reviewer reads a diff that is mostly someone else's work. Because the failure is silent, the check runs on **every** branch — there is no "this repo uses stacks" flag to gate it on, and a branch built on a colleague's open PR has the same wrong diff whether or not anyone called it a stack.

**The signal is git ancestry, read through branch names.** Only two things are consulted: which branches the open PRs point at, and which commits this branch descends from. No PR body, title or comment is read, so nothing here rests on prose a third party wrote — and nothing rests on a preview API either.

**That is also what makes the check forge-neutral.** GitLab has no "stacked merge requests" feature to read, and it does not need one here: the classification below is entirely `git merge-base`, and the only forge call is the list of open requests and their source/target branches. On GitLab that list is `glab mr list --state opened --per-page 100 --output json`, read as `.source_branch` / `.target_branch`, with a fork told apart by `.source_project_id != .target_project_id` in place of `isCrossRepository`. Everything after the listing is identical.

```bash
base=<the base step 1 resolved>          # pr.base, else defaultBranchRef.name
head=$(git branch --show-current)
default=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)

git fetch origin                          # ancestry is judged against origin/*, so refresh them first
                                          # NOT pre-approved — it asks; declined, carry on with the refs on hand

# Candidate parents: open PRs in THIS repository whose head is neither this branch,
# the base, nor the default branch. Excluding the last two matters — a dev → main
# rollup PR has head `dev`, an ancestor of everything.
# --limit 100 because gh pages at 30 by default and truncates in silence (below).
gh pr list --state open --limit 100 --json number,headRefName,baseRefName,isCrossRepository \
  --jq ".[] | select(.isCrossRepository != true) | select(.headRefName != \"$head\" and .headRefName != \"$base\" and .headRefName != \"$default\")"

# Then classify each candidate branch B against HEAD:
tip=$(git rev-parse --verify -q "origin/$B") || continue   # no such ref after the fetch → skip this candidate
if git merge-base --is-ancestor "$tip" "origin/$base"; then
  continue # B's tip is already contained in the trunk → it has nothing this branch could be stacked on
fi
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

**Two of these arms drop a candidate rather than refusing, and the difference is the point.** A refusal stops the whole run, so it is only ever right for a candidate that _might_ be this branch's parent and cannot be judged. A candidate that provably cannot be one — cross-fork, or a tip already contained in the trunk — is filtered out, and a candidate that cannot be seen at all after a fetch is skipped:

- **Cross-fork is filtered in the query.** GitHub states plainly that "Stacked pull requests require all branches to be in the same repository. Cross-fork stacks are not supported" — so an outside contributor's PR is not a possible parent, and on any repo that invites fork PRs there is usually one open. Turning that into a refusal would take a branch stacked on nothing and refuse to open a PR for it, which is the opposite of the harm this section exists to prevent.
- **A missing `origin/<B>` is skipped, not fatal.** The fetch above is what makes that safe: after it, a ref still missing is a branch this remote does not have, not one this tree merely had not seen. Skip that candidate and say so in the plan; do not end the run. **The fetch is the one command here that is not pre-approved** — `git fetch` carries the same `--upload-pack=<cmd>` exec route that keeps `git push` out of [`allowed-tools`](#config), so it asks. Declined or failing, judge against the refs already present and **name every skipped candidate in the plan**, so the human sees which branches were not judged rather than being told, wrongly, that nothing was found.
- **A tip already on the trunk is filtered.** An open PR whose commits have since landed on the base is an ancestor of every branch cut after it, and without this arm it would read as a parent for all of them. A genuine parent always carries commits the trunk does not.

**The list is paged, and a truncated page is the one drop nobody sees.** `gh pr list` returns **30** PRs by default, so past thirty open PRs the candidate set is cut off with no error and no signal — and a genuine parent outside the page is never considered, which lands exactly the mis-based PR this section exists to prevent. Every other drop above is knowing: cross-fork is filtered on a stated rule, a missing ref is named in the plan, a trunk-contained tip is filtered on a stated rule. Truncation drops a candidate without anyone learning there was one, so the asymmetry the rest of this section argues for does not hold for it. Hence `--limit 100` in the query — and, because that is a bigger page rather than a guarantee, **a page that comes back full is itself worth a line in the plan**: at that count the set may be a prefix, so say so instead of reporting "no parent found" as if the whole list had been read. The [existing-PR check](#existing-pr-and-who-owns-it) needs none of this — it is `--head`-scoped, so it is bounded already.

The refusal that stays is the one that earns it: a candidate sharing history that is **not** on the trunk, whose tip is nevertheless no ancestor of this branch. That one may well be the parent, moved out from under this branch, and guessing there is exactly what produces the wrong diff.

**The direction matters as much as the overlap.** Only a branch **below** this one is a base; a branch someone stacked **on top** shares exactly the same commits, differing only in which is the ancestor of which — hence the second arm above. Skipping that test turns every branch with a layer above it into an out-of-sync refusal, which would block the bottom of a healthy stack from ever opening its PR.

**The nearest candidate is the base**, not the first one found: in a chain each layer is an ancestor of the one above, so several may qualify. The nearest is the candidate that has **every other candidate as its own ancestor** — settle it pairwise with `git merge-base --is-ancestor origin/A origin/B`, never by counting commits.

| What the candidates say                                                                | Base               | Action                                                                                                                                                                           |
| :------------------------------------------------------------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **None** — no open PR's branch is an ancestor                                          | the resolved trunk | proceed exactly as before; this is the ordinary case and it stays silent                                                                                                         |
| **A unique nearest** candidate                                                         | that branch        | proceed; the plan names the PR below (see [Plan output](#plan-output))                                                                                                           |
| **Two or more**, none an ancestor of the others                                        | —                  | **stop**: name both PRs and ask for an explicit `--base`; a merge in the history makes "below" undefined                                                                         |
| **Out of sync** — shared commits that are not on the trunk, but the tip is no ancestor | —                  | **stop**: the branch below moved (a rebase, or the bottom PR merging), so this branch's parent no longer exists as pushed. Ask for a rebase onto the current parent, then re-run |
| **Cross-fork** (`isCrossRepository: true`)                                             | unaffected         | **skip the candidate** — cross-fork stacks are not supported, so it cannot be the parent. Filtered in the query; never a refusal                                                 |
| **`origin/<B>` still missing** after `git fetch origin`                                | unaffected         | **skip the candidate** and name it in the plan — the ref is not on this remote, so it is not a branch this one is stacked on                                                     |
| **B's tip already contained in the trunk**                                             | unaffected         | **skip the candidate** — its commits are on the base already, so it carries nothing this branch could sit on                                                                     |
| **The candidate page came back full** (`--limit` reached)                              | unaffected         | **note it in the plan** — the set may be a prefix, so a parent beyond the page was never judged; this is the one drop that is otherwise invisible                                |

Only the first four rows decide the base; the last four leave that to the remaining candidates — three by dropping one, the last by saying the list may not have held them all. **Every refusal row stops before creating anything** and says which PRs it saw — while a skipped candidate never stops anything, because a run that refuses on a branch stacked on nothing is a broken skill, not a careful one. That asymmetry is the whole design: the cost of stopping is one round trip, the cost of guessing is a PR whose diff is someone else's work — but the cost of stopping on a candidate that was never a parent is a skill that cannot open a PR at all.

**A base the user named wins outright.** An explicit `--base <branch>` (or a base given in the request) is an answer, not a guess — take it, skip the detection, and mention at most in passing what the check would have picked. The refusals above exist because there is no answer, so they never override one.

**Merge order and re-targeting belong to the forge — but a base chain is not yet a stack.** Stacked PRs "must merge from the bottom up", and when the bottom merges "the remaining branches are automatically rebased so the next pull request targets the default base branch." Read that quote precisely twice over, because both halves are narrower than they look:

- **"Default base branch" there is the _stack's trunk_, not the repository's default branch.** The same page says the trunk is "usually your repository's default branch, such as `main`, though it can be any branch, such as a release branch." In a repo whose `pr.base` is `dev`, reading the quote as `main` points at the wrong branch — which is why the recipe above keeps `$base` and `$default` as separate variables throughout.
- **That rebase is a _stack_ behaviour, and this skill never makes a stack.** GitHub exposes endpoints to create, extend and dissolve one precisely because a chain of PRs is not automatically a stack; somebody makes it one, in the web UI or via `gh stack`. What this skill opens is a plain base chain, so the automatic **rebase** never fires on it. **Re-targeting still might** — by an older mechanism that has nothing to do with stacks.

**Three things can move the base of the PR above, and this skill is none of them:**

| Mover                               | Fires when                                                                                                                                 | What moves                                                                                                                                                                                                                                                                            |
| :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A confirmed stack**               | the bottom PR merges                                                                                                                       | the branches above are rebased and the next PR is re-targeted onto the **stack's trunk** — the quote above                                                                                                                                                                            |
| **Deleting the merged head branch** | the merged branch is deleted — the button GitHub offers the moment a PR merges, or the repo's _Automatically delete head branches_ setting | GitHub "checks for any open pull requests in the same repository that specify the deleted branch as their base branch" and re-targets each to "the merged pull request's base branch" (_Managing branches within your repository_). **No stack, no preview feature, no confirmation** |
| **Nothing**                         | no stack was confirmed **and** the merged branch is kept                                                                                   | nothing — the PR above is left pointing at a branch that has already merged                                                                                                                                                                                                           |

Deletion is the ordinary path, not an exotic one, so "no stack ⇒ nothing re-targets" is as wrong as reading the stack quote as universal: which of the three applies is a property of the repo — whether the chain was promoted, and whether merged branches are deleted — not something this skill can settle or should assume. Its own behaviour, **report the difference and change nothing**, is correct under all three.

Two consequences here, both about staying out of the way:

- The plan says the PR is stacked so the human knows its merge is gated on the one below. This skill [never merges](SKILL.md), so ordering is theirs to act on — including whether to promote the chain to a real stack.
- An **existing** PR whose base is not what this run would compute is **not** drift to correct. The skill leaves an existing PR's base alone unless asked, and moving a base is the forge's or the human's act, never a side effect of writing a PR body. **Report the difference, change nothing** — and note that the report is the whole value in the third row above: with no stack confirmed and the merged branch kept, nothing will re-target the PR on its own.

**Why not the stacks preview API.** The preview also exposes read-only `stack` fields on a pull request in GraphQL, plus REST endpoints to list, create, extend and dissolve stacks — reachable with plain `gh api`, no extension needed. This skill uses neither, for two reasons pointing the same way:

- The feature is stated to be **"in public preview and subject to change"**, while git ancestry is not. Reading the base chain is stable ground; the fields describing it are not yet.
- Reaching them means granting `Bash(gh api graphql:*)`, which pre-approves every GraphQL **mutation** — precisely the surface the [`gh api user` narrowing](#config) exists to keep shut — to learn something ancestry already answers. `git merge-base` buys the same fact with a read-only grant.

The `gh stack` CLI extension is out for a third reason: every other call this skill makes is plain `gh`, which is present wherever the skill runs, and an extension is not. Requiring one would trade a silent mis-based PR for a skill that cannot run at all.

## Config

`.tituskirch-skills.json` at the repo root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. Absent → behave exactly as before. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Resolution per setting: **config → native → built-in default**.

Keys this skill reads:

| Key                   | Effect                                                                                                                              |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `pr.language`         | PR title/body language — any code/name or `match`; overrides root + detection                                                       |
| `language` (root)     | shared default language; used when `pr.language` is unset; shared with `atomic-commit`                                              |
| `pr.base`             | PR base branch — overrides `defaultBranchRef.name` (e.g. a `feature → dev` flow)                                                    |
| `pr.title.convention` | `conventional` (default) or `plain`                                                                                                 |
| `pr.instructions`     | free-text wording guidance for the PR title/body — additive, never overrides guardrails                                             |
| `forge` (root)        | `github` or `gitlab` — repo-root key shared with the `release` and `merge-deps` skills, which implement GitHub only                 |
| `forgeHost` (root)    | the host that forge lives on; absent → derived from `origin`, then from the CLI ([The forge and its host](#the-forge-and-its-host)) |

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
base=$(printf '%s' "$resolved" | jq -er '.pr.base // empty' 2>/dev/null) || base=
title_conv=$(printf '%s' "$resolved" | jq -er '.pr.title.convention // empty' 2>/dev/null) || title_conv=
lang=$(printf '%s' "$resolved" | jq -er '.pr.language // .language // empty' 2>/dev/null) || lang=
instructions=$(printf '%s' "$resolved" | jq -er '.pr.instructions // empty' 2>/dev/null) || instructions=
```

`language` is a shared root key; `pr.*` are this skill's section. `pr.language` overrides the root `language` for the PR title/body, mirroring `commit.language` / `issue.language`. `pr.instructions` mirrors `commit.instructions` / `issue.instructions` — additive wording guidance that never overrides the template, detection, or guardrails. Full schema: the repo-root `tituskirch-skills.schema.json`.

**What the grant leaves out, and why that is the point.** This skill's `allowed-tools` names the commands it drives rather than granting `Bash` outright — `git rev-parse`, `git branch --show-current`, `git log`, `git diff` and `git merge-base` for the branch, its commits and the [ancestry a stacked base rests on](#stacked-branches), `gh pr list` / `view` / `diff`, `gh repo view` and `gh api user` for the GitHub side and their `glab mr list` / `view` / `diff`, `glab repo view` and `glab api user` counterparts for the GitLab one, plus `jq`, `printf` and `mkdir` for the config and the shared conventions cache, and the `date`, `ls`, `head`, `cksum`, `cut` and `grep` that cache's own hash and TTL check runs on every invocation. **`gh pr create`, `gh pr edit`, `gh pr ready`, `glab mr create`, `glab mr update` and `git push` are deliberately absent.** Everything that reads is pre-approved; everything that changes the forge or the remote asks, which matches a skill that [presents the full plan and creates only after confirmation](SKILL.md). The `git branch` grant is written at `--show-current` for that same reason: the branch is only ever read here, while the bare subcommand would also pre-approve the creation, deletion, rename and upstream rewiring this skill never performs. `git push` is also an exec route in its own right (`--receive-pack=<cmd>`), so no clear could cover it. **`git fetch` is absent for that same reason, and deliberately** — the [stacked-branch check runs one](#stacked-branches), but `--upload-pack=<cmd>` runs a command on the far side exactly as `--receive-pack` does, so no prefix rule can scope it safely. It asks, which is the right answer for the one command in this skill that touches the network on the reader's behalf; the check degrades cleanly when it is declined.

**`gh api` / `glab api` are written at the `user` endpoint, and that narrowing is real without being complete.** The skill's one call on each side is `gh api user --jq .login` / `glab api user --jq .username`, while a bare `Bash(gh api:*)` would pre-approve `gh api repos/{owner}/{repo}/pulls --method POST` — which **creates a pull request**, the very action the paragraph above names first as one that must ask. `gh pr create` asking while the same act spelled as an API call did not was the gap, and the narrowed rule closes it. What it does **not** close: a permission rule matches the command **string**, so `gh api user` also covers `gh api user/repos --method POST`. That surface is small and it is not nothing, and on a page whose subject is grants that describe themselves accurately it belongs here rather than in the next reviewer's notes.

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

<skills-forge>

## The forge and its host

Two questions, answered in this order and never merged: **which forge** drives this repo, and **which host** that forge lives on. The first is a config key with a default; the second is a per-repo fact with a resolution ladder, and the reason it has a ladder is that a session working two repos may reach two different instances.

### Which forge

The root `forge` key, resolved from the config, defaulting to `github`:

```sh
# $resolved comes from the resolver — see "Reading the config" in this file.
forge=$(printf '%s' "$resolved" | jq -er '.forge // empty' 2>/dev/null) || forge=
[ -n "$forge" ] || forge=github
```

| `forge`  | CLI    | Availability check | The thing it opens       |
| :------- | :----- | :----------------- | :----------------------- |
| `github` | `gh`   | `gh auth status`   | a **pull request** (PR)  |
| `gitlab` | `glab` | `glab auth status` | a **merge request** (MR) |

**Speak the forge's own vocabulary in everything a human reads.** On GitLab it is a merge request, a source branch and a target branch, and the templates live under `.gitlab/merge_request_templates/`; calling it a pull request in a plan, a title or a comment is how a reader stops trusting that the run knows where it is. The skills' own trigger phrases stay bilingual — a user asking for "a PR" on a GitLab repo means the MR — but the **output** follows the forge.

**A forge a skill does not implement is a stop, never a degrade.** Say which forge the config names, that this skill does not drive it, and stop. Never fall back to raw `git` plumbing, and never assume `github` because it is the default — a repo that wrote `gitlab` said something, and quietly serving it GitHub is worse than refusing.

**A CLI that is absent or unauthenticated is the same kind of stop.** Report which CLI was looked for and which host it was asked about, so the fix is one command (`gh auth login`, `glab auth login --hostname <host>`) rather than a hunt.

### Which host

Resolution is a ladder, most specific first. **Take the first that answers; never resolve it once for a session and reuse it.**

1. **The config** — the root `forgeHost` key, a bare hostname with an optional port. Explicit, committed, and the only rung a repo can state for itself.
2. **The `origin` remote** — the host in the repo's own remote URL. This is a repo-level fact and it is why the ladder does not start at the CLI: the remote is what the checkout actually points at.
3. **What the CLI is already configured for** — `GITLAB_HOST` or `glab`'s configured host; `GH_HOST` or `gh`'s `hosts.yml`. This rung is **global**, so it is the last one: it answers "what does this machine usually talk to", not "what does this repo talk to".

```sh
host=$(printf '%s' "$resolved" | jq -er '.forgeHost // empty' 2>/dev/null) || host=
if [ -z "$host" ]; then
  # Strip scheme, userinfo and path from whatever shape the remote is written in:
  #   git@host:group/repo.git · ssh://git@host:2222/group/repo · https://host/group/repo
  url=$(git remote get-url origin 2>/dev/null) || url=
  host=$(printf '%s' "$url" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|^[^@/]*@||' -e 's|[:/].*$||')
fi
# Still empty → let the CLI use whatever it is already configured for, and say so.
```

**Authentication is never duplicated.** The ladder resolves a _name_; the CLI holds the credentials. Pass the resolved host to the CLI rather than re-implementing login — `GH_HOST=<host> gh …`, `GITLAB_HOST=<host> glab …` — and where the host came from rung 3, pass nothing and let the CLI keep its own default.

**Name the host in the plan whenever it is not the forge's public one.** `gitlab.example.com` in the `base ← head` line, the candidate list or the run report is the one signal a reader has that the run is pointed at their instance and not at `gitlab.com`. Where the host came from rung 2 or 3 rather than the config, say which — a derived host is a guess that happened to be right, and it is worth one clause.

**Two repos in one session are two resolutions.** Re-run the ladder per repo, and treat a cached host the way a cached config is treated: keyed by the checkout it was read in, never by the session.

</skills-forge>

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

A **skipped** candidate is a note on an otherwise ordinary plan, not a stop — the run proceeds on the base it resolved:

```text
  base ← head : dev ← feat/api-cache   (base = pr.base)
  skipped     : #57 (fix/typo, fork) — cross-fork, cannot be a stack parent
                #61 (feat/queue) — origin/feat/queue absent after fetch
```

A **full candidate page** is a note on the same footing — the run proceeds, and the human learns the set may have been a prefix rather than the whole list:

```text
  base ← head : dev ← feat/api-cache   (base = pr.base)
  candidates  : 100 open PRs read (page full) — a parent beyond it was not judged
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
