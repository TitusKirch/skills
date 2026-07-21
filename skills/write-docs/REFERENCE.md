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
  99.adr/
    index.md                   # the decision log
    0001-adopt-the-managed-broker.md
```

- **Root** is always `docs/` (fixed).
- **Order comes from the numeric filename/dir prefix** (`1.`, `2.`, …) — never from frontmatter. The prefix is stripped from the rendered slug (`4.reference/1.configuration.md` → `/reference/configuration`).
- **Every section directory has an `index.md`** (landing): frontmatter `title` + `description`, a plain-text H1. Generated docs are emoji-free.
- **Pages** are `N.kebab.md` inside a section — except in `99.adr/`, which has its own contract (see [Architecture decision records](#architecture-decision-records)).
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
| `adr`             | Architecture decision records — one decision per file.      |      |

`adr` is the one slug with a **fixed prefix** (`99.adr/`) and its own page contract — see [Architecture decision records](#architecture-decision-records). **Core** sections are always scaffolded. The catalogue is organized by **documentation type** (intent) — every slug answers _what kind of page_, never _what subject_. A section not in this catalogue is allowed but triggers a **gap report** (see SKILL.md): only fold in a genuinely missing **type**. A **subject** section (`plugins`, `themes`, `integrations`, `billing`) is a category error — route its content through the type it fits (see the routing matrix), and nest it if it needs grouping (see below), rather than minting a top-level slug.

## Nesting & subject grouping

Sections hold pages, but a page slot can be a **subject folder** when one topic spans several pages — the `reference` section nests (`reference/rest-api/v1/…`). Group by subject **inside** a type section, never as a new top-level slug: an external integration's how-it-works belongs at `concepts/integrations/wordpress.md`, not `plugins/wordpress.md`. Keeping the top level type-only is what keeps the tree the same shape across every repo. `99.adr/` is the exception that proves the rule — it is **flat**, never nested.

## Presets

Which sections to scaffold beyond the core, by project type. Core (`getting-started`, `reference`) is implicit in every preset.

| Preset    | Adds                               |
| :-------- | :--------------------------------- |
| `library` | `guides`                           |
| `cli`     | `guides`                           |
| `app`     | `concepts`, `guides`, `operations` |
| `infra`   | `concepts`, `operations`           |
| `ai-tool` | `concepts`, `guides`               |

Add `contributing`/`conventions` when the repo accepts external contributions or carries non-obvious project rules. Presets are a starting point, not a cage — sections can be added or dropped per use case. `adr` belongs to no preset — the section is created when the first ADR is written, never scaffolded empty.

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
- **One exception**: an ADR adds `status` + `date` (see [Architecture decision records](#architecture-decision-records)). It is a distinct artifact, not a licence to extend the contract elsewhere.

## Page types

Type is implied by **section + template** — never a frontmatter field. Skeletons in [`templates/`](templates/).

| Type                   | Shape                                                 | Template       |
| :--------------------- | :---------------------------------------------------- | :------------- |
| guide / tutorial       | A learning path; goal → steps → result.               | `guide.md`     |
| how-to                 | One task, start to finish; **ends with a checklist**. | `how-to.md`    |
| concept / architecture | Explains the model — how it works and why.            | `concept.md`   |
| reference              | A lookup entry — terse, tabular, complete.            | `reference.md` |
| ADR                    | One decision + its reasoning; append-only.            | `adr.md`       |

## Status marker

A lightweight lifecycle signal in the page body (not frontmatter, never required, no emoji). Place a note callout right under the H1:

```markdown
> [!NOTE]
> **Status:** in development
```

Values: `in development` · `planned` · `deprecated` — a shipped page omits the marker. The reconciler doesn't enforce it but can check it when present. An ADR does not use this marker — its lifecycle lives in the `status` frontmatter field.

## Architecture decision records

An **ADR** records one architectural decision and the reasoning behind it. It is a **structurally distinct artifact** — its own filename schema, extra frontmatter and an append-only lifecycle. Everything here **overrides** the general page contract above.

### Section

ADRs live in **`docs/99.adr/`** — a numbered house section like any other, never an unprefixed `docs/adr/`.

- **The `99` prefix is fixed**, identical in every repo, so readers and tooling can rely on one path.
- **Pinned last**, after every reading section: an ADR set is a decision log — an appendix, not front-of-manual reading. `99` also leaves the reading sections room to grow without ever renumbering the ADR section.
- **Flat** — pages sit directly in the section. No subfolders, no subject grouping.
- **Never scaffolded empty** — the section appears with the first ADR.

### File schema

`NNNN-title.md` — 4-digit zero-padded id, **hyphen**, kebab title (`0007-drop-the-legacy-queue.md`). The H1 is `ADR-{NNNN} — {title}`.

- The id is a **permanent decision identifier**, taken once from the next free value. It is what cross-references point at (`superseded by ADR-0007`), so it is **never reused, renumbered or gap-filled**.
- This is deliberately **not** the house `N.kebab.md` dot-schema: that prefix is reading order and may be renumbered by the reconciler — a decision id may not. The hyphen keeps the two schemas impossible to confuse.
- **`index.md` is the decision log** — a table of every ADR (id, decision, status, date), in id order. Update it in the same change that adds an ADR. Template: [`templates/adr-index.md`](templates/adr-index.md).

### Frontmatter

House `title` + `description` (so an ADR renders and indexes like any other page) plus the ADR fields:

```yaml
---
title: Drop the legacy queue
description: Retire the hand-rolled queue in favour of the managed broker.
status: accepted
date: 2026-07-15
---
```

- **`status`** — `proposed` · `accepted` · `rejected` · `deprecated` · `superseded`.
- **`date`** — ISO `YYYY-MM-DD`; the day the status last changed.
- **Context, decision and consequences are body sections, not frontmatter** — they are prose, and prose belongs where it renders. Required H2s in order: `Context`, `Decision`, `Consequences` (Nygard / MADR). Template: [`templates/adr.md`](templates/adr.md).

### Lifecycle — append-only

An ADR is **immutable once accepted**. The log records what was decided and when, so a superseded decision has to survive intact — that record is the whole value.

- **Overturning a decision writes a new ADR.** The old one keeps its prose and only flips `status` to `superseded`, gains a `Superseded by ADR-NNNN` pointer under its H1, and updates `date`. The new ADR points back (`Supersedes ADR-NNNN`).
- **Never** rewrite an accepted ADR's Context/Decision/Consequences, delete an ADR, or renumber one. Typo and link fixes are the only in-place edits.
- The general page rules **do not apply**: no edit-in-place for a changed decision, no one-topic-per-page dedupe (several ADRs may touch the same topic — that is the log working, not duplication), and no prose reconcile.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md). Categorize each deviation:

| Category      | Examples                                                                                                                              | Action          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken relative link | auto-fix        |
| Value-needing | missing required `title`/`description`                                                                                                | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found                                     | report, no edit |

**`99.adr/` is exempt.** There the reconciler may only fix broken links and a missing/stale `index.md` row. It must **never** renumber an ADR, normalize `NNNN-title.md` to the dot-schema, close a numbering gap, or touch body prose or `status` — ids are permanent and gaps are not deviations. A missing `title`/`description` is still worth proposing; everything else in an ADR is report-only.

Read the whole tree fresh every run — it is live state and is **never cached**.

## Config

`.tituskirch-skills.json` at the consuming repo's root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `docs.*` section is this skill's. Read with `jq`; if the file or `jq` is missing, fall back to detection. Resolution per setting: **config → native/detected → built-in default**.

```json
{
  "language": "de",
  "docs": {
    "preset": "app",
    "language": { "title": "en", "body": "de" },
    "instructions": "…"
  }
}
```

| Key                 | Effect                                                                                                                                               |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.preset`       | `library` / `cli` / `app` / `infra` / `ai-tool` — which sections to scaffold; falls back to repo detection, then asks                                |
| `docs.language`     | docs language — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`, then the existing docs/repo language, then `en` |
| `docs.instructions` | free-text guidance for generated docs (tone, house conventions) — additive preference only, never overrides the docs format or guardrails            |

`language` is a shared root key; `docs.*` is this skill's section (`commit.*`/`pr.*`/`issue.*` belong to the other skills). `match` mirrors the repo/source language. `docs.instructions` mirrors `commit.instructions` / `pr.instructions` / `issue.instructions` — additive wording guidance that never overrides the docs format or guardrails. Set `docs` to `false` (instead of an object) to opt the repo out entirely — the skill then **stops with a "disabled" notice** instead of falling back; an _absent_ block still falls back to defaults/detection. Full schema: the repo-root [`tituskirch-skills.schema.json`](../../tituskirch-skills.schema.json).

```bash
config="$(git rev-parse --show-toplevel)/.tituskirch-skills.json"
if [ -f "$config" ] && command -v jq >/dev/null 2>&1; then
  disabled=$(jq -er 'if .docs == false then 1 else empty end' "$config" 2>/dev/null) || disabled=
  preset=$(jq -er '.docs.preset // empty' "$config" 2>/dev/null) || preset=
  lang=$(jq -er '.docs.language // .language // empty' "$config" 2>/dev/null) || lang= # may be a { title, body } object, not a scalar
  instructions=$(jq -er '.docs.instructions // empty' "$config" 2>/dev/null) || instructions=
fi
```

This skill keeps **no cache** — unlike the commit/PR/issue skills, its only input is the live `docs/` tree.

## Anti-patterns

- ❌ Order in frontmatter instead of the filename prefix.
- ❌ A `type:` (or `icon:`/`nav:`) frontmatter field — the contract is `title` + `description` only (an ADR adds `status` + `date`; nothing else does).
- ❌ A subject-matter top-level section (`plugins/`, `themes/`, `integrations/`) instead of routing content into a type section (nested if needed).
- ❌ A second page on a topic that already has one — edit in place. (ADRs excepted — a new decision is a new ADR.)
- ❌ An unprefixed `docs/adr/`, or any prefix other than `99`, for the ADR section.
- ❌ An ADR id that is renumbered, reused, gap-filled, or written in the house `N.title.md` dot-schema.
- ❌ Rewriting an accepted ADR to reflect a new decision instead of superseding it.
- ❌ Context/decision/consequences as ADR frontmatter fields instead of body sections.
- ❌ A how-to without a closing checklist.
- ❌ Restating upstream/framework behavior instead of linking it.
- ❌ Rewriting prose during a reconcile, or touching anything outside `docs/`.
- ❌ Emoji in generated headings, landing pages, or prose — output is plain text.
- ❌ Naming a specific docs tool/generator in the pages or the convention.
