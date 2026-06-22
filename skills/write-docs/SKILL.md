---
name: write-docs
summary: Scaffolds, extends and reconciles a project's docs/ tree in the TitusKirch docs format.
description: Scaffolds, extends, and reconciles a project's `docs/` tree in the TitusKirch docs format — one opinionated, stack-agnostic documentation convention shared across all repos. Detects state and routes the job — when `docs/` is missing it scaffolds the canonical structure for the project's preset (library/app/cli/infra/ai-tool); when it exists it routes a feature to the right section and page type (guide, how-to, concept/architecture, reference); when asked to update/align/migrate it reconciles existing pages to the current convention (numbering, index pages, frontmatter) without ever rewriting prose. Always previews a plan and writes only after confirmation. Use when the user wants to write, add, scaffold, or update documentation, set up a docs/ tree, document a feature, or says things like "write the docs", "add a docs page", "document this", "reconcile the docs", "Doku schreiben", "docs aktualisieren". Also trigger proactively, without an explicit request, once a feature has cleared every review and reached final approval — merged or signed off, the work settled — not the moment implementation finishes, to document the shipped result.
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

## Jobs — pick by repo state + intent

| State / intent                              | Job           |
| :------------------------------------------ | :------------ |
| `docs/` missing                             | **scaffold**  |
| `docs/` exists + "document feature X"       | **route/add** |
| "update / align / migrate / reconcile docs" | **reconcile** |

Optional verb shortcuts: `/write-docs init`, `/write-docs add <topic>`, `/write-docs reconcile`. Otherwise infer from state and the request. **Always: plan → confirm → apply.**

**Proactive trigger** — don't wait to be asked. Once a feature has passed all its reviews and reached final approval (signed off or merged), engage this skill yourself and run the **route/add** job for that feature. Trigger on _final approval_, not on _implementation finished_ — code still facing review is too early, and a feature that gets reworked shouldn't be documented twice. The write still follows plan → confirm → apply.

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

A real feature usually spans several types: how-it-works (`concepts`) + usage (`guides`) + lookup values (`reference`). **Lead with how-it-works and how-to-use; push every lookup value to `reference` and link to it.** Page type is implied by section + template — it is **not** a frontmatter field. Catalogue, core sections and presets: [REFERENCE.md](REFERENCE.md).

## Scaffold — `docs/` is missing

1. **Resolve the preset** — `docs.preset` config → detect from the repo (bin/CLI → `cli`, library manifest → `library`, app/server → `app`, IaC → `infra`, agent/skill → `ai-tool`) → ask. Preset = which sections beyond the core.
2. **Resolve the language** — `docs.language` → root `language` → existing docs/repo language → `en` (see [REFERENCE.md#config](REFERENCE.md#config)).
3. **Plan the tree** — core (`getting-started`, `reference`) + the preset's sections; show it.
4. **On confirm** — create numeric-prefixed section dirs, each with an `index.md` (frontmatter `title` + `description`, plain-text H1), plus a `docs/index.md` landing page. Generated docs are emoji-free. Skeletons: [`templates/`](templates/).

## Route / add — `docs/` exists

1. Run the routing matrix; list **every** page to create or touch.
2. New page → next free `N.kebab.md` in the section, frontmatter `title` + `description`, body from the matching template, then link it from that section's `index.md`.
3. **How-tos end with a checklist.** Add a `> [!NOTE]` **Status** callout (see [REFERENCE.md#status-marker](REFERENCE.md#status-marker)) if the feature isn't shipped yet.
4. **Delta principle** — don't restate what an authoritative upstream source (framework docs, a library's README, a standard) already documents; link it, and document the project-specific delta + the glue. A strong guideline, not a hard block.
5. **Updating** an existing topic — the one-topic-per-page rule means there's usually exactly one page; `grep docs/` for the term, edit it **in place**, never open a second page on the same topic, and update affected reference tables + cross-links.
6. Verify every fact against current code before writing.

## Reconcile — align existing docs to the convention

Desired-state, idempotent — like a `--fix` linter for the docs tree.

1. Read the **whole** `docs/` tree fresh (it is live state — never cached).
2. Diff against the convention and group the plan:
   - **Auto-fix (mechanical)** — numbering gaps/dupes, missing `index.md`, removed/unknown frontmatter keys, `N.kebab.md` filename normalization, unambiguous broken relative links.
   - **Prompt (value-needing)** — a missing required field (`title`/`description`): derive a candidate from the H1 / first paragraph and confirm.
   - **Report only** — a how-to without a checklist, a page that fits no section, suspected upstream duplication, any secret detected. Never auto-edited.
3. Show the **plan + diff**; on confirm apply **only structure + frontmatter**. **Never rewrite prose. Only touch files inside `docs/`.**

## Guardrails (inherited)

- **Plan/preview first; apply only after confirmation.** Respect plan-only / dry-run.
- **No AI/agent attribution** anywhere in generated content.
- **No secrets** in generated docs — scan, warn, exclude.
- **Only the requested action** — nothing closed or changed unasked.
- **No cache** — the `docs/` tree is live state, always read fresh.

## Reference

- Section catalogue, core, presets, frontmatter contract, page types, status marker, reconcile rules, config keys: [REFERENCE.md](REFERENCE.md).
- Page skeletons to copy: [`templates/`](templates/).

## Gap report (final step)

If you used a section, page type, or preset not in [REFERENCE.md](REFERENCE.md), end the turn with a short note (`Gap report: section "{x}" — no catalogue entry; added ad hoc.`). Only report; don't edit REFERENCE.md yourself — the user folds gaps back in. If everything matched: `Gap report: no gaps.`
