# skills

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

### Option A — `skills.sh` CLI (recommended)

The [`skills.sh`](https://skills.sh) CLI fetches skills directly from this repo and wires them into your AI agent:

```bash
npx skills add TitusKirch/skills
```

This installs every skill in the bundle. To opt out of the CLI's anonymous install-count telemetry, set `DISABLE_TELEMETRY=1`.

### Option B — Claude Code plugin manifest

This repo ships a [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), so cloning it into Claude Code's plugin directory activates the registered skills:

```bash
git clone https://github.com/TitusKirch/skills.git ~/.claude/plugins/tituskirch-skills
```

Restart Claude Code; the skills become discoverable.

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
