# Contributing to skills

Thanks for contributing! 🛠️ This covers what you need to get a PR landed. The project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Reporting issues

- **Bug** → [bug report](https://github.com/TitusKirch/skills/issues/new?template=bug_report.yml) · **feature or new skill** → [feature request](https://github.com/TitusKirch/skills/issues/new?template=feature_request.yml).
- **Questions, ideas, maybe-bugs** → the [Discord forum](https://discord.kirch.dev/).
- **Security** → never a public issue; follow [SECURITY.md](SECURITY.md).

## Setup

Node **26+** and **pnpm 12** (pinned in `package.json`):

```bash
git clone https://github.com/TitusKirch/skills.git
cd skills
pnpm install   # also wires the husky hooks
```

**Agent instructions live in [`AGENTS.md`](AGENTS.md) alone** ([ADR-0049](docs/99.adr/0049-keep-one-instruction-file-agents-md.md)). Claude Code (v2.1.277+) reads it only while no `CLAUDE.md` or `CLAUDE.local.md` sits in the working directory or above, under its default _project instructions_ setting. If an agent ignores the conventions, check those first; `/memory` shows what Claude Code loaded.

## Adding a skill

1. Create `skills/<category>/<skill-name>/SKILL.md` — category `repo/`, `work/`, `docs/` or `meta/`; frontmatter contract in [`skills/README.md`](skills/README.md). Bundled templates and scripts stay in the same folder.
2. Run `pnpm skills:sync` — it regenerates the README table, the category README, `.claude-plugin/plugin.json` and `skills.sh.json`. Never hand-edit them; `pnpm skills:check` fails on drift.
3. Try it with `pnpm skills:link`, then run `pnpm verify`.
4. Commit as `feat(<skill-name>): add skill`.

## Checks

`pnpm verify` is the whole gate — `check` + `skills:check` + `typecheck` + `test` — and CI runs the same tasks, reporting every failure in one run. `pnpm check:fix` applies the linters' fixes.

Outside the gate, because they need extra tooling:

- **`pnpm skills:conformance`** — the spec's own validator in Docker; its own workflow runs it on PRs touching `skills/`. It reports the deliberate Claude Code extensions as non-portable rather than failing on them ([ADR-0007](docs/99.adr/0007-permit-claude-code-frontmatter-extensions.md)).
- **`pnpm containers:audit`** — Trivy scan of the validator image and the VHS renderer; exit 0 clean, 1 advisories, 2 could not run.
- **CLI probes inside `pnpm test`** run only where the CLI is installed and say so when skipped: `codex` (policy parity), the `skills` installer, `claude` (plugin validation). To force the OpenCode probe, set `OPENCODE_REQUIRED=true` and `OPENCODE_BIN` to the version `scripts/toolchain-versions.json` pins.

## Branching, commits, releases

- **Branch off `dev`, target `dev`.** `main` only takes the `dev → main` rollup PR.
- **Conventional Commits**, scoped by skill (`fix(write-readme): …`); breaking changes as `feat!:` or a `BREAKING CHANGE:` footer. Husky runs commitlint and formats staged files — never `--no-verify`.
- **One concern per PR.**
- **release-please** turns `feat:`/`fix:` into the version bump and CHANGELOG once the rollup reaches `main` — nothing to do beyond the commit message.

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
