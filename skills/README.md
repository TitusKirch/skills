# Skills

Skills are grouped into **categories** — one directory level between `skills/` and the skill itself:

```text
skills/
  <category>/
    README.md         # generated — the category's landing page
    <skill-name>/
      SKILL.md        # required — frontmatter + body
      REFERENCE.md    # optional — mechanics, recipes, config tables
      DESIGN.md       # optional — why the skill is shaped this way
      templates/      # optional — templates, prompts, scripts the skill ships with
```

| Category | Holds                                                    |
| :------- | :------------------------------------------------------- |
| `repo/`  | Commits, pull requests, releases, dependency updates.    |
| `work/`  | Issues, the AI implement/review loops, session handoffs. |
| `docs/`  | Documentation, READMEs, terminal demos.                  |
| `meta/`  | Configuring the skills themselves.                       |

Categories are a **display and navigation** device, not a namespace: a skill's `name` is still globally unique and unprefixed, and `pnpm skills:link` flattens them back into `~/.claude/skills/`. Category membership comes from the filesystem; each category's title and description live in `CATEGORIES` in [`scripts/gen-skills.mjs`](../scripts/gen-skills.mjs) — adding a category means one entry there, or `pnpm skills:sync` fails loudly rather than silently dropping the folder.

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
- **`summary`** _(optional)_ — short one-liner for the root README skills table; falls back to the first clause of `description`. Four artifacts are generated from the skill folders via `pnpm skills:sync` (CI runs `pnpm skills:check`), so none is hand-edited: the root README table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, and `skills.sh.json`'s groupings.
- **`description`** — kept tight; the better the description, the more reliably Claude picks the right skill.
- **`allowed-tools`** _(optional)_ — restrict the skill to a subset of tools. Omit to inherit the caller's toolset.

## Naming

- Folder name = skill name = kebab-case.
- **The category carries the grouping, so the name should not.** A skill in `docs/` is `write-docs`, never `docs-write`. Where a family genuinely reads as one unit, keep the shared stem in the name (`work-implement`, `work-implement-queue`) — that pairs the two halves of a loop, which a folder alone would not.

## Shared config

Some skills read an optional, committed `.tituskirch-skills.json` at the **consuming repo's** root (not this repo) — a thin, shared override surface. It is validated by [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json); point `$schema` at the raw URL for editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json",
  "language": "de",
  "pr": { "base": "dev" },
  "issue": { "tracker": "github" }
}
```

Resolution per setting: **config → native/detected → built-in default** — absent config means today's behavior. The only shared root key is `language`; everything else lives under a skill section (`pr.*`, `issue.*`). Each skill documents only the keys it reads, in its own `REFERENCE.md`:

- [`atomic-commit`](repo/atomic-commit/REFERENCE.md#config) — `language`, `commit.language`
- [`pull-request`](repo/pull-request/REFERENCE.md#config) — `language`, `pr.*`
- [`issue`](work/issue/REFERENCE.md#config) — `language`, `issue.*`
- [`release`](repo/release/REFERENCE.md#config) — `language`, `release.*`, `pr.base`
- [`merge-deps`](repo/merge-deps/REFERENCE.md#config) — `language`, `mergeDeps.*`, `work.verify`
- [`update-deps`](repo/update-deps/REFERENCE.md#config) — `language`, `work.verify` (owns no section of its own)
- [`handoff`](work/handoff/REFERENCE.md#config) — `language` (owns no section of its own)
- [`write-docs`](docs/write-docs/REFERENCE.md#config) — `language`, `docs.*`
- [`work-implement`](work/work-implement/REFERENCE.md#config) — `language`, `work.*`, `pr.base`
- [`work-implement-queue`](work/work-implement/REFERENCE.md#config) — shares `work-implement`'s `work.*` config
- [`work-review`](work/work-review/REFERENCE.md#config) — `language`, `work.*`, `work.review.*`
- [`work-review-queue`](work/work-review/REFERENCE.md#config) — shares `work-review`'s config

Auto-detected data (commit conventions, issue catalogs) is cached separately under `tituskirch-skills/` in the git common dir — never committed, TTL-disposable.

## Adding a new skill

Create `<category>/<skill-name>/SKILL.md` per the frontmatter contract above (use an existing skill as a structural reference), then run `pnpm skills:sync` to regenerate the root [`README.md`](../README.md) skills table, the category's `README.md`, the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) and the groupings in [`skills.sh.json`](../skills.sh.json) — never hand-edit any of them. Full workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
