---
name: write-docs
metadata:
  summary: Scaffolds, extends and reconciles a project's docs/ tree — ADRs included — in the TitusKirch docs format.
description: Scaffolds, extends, and reconciles a project's `docs/` tree in the TitusKirch docs format — one stack-agnostic convention shared across all repos, ADRs included (append-only records in `docs/99.adr/`). Routes by state — scaffolds when `docs/` is missing, adds to the right section when it exists, reconciles pages when asked (never rewriting prose). Always previews a plan, writing only after confirmation. Use when the user wants to write, add, scaffold, or update documentation, set up docs/, document a feature, record or supersede an architecture decision, or says things like "write the docs", "add a docs page", "document this", "reconcile the docs", "write an ADR", "record this decision", "Doku schreiben", "docs aktualisieren". Also trigger proactively once a feature has cleared review and final approval — when the work is settled, not when implementation ends — to document the shipped result, and offer an ADR when a decision clearly earns one.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(grep:*)
  - Bash(git log:*)
---

# write-docs

The TitusKirch **docs format** — one opinionated, stack-agnostic convention for a project's `docs/` tree, the same in every repo (including client projects). This skill owns the convention; the page mechanics live in [REFERENCE.md](REFERENCE.md), the skeletons in [`templates/`](templates/). Pages are plain Markdown with `title` + `description` frontmatter and numeric-prefixed paths — a clean tree any file-based docs generator can render, index, and feed to an LLM.

**Opted out?** If the repo config sets `docs` to `false`, this skill is **disabled** for the repo — **stop immediately** (including the proactive trigger) and tell the user docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled — that falls back to defaults/detection. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Jobs — pick by repo state + intent

| State / intent                              | Job           |
| :------------------------------------------ | :------------ |
| `docs/` missing                             | **scaffold**  |
| `docs/` exists + "document feature X"       | **route/add** |
| "update / align / migrate / reconcile docs" | **reconcile** |

Optional verb shortcuts: `/write-docs init`, `/write-docs add <topic>`, `/write-docs reconcile`. Otherwise infer from state and the request. **Always: plan → confirm → apply.**

**Proactive trigger** — don't wait to be asked. Once a feature has passed all its reviews and reached final approval (signed off or merged), engage this skill yourself and run the **route/add** job for that feature. Trigger on _final approval_, not on _implementation finished_ — code still facing review is too early, and a feature that gets reworked shouldn't be documented twice. The write still follows plan → confirm → apply. An ADR has its own proactive moment, on its own trigger: [when a decision earns one](#when-a-decision-earns-an-adr).

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

**ADRs are the standing exception.** They live in `docs/99.adr/` (fixed prefix, flat), are named `NNNN-title.md` — a permanent decision id plus an imperative verb phrase — carry `status` + `date` on top of the house frontmatter, run `Context` / `Decision` / `Consequences` (Nygard) with an optional `Alternatives considered`, and are **append-only** — a reversed decision writes a new ADR and marks the old one `superseded`, never edits it. A concept page explains how a thing works _today_; an ADR records why it was chosen, _then_. Full contract: [REFERENCE.md](REFERENCE.md#architecture-decision-records).

## When a decision earns an ADR

The matrix above says _where_ a decision goes; this says _whether_ there is one to record. Ask it **before** routing — the `adr` row is the only one whose page cannot be pruned later, because the log is append-only.

**The threshold.** A decision earns an ADR when it **constrains work that comes later** and **its reasoning would otherwise be lost**: a choice between real alternatives, a convention every part of the project has to follow, a trade-off that looks like a mistake until the reason is known. Both halves have to hold — a constraint whose reason is obvious from the code needs no record, and a well-argued call that binds nothing later is a comment, not an ADR.

Decisions that typically clear it: architectural shape · integration patterns between parts · technology choices carrying lock-in · boundary and scope decisions · deliberate deviations from the obvious path · constraints invisible in the code · alternatives rejected for non-obvious reasons. A list of the usual suspects, not a checklist — the threshold above is what decides.

**Three signs of a certain ADR** — hard to reverse, surprising without context, the result of a real trade-off. All three together are **sufficient**: write the record, no further argument needed. They are **never necessary** — the cheapest convention in the repo still earns an ADR if it binds later work and its reason would otherwise be lost, and gating on reversal cost alone would exclude exactly the decisions that are easiest to break by accident.

**Size is not the gate, and never a reason to skip one.** _An ADR can be a single paragraph. The value is in recording that a decision was made and why — not in filling out sections._ The required H2s stay, and any of them may be one sentence ([contract](REFERENCE.md#architecture-decision-records)).

**Offer an ADR proactively** once a decision clearly clears the threshold — same shape as the proactive trigger above: propose the record, plan → confirm → apply, and never write one unasked. _Clearly_ is the bar; a borderline call is the human's to make, so name it and let them answer.

## Scaffold — `docs/` is missing

1. **Resolve the preset** — `docs.preset` config → detect from the repo (bin/CLI → `cli`, a published manifest — library, module, agent/skill set → `package`, a UI app → `app`, a server entrypoint with no frontend build → `service`, IaC → `infra`) → ask. The preset is the **whole** set of sections to scaffold; none is implicit. **Several signals hit at once in most repos** — a CLI that also publishes a library, a module shipping a demo app — so resolve by **how the thing is primarily consumed**, not by what the repo contains: invoked → `cli`, imported into another project → `package`, run and used → `app`/`service`, applied to an environment → `infra`. Genuinely co-equal → ask.
2. **Resolve the language** — `docs.language` → root `language` → existing docs/repo language → `en` (see [REFERENCE.md#config](REFERENCE.md#config)). When set, `docs.instructions` shapes the generated-docs wording (tone, house conventions) — additive only, never overriding the docs format or guardrails.
3. **Plan the tree** — the preset's sections, plus any its conditional column earns here; show it.
4. **Drop any section that would only redirect.** For each planned section ask: does this repo have a page's worth of material that is **not** already canonical somewhere else — a README that covers install and first run, a committed schema that _is_ the config reference, per-module docs that ship with their module? If not, the section's `index.md` can only say "the real thing is over there", which costs a click and returns nothing. Leave it out, name it in the plan with the reason, and let **route/add** create it later when it has a page of its own. This applies to every section the preset names — a preset is the starting set, not an obligation.
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
   - **Import (value-needing)** — a **dedicated ADR directory outside `99.adr/`** (`docs/adr/` and near variants): decisions recorded in someone else's format, which every other category misses, so they are missing from the decision log while the log still reads as complete. Measure **each file** against [the threshold](#when-a-decision-earns-an-adr) first — it governs an adopted record exactly as it governs a written one, and this is the last moment it can be asked, because an append-only log cannot be pruned afterwards. What clears it is proposed as **one** operation — move, rename to `NNNN-title.md`, the log's row, the missing frontmatter, the body under the required H2s — applied only on confirmation. What does not clear it is routed as an ordinary docs page or reported and left alone, in the same plan. Detection rule, the threshold gate, the `date` derivation and what is report-only instead: [REFERENCE.md](REFERENCE.md#foreign-adrs--a-decision-log-written-elsewhere).
   - **Report only** — a how-to without a checklist, a page that fits no section, suspected duplication of an upstream source **or of a file in the repo**, any secret detected. Never auto-edited.
3. Show the **plan + diff**; on confirm apply **only structure + frontmatter**. **Never rewrite prose. Only touch files inside `docs/`.** The one exception is an **imported** ADR, whose body is **re-homed** under the required H2s — the author's sentences are moved, never rewritten.

`99.adr/` is **exempt** — links and the decision log only. An ADR id is permanent, so never renumber one, never rename it to the dot-schema, never close a gap in the sequence ([REFERENCE.md](REFERENCE.md#reconcile-rules)). A **foreign** ADR is outside that exemption: it was never accepted _in this log_, so giving it an id is a first assignment rather than a renumbering, and shaping it on entry is not an edit to an accepted record.

<skills-plan>

## Presenting the plan

Everything this skill puts in front of a human — plan, preview, candidate list, findings report —
is read **once, in a terminal**, and answered there. So **every section of it renders on arrival**,
with no interaction needed to reveal it: prose, lists, tables, fenced code.

**Never fold content behind a control.** `<details>`/`<summary>` is a browser widget, and a
terminal has no way to open it: the summary line prints and everything under it does not. The plan
then arrives as headings with nothing beneath them, and the failure is silent on **both** sides —
the skill believes it reported, and the reader sees no marker saying anything is missing, so a
human confirms a plan whose contents never reached them. What gets folded is whatever ran long,
which is to say the part the decision actually rested on. The same holds for anything else needing
a click: a tab strip, an accordion, a "show more".

**Length is handled by shortening, never by hiding.** This is a fixed rule of the skill, not a
per-run judgement, so it holds however long the list runs. Trim to what the decision needs, group
the rest by something the reader already thinks in (ecosystem, kind, verdict) with a count per
group, or split it across sections. What is left out is left out **visibly**: say how many, why,
and the exact command that shows the rest.

**This binds what the skill presents, not what it writes.** A `<details>` block inside a README, an
issue body, a pull request description or a docs page is rendered by a browser and is entirely
legitimate there. The rule is about the message a human reads to decide — never about the content
of a file.

</skills-plan>

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

## Gap report (mandatory final step)

If you used a section, page type, or preset not in [REFERENCE.md](REFERENCE.md), end the turn with a short note (`Gap report: section "{x}" — no catalogue entry; added ad hoc.`). Only report; don't edit REFERENCE.md yourself — the user folds gaps back in. A new _slug_ is a real gap only when it names a missing **type**; a **subject** section (`plugins`, `themes`, `integrations`) is not — route its content into the type sections (nested if it needs grouping) and report that instead. If everything matched: `Gap report: no gaps.`
