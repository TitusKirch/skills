# write-docs — Reference

Mechanics for the [SKILL.md](SKILL.md) workflow: the section catalogue, the page contract, and the reconcile rules. The format is plain Markdown + frontmatter with numeric-prefixed paths — deliberately portable so any file-based docs generator can render and index it. Don't tie pages to a specific tool.

**That is the default, not the only shape.** Most repos have no rendered site at all — their `docs/` is read on the forge, where a relative `.md` link is the only one that resolves and a component block shows as raw text — so portability is what the tree above is written for. A repo that _does_ publish its tree through a rendering theme opts into a [render mode](#render-mode), which flips five of the rules below and nothing else. The mode is **declared in the config**, never detected, and off wherever it is not written down.

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
- **Every section directory has an `index.md`** (landing): frontmatter `title` + `description`, a plain-text H1. Generated docs are emoji-free. Templates: [`templates/section-index.md`](templates/section-index.md) for a section, [`templates/docs-index.md`](templates/docs-index.md) for the `docs/` landing page. ([Flipped by the render mode](#render-mode): no body H1, and the index lists its pages with a component instead of by hand.)
- **Pages** are `N.kebab.md` inside a section — except in `99.adr/`, which has its own contract (see [Architecture decision records](#architecture-decision-records)).
- **Links** are relative `.md` links to real, verified paths. ([Flipped by the render mode](#render-mode): absolute doc paths.)
- **One topic per page; one how-to per topic** — others link, never duplicate steps.
- **A locale root** — `docs/de-DE/` — is a whole translated tree, not a section, and appears only where [`docs.locales`](#config) lists it. The default locale has no folder of its own; it _is_ the source root ([Locales](#locales)).

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

`adr` is the one slug with a **fixed prefix** (`99.adr/`) and its own page contract — see [Architecture decision records](#architecture-decision-records). No section is implicit: which ones a scaffold reaches for comes entirely from the [preset](#presets), and a section whose material is already canonical elsewhere is [dropped from the scaffold](SKILL.md#scaffold--docs-is-missing) rather than created as a redirect. The catalogue is organized by **documentation type** (intent) — every slug answers _what kind of page_, never _what subject_. A section not in this catalogue is allowed but triggers a **gap report** (see SKILL.md): only fold in a genuinely missing **type**. A **subject** section (`plugins`, `themes`, `integrations`, `billing`) is a category error — route its content through the type it fits (see the routing matrix), and nest it if it needs grouping (see below), rather than minting a top-level slug. A **locale root** (`de-DE/`) is neither: it holds a translated copy of the whole tree, so the catalogue applies _inside_ it and never _to_ it, and it never triggers a gap report ([Locales](#locales)).

### Named directories that are not sections

A directory under `docs/` is not automatically a section. Those **named here** are mechanisms instead — stores the tooling reads, holding no pages of their own:

| Directory    | Is                                                                                                           |
| :----------- | :----------------------------------------------------------------------------------------------------------- |
| `_partials/` | the store for reusable content blocks a page includes (`Partial.vue`), under the [render mode](#render-mode) |
| `_assets/`   | reproducible documentation media and its capture sources, in portable and rendered trees ([Media](#media))   |

- **It has no `index.md`, no numeric prefix and no place in the reading order** — nothing navigates into it, so a landing page for it would describe a directory no reader reaches.
- **It is never a gap.** It is catalogued here, so a run that meets or creates one has matched the catalogue and reports `no gaps` on its account — the same standing `99.adr/` has as a section with its own contract. `_partials/` found in a repo running **no** render mode is [report only](#reconcile-rules); `_assets/` is valid in either mode.
- **The catalogue is closed for these, as it is for sections.** A directory that is neither a catalogued section nor named above is an ordinary [gap report](SKILL.md#gap-report-mandatory-final-step).

## Nesting & subject grouping

Sections hold pages, but a page slot can be a **subject folder** when one topic spans several pages — the `reference` section nests (`reference/rest-api/v1/…`). Group by subject **inside** a type section, never as a new top-level slug: an external integration's how-it-works belongs at `concepts/integrations/wordpress.md`, not `plugins/wordpress.md`. Keeping the top level type-only is what keeps the tree the same shape across every repo. `99.adr/` is the exception that proves the rule — it is **flat**, never nested.

## Locales

A tree can be maintained in more than one language. [`docs.language`](#config) is the **default locale** — the tree at the source root, with **no folder of its own** — and [`docs.locales`](#config) names the **additional** ones, each a folder directly inside `docs/`:

```text
docs/
  index.md                     # the default locale, at the root
  1.getting-started/
    index.md
    1.installation.md
  de-DE/                       # a locale root — not a section
    index.md
    1.getting-started/
      index.md
      1.installation.md
```

**A locale root is not a section slug.** It carries no numeric prefix, it is not in the [catalogue](#section-catalogue), and it never triggers a [gap report](SKILL.md#gap-report-mandatory-final-step) — the catalogue describes what lives _inside_ a tree, and a locale root holds a whole tree rather than a page's worth of one type. A run that reads `docs/de-DE/` as an unknown section has made a category error, and so has one that reads it as a subject folder.

**Listing a locale is the whole switch.** It binds the skill to **maintain and translate** that tree — in scaffold, in route/add and in a reconcile sweep alike. There is no second key confirming it: a repo that lists a locale has already said what it wants. An **absent** `docs.locales` leaves single-locale behaviour exactly as it is, so nothing here reaches a repo that has not opted in.

**Structure is derived, never authored.** Every listed locale's tree is regenerated from the default one, so its section numbering, its `index.md` files and its section shape all follow from the source. **Paths match the source exactly** — same numeric prefixes, same kebab slugs, untranslated — because a renderer resolves a translation by path; translating a filename breaks the lookup and orphans the page. What _is_ translated is the content: the `title` and `description` frontmatter, and the body prose, including image alt text/captions and visible Mermaid labels. Media follows the [shared/variant policy](#media), rather than being copied or regenerated by the sweep.

**A translated page is generated output, not a hand-maintained one.** When the source page changes, a sweep **rewrites** the translation rather than reporting it stale, so the trees are never out of step. That is a knowing trade: a correction made directly in `docs/de-DE/` does not survive the next sweep, and a reviewer who does not read that language will not catch it in the diff. It follows as a rule rather than a caveat — **a correction belongs in the source page, or in the wording guidance [`docs.instructions`](#config) carries, never in the translated file.**

**Structural drift between a locale tree and the default one is not a finding.** Because the locale tree is derived, there is nothing to judge it against on its own terms — a numbering gap or a missing page there is a **sweep that has not run yet**, not a deviation to report. This is why the [reconcile categories](#reconcile-rules) do not apply inside a locale root.

**A missing translation is legitimate.** A renderer resolves a missing page through a documented chain — the locale, its base language, a sibling region, a configured fallback, then the untranslated original — so the reader gets the nearest language rather than a 404. An untranslated page is therefore **not a defect to fix** and never blocks anything; it is simply a page the next sweep will write.

**The ADR log's authority is the default-locale tree.** A translated ADR is a rendering of a record, not a record: `write-adr`'s append-only rule binds the source file in `99.adr/`, so regenerating its translation is not an edit to an accepted record. Ids, filenames and `status` are copied from the source untouched, and a decision is never superseded from inside a locale tree.

**A locale sourced from another repository is the consuming site's config, not this one's.** A renderer can pull a locale from a separate repo; this skill only ever writes inside this repo's `docs/`, so such a locale is out of its reach entirely — it is neither scaffolded, translated, nor reported on here.

## Media

Include media when it explains something the page needs. **Prefer text-based diagrams** such as Mermaid for models and flows: their source is diffable and their visible labels can be translated. Mermaid is translatable, not inherently language-neutral.

**Reproducible production is required.** A screenshot, rendered diagram or demo GIF has a committed source — a tape, diagram source or capture spec/script — and is regenerated by the capture owner. A hand-taken screenshot has no such contract. A committed source makes regeneration possible; it does **not** prove the image is fresh. The capture owner renders against the intended code/ref and verifies the output and its reference before reporting completion.

**Destination follows context.** Documentation media and its sources belong under `docs/_assets/`; README-specific media belongs under `.github/assets/`. Reuse an existing artifact when both need the same media: two references do not require two copies. Keep names descriptive, with source and output sharing a base name where paired (`quickstart.tape` / `quickstart.gif`). Shared capture infrastructure, such as `vhs.Dockerfile`, may stay in `.github/assets/` for both contexts. Consumer-specific capture sources and outputs live in the consumer repo, never in the published skill.

**Writing owns inclusion and layout; capture owns production and verification.** For a requested terminal capture, `write-docs` makes an **optional call** to `vhs-demo`, passing the target page, README/docs context, repo-relative output path, subject/ref and any required language variant. It returns the committed source, verified artifact and correct image reference; the writer places that reference. If `vhs-demo` is unavailable, report the outstanding capture and continue the writing that is possible — never fabricate an artifact or report the capture complete. A future browser/Playwright sibling follows the same target contract; it is not implemented or silently substituted by this skill. Missing browser capture capability is reported in the same way.

Use relative image paths from the authored page even in [render mode](#render-mode) — its absolute **page-link** rule does not turn an asset into a page:

```markdown
<!-- docs/2.guides/1.quickstart.md -->

![Quickstart terminal demo](../_assets/quickstart.gif)
```

Duxt publishes image outputs from a docs source's `_assets/` automatically and resolves authored references to public URLs for that source and ref/version, including locale pages. A docs-only source needs no manual copy into the consuming site's `public/`. Capture sources (tapes/scripts/Dockerfiles) are not public media. Keep the existing image-provider and page-link contracts; do not replace source references with a guessed public URL. Other renderers need their own verified asset-publishing support.

**Language-neutral media is shared.** Translate alt text and captions with the page; a page at `docs/de-DE/2.guides/1.quickstart.md` can reference the same artifact as `../../_assets/quickstart.gif`. Language-dependent captures get explicitly produced and verified variants when needed, for example `docs/_assets/de-DE/quickstart.gif`, referenced from that page as `../../_assets/de-DE/quickstart.gif`. Translate Mermaid's visible labels. A translation sweep neither copies media into every locale tree nor generates captures; preserve the shared target or an existing verified variant, adjusting relative paths for the translated page location, and report a missing required variant explicitly.

**Media reconciliation is report-only**, in the default tree and in locale trees. Report missing image targets, missing required capture sources, suspected unused assets and freshness concerns with their evidence. Never automatically delete, move, copy or regenerate media, or rewrite an image reference as an unambiguous broken page link. Lack of references inside `docs/` alone does not establish repo-wide orphanhood: inspect README and other consumers before claiming an asset is unused.

## Presets

Which sections to scaffold, by project type. **No section is implicit** — each preset states its whole set, and every one of them still faces the redirect test in [SKILL.md](SKILL.md#scaffold--docs-is-missing).

| Preset    | Scaffolds                                             | Conditional                                    |
| :-------- | :---------------------------------------------------- | :--------------------------------------------- |
| `package` | `concepts`, `guides`                                  | `contributing`, `getting-started`, `reference` |
| `cli`     | `getting-started`, `guides`                           | `contributing`                                 |
| `app`     | `getting-started`, `concepts`, `guides`, `operations` | `conventions`                                  |
| `service` | `concepts`, `reference`, `operations`                 | `conventions`                                  |
| `infra`   | `concepts`, `operations`                              | `conventions`                                  |

**Conditional** names the sections that type most often earns, each on a condition the repo has to meet: `contributing` when it accepts outside contributions, `conventions` when it carries project rules a newcomer would not guess, and — on `package` — `getting-started` when the repo's first run is framework wiring rather than an install command, `reference` when the published surface has no `--help` and no schema to read instead. Any of them can be added to any preset — the column says which to expect, not which is allowed.

Three sections are deliberately out of the base set on most rows. Two of them are not withdrawn where they are absent — they are the conditions above, stated:

- **`getting-started` only where a README cannot carry it.** A README in the house style already covers install and first run, so the section would only redirect — and a section index that redirects is an [anti-pattern](#anti-patterns). It is a base section for a `cli` (install varies by channel: package manager, binary, script) and an `app` (a setup chain of env, services and migrations). What that argument assumes is an install command, which is the `package` condition: a first run that is **framework wiring** — registering a module, adding a config block, mounting a component — is a step no README hook covers, so the section holds a page rather than a redirect.
- **`reference` outright only for a `service`.** A lookup page is [the row to challenge](SKILL.md#routing-matrix--what-you-changed--page-type--section): a manifest, a schema or `--help` usually holds the real answer and never goes stale. An HTTP API with no published schema is the one case that earns the section outright. That same test is the `package` condition: a published surface with **no `--help` and no schema** — components, composables and config keys readable only in source — has nothing machine-readable to defer to, so its lookup values are canonical here or nowhere.
- **`adr` belongs to no preset** — the section appears when the first ADR is written, never scaffolded empty.

`package` is **anything published that carries its own reference** — an npm library, a Composer package, a Nuxt module, an agent/skill set. What such a repo ships travels without `docs/`, so the tree holds only what spans the whole set; the per-artifact reference stays with the artifact — where there is one to stay with, an artifact carrying none being exactly what the conditional `reference` above covers. It is deliberately not named `library`: the case is the publishing, not the language or the format.

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
- **Two exceptions, both named.** An ADR adds `status` + `date` (see [Architecture decision records](#architecture-decision-records)); a repo running the [render mode](#render-mode) may carry that mode's theme fields. Neither is a licence to extend the contract elsewhere: a field outside those two sets is still an unknown key, and the reconciler still strips it.

## Page types

Type is implied by **section + template** — never a frontmatter field. Skeletons in [`templates/`](templates/).

| Type                   | Shape                                                 | Template       |
| :--------------------- | :---------------------------------------------------- | :------------- |
| guide / tutorial       | A learning path; goal → steps → result.               | `guide.md`     |
| how-to                 | One task, start to finish; **ends with a checklist**. | `how-to.md`    |
| concept / architecture | Explains the model — how it works and why.            | `concept.md`   |
| reference              | A lookup entry — terse, tabular, complete.            | `reference.md` |
| ADR                    | One decision + its reasoning; append-only.            | `adr.md`       |

**The skeletons are written for the portable default.** Under the [render mode](#render-mode) they are still the right starting point — the frontmatter, the section order and the prose shape are unchanged — but the mode's flips apply as the template is copied, so the page that lands drops the body H1 and writes the mode's own form of a section index and a status marker. Apply them on copy; there is no second set of templates, and a copied skeleton is never the reason a rule was missed.

## Status marker

A lightweight lifecycle signal in the page body (not frontmatter, never required, no emoji). Place a note callout right under the H1:

```markdown
> [!NOTE]
> **Status:** in development
```

Values: `in development` · `planned` · `deprecated` — a shipped page omits the marker. The reconciler doesn't enforce it but can check it when present. An ADR does not use this marker — its lifecycle lives in the `status` frontmatter field. ([Flipped by the render mode](#render-mode), and as a correctness fix rather than a matter of taste: the blockquote form has no transform there and renders as an ordinary quote with the literal `[!NOTE]` in it.)

## Render mode

The tree above is written to be read **as files** — on the forge, in an editor, by an LLM. A repo that also **publishes** it through a rendering theme needs a different page on four counts, and the site's requirement wins on each: a theme that renders `title` as the `<h1>` makes the body's own heading a second one, a rendered site resolves absolute doc paths and not relative `.md` ones, a self-maintaining page list beats a hand-written bullet per page, and the theme's own frontmatter fields have to survive the reconciler. A fifth is a plain rendering bug rather than a preference. `docs.render` names the target and flips exactly those five.

**Portability stays the default, and this is why.** Most repos here publish nothing — their `docs/` is read on the forge, where a relative `.md` link is the only form that resolves and a component block shows as raw text. Flipping the rules globally would break the common case to serve the rarer one, so the mode is opt-in and everything not listed below is unchanged by it.

### What flips

| Rule                                              | Portable (default)                     | Under the mode                                                                      |
| :------------------------------------------------ | :------------------------------------- | :---------------------------------------------------------------------------------- |
| The [body H1](#tree-shape)                        | a plain-text H1 under the frontmatter  | **no body H1** — the theme renders `title` as the `<h1>`                            |
| [Links](#tree-shape)                              | relative `.md` links to verified paths | **absolute doc paths** — the only form that resolves, and the form the build checks |
| A [section index](#tree-shape)'s page list        | a hand-written bullet per page         | the theme's **page-cards** component — self-maintaining, which is why it exists     |
| The [frontmatter contract](#frontmatter-contract) | `title` + `description`, nothing else  | plus the **theme's own fields**, which the reconciler then leaves alone             |
| The [status marker](#status-marker)               | a `> [!NOTE]` blockquote               | the theme's **callout** component                                                   |

Nothing else moves. The mode changes the **form of a page**, never [what belongs in docs at all](SKILL.md#what-belongs-in-docs-at-all), the [section catalogue](#section-catalogue), the [presets](#presets), the numeric-prefix ordering, the [delta principle](SKILL.md#route--add--docs-exists), or the one-topic-per-page rule.

**`99.adr/` keeps its own contract under the mode too.** That section is [not this skill's](#architecture-decision-records), and `write-adr` states why the mode leaves it unchanged.

### The target, and why its contract is linked rather than copied

The one target implemented is **`duxt`** (`@kirchdev/duxt`), and it already publishes what a page must look like:

| For                    | Read                                                                                     |
| :--------------------- | :--------------------------------------------------------------------------------------- |
| The frontmatter fields | duxt's `pageSchema` (`sources.ts`), documented in its own `4.reference/3.frontmatter.md` |
| The components         | duxt's `app/components/content/` — one file per block                                    |

**This skill states only what it owns — the five flips above — and points at duxt for the rest.** A field list or a component table copied into this file would be correct until duxt's next release and then quietly wrong, with nothing to catch it; the same reasoning that keeps the [delta principle](SKILL.md#route--add--docs-exists) from transcribing a schema into a page. So: resolve the fields from duxt when writing frontmatter under the mode, and never enumerate them here.

**A generic `site` mode was rejected.** Naming no target would oblige this skill to invent a contract it can validate against nothing — and "a rendered site" is not one shape: the five flips above are duxt's answers, not universal ones. A second target docks by being named in the config key and getting its own row here, not by generalising this one.

### The status marker under the mode

The blockquote form carries **no transform** in duxt — there is no blockquote-alert handling in the layer — so it renders as an ordinary quote with the literal `[!NOTE]` still in it. That is a rendering bug, which is why this flip is a correctness fix rather than a matter of style.

The marker becomes a **callout** (`Callout.vue`). Its types are `info` · `tip` · `warning` · `danger` — there is **no `note`**, and `info` is the default, so an untyped callout is the nearest thing to what `[!NOTE]` meant. The marker's own values are unchanged (`in development` · `planned` · `deprecated`), and a shipped page still omits it. Don't map each value to a type: which types exist is duxt's to change, and a mapping written here is the copied contract this section just refused.

### The rest of the component set is permitted, never required

duxt's own tree reaches for roughly eight blocks — callouts, page cards, package-manager and tabbed switchers, step lists, file trees, field groups, code groups — and a page that uses one **where it genuinely fits** is writing the mode correctly, not going off-piste.

But this skill **prescribes none of them**. It cannot judge per page whether a component suits the material, and a table mapping case to component would be the same copied contract that the section above rejects. The set stays discoverable in `app/components/content/`; reach for a block when the material calls for it, and write plain Markdown when it does not.

### Declared, never detected

The mode is `docs.render` in `.tituskirch-skills.json` (see [Config](#config)) — written down, or absent.

**Detection was ruled out by the target's own design.** duxt is multi-repo: a repo whose `docs/` is pulled into someone else's site carries no dependency to detect. Sniffing for one would read that tree as portable and write the **portable** contract into precisely the tree that needs the other — the failure mode with no signal at all, since portable pages render on a site, just wrongly.

The **reconciler reads the same key**, which is the other half of the mode working: without it, the theme's frontmatter fields are unknown keys and the [mechanical auto-fix](#reconcile-rules) strips them on its next pass, from exactly the pages that need them.

## Architecture decision records

**The decision log is `write-adr`'s, not this skill's.** It lives in **`docs/99.adr/`**, and that is all this skill needs to know about it:

- **The `99` prefix is fixed**, identical in every repo, and the section is **pinned last** — a decision log is an appendix, not front-of-manual reading.
- **It is never scaffolded**, and no preset includes it. It appears with the first record `write-adr` writes.
- **Its pages follow their own contract** — `NNNN-title.md` filenames, `status` + `date` frontmatter, an append-only body — so none of the page rules in this file apply to them, and a reconcile never touches them in the default-locale tree.
- **A translated ADR** is a rendering of a record, regenerated with its [locale tree](#locale-trees-are-regenerated-not-categorized): ids, filenames and `status` copied from the source untouched.

Everything else — whether a decision earns a record, its sections, its size, superseding, importing a log written elsewhere — is in `write-adr`.

## Reconcile rules

Desired-state and idempotent. Blast radius: **structure + frontmatter only, prose untouched, inside `docs/` only, plan + diff first** (see SKILL.md) — with one configured exception, the [locale trees](#locale-trees-are-regenerated-not-categorized) below. Categorize each deviation:

| Category      | Examples                                                                                                                                                                                       | Action          |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- |
| Mechanical    | numbering gaps/dupes · missing `index.md` · removed/unknown frontmatter keys · `N.kebab.md` rename · unambiguous broken link                                                                   | auto-fix        |
| Value-needing | missing required `title`/`description`                                                                                                                                                         | propose + ask   |
| Report only   | how-to without a checklist · page fits no section · suspected upstream duplication · secret found · missing media/source · suspected unused media · a foreign ADR directory (name `write-adr`) | report, no edit |

**Resolve the [render mode](#render-mode) before categorizing anything.** Two of the mechanical fixes are written against the portable contract and become destructive under the mode: _unknown frontmatter keys_ would strip the theme's fields off exactly the pages that need them, and _broken link_ would rewrite the mode's absolute doc paths as dangling relatives. Under the mode, read those two against the mode's rules instead — the theme's fields are known keys, an absolute doc path is the correct form, and a missing body H1 is not a deviation to restore. This is the whole reason the mode is a config key the reconciler can read rather than something each run infers.

**`99.adr/` is out of scope.** The reconciler does not fix, rename, renumber or report-and-fix anything inside it in the default-locale tree — the log is `write-adr`'s, including its `index.md`. A finding there is reported once, naming that skill. A **foreign** ADR directory outside `99.adr/` is likewise reported and handed to `write-adr`'s import, never moved from here.

**Media is exempt from mechanical fixes.** Follow [Media](#media): image targets, required capture sources and suspected unused assets are report-only even when a page link would be auto-fixed. `_assets/` gains no index, numbering or navigation entry.

### Locale trees are regenerated, not categorized

The three categories above judge a tree against the convention. A [locale tree](#locales) is **derived from the default tree**, so there is nothing to judge it against on its own terms: its numbering, its `index.md` files and its section shape all come from the source, and a gap in any of them means the sweep has not run, not that the tree deviates. So for translated pages inside a locale root the reconciler **does not categorize structural drift** — it **regenerates**, and structural drift against the default tree is never a finding to report.

**This is the one place a reconcile writes prose, and it is a deliberate exception.** Where `docs.locales` lists a locale, the sweep rewrites that tree's translated `title`, `description` and body from the source. The exception is **scoped to the locale trees**: the default-locale tree keeps _prose untouched_ in full, exactly as before, and a repo that lists no locales never reaches this path. It is also why a correction made inside `docs/de-DE/` does not survive — the fix belongs in the source page or in `docs.instructions`.

**The sweep covers translated pages, never media files.** Shared images stay at their existing paths; localized captures require their capture owner. Missing variants and other media findings remain report-only under [Media](#media).

`99.adr/` inside a locale tree is regenerated with the other pages, and that does **not** collide with `write-adr`'s append-only rule: the record is the source file, and its translation is a rendering of one. Ids, filenames and `status` are copied across untouched, and a decision is never superseded from inside a locale tree.

Read the whole tree fresh every run — it is live state and is **never cached**.

## Config

`.tituskirch-skills.json` at the consuming repo's root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The `docs.*` section is this skill's. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent. Resolution per setting: **config → native/detected → built-in default**.

```json
{
  "language": "de",
  "docs": {
    "preset": "app",
    "render": "duxt",
    "language": { "title": "en", "body": "de" },
    "locales": ["de-DE", "pt-BR"],
    "instructions": "…"
  }
}
```

| Key                 | Effect                                                                                                                                                                                  |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.preset`       | `package` / `cli` / `app` / `service` / `infra` — which sections to scaffold; falls back to repo detection, then asks                                                                   |
| `docs.render`       | `duxt` — the [render mode](#render-mode)'s target; absent or `null` is the portable default. **Declared, never detected**                                                               |
| `docs.language`     | docs language, and the tree's **default locale** — scalar (a code/name or `match`) or `{ title, body }`; falls back to root `language`, then the existing docs/repo language, then `en` |
| `docs.locales`      | the **additional** locale trees to maintain and translate, each a folder inside the source (`docs/de-DE/`); absent → single-locale, unchanged ([Locales](#locales))                     |
| `docs.instructions` | free-text guidance for generated docs (tone, house conventions) — additive preference only, never overrides the docs format or guardrails                                               |

**`docs.language` and `docs.locales` answer different questions**, so a multilingual repo sets both: the first names the locale living at the source root, the second the folders beside it. The default locale is therefore **never** listed in `docs.locales` — it has no folder to name, and listing it would ask for `docs/en-GB/` alongside the root tree it already is. The schema cannot catch that (`docs.language` may be `match` or a `{ title, body }` object), so it is a rule the skill holds: on finding the default locale in the list, say so and drop it rather than scaffolding the duplicate tree.

`language` is a shared root key; `docs.*` is this skill's section (`commit.*`/`pr.*`/`issue.*` belong to the other skills). `match` mirrors the repo/source language. `docs.instructions` mirrors `commit.instructions` / `pr.instructions` / `issue.instructions` — additive wording guidance that never overrides the docs format or guardrails. Set `docs` to `false` (instead of an object) to opt the repo out entirely — the skill then **stops with a "disabled" notice** instead of falling back; an _absent_ block still falls back to defaults/detection. Full schema: the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
disabled=$(printf '%s' "$resolved" | jq -er 'if .docs == false then 1 else empty end' 2>/dev/null) || disabled=
preset=$(printf '%s' "$resolved" | jq -er '.docs.preset // empty' 2>/dev/null) || preset=
render=$(printf '%s' "$resolved" | jq -er '.docs.render // empty' 2>/dev/null) || render= # empty = portable; `null` and absent mean the same thing here
lang=$(printf '%s' "$resolved" | jq -er '.docs.language // .language // empty' 2>/dev/null) || lang= # may be a { title, body } object, not a scalar
locales=$(printf '%s' "$resolved" | jq -er '.docs.locales // [] | .[]' 2>/dev/null) || locales= # one per line; empty means single-locale
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
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;   # 11: unknown profile named
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found, could not run, or was told to select a profile the config does not define, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset name, or a detected `ci` the config does not define, yields the base config unchanged. A `TITUSKIRCH_SKILLS_PROFILE` naming no defined profile exits `11` — a renamed profile stops the run rather than silently dropping its overlay.

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
- ❌ A `type:` (or `icon:`/`nav:`) frontmatter field — the contract is `title` + `description` only (an ADR adds `status` + `date`, and a repo running the [render mode](#render-mode) adds that mode's theme fields; nothing else does).
- ❌ A subject-matter top-level section (`plugins/`, `themes/`, `integrations/`) instead of routing content into a type section (nested if needed).
- ❌ A second page on a topic that already has one — edit in place. (ADRs excepted — a new decision is a new ADR.)
- ❌ Writing, superseding, importing or reconciling an ADR from this skill — the log is `write-adr`'s.
- ❌ Documenting a finished feature as an ADR instead of as pages.
- ❌ A how-to without a closing checklist.
- ❌ Restating upstream/framework behavior instead of linking it.
- ❌ Rewriting prose during a reconcile, or touching anything outside `docs/`. (A [locale tree](#locale-trees-are-regenerated-not-categorized) is the sole carve-out — it is regenerated from the source, and it never leaves `docs/`.)
- ❌ Emoji in generated headings, landing pages, or prose — output is plain text.
- ❌ Naming a specific docs tool/generator in the pages or the convention — outside the [render mode](#render-mode), whose entire purpose is to target one, and which is off unless `docs.render` says otherwise.
- ❌ Writing a component block, an absolute doc path or a theme frontmatter field into a repo whose config does **not** declare the mode — a component shows as raw text on the forge, and the reconciler strips the field on its next pass.
- ❌ Keeping the portable form under the mode — a body H1 the theme renders a second time, a hand-written bullet list where the page-cards component belongs, a `> [!NOTE]` that renders with its marker showing.
- ❌ [Detecting](#declared-never-detected) the mode from a dependency, a lockfile or a config file instead of reading `docs.render` — the target is multi-repo, so the tree that most needs the mode is the one carrying no trace of it.
- ❌ Copying the target's frontmatter field list or component set into this file instead of [pointing at it](#the-target-and-why-its-contract-is-linked-rather-than-copied) — a copy is correct until the next release, and nothing catches it afterwards.
- ❌ Reading a [locale root](#locales) (`de-DE/`) as a section, a subject folder, or an unknown directory to gap-report — it holds a whole tree, not a page's worth of one type.
- ❌ A folder for the default locale (`docs/en-GB/` beside the root tree it already is), or the default locale listed in `docs.locales`.
- ❌ Translating a filename or a numeric prefix — a path is how a renderer finds a translation, so it is copied from the source untouched.
- ❌ Correcting a translation inside `docs/de-DE/` — a translated page is generated output, so the fix belongs in the source page or in `docs.instructions`.
- ❌ Reporting a locale tree's numbering, missing page or section shape as drift — it is derived, so a gap is an unrun sweep, not a deviation.
- ❌ A stub or placeholder page standing in for a missing translation — a renderer already falls back to the nearest language, so the stub only hides that the sweep has not run.
- ❌ Rewriting prose in the default-locale tree during a reconcile because `docs.locales` is set — the exception is scoped to the locale trees.
- ❌ Hand-taken screenshots without committed capture sources, or treating reproducibility as proof of freshness.
- ❌ Giving `_assets/` a numeric prefix, `index.md`, navigation entry or catalogue gap.
- ❌ Copying binaries into every locale tree, inventing localized captures, or calling Mermaid locale-neutral.
- ❌ Automatically moving, deleting, copying or regenerating media during reconcile, or claiming repo-wide orphanhood from a docs-only search.
- ❌ Publishing capture scripts, tapes or Dockerfiles as media, or requiring manual public copies for a Duxt docs source.
