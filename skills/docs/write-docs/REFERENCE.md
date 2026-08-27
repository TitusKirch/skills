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

### What the body may hold

The [lifecycle](#lifecycle--append-only) makes this a **content** rule rather than a length one: no sentence in an accepted record can ever be corrected, so **every sentence has to still be true years from now**.

**The expiry test — a record may hold no sentence its author would later want to fix.** The tells are mechanical, and each marks a fact that belongs to a page which _may_ be edited when it moves:

| Tell in the prose                                | What it actually is                                                                     |
| :----------------------------------------------- | :-------------------------------------------------------------------------------------- |
| _currently_ · _for now_ · _at present_ · _today_ | a state of the world, not a decision                                                    |
| _is being_ removed / replaced / migrated         | work in flight, finished before the next reader arrives                                 |
| a version, a release, a dependency's shape       | an implementation state, correct for exactly one release                                |
| a claim about what some tickets contain          | their contents move; a pointer to the record's origin is fine, a summary of them is not |
| a field list, an option table, a signature       | transcribed from code that stays correct on its own                                     |
| any enumeration a later change will extend       | a convention, and conventions grow                                                      |

Freezing a fact **on purpose** is legitimate — the state something was in on the day it was decided is often what makes the decision legible at all. Write it in the **past tense**, so the record dates its own claim instead of asserting it forever.

Two sections attract borrowed material in particular:

- **`Context` states the constraint, not the inventory.** It answers what _forced_ this decision, never what the project looked like at the time. A workaround that shipped with a bug is context — it proves the discipline did not hold; a tour of what the repo contained is not, and it is false within a release.
- **`Consequences` are not conventions.** The moment a consequence prescribes how _future_ work is to be done, it is a rule, and it belongs in `conventions/` — where it is found without reading this record, and edited when it changes. What follows _from_ the decision stays; what is now _required of everyone_ moves out and is linked.

**The [delta principle](SKILL.md#route--add--docs-exists) binds hardest here.** It forbids transcribing values, versions and option tables out of a file anywhere in the tree; in an append-only record the copy cannot even be corrected once that file moves on. Name the file and what is surprising about it — never its contents.

**A record never instructs its own continuation.** "Extend this list here when you add one" describes a living page, which is the one thing the lifecycle forbids: the list belongs in `conventions/`, and the record decides only that it exists. The sole thing an accepted ADR may grow is a dated [amendment](#lifecycle--append-only).

### Size

**An ADR can be a single paragraph. The value is in recording that a decision was made and why — not in filling out sections.** The three H2s are required as _headings_, not as a word budget: any of them may be one sentence, and "the consequences are the obvious ones" is a complete `Consequences` section.

This is a **permission, not a ceiling** — no word count in either direction. A decision with four rejected alternatives earns the words it takes to name them, and append-only means an over-long record cannot be trimmed later anyway. What bounds a record is therefore not its length but [what may go in it](#what-the-body-may-hold): a long record is a problem only when the words come from a page that should have stayed editable. The permission exists because the cost of a mandatory-looking section is paid at the moment of **writing**, where a record that feels like paperwork is a record that does not get made — and an unwritten ADR is the only failure mode this contract cannot recover from.

### Lifecycle — append-only

An ADR is **immutable once accepted**. The log records what was decided and when, so a superseded decision has to survive intact — that record is the whole value.

- **Overturning a decision writes a new ADR.** The old one keeps its prose and only flips `status` to `superseded`, gains a `Superseded by ADR-NNNN` pointer under its H1, and updates `date`. The new ADR points back (`Supersedes ADR-NNNN`).
- **Adding to a decision that still stands writes an amendment, in place.** Where the decision holds but a fact it priced has moved, append a dated entry under a trailing `## Amendments` H2 (`### YYYY-MM-DD — what changed`) — the one section an accepted ADR may grow. It adds, never edits: Context/Decision/Consequences stay byte-for-byte, `status` and `date` stay put, and the amendment's own heading carries its date, so the index's Date column keeps meaning "the day the status last changed". **Superseding is reserved for a reversal** — reaching for a new record to say "this still holds, but" costs the reader the pointer, since nothing on the old record says it was refined.
- **Never** rewrite an accepted ADR's Context/Decision/Consequences, delete an ADR, or renumber one. Typo fixes, link fixes and an appended amendment are the only in-place edits.
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

Admission has **four** outcomes, all of them proposed in the same plan:

| Outcome                                      | When                                                                                                                                                                                          |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import the record**                        | it clears the bar, and what it holds is what a record nobody may correct should hold                                                                                                          |
| **[Split it](#splitting-a-record-on-entry)** | it holds a decision this log wants **and** material the [expiry test](#what-the-body-may-hold) rejects, and the two come apart without a sentence being rewritten                             |
| **Route it as an ordinary docs page**        | the content is worth keeping but is not a decision this log records — it goes through the [routing matrix](SKILL.md#routing-matrix--what-you-changed--page-type--section) like any other page |
| **Report it and leave it alone**             | there is nothing to keep, the call is genuinely the human's, or the decision will not come apart from the rest without prose being rewritten — named in the report, not moved, not imported   |

**Borderline is the human's call.** Name it in the plan and let them answer; never resolve it by importing "just in case", since that is the direction with no way back. Nothing is deleted either way — a record the reconciler declines to import stays exactly where it is. The single deletion this job permits belongs to a confirmed [split](#splitting-a-record-on-entry), never to a record the threshold turned down.

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
- **Idempotent** — an admitted record is gone from the source directory, so a second run has nothing left to propose for it; a split one is gone too, because both halves have landed. What the threshold declined is still there and is **reported** again, never re-proposed as an import; a directory emptied of everything admitted disappears from the job entirely.

#### Splitting a record on entry

**A foreign record is rarely all one thing**, and the one that most needs importing is usually the worst offender: a genuine decision, plus a naming convention telling the reader to extend a list, plus a version, plus a component that "is being removed". Every whole-file outcome is wrong for it — importing carries material the [expiry test](#what-the-body-may-hold) rejects into a log nobody may trim, routing loses the decision from the log, and leaving it alone is the blind spot the import exists to close.

**So the record is split, and the split is one proposal.** The decision enters `99.adr/` as the record; what fails the expiry test goes through the [routing matrix](SKILL.md#routing-matrix--what-you-changed--page-type--section) as an ordinary page — in the **same** confirmed change, never as a follow-up, since a half-applied split leaves the log holding a record whose other half is nowhere. It rests on the same licence as the id assignment above: the file was never accepted _in this log_, so shaping it on entry is not an edit to an accepted record. And entry is the only moment the licence exists — from the moment the record lands in `99.adr/` its body is [append-only](#lifecycle--append-only).

- **A split is a move, never a rewrite.** The sentences are the author's on both sides of it, exactly as re-homing leaves them, and each goes to one destination or the other whole. A record whose decision cannot be separated without rewriting prose is **not splittable** — report it and let the human decide, the same answer borderline admission gets.
- **The human confirms it, and the plan names it per file.** Which sentences become the record and which become the page is stated file by file in the plan, and applied only on confirmation — the shape the empty-required-section rule above already uses. What a sentence _is_ is a judgement, and it is not the reconciler's to make alone.
- **Cross-link both halves, both ways.** The record points at the page that now carries the convention; the page points back at the decision that established it. Neither half is left orphaned, and both pointers are written on entry, because afterwards the record may not gain one.
- **A fragment that belongs on no page is dropped — the only thing a reconcile deletes.** Prose that fails the expiry test, records no decision and would not earn a page anywhere — a bare statement of state, "`system.*` currently holds two permissions" — is neither imported nor routed. Name it in the import plan and remove it **only** on explicit confirmation. It is bound to the record being imported and to nothing else: it never reaches an existing `docs/` page, since trimming one is rewriting prose and no reconcile may do that, and it never applies to a whole record — one that fails the threshold takes **report it and leave it alone**, where nothing is deleted either way.
- **A missing target section is created in the same proposal.** Routing a fragment needs a section to route it into, and the repo may not have one — a `conventions/` that never appeared because nothing had earned it yet. Create it, directory and `index.md`, alongside the rest of the change: that is structure inside `docs/`, and both are already within the reconcile's blast radius. This holds for a plain **route it as an ordinary docs page** too, which always needed a target and never said what to do without one.
- **The `status` question needs no rule of its own.** A split that empties a required section is already answered above — the human fills it in the same plan, or the record lands `proposed`.
- **Unsure → report.** A wrong split costs what a wrong import costs, and the direction with no way back is unchanged. Propose one only where the seam is plain in the prose; otherwise name the record in the report and leave the call to the human.

**An unsplit import carries its expiring material, and that is a priced cost rather than an oversight.** A record admitted whole enters with the author's sentences intact — the _currently_, the version, the enumeration a later change will extend, all of it. Faithfulness is what that buys, and [append-only](#lifecycle--append-only) is what it costs: nobody may fix those sentences afterwards. Say so in the plan rather than importing quietly, and where the human has not settled what the record should hold, `status: proposed` is available — the honest description of a record whose body is not yet what this log wants, and the status that leaves it free to be completed and accepted later.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md). Categorize each deviation:

| Category      | Examples                                                                                                                              | Action          |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken relative link | auto-fix        |
| Value-needing | missing required `title`/`description` · a [foreign ADR directory](#foreign-adrs--a-decision-log-written-elsewhere) to import         | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found                                     | report, no edit |

**`99.adr/` is exempt.** There the reconciler may only fix broken links and a missing/stale `index.md` row. It must **never** renumber an ADR, normalize `NNNN-title.md` to the dot-schema, close a numbering gap, rename a record whose title is not imperative, add a missing `Alternatives considered`, or touch body prose or `status` — ids are permanent, gaps are not deviations, and the body is append-only. A missing `title`/`description` is still worth proposing; everything else in an ADR is report-only.

**The exemption covers the log, not what is outside it.** A [foreign ADR](#foreign-adrs--a-decision-log-written-elsewhere) has never entered `99.adr/`, so importing one is not an exception to the rule above — there is no id to renumber and no accepted record to edit. It is the single case where the reconciler moves a file into `99.adr/`, re-homes body prose, [splits](#splitting-a-record-on-entry) part of it onto a page elsewhere in `docs/` or drops a named fragment of it — all of that inside one confirmed proposal, and none of it anywhere but the record being imported.

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
- ❌ An ADR sentence describing the repo at the moment of writing rather than the decision — _currently_, _is being_, a version number, a transcribed field list ([the expiry test](#what-the-body-may-hold)).
- ❌ An ADR instructing its own continuation ("extend this list here") instead of deciding that the list exists and pointing at the page allowed to grow.
- ❌ A `Consequences` entry prescribing how future work is to be done — that is a convention, and it belongs where it can be edited.
- ❌ MADR fields (`decision-makers`, `consulted`, `informed`) or MADR's section names on an ADR — the shape here is Nygard's.
- ❌ A how-to without a closing checklist.
- ❌ Restating upstream/framework behavior instead of linking it.
- ❌ Rewriting prose during a reconcile, or touching anything outside `docs/`. (An [imported ADR](#foreign-adrs--a-decision-log-written-elsewhere) is the sole carve-out — its own sentences are re-homed under the required H2s, or split onto a page in the same confirmed proposal; the prose **moves**, it is never rewritten, and it never leaves `docs/`.)
- ❌ [Splitting](#splitting-a-record-on-entry) an imported record by rewriting a sentence so it fits one side — a split moves whole sentences or it does not happen, and a record that will not come apart is reported instead.
- ❌ Deleting prose anywhere but a named, confirmed fragment of the record being imported — an existing page is never trimmed, and a record the threshold declined is never emptied.
- ❌ Emoji in generated headings, landing pages, or prose — output is plain text.
- ❌ Naming a specific docs tool/generator in the pages or the convention.
