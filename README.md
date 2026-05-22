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

### Option A — use the whole bundle as a plugin

This repo ships a [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) manifest, so cloning it into a Claude-Code-aware project activates every registered skill at once.

```bash
git clone https://github.com/TitusKirch/skills.git ~/.claude/plugins/tituskirch-skills
```

Restart Claude Code; all skills listed in the manifest become discoverable.

### Option B — install a single skill

Drop one skill folder into:

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
