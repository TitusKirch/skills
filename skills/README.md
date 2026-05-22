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
- **`description`** — kept tight; the better the description, the more reliably Claude picks the right skill.
- **`allowed-tools`** _(optional)_ — restrict the skill to a subset of tools. Omit to inherit the caller's toolset.

## Naming

- Folder name = skill name = kebab-case.
- Prefix related skills with a shared namespace if it helps (`docs-*`, `release-*`).

## Adding a new skill

1. Create `<skill-name>/SKILL.md` (use an existing skill as a structural reference).
2. Fill in the frontmatter and body.
3. Add a row to the root [`README.md`](../README.md) skills table and the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json).
4. Commit with `feat(<skill-name>): add skill`.
