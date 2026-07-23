# CLAUDE.md

This repo publishes reusable [Claude Code agent skills](https://docs.claude.com/en/docs/claude-code/skills). Skills live at `skills/<category>/<skill>/` — categories are `repo/`, `work/`, `docs/`, `meta/` — each self-contained: a `SKILL.md` (YAML frontmatter + body) plus optional assets. **No runtime code ships** — only skill definitions and the tooling that keeps them lint/format-clean, so there is no test suite. Don't go looking for one.

Every file named below is the source of truth for what it configures. Read it rather than trusting a summary here — this file carries only what no file states outright.

## Commands

`package.json` has the full list. The ones with non-obvious behaviour:

| Command             | Why it needs saying                                                               |
| :------------------ | :-------------------------------------------------------------------------------- |
| `pnpm check`        | Lint + format check — exactly what CI runs. `pnpm check:fix` applies both fixers. |
| `pnpm skills:sync`  | Regenerates four files from skill frontmatter. **Run after touching any skill.**  |
| `pnpm skills:check` | The CI guard for the above. Fails if any of the four drifted.                     |
| `pnpm skills:link`  | Symlinks every skill into `~/.claude/skills/` for live local testing.             |

**Four files are generated — never hand-edit them:** the root `README.md` skills table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, and `skills.sh.json`'s groupings. A new category also needs an entry in `CATEGORIES` in `scripts/gen-skills.ts`, or the sync fails loudly.

## Non-obvious tooling

- **pnpm is mandatory** — `packageManagerStrict: true` plus the `packageManager` pin. npm/yarn are rejected outright.
- **`pnpm-workspace.yaml` holds every pnpm setting.** pnpm 10+ reads only auth/registry from `.npmrc`; anything else placed there is **silently ignored**. There is no `.npmrc`.
- **A release-age gate is active** (`minimumReleaseAge` in `pnpm-workspace.yaml`). Packages published inside that window will not install, and `pnpm taze` reports them as "up to date" rather than as withheld — so "up to date" never proves nothing newer exists.
- **oxfmt formats markdown, JSON and YAML too**, not just JS — see `lint-staged.config.js`. Markdown is the point here; JS is incidental.
- **`oxlint` and `oxfmt` are pinned exactly** (no `^`), which drops them out of taze's default scope entirely — absent from its table, not reported as current. `-l` brings them back in and composes with the mode (`taze minor -w -l`). Don't reach for `latest` to move a pin: it spans majors and will happily propose a 0.x major or a prerelease.
- **Husky runs lint-staged and commitlint** on every commit. Don't `--no-verify` unless asked.
- **Conventional Commits are enforced.** Scope by skill name when changing one skill: `feat(write-readme): …`.
- **release-please cuts releases from `main`** with `bump-minor-pre-major`, so a pre-1.0 breaking change bumps the minor. Only `feat`/`fix`/breaking reach the changelog — typing a user-visible change as `chore` or `refactor` silently drops it from the release.

## CI gotchas

`.github/workflows/` is authoritative. Two behaviours that mislead if unknown:

- **CI skips draft PRs** — a draft's empty check list is not a pass.
- **CodeQL only fires on `**/*.{js,ts,mjs,cjs}` or workflow changes** — it will not run on a markdown-only PR, which is most PRs here.

## Adding a skill

Create `skills/<category>/<name>/SKILL.md`, run `pnpm skills:sync`, commit as `feat(<name>): add skill`. The frontmatter contract and layout live in [`skills/README.md`](skills/README.md); the full workflow in [`CONTRIBUTING.md`](CONTRIBUTING.md).
