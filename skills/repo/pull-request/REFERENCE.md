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

**What the grant leaves out, and why that is the point.** This skill's `allowed-tools` names the commands it drives rather than granting `Bash` outright — `git rev-parse`, `git branch --show-current`, `git log` and `git diff` for the branch and its commits, `gh pr list` / `view` / `diff` and `gh repo view` for the forge side, plus `jq`, `printf` and `mkdir` for the config and the shared conventions cache, and the `date`, `ls`, `head`, `cksum`, `cut` and `grep` that cache's own hash and TTL check runs on every invocation. **`gh pr create`, `gh pr edit`, `gh pr ready` and `git push` are deliberately absent.** Everything that reads is pre-approved; everything that changes the forge or the remote asks, which matches a skill that [presents the full plan and creates only after confirmation](SKILL.md). The `git branch` grant is written at `--show-current` for that same reason: the branch is only ever read here, while the bare subcommand would also pre-approve the creation, deletion, rename and upstream rewiring this skill never performs. `git push` is also an exec route in its own right (`--receive-pack=<cmd>`), so no clear could cover it.

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

## Worked example

Branch `feat/cache` with `feat(atomic-commit): add convention cache` + `docs(atomic-commit): document the cache`. Detected: base `main`, Conventional titles, PR template present, no open PR.

- Title: `feat(atomic-commit): cache detected conventions`
- Body: template Summary (cache + 3-day TTL + config hash, from the commits), "Skill update" and "Documentation" ticked, no linked issue.
- After confirmation: `gh pr create --base main --head feat/cache --title "feat(atomic-commit): cache detected conventions" --body-file /tmp/pr-body.md`.
