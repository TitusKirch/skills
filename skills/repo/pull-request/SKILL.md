---
name: pull-request
metadata:
  summary: Opens a pull request from the current branch via gh; forge chosen by config (github in v1).
description: Creates a pull request from the current branch in the repo's own conventions — an umbrella Conventional-Commits title and a body filled from the repo's PR template. Forge chosen per-repo by config (root `forge`); v1 is GitHub via the gh CLI. Presents the full plan first and creates only after confirmation; plan-only when asked. Updates your own existing PR instead of duplicating, and never touches PRs opened by others or automation. Use when the user wants to open, create, or raise a pull request or merge request, mentions a PR/MR or a conventional PR, or says things like "open a PR", "create a pull request", "PR for this branch", "PR erstellen", "mach einen PR".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(mkdir:*)
  - Bash(date:*)
  - Bash(ls:*)
  - Bash(head:*)
  - Bash(cksum:*)
  - Bash(cut:*)
  - Bash(grep:*)
  - Bash(git rev-parse:*)
  - Bash(git branch --show-current:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(gh pr list:*)
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh repo view:*)
  - Bash(gh api:*)
---

# pull-request

Turn the current branch into a pull request that follows the repo's own conventions — an umbrella Conventional-Commits title and a body filled from the repo's PR template — then create it after your confirmation, update your _own_ existing PR, or just show the exact command. The forge is chosen by the root `forge` key; **GitHub (via `gh`) is the only forge implemented in v1**.

**Opted out?** If the repo config sets `pr` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the pull-request skill is turned off in `.tituskirch-skills.json`. An _absent_ `pr` block is **not** disabled. Check `.pr == false` on the resolved config before any action. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect conventions (read the repo — never assume)

- **Forge** — from the root `forge` key (v1: only `github` is implemented; any other value → say it's not supported yet and stop). For GitHub, confirm the repo is reachable: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop** with a clear message.
- **Base ← head** — base = `pr.base` from `.tituskirch-skills.json` if set, else `defaultBranchRef.name`; head = current branch (`git branch --show-current`). Never hardcode `main`/`dev`; show `base ← head` in the plan and let the user override.
- **PR template** — find `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, or a root/`docs/` variant. Use it verbatim as the body skeleton and fill its sections; if none, fall back to Summary / Changes / Related issues.
- **Title convention** — Conventional Commits when the repo uses them. Read it from the **shared convention cache** (`$(git rev-parse --git-common-dir)/tituskirch-skills/conventions`, written by `atomic-commit` or by this skill — same detection, memoized); if the cache is missing/stale, detect it (commitlint config + history) and write the block yourself. Honor the cached `header_max_length` for the title — PR titles are commonly linted too. `pr.title.convention: plain` in `.tituskirch-skills.json` forces a non-Conventional title.
- **Existing PR** — `gh pr list --head <branch> --state open` and check its author (step 5).
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed) can set `pr.base`, `pr.title.convention`, `pr.instructions` (free-text wording guidance for title/body), `pr.language` (a per-skill language override), and the shared `language`; the root `forge` key exists but v1 supports only `github`. Resolve it via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). Keys: [REFERENCE.md](REFERENCE.md#config).

Detection recipes and the shared cache: [REFERENCE.md](REFERENCE.md#detecting-conventions).

### 2. Gather the branch's content

- Commits since base: `git log <base>..HEAD` (subjects and bodies for the summary).
- Change shape: `git diff --stat <base>...HEAD`.
- Linked issues: scan commit messages and the branch name for `#123` / `Closes #…` / `Fixes #…`.
- If the branch isn't pushed (or its upstream is behind), offer to `git push` first — `gh pr create` needs the head on the remote. Ask before pushing.

### 3. Build the PR

- **Title (umbrella, Conventional)** — one commit → its subject; multiple → a single summarising `type(scope): subject` over the whole branch (dominant type wins; shared scope or none; mark breaking with `!`), within the header limit. Heuristics: [REFERENCE.md](REFERENCE.md#title-derivation-umbrella).
- **Body** — fill the detected template: **Summary** (what + why, from the commits and diff), tick the matching **Type of change**, carry the **Checklist** (pre-tick only what you verified, e.g. `pnpm check` if run). **Closing keywords last:** end the body with one `Closes #N` per issue the branch resolves (gathered from commit `Refs/Closes #N` footers, the branch name, and the session) — each issue needs its own keyword; use `Refs #N` for issues it relates to but doesn't close. Pass it via `--body-file` so multi-line markdown survives the shell.

### 4. Present the plan (always, before creating)

Show: title · `base ← head` · ready/draft · existing-PR status · the rendered body. Flag anything missing (unpushed branch, guessed base, no linked issue). Format in [REFERENCE.md](REFERENCE.md#plan-output).

### 5. Create — update your own — or stop

- **Plan-only triggers** ("nur den Plan", "don't create", "dry run", "just show me", "nicht erstellen"): print the exact `gh pr create` / `gh pr edit` command and stop.
- **No existing PR** → after confirmation: `gh pr create --base <base> --head <branch> --title … --body-file …`. **Ready by default**; `--draft` only if asked.
- **An open PR you opened** (author login == `gh api user --jq .login`) → offer to **update its body**: `gh pr edit <n> --body-file …`. Don't change its title, base, or draft state unless asked.
- **A PR opened by anyone else or by automation** (e.g. a `dev → main` rollup) → **leave it untouched**. Report its number and author, then stop.

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

## Guardrails

- **GitHub forge (v1).** The root `forge` key selects the forge, but only `github` is implemented. No GitHub remote / `gh` unavailable → stop; never fall back to raw `git` PR plumbing. Any other `forge` value isn't supported yet — say so and stop.
- **Keep the title/body attribution-free** — no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it.
- **Only ever touch your own PR.** Never edit a PR opened by another user or by automation, and never open a duplicate of one that already exists.
- **Never force-push; never merge** unless explicitly asked. Push the head branch only after confirmation.
- **No secrets in the body.** Scan the summary and diff for `.env`, keys, tokens; warn and exclude.
- **Respect the base.** Show the detected `base ← head` and confirm before creating; don't assume `main`/`dev`.

## Reference

GitHub-forge detection recipes, the umbrella-title heuristics, template-filling rules, the plan-output format, and worked examples: [REFERENCE.md](REFERENCE.md).
