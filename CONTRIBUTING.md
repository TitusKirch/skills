# Contributing to skills

Thanks for taking the time to contribute! 🛠️ This document covers what you need to get a PR landed.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Reporting issues

- **Bugs**: open a [Bug report](https://github.com/TitusKirch/skills/issues/new?template=bug_report.yml).
- **Feature requests / new skills**: open a [Feature request](https://github.com/TitusKirch/skills/issues/new?template=feature_request.yml).
- **Questions & ideas, or something that might be a bug**: start in the [Discord forum](https://discord.kirch.dev/) — that's where the low-friction, unconfirmed stuff lives.
- **Security vulnerabilities**: **do not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Requirements:

- Node **24+**
- **pnpm 11**

Clone and install:

```bash
git clone https://github.com/TitusKirch/skills.git
cd skills
pnpm install   # wires husky hooks
```

## Adding a new skill

1. Pick a category — `repo/`, `work/`, `docs/` or `meta/` (see [`skills/README.md`](skills/README.md)) — and create `skills/<category>/<skill-name>/SKILL.md`: YAML frontmatter (`name`, `summary`, `description`, optional `allowed-tools`) followed by the skill body. Use an existing skill (e.g. [`skills/docs/write-readme/`](skills/docs/write-readme/)) as a reference.
2. Keep any bundled resources (templates, scripts) inside the same folder.
3. Run `pnpm skills:sync` — it regenerates the root [`README.md`](README.md) skills table, the category's `README.md`, [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) and [`skills.sh.json`](skills.sh.json)'s groupings from your frontmatter. **Don't hand-edit any of them** (CI runs `pnpm skills:check`).
4. Run `pnpm skills:link` to try it locally, then `pnpm verify` before pushing.
5. Commit as `feat(<skill-name>): add skill`.

## Running the suite

| Command          | What it does                                                    |
| :--------------- | :-------------------------------------------------------------- |
| `pnpm verify`    | The full gate: `check` + `skills:check` + `typecheck` + `test`. |
| `pnpm check`     | oxlint + oxfmt only — part of the gate, not all of it.          |
| `pnpm check:fix` | Auto-fix the above.                                             |
| `pnpm taze`      | Check dependency drift.                                         |

CI runs `pnpm verify` — the same script, not a parallel list — so keeping it green locally is keeping CI green.

## Branching & PRs

1. **Don't push directly to `main`.** Branch off `main` for every change.
2. **Conventional Commits required.** Commitlint enforces this on every commit. Examples:
   - `feat(skill-name): add new skill`
   - `fix(skill-name): correct example prompt`
   - `docs(readme): clarify install instructions`
   - `chore(deps): bump oxlint`
   - Breaking changes: `feat!: ...` or include `BREAKING CHANGE:` in the body.
3. **One concern per PR.** Smaller PRs land faster.

## Style & quality gates

Husky runs the following on `git commit`:

- **Markdown / JSON / YAML** → `oxfmt`
- **JS** (if any) → `oxlint` + `oxfmt`

If a hook fails, fix the issue and commit again. **Don't `--no-verify`** unless explicitly asked.

> [!TIP]
> Run `pnpm check:fix` before opening a PR — saves a CI cycle.

## Releases

Releases are automated via [release-please](https://github.com/googleapis/release-please). When your `feat:`/`fix:` commits land on `main`, release-please opens a PR with the next version bump and CHANGELOG entry.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
