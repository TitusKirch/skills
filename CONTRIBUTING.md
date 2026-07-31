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

CI runs the same commands, one step per command, so a single run reports every failure rather than stopping at the first. A test (`test/ci-gate.test.ts`) asserts CI's step list still matches what `verify` composes, so keeping `pnpm verify` green locally is keeping CI green.

**One check sits outside that gate.** `pnpm skills:conformance` validates every skill against the [Agent Skills specification](https://agentskills.io/specification) with the standard's own validator, pinned and run in a container — so it needs Docker, which is exactly why `pnpm verify` does not reach it and stays runnable with nothing but pnpm. A separate workflow runs it on any pull request that touches `skills/`. It re-tiers the Claude Code frontmatter extensions this repo deliberately uses ([ADR-0007](docs/99.adr/0007-permit-claude-code-frontmatter-extensions.md)) rather than failing on them, so a green run still reports them as non-portable.

## Branching & PRs

1. **Branch off `dev`, and target `dev`.** `dev` is the integration branch every PR goes into; `main` is the release branch and takes only the `dev → main` rollup PR that CI keeps open. Never push to either directly — a contribution reaches `dev` through a pull request.
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

Releases are automated via [release-please](https://github.com/googleapis/release-please). Your `feat:`/`fix:` commits land on `dev` first and reach `main` through the rollup PR; release-please then opens a PR with the next version bump and CHANGELOG entry. Nothing to do on your side beyond the commit message.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
