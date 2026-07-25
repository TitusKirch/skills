---
name: write-docs
metadata:
  summary: Scaffolds, extends and reconciles a project's docs/ tree — ADRs included — in the TitusKirch docs format.
description: Scaffolds, extends, and reconciles a project's `docs/` tree in the TitusKirch docs format — one stack-agnostic documentation convention shared across all repos, including the ADR format (append-only architecture decision records in `docs/99.adr/`). Routes by state — scaffolds when `docs/` is missing, adds to the right section when it exists, reconciles existing pages to the convention when asked (never rewriting prose). Always previews a plan and writes only after confirmation. Use when the user wants to write, add, scaffold, or update documentation, set up a docs/ tree, document a feature, record or supersede an architecture decision, or says things like "write the docs", "add a docs page", "document this", "reconcile the docs", "write an ADR", "record this decision", "Doku schreiben", "docs aktualisieren". Also trigger proactively, once a feature has cleared review and reached final approval — when the work is settled, not the moment implementation finishes — to document the shipped result.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# write-docs

The TitusKirch **docs format** — one opinionated, stack-agnostic convention for a project's `docs/` tree, the same in every repo (including client projects). This skill owns the convention; the page mechanics live in [REFERENCE.md](REFERENCE.md), the skeletons in [`templates/`](templates/). Pages are plain Markdown with `title` + `description` frontmatter and numeric-prefixed paths — a clean tree any file-based docs generator can render, index, and feed to an LLM.

**Opted out?** If the repo config sets `docs` to `false`, this skill is disabled for the repo — **stop immediately** (including the proactive trigger) and tell the user docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled — that falls back to defaults/detection. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Jobs — pick by repo state + intent

| State / intent                              | Job           |
| :------------------------------------------ | :------------ |
| `docs/` missing                             | **scaffold**  |
| `docs/` exists + "document feature X"       | **route/add** |
| "update / align / migrate / reconcile docs" | **reconcile** |

Optional verb shortcuts: `/write-docs init`, `/write-docs add <topic>`, `/write-docs reconcile`. Otherwise infer from state and the request. **Always: plan → confirm → apply.**

**Proactive trigger** — don't wait to be asked. Once a feature has passed all its reviews and reached final approval (signed off or merged), engage this skill yourself and run the **route/add** job for that feature. Trigger on _final approval_, not on _implementation finished_ — code still facing review is too early, and a feature that gets reworked shouldn't be documented twice. The write still follows plan → confirm → apply.

## What belongs in docs at all

**Code says what happens. Docs say why.** An agent reads the code, so a page that narrates what the code does is a slower, staler copy of something already open in the editor — and if the code needs narrating, the fix is the code, not a page about it.

Before writing anything, ask what the reader could **not** recover by reading the source. Exactly three answers survive that test:

| Code cannot express           | Because                                                                                      | Goes to                       |
| :---------------------------- | :------------------------------------------------------------------------------------------- | :---------------------------- |
| **The roads not taken**       | What was rejected, and why, leaves no trace in what shipped                                  | `adr`, `concepts`             |
| **How new work here is done** | The intended approach for the next change is not a property of the current one               | `conventions`, `guides`       |
| **Where to start**            | A repo has no first line; which seam to enter by, and how the parts relate, is not in a file | `concepts`, `getting-started` |

Everything else — what a function does, which options exist, what a command prints — either belongs in the code and its own reference output, or is [already in a file](#route--add--docs-exists) that owns it. If a planned page fits none of the three rows, that is the answer: don't write it.

## Routing matrix — what you changed → page type → section

| You added / changed                            | Page type                 | Section           |
| :--------------------------------------------- | :------------------------ | :---------------- |
| A user-facing capability's usage               | guide / tutorial          | `guides`          |
| A repeatable task / "add a new X"              | how-to (ends w/checklist) | `guides`          |
| A subsystem, model, or how-it-works            | concept / architecture    | `concepts`        |
| A lookup value: env var, CLI flag, config, API | reference entry           | `reference`       |
| Setup / install / first-run change             | (update existing)         | `getting-started` |
| A run / deploy / maintain procedure            | how-to or concept         | `operations`      |
| A project-specific rule or pattern             | concept                   | `conventions`     |
| An architectural decision + its reasoning      | ADR (own schema)          | `adr`             |

A real feature usually spans several types: how-it-works (`concepts`) + usage (`guides`) + lookup values (`reference`). **"How it works" means the shape and the reasoning** — the seams, the invariants, why it is built this way — never a walk through the implementation, which the code states better and keeps current for free.

**The `reference` row is the one to challenge.** Lookup values earn a page only where nothing machine-readable already holds them — an HTTP API with no published schema, env vars with no `.env.example`. Where a schema, a manifest or `--help` is the real answer, the reference page is one sentence naming it plus whatever it cannot say (which values are safe to change, which combinations conflict). A transcribed option table is the single most common stale page in any repo. **Lead with how-it-works and how-to-use; push every lookup value to `reference` and link to it.** Page type is implied by section + template — it is **not** a frontmatter field. Catalogue, core sections and presets: [REFERENCE.md](REFERENCE.md).

**ADRs are the standing exception.** They live in `docs/99.adr/` (fixed prefix, flat), are named `NNNN-title.md` for a permanent decision id, carry `status` + `date` on top of the house frontmatter, and are **append-only** — a reversed decision writes a new ADR and marks the old one `superseded`, never edits it. A concept page explains how a thing works _today_; an ADR records why it was chosen, _then_. Full contract: [REFERENCE.md](REFERENCE.md#architecture-decision-records).

## Scaffold — `docs/` is missing

1. **Resolve the preset** — `docs.preset` config → detect from the repo (bin/CLI → `cli`, library manifest → `library`, app/server → `app`, IaC → `infra`, agent/skill → `ai-tool`) → ask. Preset = which sections beyond the core.
2. **Resolve the language** — `docs.language` → root `language` → existing docs/repo language → `en` (see [REFERENCE.md#config](REFERENCE.md#config)). When set, `docs.instructions` shapes the generated-docs wording (tone, house conventions) — additive only, never overriding the docs format or guardrails.
3. **Plan the tree** — core (`getting-started`, `reference`) + the preset's sections; show it.
4. **Drop any section that would only redirect.** For each planned section ask: does this repo have a page's worth of material that is **not** already canonical somewhere else — a README that covers install and first run, a committed schema that _is_ the config reference, per-module docs that ship with their module? If not, the section's `index.md` can only say "the real thing is over there", which costs a click and returns nothing. Leave it out, name it in the plan with the reason, and let **route/add** create it later when it has a page of its own. This applies to the core sections too: core is the default, not an obligation.
5. **On confirm** — create numeric-prefixed section dirs, each with an `index.md` (frontmatter `title` + `description`, plain-text H1), plus a `docs/index.md` landing page. Generated docs are emoji-free. Skeletons: [`templates/`](templates/).

A scaffold that produces one section is a **success**, not a failure — the tree's job is to hold what has no other home, and in a repo whose parts already document themselves that can be a single section. Numbering starts at `1.` over whatever survives, so nothing looks missing.

## Route / add — `docs/` exists

1. Run the routing matrix; list **every** page to create or touch.
2. New page → next free `N.kebab.md` in the section, frontmatter `title` + `description`, body from the matching template, then link it from that section's `index.md`.
3. **How-tos end with a checklist.** Add a `> [!NOTE]` **Status** callout (see [REFERENCE.md#status-marker](REFERENCE.md#status-marker)) if the feature isn't shipped yet.
4. **Delta principle** — don't restate what something else already documents; link it, and write the project-specific delta plus the glue. Three sources outrank a page here, in descending order of how badly a copy hurts:
   - **A file in this repo.** `package.json`'s scripts, a workflow, a schema, a lockfile, a config — a doc that lists their contents is wrong the moment the file changes, and nothing will tell you. Name the file and what is surprising about it; never transcribe values, versions or option tables out of it.
   - **Anything the repo ships.** A library, plugin or skill travels without `docs/`, so it must carry its own reference — a second copy here is the one guaranteed to drift.
   - **An authoritative upstream source** — framework docs, a dependency's README, a standard.
     A strong guideline, not a hard block: cross-cutting glue, and the reason a thing is set the way it is, are exactly what no source file states.
5. **Updating** an existing topic — the one-topic-per-page rule means there's usually exactly one page; `grep docs/` for the term, edit it **in place**, never open a second page on the same topic, and update affected reference tables + cross-links. **Never for an ADR** — a changed decision is a new ADR that supersedes the old one, and the ADR section's `index.md` decision log gets the row in the same change.
6. Verify every fact against current code before writing.

## Reconcile — align existing docs to the convention

Desired-state, idempotent — like a `--fix` linter for the docs tree.

1. Read the **whole** `docs/` tree fresh (it is live state — never cached).
2. Diff against the convention and group the plan:
   - **Auto-fix (mechanical)** — numbering gaps/dupes, missing `index.md`, removed/unknown frontmatter keys, `N.kebab.md` filename normalization, unambiguous broken relative links.
   - **Prompt (value-needing)** — a missing required field (`title`/`description`): derive a candidate from the H1 / first paragraph and confirm.
   - **Report only** — a how-to without a checklist, a page that fits no section, suspected duplication of an upstream source **or of a file in the repo**, any secret detected. Never auto-edited.
3. Show the **plan + diff**; on confirm apply **only structure + frontmatter**. **Never rewrite prose. Only touch files inside `docs/`.**

`99.adr/` is **exempt** — links and the decision log only. An ADR id is permanent, so never renumber one, never rename it to the dot-schema, never close a gap in the sequence ([REFERENCE.md](REFERENCE.md#reconcile-rules)).

## Guardrails (inherited)

- **Docs are never the source of truth — the repo is.** Code says what happens; a page exists for the why, the rejected alternatives, and the way in — the three things [code cannot express](#what-belongs-in-docs-at-all). Documentation that mirrors code or a file costs tokens on every read and starts lying at the next commit, so when a page would restate one, link it and write only the delta.
- **Plan/preview first; apply only after confirmation.** Respect plan-only / dry-run.
- **Keep generated content attribution-free** — no agent self-naming or `Generated with`/🤖 lines.
- **No secrets** in generated docs — scan, warn, exclude.
- **Only the requested action** — nothing closed or changed unasked.
- **No cache** — the `docs/` tree is live state, always read fresh.

## Reference

- Section catalogue, core, presets, frontmatter contract, page types, status marker, ADR contract, reconcile rules, config keys: [REFERENCE.md](REFERENCE.md).
- Page skeletons to copy: [`templates/`](templates/).

## Gap report (final step)

If you used a section, page type, or preset not in [REFERENCE.md](REFERENCE.md), end the turn with a short note (`Gap report: section "{x}" — no catalogue entry; added ad hoc.`). Only report; don't edit REFERENCE.md yourself — the user folds gaps back in. A new _slug_ is a real gap only when it names a missing **type**; a **subject** section (`plugins`, `themes`, `integrations`) is not — route its content into the type sections (nested if it needs grouping) and report that instead. If everything matched: `Gap report: no gaps.`
