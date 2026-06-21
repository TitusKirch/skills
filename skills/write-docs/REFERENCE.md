# write-docs — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow: the section catalogue, the page contract, and the reconcile rules. The format is plain Markdown + frontmatter with numeric-prefixed paths — deliberately portable so any file-based docs generator can render and index it. Don't tie pages to a specific tool.

## Tree shape

```text
docs/
  index.md                     # landing page
  1.getting-started/
    index.md                   # section landing
    1.installation.md
  4.reference/
    index.md
    1.configuration.md
```

- **Root** is always `docs/` (fixed).
- **Order comes from the numeric filename/dir prefix** (`1.`, `2.`, …) — never from frontmatter. The prefix is stripped from the rendered slug (`4.reference/1.configuration.md` → `/reference/configuration`).
- **Every section directory has an `index.md`** (landing): frontmatter `title` + `description`, a plain-text H1. Generated docs are emoji-free.
- **Pages** are `N.kebab.md` inside a section.
- **Links** are relative `.md` links to real, verified paths.
- **One topic per page; one how-to per topic** — others link, never duplicate steps.

## Section catalogue

The recognized sections. The slug is the directory name (after its numeric prefix).

| Slug              | Holds                                                       | Core |
| :---------------- | :---------------------------------------------------------- | :--: |
| `getting-started` | Install, first run, orientation.                            |  ✅  |
| `guides`          | Task-oriented guides, tutorials, and "add a new X" how-tos. |      |
| `concepts`        | How it works — architecture, models, explanation.           |      |
| `reference`       | Lookup: config keys, CLI flags, env vars, API.              |  ✅  |
| `operations`      | Run / deploy / maintain — jobs, schedules, backups.         |      |
| `conventions`     | Project-specific rules and patterns.                        |      |
| `contributing`    | How to develop and contribute.                              |      |

**Core** sections are always scaffolded. A section not in this catalogue is allowed but triggers a **gap report** (see SKILL.md) — pick a sensible slug and add it here in the same change so the next repo stays consistent.

## Presets

Which sections to scaffold beyond the core, by project type. Core (`getting-started`, `reference`) is implicit in every preset.

| Preset    | Adds                               |
| :-------- | :--------------------------------- |
| `library` | `guides`                           |
| `cli`     | `guides`                           |
| `app`     | `concepts`, `guides`, `operations` |
| `infra`   | `concepts`, `operations`           |
| `ai-tool` | `concepts`, `guides`               |

Add `contributing`/`conventions` when the repo accepts external contributions or carries non-obvious project rules. Presets are a starting point, not a cage — sections can be added or dropped per use case.

## Frontmatter contract

```yaml
---
title: Add a provider
description: Wire a new provider into the registry and expose it in the UI.
---
```

- **`title`** — required. Short, the page's name.
- **`description`** — required. One line; it doubles as the page's summary for search/LLM consumers, so make it self-contained.
- **Nothing else** — order lives in the filename, page type in the section + template, status in an optional marker callout (see below). The contract stays minimal on purpose; any future field is rolled out across the tree by the reconciler, not added ad hoc.

## Page types

Type is implied by **section + template** — never a frontmatter field. Skeletons in [`templates/`](templates/).

| Type                   | Shape                                                 | Template       |
| :--------------------- | :---------------------------------------------------- | :------------- |
| guide / tutorial       | A learning path; goal → steps → result.               | `guide.md`     |
| how-to                 | One task, start to finish; **ends with a checklist**. | `how-to.md`    |
| concept / architecture | Explains the model — how it works and why.            | `concept.md`   |
| reference              | A lookup entry — terse, tabular, complete.            | `reference.md` |

## Status marker

A lightweight lifecycle signal in the page body (not frontmatter, never required, no emoji). Place a note callout right under the H1:

```markdown
> [!NOTE]
> **Status:** in development
```

Values: `in development` · `planned` · `deprecated` — a shipped page omits the marker. The reconciler doesn't enforce it but can check it when present.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md). Categorize each deviation:

| Category      | Examples                                                                                                                              | Action          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken relative link | auto-fix        |
| Value-needing | missing required `title`/`description`                                                                                                | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found                                     | report, no edit |

Read the whole tree fresh every run — it is live state and is **never cached**.

## Config

`.tituskirch-skills.json` at the consuming repo's root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `docs.*` section is this skill's. Read with `jq`; if the file or `jq` is missing, fall back to detection. Resolution per setting: **config → native/detected → built-in default**.

```json
{
  "language": "de",
  "docs": {
    "preset": "app",
    "language": { "title": "en", "body": "de" }
  }
}
```

| Key             | Effect                                                                                                                                               |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.preset`   | `library` / `cli` / `app` / `infra` / `ai-tool` — which sections to scaffold; falls back to repo detection, then asks                                |
| `docs.language` | docs language — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`, then the existing docs/repo language, then `en` |

`language` is a shared root key; `docs.*` is this skill's section (`commit.*`/`pr.*`/`issue.*` belong to the other skills). `match` mirrors the repo/source language. Full schema: the repo-root [`tituskirch-skills.schema.json`](../../tituskirch-skills.schema.json).

```bash
config="$(git rev-parse --show-toplevel)/.tituskirch-skills.json"
if [ -f "$config" ] && command -v jq >/dev/null 2>&1; then
  preset=$(jq -er '.docs.preset // empty' "$config" 2>/dev/null) || preset=
  lang=$(jq -er '.docs.language // .language // empty' "$config" 2>/dev/null) || lang=
fi
```

This skill keeps **no cache** — unlike the commit/PR/issue skills, its only input is the live `docs/` tree.

## Anti-patterns

- ❌ Order in frontmatter instead of the filename prefix.
- ❌ A `type:` (or `icon:`/`nav:`) frontmatter field — the contract is `title` + `description` only.
- ❌ A second page on a topic that already has one — edit in place.
- ❌ A how-to without a closing checklist.
- ❌ Restating upstream/framework behavior instead of linking it.
- ❌ Rewriting prose during a reconcile, or touching anything outside `docs/`.
- ❌ Emoji in generated headings, landing pages, or prose — output is plain text.
- ❌ Naming a specific docs tool/generator in the pages or the convention.
