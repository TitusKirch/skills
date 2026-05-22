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

Drop a skill folder into one of:

- **User scope** — `~/.claude/skills/<skill-name>/` (available in every project).
- **Project scope** — `.claude/skills/<skill-name>/` (committed with the project).

Restart Claude Code and the skill will be discoverable.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick start:

```bash
pnpm install
pnpm check       # lint + format
pnpm check:fix   # auto-fix
```

## License

[MIT](LICENSE) © IT-Dienstleistungen Titus Kirch.
