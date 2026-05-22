# skills

[![skills.sh](https://skills.sh/b/TitusKirch/skills)](https://skills.sh/TitusKirch/skills)
[![License: MIT](https://img.shields.io/github/license/TitusKirch/skills?style=flat-square&color=10b981)](LICENSE)

Reusable [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) agent skills by [Titus Kirch](https://github.com/TitusKirch).

Each subfolder under [`skills/`](skills/) is a self-contained skill — a `SKILL.md` with YAML frontmatter that Claude Code can discover and invoke on demand.

## Available skills

<!-- prettier-ignore-start -->

| Skill                                                       | Description                                                              |
| :---------------------------------------------------------- | :----------------------------------------------------------------------- |
| [`write-readme`](skills/write-readme/SKILL.md)              | Generates project READMEs in the kirchDev house style.                   |
| [`example-skill`](skills/example-skill/SKILL.md)            | Placeholder template for new skills.                                     |

<!-- prettier-ignore-end -->

## Installation

### Option A — `skills.sh` CLI (recommended for users)

The [`skills.sh`](https://skills.sh) CLI fetches skills directly from this repo and wires them into your AI agent:

```bash
npx skills add TitusKirch/skills
```

To opt out of the CLI's anonymous install-count telemetry, set `DISABLE_TELEMETRY=1`.

### Option B — symlink locally (recommended for development on this repo)

Clone the repo, then symlink every `skills/<name>/` into `~/.claude/skills/`:

```bash
git clone https://github.com/TitusKirch/skills.git
cd skills
pnpm install
pnpm skills:link        # symlinks every skill into ~/.claude/skills/
pnpm skills:list        # lists every SKILL.md in the repo
pnpm skills:unlink      # removes the symlinks again
```

Restart Claude Code (or run `/reload-plugins`); the skills become discoverable. Because they're symlinks, edits to the working copy are picked up live.

### Option C — install a single skill by hand

Copy one skill folder into:

- **User scope** — `~/.claude/skills/<skill-name>/` (available in every project).
- **Project scope** — `.claude/skills/<skill-name>/` (committed with the project).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick start:

```bash
pnpm install
pnpm check       # lint + format
pnpm check:fix   # auto-fix
```

## License

[MIT](LICENSE) © IT-Dienstleistungen Titus Kirch.
