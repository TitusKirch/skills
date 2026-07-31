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
- **Every section directory has an `index.md`** (landing): frontmatter `title` + `description`, a plain-text H1. Generated docs are emoji-free. Templates: [`templates/section-index.md`](templates/section-index.md) for a section, [`templates/docs-index.md`](templates/docs-index.md) for the `docs/` landing page.
- **Pages** are `N.kebab.md` inside a section — except in `99.adr/`, which has its own contract (see [Architecture decision records](#architecture-decision-records)).
- **Links** are relative `.md` links to real, verified paths.
- **One topic per page; one how-to per topic** — others link, never duplicate steps.

## Section catalogue

The recognized sections. The slug is the directory name (after its numeric prefix).

| Slug              | Holds                                                       |
| :---------------- | :---------------------------------------------------------- |
| `getting-started` | Install, first run, orientation.                            |
| `guides`          | Task-oriented guides, tutorials, and "add a new X" how-tos. |
| `concepts`        | How it works — architecture, models, explanation.           |
| `reference`       | Lookup: config keys, CLI flags, env vars, API.              |
| `operations`      | Run / deploy / maintain — jobs, schedules, backups.         |
| `conventions`     | Project-specific rules and patterns.                        |
| `contributing`    | How to develop and contribute.                              |
| `adr`             | Architecture decision records — one decision per file.      |

`adr` is the one slug with a **fixed prefix** (`99.adr/`) and its own page contract — see [Architecture decision records](#architecture-decision-records). No section is implicit: which ones a scaffold reaches for comes entirely from the [preset](#presets), and a section whose material is already canonical elsewhere is [dropped from the scaffold](SKILL.md#scaffold--docs-is-missing) rather than created as a redirect. The catalogue is organized by **documentation type** (intent) — every slug answers _what kind of page_, never _what subject_. A section not in this catalogue is allowed but triggers a **gap report** (see SKILL.md): only fold in a genuinely missing **type**. A **subject** section (`plugins`, `themes`, `integrations`, `billing`) is a category error — route its content through the type it fits (see the routing matrix), and nest it if it needs grouping (see below), rather than minting a top-level slug.

## Nesting & subject grouping

Sections hold pages, but a page slot can be a **subject folder** when one topic spans several pages — the `reference` section nests (`reference/rest-api/v1/…`). Group by subject **inside** a type section, never as a new top-level slug: an external integration's how-it-works belongs at `concepts/integrations/wordpress.md`, not `plugins/wordpress.md`. Keeping the top level type-only is what keeps the tree the same shape across every repo. `99.adr/` is the exception that proves the rule — it is **flat**, never nested.

## Presets

Which sections to scaffold, by project type. **No section is implicit** — each preset states its whole set, and every one of them still faces the redirect test in [SKILL.md](SKILL.md#scaffold--docs-is-missing).

| Preset    | Scaffolds                                             | Conditional    |
| :-------- | :---------------------------------------------------- | :------------- |
| `package` | `concepts`, `guides`                                  | `contributing` |
| `cli`     | `getting-started`, `guides`                           | `contributing` |
| `app`     | `getting-started`, `concepts`, `guides`, `operations` | `conventions`  |
| `service` | `concepts`, `reference`, `operations`                 | `conventions`  |
| `infra`   | `concepts`, `operations`                              | `conventions`  |

**Conditional** names the section that type most often earns, on a condition the repo has to meet: `contributing` when it accepts outside contributions, `conventions` when it carries project rules a newcomer would not guess. Either can be added to any preset — the column says which to expect, not which is allowed.

Three sections are deliberately absent from most rows:

- **`getting-started` only where a README cannot carry it.** A README in the house style already covers install and first run, so the section would only redirect — and a section index that redirects is an [anti-pattern](#anti-patterns). It survives for a `cli` (install varies by channel: package manager, binary, script) and an `app` (a setup chain of env, services and migrations), and is dropped everywhere else.
- **`reference` only for a `service`.** A lookup page is [the row to challenge](SKILL.md#routing-matrix--what-you-changed--page-type--section): a manifest, a schema or `--help` usually holds the real answer and never goes stale. An HTTP API with no published schema is the one case that earns the section outright.
- **`adr` belongs to no preset** — the section appears when the first ADR is written, never scaffolded empty.

`package` is **anything published that carries its own reference** — an npm library, a Composer package, a Nuxt module, an agent/skill set. What such a repo ships travels without `docs/`, so the tree holds only what spans the whole set; the per-artifact reference stays with the artifact. It is deliberately not named `library`: the case is the publishing, not the language or the format.

`service` is an HTTP API or backend with no UI — the operational surface matters more than the guides, which is what separates it from `app`.

Presets are a starting point, not a cage — sections can be added or dropped per use case.

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

### Foreign ADRs — a decision log written elsewhere

A repo may already hold ADRs that were written **somewhere else, in someone else's format** — another tool's `docs/adr/0001-slug.md` with no frontmatter and a two-sentence body, a migrated repo's log, a human contributor following a different convention. Such a file matches no category in [Reconcile rules](#reconcile-rules): it is not a numbering gap, not a missing `index.md`, not an unknown key on a page we own. It is a page the job never looks at, so the decision it records is **absent from the decision log** — the one failure a log must not have, because an incomplete log still reads as complete.

The **reconcile** job therefore recognizes such a directory and offers to bring it into the contract.

**Detection is a dedicated ADR directory, and nothing else.** Inside `docs/`, a directory whose whole content is decision records: `adr/`, `adrs/`, `decisions/`, `architecture-decisions/` and near variants of those names.

- **Never match on filenames.** A page called `adr-caching.md` sitting in a section, or an `adr/` holding a mix of decisions and other material, is **report only** — filename matching starts collecting documents nobody meant as decision records, and a wrong import is far more expensive than a missed one. Unsure → report, don't import.
- **A decision directory outside `docs/`** (a root-level `adr/`) is likewise **report only**: the reconcile blast radius stops at `docs/`, so name it in the report and leave the move to a human.

**The import is one proposal, and nothing moves unasked.** Move, rename, index row and the missing values are presented **together** and applied only on confirmation. Splitting the move out as a mechanical first step saves nothing — `title` / `description` / `status` have to be asked for anyway — and buys a half-imported log, which is worse than an unimported one.

| The import supplies    | From                                                                                                                                      |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| Path + name            | `docs/99.adr/NNNN-title.md`, `NNNN` the next free id — one per file, in the source directory's own order                                  |
| `title`/`description`  | proposed from the H1 / first paragraph, confirmed like any other missing required field                                                   |
| `status`               | proposed (`accepted` for a decision evidently in force), confirmed — never silently defaulted                                             |
| `date`                 | the file's **first commit** is the decision date: `git log --diff-filter=A --reverse --format=%as -- <file>`, first line. No guess needed |
| Body                   | the existing text **re-homed** under the required `Context` / `Decision` / `Consequences` H2s                                             |
| The decision log's row | `99.adr/index.md`, in the same change                                                                                                     |

- **`date` is the decision's date, not the import's.** The field records when the `status` last changed, and a record entering the log unchanged last changed when it was written — so the first commit, never the day it moved.
- **Untracked, or no commit for the file** → git has no answer; fall back to a date the file itself states, else propose today's and say which of the two it is.
- **Re-homing is not rewriting.** The sentences are the author's and stay the author's — they move under the H2 they belong to, and a section the source never wrote is left empty rather than invented. Everything the reconciler cannot place goes in the plan for a human to place.
- **Assigning an id does not break [append-only](#lifecycle--append-only).** The file was never accepted _in this log_, so the id is a **first assignment**, not a renumbering, and shaping it on entry is not an edit to an accepted record. From the moment it lands in `99.adr/` it is immutable like every other ADR.
- **Idempotent** — a second run finds no dedicated ADR directory left to import and proposes nothing.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md). Categorize each deviation:

| Category      | Examples                                                                                                                              | Action          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken relative link | auto-fix        |
| Value-needing | missing required `title`/`description` · a [foreign ADR directory](#foreign-adrs--a-decision-log-written-elsewhere) to import         | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found                                     | report, no edit |

**`99.adr/` is exempt.** There the reconciler may only fix broken links and a missing/stale `index.md` row. It must **never** renumber an ADR, normalize `NNNN-title.md` to the dot-schema, close a numbering gap, or touch body prose or `status` — ids are permanent and gaps are not deviations. A missing `title`/`description` is still worth proposing; everything else in an ADR is report-only.

**The exemption covers the log, not what is outside it.** A [foreign ADR](#foreign-adrs--a-decision-log-written-elsewhere) has never entered `99.adr/`, so importing one is not an exception to the rule above — there is no id to renumber and no accepted record to edit. It is the single case where the reconciler moves a file into `99.adr/` and re-homes body prose, and it does so only as one confirmed proposal.

Read the whole tree fresh every run — it is live state and is **never cached**.

## Config

`.tituskirch-skills.json` at the consuming repo's root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `docs.*` section is this skill's. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Resolution per setting: **config → native/detected → built-in default**.

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
| `docs.preset`       | `package` / `cli` / `app` / `service` / `infra` — which sections to scaffold; falls back to repo detection, then asks                                |
| `docs.language`     | docs language — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`, then the existing docs/repo language, then `en` |
| `docs.instructions` | free-text guidance for generated docs (tone, house conventions) — additive preference only, never overrides the docs format or guardrails            |

`language` is a shared root key; `docs.*` is this skill's section (`commit.*`/`pr.*`/`issue.*` belong to the other skills). `match` mirrors the repo/source language. `docs.instructions` mirrors `commit.instructions` / `pr.instructions` / `issue.instructions` — additive wording guidance that never overrides the docs format or guardrails. Set `docs` to `false` (instead of an object) to opt the repo out entirely — the skill then **stops with a "disabled" notice** instead of falling back; an _absent_ block still falls back to defaults/detection. Full schema: the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
disabled=$(printf '%s' "$resolved" | jq -er 'if .docs == false then 1 else empty end' 2>/dev/null) || disabled=
preset=$(printf '%s' "$resolved" | jq -er '.docs.preset // empty' 2>/dev/null) || preset=
lang=$(printf '%s' "$resolved" | jq -er '.docs.language // .language // empty' 2>/dev/null) || lang= # may be a { title, body } object, not a scalar
instructions=$(printf '%s' "$resolved" | jq -er '.docs.instructions // empty' 2>/dev/null) || instructions=
```

This skill keeps **no cache** — unlike the commit/PR/issue skills, its only input is the live `docs/` tree.

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>

## Anti-patterns

- ❌ A section `index.md` whose body only points elsewhere — a promise of pages with none behind it. Either it lists real pages, or the section should not exist yet.
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
