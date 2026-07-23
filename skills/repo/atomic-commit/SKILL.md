---
name: atomic-commit
summary: Commits session work as atomic Conventional Commits (or just plans).
description: Commits the current session's working-tree changes as a series of atomic Conventional Commits in the repo's own detected conventions (scopes, types, commitlint rules, message language). Always presents the full plan first and commits only after confirmation; switches to plan-only when asked. Use when the user wants to commit session or feature work, mentions conventional or atomic commits, splitting changes into multiple commits, or says things like "how would you commit this", "just show me the plan", "don't commit yet", "nicht committen".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# atomic-commit

Turn the uncommitted work from a session into a clean series of **atomic Conventional Commits**. The skill reads the repo's own conventions, splits the changes into the smallest sensible commits, and either commits them after your confirmation — or, when you ask it not to, just shows exactly what would go where.

**Opted out?** If the repo config sets `commit` to `false`, this skill is **disabled** for the repo — stop immediately and tell the user the atomic-commit skill is turned off in `.tituskirch-skills.json`. An _absent_ `commit` block is **not** disabled (it falls back to detection/defaults). Check `.commit == false` on the resolved config before any action — and before indexing `.commit.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Detect conventions (read the repo — never assume)

Conventions are **repo-wide, not branch-specific**, and change rarely — so cache them per-repo instead of re-detecting every run. The cache is **shared across TitusKirch skills** (e.g. `pull-request` reads the same convention for its PR title) at `$(git rev-parse --git-common-dir)/tituskirch-skills/conventions`. Before sampling, check for a fresh cache there: **reuse it on a commitlint-config hash match regardless of age** when a hashable config exists — the match already proves the conventions are unchanged; with no hashable config (conventions inferred from `git log`) fall back to a 3-day TTL. Re-detect with the recipes below — and rewrite the cache — when it is missing, the config hash differs, the TTL-only fallback has expired, or the user asks to refresh ("neu prüfen", "refresh", "--refresh"). Cache mechanics, the shared namespace, and the one-time migration from the old `atomic-commit-cache`: [REFERENCE.md](REFERENCE.md#convention-cache).

A committed, optional config can override detection: if `$(git rev-parse --show-toplevel)/.tituskirch-skills.json` exists it wins per setting — `commit.language` (or the shared root `language`) for message language, `commit.scopes` (`true`/`false`/`auto`) to force scope usage, `commit.scopeVocab` to seed the scope vocabulary, and `commit.instructions` for free-text wording guidance. Resolve it via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). Resolution per setting: **config → detected/native → built-in default** — **except** that a commitlint rule (a hard constraint the `commit-msg` hook enforces) always wins over a soft config preference like `commit.scopes`/`commit.scopeVocab`. Keys this skill reads: [REFERENCE.md](REFERENCE.md#config).

- **Scopes on/off** — `commit.scopes` wins when set (`true`/`false`); on `auto` (the default) sample `git log --pretty='%s' -n 80` and count subjects matching `type(scope):` vs `type:` (majority wins; ties or thin history fall back to a commitlint `scope-enum`, else off). A commitlint `scope-enum`/`scope-empty` rule overrides either way.
- **Types & scopes in use** — collect the types and scope words already present and prefer them; union the scope words with `commit.scopeVocab` when set, dropping any the commitlint `scope-enum` forbids.
- **Scope drift (soft signal)** — when `commit.scopeVocab` is set and a commit's chosen scope isn't in it (a new or renamed skill / package / area), the vocab is behind the repo. Note it once in the plan and hand off to `tituskirch-skills-config` — never edit the config from here. A commitlint `scope-enum`, not the vocab, still decides what is a legal scope.
- **commitlint** — look for `commitlint.config.*`, `.commitlintrc*`, or a `commitlint` key in `package.json`. If found, treat its rules (`type-enum`, `scope-enum`, `header-max-length`, `subject-case`, `body-max-line-length`) as hard constraints.
- **Language** — `.tituskirch-skills.json` `commit.language` (then root `language`) if set, else match the language of existing subjects; default to English.
- **Instructions** — when `commit.instructions` is set, apply its free-text guidance to subject/body wording; it never overrides commitlint or the release-type rules below.

Exact detection recipes: [REFERENCE.md](REFERENCE.md#detecting-conventions).

### 2. Survey the changes

- `git status --porcelain` + `git diff` (unstaged) + `git diff --staged` + list untracked files.
- Read the diffs so you understand _what_ changed, not just _which files_. Fold anything already staged into the plan.

### 3. Plan atomic commits

- **One logical change per commit.** Split feature vs. fix vs. refactor vs. docs vs. tooling/config vs. tests. If you'd join two changes with the word "and", they are probably two commits.
- **Order by dependency** — deps/config/scaffolding first, then the core change, then tests, then docs/chores. Each commit should ideally leave the tree building.
- **Hunk-level when needed** — if one file mixes concerns, assign individual hunks to different commits ([REFERENCE.md](REFERENCE.md#hunk-level-staging)).
- Pick `type(scope): subject` per group from the detected conventions. Subject = imperative, lowercase, no trailing period, within the max length. Add a body only when the _why_ isn't obvious; when you do, **hard-wrap every body line** to the repo's `body-max-line-length` (100 by default under config-conventional, unless disabled) — one long line is the most common `commit-msg` hook rejection.
- **Release-relevant changes must be `feat`/`fix` — when in doubt, never `refactor`.** Under release-please (`release-please-config.json`, `.release-please-manifest.json`, or a release-please workflow), **only `feat:`/`fix:` cut a release and reach the changelog**; `refactor`/`chore`/`perf`/… ship nothing and stay invisible to users. The error is asymmetric — a change mis-typed `refactor` is silently dropped from the release, far worse than a slightly noisy changelog — so **if a change _could_ be release-relevant, type it `feat`/`fix`.** Reserve `refactor` for changes you are certain are effect-free and invisible to consumers; when the changed files _are_ the shipped product (a skills/library/template repo), improving them is a `feat`/`fix`, never a `refactor`. Details: [REFERENCE.md](REFERENCE.md#release-gated-repos).
- **Reference the issue when in issue context.** If this session is clearly working on a specific issue (its `#N` came up, or you created/updated one via the `issue` skill), add a `Refs #N` footer to the commit(s) that relate to it — reference only, not `Closes` (closing is the PR's job). Don't tag unrelated commits.

### 4. Present the plan (always, before any commit)

Show the detected conventions, then a numbered commit plan: each commit's message and the files/hunks it includes, plus a one-line rationale. Flag any leftover/unassigned changes. Format in [REFERENCE.md](REFERENCE.md#plan-output).

### 5. Commit — or stop

- **Plan-only triggers** ("nicht committen", "nur den plan", "wie würdest du das committen", "don't commit", "dry run", "just show me"): **stop after the plan** and print the exact `git` commands the user could run. Do **not** run `git commit`.
- **Otherwise**: ask for confirmation, then execute group by group — stage exactly that group's files/hunks, commit, verify with `git diff --cached --stat` before and `git log -1` after. Reset staging between groups so commits stay atomic.

## Guardrails

- **Never `--no-verify` or `--no-gpg-sign`.** Let husky/commitlint hooks run; respect the repo's **git** setting `commit.gpgsign` (`git config`, not the `commit` section of `.tituskirch-skills.json` — this skill has no key for signing) so signed repos stay signed. If a hook rejects a commit, surface the error and stop.
- **Don't assume signing is broken.** A failing `git commit` is almost always a hook (commitlint message format), not signing — read the actual error. `git log --show-signature` printing `N` / "allowedSignersFile" locally is not a failure: the commit is still signed — confirm with native git via `git cat-file -p <sha>` (look for a `gpgsig` header) or `git verify-commit <sha>` (SSH signatures need `gpg.ssh.allowedSignersFile` configured to verify). GitHub's server-side "verified" badge has no native-git equivalent — for that, fall back to `gh api repos/<owner>/<repo>/commits/<sha> --jq .commit.verification`.
- **Commit only — never push, amend, or rebase** unless explicitly asked.
- **Keep the message attribution-free** — it describes the change, never the tool that made it. No `Co-authored-by:` naming an assistant, no `Generated with`/🤖 line, no session/permalink URL, no agent self-naming (Claude, Codex, Copilot, Cursor, or any future assistant). Strip it if the harness injects it, regardless of any `attribution` setting.
- **Don't commit secrets.** Scan staged content for `.env`, keys, tokens; warn and exclude.
- **Respect the branch.** If on `main`/`master` and the repo works on feature branches, confirm (or offer to branch) before committing.
- **Keep commits atomic _and_ buildable** — don't split a symbol from its only call site if that breaks the build; note the trade-off when unavoidable.
- **Verify each step.** After every commit, confirm it landed and the remaining tree matches the plan.

## Reference

Convention-detection recipes, hunk-staging mechanics, the type catalogue, commitlint-aware rules, and worked examples: [REFERENCE.md](REFERENCE.md).
