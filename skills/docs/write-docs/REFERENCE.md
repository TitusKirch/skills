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

This section is the artifact's contract — what an ADR looks like once there is one to write. **Whether a decision earns one at all** is the threshold in [SKILL.md](SKILL.md#when-a-decision-earns-an-adr), asked before routing.

### Section

ADRs live in **`docs/99.adr/`** — a numbered house section like any other, never an unprefixed `docs/adr/`.

- **The `99` prefix is fixed**, identical in every repo, so readers and tooling can rely on one path.
- **Pinned last**, after every reading section: an ADR set is a decision log — an appendix, not front-of-manual reading. `99` also leaves the reading sections room to grow without ever renumbering the ADR section.
- **Flat** — pages sit directly in the section. No subfolders, no subject grouping.
- **Never scaffolded empty** — the section appears with the first ADR.

### File schema

`NNNN-title.md` — 4-digit zero-padded id, **hyphen**, kebab title (`0007-drop-the-legacy-queue.md`). The H1 is `ADR-{NNNN} — {title}`.

- The id is a **permanent decision identifier**, taken once from the next free value. It is what cross-references point at (`superseded by ADR-0007`), so it is **never reused, renumbered or gap-filled**.
- **The title is a present-tense imperative verb phrase** — `0012-let-the-review-establish-green`, not `0012-review-green-policy`. A decision is something a project _did_, so the filename says what was done; a noun phrase names the topic instead and reads like a concept page. The H1 and the `title` frontmatter carry the same phrase, capitalized (`Let the review establish green`).
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
- **Nothing else.** MADR's `decision-makers` / `consulted` / `informed` are a deliberate **no**: who decided is already recorded, timestamped and unforgeable, on the issue and pull request the ADR came out of, and a retyped list only goes stale beside it.

### Body

Context, decision and consequences are **body sections, not frontmatter** — they are prose, and prose belongs where it renders. Template: [`templates/adr.md`](templates/adr.md).

| H2                        | Required     | Holds                                                             |
| :------------------------ | :----------- | :---------------------------------------------------------------- |
| `Context`                 | **yes**      | the forces at play, neutral — no verdict yet                      |
| `Decision`                | **yes**      | what was decided, active voice                                    |
| `Consequences`            | **yes**      | what becomes easier, what becomes harder, the trade-offs accepted |
| `Alternatives considered` | **optional** | the options that lost, and why each lost                          |

In that order, the optional one last.

- **The three required sections are Nygard's** — cite him and no one else. MADR requires a **different** set (`Context and Problem Statement`, `Considered Options`, `Decision Outcome`, with `Consequences` merely optional), so naming it alongside would claim a backing this shape does not have.
- **`Alternatives considered` is optional on purpose.** The reasoning it holds is what a later reader comes back for, and without a home it ends up buried mid-`Decision` or dropped entirely — but required is the one thing it must not be: the lifecycle below is append-only, so a section made mandatory today could never be added to the records already written, and it would freeze every one of them out of conformance permanently. An ADR whose alternatives are genuinely covered inside `Decision` omits the section rather than padding it.
- **Optional is about writing it, not about editing it later.** Once the record is accepted this section is as immutable as the three above it — the [lifecycle](#lifecycle--append-only) governs the whole body, so an omitted `Alternatives considered` is not an invitation to add one to an accepted ADR afterwards.

### Size

**An ADR can be a single paragraph. The value is in recording that a decision was made and why — not in filling out sections.** The three H2s are required as _headings_, not as a word budget: any of them may be one sentence, and "the consequences are the obvious ones" is a complete `Consequences` section.

This is a **permission, not a ceiling** — no word count in either direction. A decision with four rejected alternatives earns the words it takes to name them, and append-only means an over-long record cannot be trimmed later anyway. The permission exists because the cost of a mandatory-looking section is paid at the moment of **writing**, where a record that feels like paperwork is a record that does not get made — and an unwritten ADR is the only failure mode this contract cannot recover from.

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

#### The threshold governs adopted records too

**Finding the directory is not the decision to admit it.** Admission is judged **per file**, against the same bar a record written here has to clear — [when a decision earns an ADR](SKILL.md#when-a-decision-earns-an-adr), as the target repo's own `99.adr/index.md` states it. A threshold that governs which decisions earn an ADR governs adopted ones no differently; nothing about arriving in another tool's format earns a record a place this log would not otherwise give it.

**The gate belongs at the import step and nowhere later.** The log is [append-only](#lifecycle--append-only), so a record admitted wrongly can never be pruned — faithfully importing another tool's noise into a log that cannot be trimmed is a worse outcome than the blind spot the import exists to close. Ask it before the id is assigned, because after that there is no undo.

A record that does **not** clear the bar has two outcomes, proposed in the same plan as the ones that do:

| Outcome                            | When                                                                                                                                                                                          |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route as an ordinary docs page** | the content is worth keeping but is not a decision this log records — it goes through the [routing matrix](SKILL.md#routing-matrix--what-you-changed--page-type--section) like any other page |
| **Report and leave it alone**      | there is nothing to keep, or the call is genuinely the human's — named in the report, not moved, not imported                                                                                 |

**Borderline is the human's call.** Name it in the plan and let them answer; never resolve it by importing "just in case", since that is the direction with no way back. Nothing is deleted either way — a record the reconciler declines to import stays exactly where it is.

| The import supplies    | From                                                                                                                                               |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path + name            | `docs/99.adr/NNNN-title.md`, `NNNN` the next free id — one per admitted file, in the source directory's own order                                  |
| `title`/`description`  | proposed from the H1 / first paragraph, confirmed like any other missing required field                                                            |
| `status`               | proposed (`accepted` for a decision evidently in force, `proposed` while any required section is empty), confirmed — never silently defaulted      |
| `date`                 | the file's **first commit** is the decision date: `git log --follow --diff-filter=A --reverse --format=%as -- <file>`, first line. No guess needed |
| Body                   | the existing text **re-homed** under the required `Context` / `Decision` / `Consequences` H2s                                                      |
| The decision log's row | `99.adr/index.md`, in the same change                                                                                                              |

- **`date` is the decision's date, not the import's.** The field records when the `status` last changed, and a record entering the log unchanged last changed when it was written — so the first commit, never the day it moved.
- **`--follow` is not optional here.** `git log` stops at a rename without it, and a foreign ADR directory has usually been moved at least once already — that is often how it ended up where the reconciler found it. Drop the flag and the one value this section claims needs no guess quietly becomes the date of a move.
- **Untracked, or no commit for the file** → git has no answer; fall back to a date the file itself states, else propose today's and say which of the two it is.
- **The title states the decision, not the source's topic.** A foreign H1 is characteristically a noun phrase (`ADR-0003: Caching strategy`); the imported filename and `title` restate it in this log's shape — the [file schema](#file-schema)'s naming rule applies to an adopted record exactly as to a written one. Entry is the **only** chance to get it right: the reconciler may never rename a record once it is in `99.adr/`.
- **Re-homing is not rewriting.** The sentences are the author's and stay the author's — they move under the H2 they belong to, and a section the source never wrote is left empty rather than invented. Everything the reconciler cannot place goes in the plan for a human to place — and an empty required section decides the `status` the record enters at (next bullet).
- **A record never lands `accepted` with a required section empty.** Immutability starts the moment the file enters `99.adr/`, so an empty `Context` / `Decision` / `Consequences` admitted at `accepted` is a hole append-only forbids ever filling. Either the human fills it **in the same plan, before the change is applied**, or the record lands `status: proposed` — the honest description of an incomplete one, and the status that leaves it free to be completed and accepted later. Empty **and** accepted is the one combination the import must not produce.
- **Assigning an id does not break [append-only](#lifecycle--append-only).** The file was never accepted _in this log_, so the id is a **first assignment**, not a renumbering, and shaping it on entry is not an edit to an accepted record. From the moment it lands in `99.adr/` it is immutable like every other ADR.
- **Idempotent** — an admitted record is gone from the source directory, so a second run has nothing left to propose for it. What the threshold declined is still there and is **reported** again, never re-proposed as an import; a directory emptied of everything admitted disappears from the job entirely.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md). Categorize each deviation:

| Category      | Examples                                                                                                                              | Action          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken relative link | auto-fix        |
| Value-needing | missing required `title`/`description` · a [foreign ADR directory](#foreign-adrs--a-decision-log-written-elsewhere) to import         | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found                                     | report, no edit |

**`99.adr/` is exempt.** There the reconciler may only fix broken links and a missing/stale `index.md` row. It must **never** renumber an ADR, normalize `NNNN-title.md` to the dot-schema, close a numbering gap, rename a record whose title is not imperative, add a missing `Alternatives considered`, or touch body prose or `status` — ids are permanent, gaps are not deviations, and the body is append-only. A missing `title`/`description` is still worth proposing; everything else in an ADR is report-only.

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
- ❌ An ADR title that names the topic (`0021-adr-format`) instead of stating the decision as an imperative (`0021-drop-the-legacy-queue`).
- ❌ Rewriting an accepted ADR to reflect a new decision instead of superseding it.
- ❌ Context/decision/consequences as ADR frontmatter fields instead of body sections.
- ❌ MADR fields (`decision-makers`, `consulted`, `informed`) or MADR's section names on an ADR — the shape here is Nygard's.
- ❌ A how-to without a closing checklist.
- ❌ Restating upstream/framework behavior instead of linking it.
- ❌ Rewriting prose during a reconcile, or touching anything outside `docs/`. (Re-homing an [imported ADR](#foreign-adrs--a-decision-log-written-elsewhere)'s own sentences under the required H2s is the sole carve-out — the prose **moves**, it is never rewritten, and it never leaves `docs/`.)
- ❌ Emoji in generated headings, landing pages, or prose — output is plain text.
- ❌ Naming a specific docs tool/generator in the pages or the convention.
