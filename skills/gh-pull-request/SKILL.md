---
name: gh-pull-request
summary: Opens a GitHub pull request from the current branch via the gh CLI.
description: Creates a GitHub pull request from the current branch with the gh CLI, in the repo's own conventions — auto-detects the PR template, the Conventional-Commits title style, the default base branch, and any existing PR, then builds one umbrella Conventional title and a body filled from the repo's pull-request template (summary from the branch's commits and diff, type-of-change ticked, linked issues). Always presents the full plan first and creates only after confirmation; switches to plan-only (prints the gh command) when asked. If an open PR opened by the current user already exists for the branch, it updates that PR's body instead of duplicating; PRs opened by anyone else or by automation are never touched. GitHub-only. Use when the user wants to open, create, or raise a pull request, mentions gh pr or a conventional PR, or says things like "open a PR", "create a pull request", "PR for this branch", "PR erstellen", "mach einen PR".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# gh-pull-request

Turn the current branch into a GitHub pull request that follows the repo's own conventions — an umbrella Conventional-Commits title and a body filled from the repo's PR template — then create it after your confirmation, update your _own_ existing PR, or just show the exact `gh` command.

## Workflow

### 1. Detect conventions (read the repo — never assume)

- **GitHub-only** — confirm the repo is on GitHub: `gh repo view --json nameWithOwner,defaultBranchRef`. If it fails (no GitHub remote, or `gh` not authenticated), **stop** and say the skill is GitHub-only.
- **Base ← head** — base = `pr.base` from `.tituskirch-skills.json` if set, else `defaultBranchRef.name`; head = current branch (`git branch --show-current`). Never hardcode `main`/`dev`; show `base ← head` in the plan and let the user override.
- **PR template** — find `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, or a root/`docs/` variant. Use it verbatim as the body skeleton and fill its sections; if none, fall back to Summary / Changes / Related issues.
- **Title convention** — Conventional Commits when the repo uses them. Read it from the **shared convention cache** (`$(git rev-parse --git-common-dir)/tituskirch-skills/conventions`, written by `atomic-commit` or by this skill — same detection, memoized); if the cache is missing/stale, detect it (commitlint config + history) and write the block yourself. Honor the cached `header_max_length` for the title — PR titles are commonly linted too. `pr.title.convention: plain` in `.tituskirch-skills.json` forces a non-Conventional title.
- **Existing PR** — `gh pr list --head <branch> --state open` and check its author (step 5).
- **Config** — `.tituskirch-skills.json` at the repo root (optional, committed) can set `pr.base`, `pr.title.convention`, and the shared `language`; `pr.backend` exists but v1 supports only `github`. Read with `jq` (missing file/`jq` → ignore, warn once). Keys: [REFERENCE.md](REFERENCE.md#config).

Detection recipes and the shared cache: [REFERENCE.md](REFERENCE.md#detecting-conventions).

### 2. Gather the branch's content

- Commits since base: `git log <base>..HEAD` (subjects and bodies for the summary).
- Change shape: `git diff --stat <base>...HEAD`.
- Linked issues: scan commit messages and the branch name for `#123` / `Closes #…` / `Fixes #…`.
- If the branch isn't pushed (or its upstream is behind), offer to `git push` first — `gh pr create` needs the head on the remote. Ask before pushing.

### 3. Build the PR

- **Title (umbrella, Conventional)** — one commit → its subject; multiple → a single summarising `type(scope): subject` over the whole branch (dominant type wins; shared scope or none; mark breaking with `!`), within the header limit. Heuristics: [REFERENCE.md](REFERENCE.md#title-derivation-umbrella).
- **Body** — fill the detected template: **Summary** (what + why, from the commits and diff), tick the matching **Type of change**, carry the **Checklist** (pre-tick only what you verified, e.g. `pnpm check` if run), **Related issues** (`Closes #N`). Pass it via `--body-file` so multi-line markdown survives the shell.

### 4. Present the plan (always, before creating)

Show: title · `base ← head` · ready/draft · existing-PR status · the rendered body. Flag anything missing (unpushed branch, guessed base, no linked issue). Format in [REFERENCE.md](REFERENCE.md#plan-output).

### 5. Create — update your own — or stop

- **Plan-only triggers** ("nur den plan", "don't create", "dry run", "just show me", "nicht erstellen"): print the exact `gh pr create` / `gh pr edit` command and stop.
- **No existing PR** → after confirmation: `gh pr create --base <base> --head <branch> --title … --body-file …`. **Ready by default**; `--draft` only if asked.
- **An open PR you opened** (author login == `gh api user --jq .login`) → offer to **update its body**: `gh pr edit <n> --body-file …`. Don't change its title, base, or draft state unless asked.
- **A PR opened by anyone else or by automation** (e.g. a `dev → main` rollup) → **leave it untouched**. Report its number and author, then stop.

## Guardrails

- **GitHub-only.** No GitHub remote / `gh` unavailable → stop with a clear message; never fall back to another forge or to raw `git` PR plumbing.
- **No AI/agent attribution** in the title or body — no `Generated with` / 🤖 lines, no session or permalink URLs, no agent self-identification (Claude, Codex, Copilot, Cursor, or any current or future assistant). Strip it if the environment injects it.
- **Only ever touch your own PR.** Never edit a PR opened by another user or by automation, and never open a duplicate of one that already exists.
- **Never force-push; never merge** unless explicitly asked. Push the head branch only after confirmation.
- **No secrets in the body.** Scan the summary and diff for `.env`, keys, tokens; warn and exclude.
- **Respect the base.** Show the detected `base ← head` and confirm before creating; don't assume `main`/`dev`.

## Reference

gh detection recipes, the umbrella-title heuristics, template-filling rules, the plan-output format, and worked examples: [REFERENCE.md](REFERENCE.md).
