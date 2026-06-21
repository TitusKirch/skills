# Skills

Each directory in here is one skill. Layout:

```text
skills/
  <skill-name>/
    SKILL.md          # required — frontmatter + body
    README.md         # optional — extended docs
    assets/           # optional — templates, prompts, scripts the skill ships with
```

## `SKILL.md` frontmatter

```markdown
---
name: skill-name
summary: Short one-liner shown in the root README skills table.
description: One-line summary used by Claude to decide when to invoke this skill.
allowed-tools:
  - Read
  - Bash
---

# Skill body

Instructions for Claude when this skill is invoked. Be specific about:

- When the skill should trigger.
- What inputs it expects.
- The steps to perform.
- What the final output should look like.
```

### Field notes

- **`name`** — kebab-case, matches the folder name. Used as the invocation slug.
- **`summary`** _(optional)_ — short one-liner for the root README skills table; falls back to the first clause of `description`. The README table and `.claude-plugin/plugin.json` are generated from the skill folders via `pnpm skills:sync` (CI runs `pnpm skills:check`), so neither is hand-edited.
- **`description`** — kept tight; the better the description, the more reliably Claude picks the right skill.
- **`allowed-tools`** _(optional)_ — restrict the skill to a subset of tools. Omit to inherit the caller's toolset.

## Naming

- Folder name = skill name = kebab-case.
- Prefix related skills with a shared namespace if it helps (`docs-*`, `release-*`).

## Shared config

Some skills read an optional, committed `.tituskirch-skills.json` at the **consuming repo's** root (not this repo) — a thin, shared override surface. It is validated by [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json); point `$schema` at the raw URL for editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json",
  "language": "de",
  "pr": { "base": "dev" },
  "issue": { "backend": "github" }
}
```

Resolution per setting: **config → native/detected → built-in default** — absent config means today's behavior. The only shared root key is `language`; everything else lives under a skill section (`pr.*`, `issue.*`). Each skill documents only the keys it reads, in its own `REFERENCE.md`:

- [`atomic-commit`](atomic-commit/REFERENCE.md#config) — `language`
- [`gh-pull-request`](gh-pull-request/REFERENCE.md#config) — `language`, `pr.*`
- [`issue`](issue/REFERENCE.md#config) — `language`, `issue.*`

Auto-detected data (commit conventions, issue catalogs) is cached separately under `tituskirch-skills/` in the git common dir — never committed, TTL-disposable.

## Adding a new skill

Create `<skill-name>/SKILL.md` per the frontmatter contract above (use an existing skill as a structural reference), then run `pnpm skills:sync` to regenerate the root [`README.md`](../README.md) skills table and the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) — never hand-edit them. Full workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
