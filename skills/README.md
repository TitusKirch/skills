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

Categories are a **display and navigation** device, not a namespace: a skill's `name` is still globally unique and unprefixed, and `pnpm skills:link` flattens them back into `~/.claude/skills/`. Category membership comes from the filesystem; each category's title and description live in `CATEGORIES` in [`scripts/gen-skills.ts`](../scripts/gen-skills.ts) — adding a category means one entry there, or `pnpm skills:sync` fails loudly rather than silently dropping the folder.

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
- **`summary`** _(optional)_ — short one-liner for the root README skills table; falls back to the first clause of `description`. Five artifacts are generated from the skill folders via `pnpm skills:sync` (CI runs `pnpm skills:check`), so none is hand-edited: the root README table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, `skills.sh.json`'s groupings, and the [mirrored config contract](#reading-the-config--mirrored-not-linked).
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

Resolution per setting: **config → native/detected → built-in default** — absent config means today's behavior. Three keys sit at the root because they are facts about the **repo**, not about one skill — `forge`, `language` and `verify`; everything else lives under a skill section (`pr.*`, `issue.*`). Each skill documents only the keys it reads, in its own `REFERENCE.md`:

- [`atomic-commit`](repo/atomic-commit/REFERENCE.md#config) — `language`, `commit.language`
- [`pull-request`](repo/pull-request/REFERENCE.md#config) — `language`, `pr.*`
- [`issue`](work/issue/REFERENCE.md#config) — `language`, `issue.*`
- [`release`](repo/release/REFERENCE.md#config) — `language`, `release.*`, `pr.base`
- [`merge-deps`](repo/merge-deps/REFERENCE.md#config) — `language`, `verify`, `mergeDeps.*`
- [`update-deps`](repo/update-deps/REFERENCE.md#config) — `language`, `verify` (owns no section of its own)
- [`handoff`](work/handoff/REFERENCE.md#config) — `language` (owns no section of its own)
- [`write-docs`](docs/write-docs/REFERENCE.md#config) — `language`, `docs.*`
- [`work-implement`](work/work-implement/REFERENCE.md#config) — `language`, `work.*`, `pr.base`
- [`work-implement-queue`](work/work-implement/REFERENCE.md#config) — shares `work-implement`'s `work.*` config
- [`work-review`](work/work-review/REFERENCE.md#config) — `language`, `work.*`, `work.review.*`
- [`work-review-queue`](work/work-review/REFERENCE.md#config) — shares `work-review`'s config

Auto-detected data (commit conventions, issue catalogs) is cached separately under `tituskirch-skills/` in the git common dir — never committed, TTL-disposable.

## Reading the config — mirrored, not linked

**A skill may not link out of its own folder.** It can be installed on its own, so a link to another skill, to this file, or to anything at the repo root resolves to nothing on the installed copy. Whatever several skills need, each one has to carry.

So the config contract is written once in [`scripts/config-block.md`](../scripts/config-block.md) and mirrored by `pnpm skills:sync` into every skill that opts in by carrying a `<skills-config>` element — together with [`scripts/resolve-config.sh`](../scripts/resolve-config.sh), copied to that skill's `templates/`. `pnpm skills:check` fails the moment a copy drifts, so the duplication is mechanical rather than something to maintain.

**The boundary is a tag, not an HTML comment.** A `SKILL.md` is a prompt, so where a block ends should be visible to the model reading it rather than hidden in a comment it may skip. It carries **no attributes** — naming its source file or the command that writes it would point at things the installed skill does not have, the same mistake as linking out. The tag is matched by name, so an attribute added later still cannot orphan a committed block:

```markdown
<skills-config>
…
</skills-config>
```

Two consequences worth knowing before editing a skill:

- **Never edit a mirrored block or a skill's `resolve-config.sh`** — edit the source in `scripts/` and re-run the sync, exactly as with the generated tables.
- **Reaching for a cross-skill link is the signal** that the content belongs in the mirrored block instead. Where it is genuinely a "see also", **name the skill and drop the link** — `` `work-review` ``, not a path into its folder. An agent that has the skill installed can open it; one that does not gains nothing from a dangling path. This holds for the two work loops too: `work-implement-queue` reads `work-implement`'s `REFERENCE.md`, and says so by name and heading rather than by link. `test/isolation.test.ts` enforces it.

The resolver exists because a repo may define **profiles** — named overlays merged onto the base config for an execution context, so a remote runner can open pull requests where a local session commits directly. Every skill running the same script is what makes them agree on the result.

## Adding a new skill

Create `<category>/<skill-name>/SKILL.md` per the frontmatter contract above (use an existing skill as a structural reference), then run `pnpm skills:sync` to regenerate the root [`README.md`](../README.md) skills table, the category's `README.md`, the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) and the groupings in [`skills.sh.json`](../skills.sh.json) — never hand-edit any of them. Full workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
