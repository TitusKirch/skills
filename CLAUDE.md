# CLAUDE.md

This repo publishes reusable [agent skills](https://agentskills.io/specification) — Claude Code, Codex, Cursor, OpenCode and friends. Skills live at `skills/<category>/<skill>/` — categories are `repo/`, `work/`, `docs/`, `meta/` — each self-contained: a `SKILL.md` (YAML frontmatter + body) plus optional assets. **No runtime code ships** except one file: `scripts/resolve-config.sh`, mirrored into every skill that reads the config. That is what `test/` covers — the skill prose has no `test/` suite, and none is wanted there. Skill quality is measured out of band instead, by the `evals/` convention ([`skills/README.md`](skills/README.md#evaluating-a-skill)): per-skill, with/without-baseline fixtures that are inert dev-only data a development tool runs, never `test/`, and stripped by packaging and `skills:link`.

Every file named below is the source of truth for what it configures. Read it rather than trusting a summary here — this file carries only what no file states outright.

## Agent instruction files

`CLAUDE.md` and `AGENTS.md` are kept **byte-identical**. `CLAUDE.md` is what Claude Code reads; `AGENTS.md` is what vendor-neutral agent tools read — Codex, OpenCode, Cursor, Copilot, and whatever follows them. Two real files, deliberately not a symlink: not every tool resolves one.

**After editing either file, copy it over the other — don't repeat the edit by hand:**

```bash
cp CLAUDE.md AGENTS.md   # or the reverse, whichever you just edited
```

Retyping a change is exactly how the two drift; one reflowed line or reworded clause is enough. `diff CLAUDE.md AGENTS.md` must print nothing — `pnpm test` fails when it does. Fix it by letting one file win wholesale, never by merging them.

## Commands

`package.json` has the full list. The ones with non-obvious behaviour:

| Command             | Why it needs saying                                                                                                                                                                                                                                 |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`       | **The repo's gate** — `check` + `skills:check` + `typecheck` + `test`, in CI's order, and the root `verify` key. CI runs the same commands as one step each, so one run reports every failure; `test/ci-gate.test.ts` fails if the two lists drift. |
| `pnpm check`        | Lint + format check only — a subset of the gate, not the gate. `pnpm check:fix` applies both fixers.                                                                                                                                                |
| `pnpm skills:sync`  | Regenerates six artifacts from the skill folders. **Run after touching any skill.**                                                                                                                                                                 |
| `pnpm skills:check` | The CI guard for the above. Fails if any of the six drifted.                                                                                                                                                                                        |
| `pnpm typecheck`    | `tsc --noEmit`. `erasableSyntaxOnly` is on, so an enum fails here, not at runtime.                                                                                                                                                                  |
| `pnpm test`         | `node --test` over `test/` — the resolver, the schema, skill self-containment, the CI-gate guard, and the `CLAUDE.md`/`AGENTS.md` mirror.                                                                                                           |
| `pnpm skills:link`  | Symlinks every skill into `~/.claude/skills/` for live local testing — whole-folder, except a skill carrying a dev-artifact dir (`evals/`) links entry by entry to leave the fixture out.                                                           |

**Six artifacts are generated — never hand-edit them:** the root `README.md` skills table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, `skills.sh.json`'s groupings, the `<skills-config>` block plus `templates/resolve-config.sh` mirrored into each config-reading skill (source: `scripts/config-block.md` and `scripts/resolve-config.sh`), and the `<skills-authority>` / `<skills-authority-reduced>` author-authority block mirrored into each skill that reads third-party text (source: `scripts/authority-block.md`). A new category also needs an entry in `CATEGORIES` in `scripts/gen-skills.ts`, or the sync fails loudly.

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

`.github/workflows/` is authoritative. Three behaviours that mislead if unknown:

- **CI runs `on: pull_request` only, so a commit pushed straight to `dev` is never checked by CI.** The AI work loop is configured `branch:dev` — it commits to the shared branch with no PR — which makes `pnpm verify`, run locally before the push, the _only_ automated gate between such a change and the release branch. That is why the root `verify` key is the full gate and not just lint plus format: nothing downstream would catch a broken test, a type error, or a drifted generated artifact until the rollup PR.
- **CI skips draft PRs** — a draft's empty check list is not a pass.
- **CodeQL only fires on `**/*.{js,ts,mjs,cjs}` or workflow changes** — it will not run on a markdown-only PR, which is most PRs here.

## Adding a skill

Create `skills/<category>/<name>/SKILL.md`, run `pnpm skills:sync`, commit as `feat(<name>): add skill`. The frontmatter contract and layout live in [`skills/README.md`](skills/README.md); the full workflow in [`CONTRIBUTING.md`](CONTRIBUTING.md).
