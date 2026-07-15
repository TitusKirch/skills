# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This repo publishes reusable [Claude Code agent skills](https://docs.claude.com/en/docs/claude-code/skills). Each subfolder under `skills/` is a self-contained skill consisting of a `SKILL.md` (YAML frontmatter + body) plus optional bundled assets. The repo itself ships no runtime code — only the skill definitions and the tooling that keeps them lint/format-clean.

## Common commands

| Command          | Purpose                                                                |
| :--------------- | :--------------------------------------------------------------------- |
| `pnpm install`   | Install devDeps and wire husky hooks (`prepare` script runs husky).    |
| `pnpm lint`      | `oxlint . --deny-warnings` — fails on any warning.                     |
| `pnpm format`    | `oxfmt --check .` — does not write.                                    |
| `pnpm check`     | Lint + format check (mirrors CI).                                      |
| `pnpm check:fix` | `pnpm lint:fix && pnpm format:fix` — apply both fixers.                |
| `pnpm taze`      | List dependency drift. `pnpm taze:w` writes updates to `package.json`. |

There is no test suite — skills are documentation, validated by lint/format only.

## Tooling layout (non-obvious bits)

- **pnpm is mandatory** — `packageManagerStrict: true` in `pnpm-workspace.yaml` and the `packageManager` pin in `package.json`. npm/yarn will be rejected.
- **`pnpm-workspace.yaml` holds all pnpm settings** — pnpm 10+ reads only auth/registry from `.npmrc`; every other setting (the gate, linker, strictness) must live in `pnpm-workspace.yaml` or it is silently ignored. There is no `.npmrc`.
- **`pnpm-workspace.yaml` sets `minimumReleaseAge: 4320`** (3 days). Packages published within the last 3 days will not install. `pnpm taze` respects this too — if a newer version exists but is too recent, taze will report "up to date." Bump pinned versions (`oxfmt`, `oxlint`) manually if needed.
- **oxfmt is the formatter for everything**, including markdown, JSON, and YAML — `lint-staged.config.js` routes `*.md`, `*.{json,jsonc,yml,yaml}` through `oxfmt`, and only `*.{js,ts,mjs,cjs}` through oxlint + oxfmt. The primary use case is markdown (skill bodies); JS is incidental.
- **`oxlint` and `oxfmt` are pinned to exact versions** (no `^`). Taze's default scope omits them entirely — they are absent from the table, not reported as up to date. `-l`/`--include-locked` brings them in, and it composes with the mode, so `pnpm exec taze minor -w -l` is a minor run including the pins. Don't reach for `latest` to move a pin: it is a mode spanning majors, and today it targets `oxfmt 0.57.0 → 0.58.0` (a 0.x major) and `packageManager` pnpm → a `12.0.0-alpha.9` prerelease.
- **Husky hooks** (`.husky/pre-commit`, `.husky/commit-msg`) run lint-staged and commitlint. Don't `--no-verify` unless explicitly asked.
- **Conventional Commits are enforced** by commitlint (`@commitlint/config-conventional`). Scope by skill name when changing a single skill: `feat(write-readme): ...`.

## Releases

[release-please](https://github.com/googleapis/release-please) runs on push to `main` (`.github/workflows/release-please.yml`) and opens/updates a release PR based on Conventional Commits. Configured as a single `release-type: node` package at the repo root with `bump-minor-pre-major: true` — pre-1.0 breaking changes bump the minor. The workflow also cleans up merged `release-please--*` branches after release.

## Adding a new skill

1. Create `skills/<new-skill>/SKILL.md` (use the `write-a-skill` skill or copy an existing skill as a starting point). Frontmatter: `name` (kebab-case, matches folder), `summary` (short line for the root README table), `description` (one-line, action-oriented — this is what Claude reads to decide invocation), optional `allowed-tools`.
2. Run `pnpm skills:sync` to regenerate the root `README.md` skills table and `.claude-plugin/plugin.json` from the frontmatter — never hand-edit them (CI runs `pnpm skills:check`).
3. Commit as `feat(<new-skill>): add skill`.

Full workflow in [`CONTRIBUTING.md`](CONTRIBUTING.md); frontmatter contract and layout in `skills/README.md`.

## CI

- `.github/workflows/ci.yml` — runs `pnpm lint` and `pnpm format` on PRs to `main`. Skips drafts.
- `.github/workflows/codeql.yml` — only fires on changes to `**/*.{js,ts,mjs,cjs}` or `.github/workflows/**`. Won't run on pure markdown PRs.
- `.github/workflows/release-please.yml` — see "Releases" above.
- `.github/dependabot.yml` — weekly npm bumps, monthly github-actions bumps, both grouped minor+patch.
