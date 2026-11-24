# AGENTS.md

This repo publishes reusable [agent skills](https://agentskills.io/specification) for Claude Code, Codex, Cursor, OpenCode and friends. Each skill is self-contained at `skills/<category>/<skill>/` (`repo/`, `work/`, `docs/`, `meta/`): a `SKILL.md` plus optional assets. Layout and frontmatter contract: [`skills/README.md`](skills/README.md).

**No runtime code ships** except `scripts/resolve-config.sh` (mirrored into every skill that reads the config) and `prune-adrs`' `templates/rewrite-adr-refs.sh`; those are what `test/` covers. Skill quality is measured by each skill's `evals/` ([Evaluating a skill](skills/README.md#evaluating-a-skill)), never by `test/`.

Files named here are the source of truth — read them, don't trust a summary.

## Commands

`package.json` has the full list. The ones that need saying:

| Command                   | Note                                                                                                                                                  |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`             | **The gate**: `check` + `skills:check` + `typecheck` + `test`, the same tasks CI runs (`test/ci-gate.test.ts` pins the match). Run before every push. |
| `pnpm check` / `:fix`     | Lint + format only — part of the gate, not the gate.                                                                                                  |
| `pnpm skills:sync`        | Regenerates every derived artifact. **Run after touching any skill**; `pnpm skills:check` fails on drift.                                             |
| `pnpm typecheck`          | `tsc --noEmit` with `erasableSyntaxOnly` — an enum fails here.                                                                                        |
| `pnpm skills:link`        | Symlinks every skill into `~/.claude/skills/` and `~/.agents/skills/` for live testing, `evals/` left out. `pnpm skills:unlink` reverses it.          |
| `pnpm skills:conformance` | `skills-ref` spec check in Docker — outside `verify`, its own workflow.                                                                               |
| `pnpm containers:audit`   | Optional Docker + Trivy image scan — exit 0 clean, 1 advisories, 2 could not run.                                                                     |

**Never hand-edit a generated artifact:** the root `README.md` skills table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, `skills.sh.json`'s groupings, and every mirrored block (`<skills-config>`, `<skills-authority>`, `<skills-verify>`, `<skills-worklock>`, `<skills-plan>`, `<skills-tldr>`, `<skills-forge>`). Edit the source — `scripts/*-block.md`, `scripts/resolve-config.sh`, or the skill's frontmatter — then sync. Which skills carry which block is pinned in `test/isolation.test.ts`; a new category needs an entry in `CATEGORIES` in `scripts/gen-skills.ts`.

## Tooling traps

- **pnpm only** (`packageManagerStrict`); every pnpm setting lives in `pnpm-workspace.yaml` — an `.npmrc` setting other than auth/registry is silently ignored.
- **A release-age gate** (`minimumReleaseAge`) withholds fresh releases, and `taze` reports them as "up to date". `oxlint`/`oxfmt` are pinned exactly and need `taze … -l`; never `latest`.
- **oxfmt formats Markdown, JSON and YAML too.**
- **`scripts/toolchain-versions.json` owns the OpenCode pin**; read it, don't copy the literal.
- **Hooks run lint-staged and commitlint** — never `--no-verify`. Conventional Commits, scoped by skill name (`feat(write-readme): …`).
- **release-please releases from `main`; only `feat`/`fix`/breaking reach the changelog.** A user-visible change typed `chore` or `refactor` is silently dropped.

## CI traps

`.github/workflows/` is authoritative.

- **A push straight to `dev` is checked only after it lands** (`push: dev`). The work loop pushes there with no PR, so the local `pnpm verify` is the only check _before_ the push. Rapid pushes cancel the older run.
- **PR workflows skip drafts on the job**, so a draft reports `skipping` rows, not an empty list — a `skipping` row is never a pass. Each needs `ready_for_review` in its trigger `types`, or un-drafting runs nothing.
- **CodeQL has no `paths:` filter** — it analyses every non-draft PR, Markdown-only ones included.
- **The conformance workflow runs only on PRs touching `skills/**`** or its own script — never on a push.

## Adding a skill

Create `skills/<category>/<name>/SKILL.md`, run `pnpm skills:sync`, commit as `feat(<name>): add skill`. Full workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md).
