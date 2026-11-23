---
name: write-adr
metadata:
  summary: Writes and supersedes architecture decision records in docs/99.adr/ — short, rare, append-only.
description: Writes and supersedes architecture decision records (ADRs) in a project's `docs/99.adr/` decision log — the TitusKirch ADR format, Nygard's Context / Decision / Consequences, append-only. Gates every record on a threshold first and turns away what is not an architecture decision — feature behaviour, rules, limits, rollout steps and implementation detail go to an editable docs page instead. Keeps each record short (aim ~300 words, over 500 only with a stated reason), never amends a landed one, and supersedes instead. Always previews a plan, writing only after confirmation. Use when the user wants to write, record or supersede an ADR or an architecture decision, asks whether a decision earns one, or says things like "write an ADR", "record this decision", "supersede ADR 12", "ADR schreiben", "Entscheidung festhalten". Offer it proactively only for an architectural change, never once per feature.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(grep:*)
  - Bash(git rev-parse:*)
---

# write-adr

The TitusKirch **decision log** — `docs/99.adr/`, one architecture decision per file, append-only. This skill decides whether a decision earns a record and writes it; the record's contract is in [REFERENCE.md](REFERENCE.md), the skeletons in [`templates/`](templates/). Every other docs page is `write-docs`'. Migrating a log that grew past this contract, or importing one written elsewhere, is `prune-adrs`'.

**Its main job is to say no.** A log is read to learn why the system is shaped the way it is. Fifty short records answer that; five hundred long ones bury it. "If every decision is architectural, no decision is architectural."

**Opted out?** The log is part of the docs tree. If the repo config sets `docs` to `false`, **stop immediately** (including the proactive offer) and say docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## When a decision earns an ADR

**All three must hold:** the decision is **architectural**, it **binds later work**, and its **reasoning would otherwise be lost**. Architectural means it shapes the system, not a feature of it — structure and boundaries, which part owns which state, interfaces and integration, dependencies with lock-in, non-functional characteristics, a cross-cutting convention, a deliberate deviation from the obvious path. The tells: it is **costly to reverse**, and it would still matter if the feature that prompted it were removed.

| Not an ADR                                                                                | Goes to                                                        |
| :---------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Product behaviour and rules** — what a feature does, game or business rules, user flows | a concept or guide page, through `write-docs`                  |
| **Parameters** — durations, limits, thresholds, prices, sizes                             | the page describing the feature, or the code that holds them   |
| **Implementation detail** — endpoints, migrations, class and table names, data formats    | the code and its own reference output                          |
| **Rollout mechanics of one change** — a staged switch, a two-release dance, a backfill    | the pull request; a `conventions` page if it is a general rule |
| **A fix to how a decision was implemented**, the decision itself unchanged                | nothing — the commit says it                                   |
| **Refining a decision that has not landed yet**                                           | an edit to its draft                                           |

**Done is not a trigger.** A finished feature becomes pages, never an ADR by default. When one feature after another arrives with its own record, say so in the plan. **Borderline is the human's call** — name the row it may belong to and let them answer; never write "just in case", the direction with no way back. **Offer a record proactively** only when a change clearly clears the bar, and never write one unasked.

## Size and lifecycle

**Aim for about 300 words of body; over 500 needs a reason, stated in the plan.** Count before presenting and show the count. Over budget, move borrowed material to a page first — parameters, behaviour, detail — and never cut the reasoning, which is what the record is for. Past about 800 words it is almost always two decisions: propose two records. Full rule and its sources: [REFERENCE.md](REFERENCE.md#size).

**A record is a draft until it lands on the integration branch**, and is edited freely until then. It is written as `status: accepted` from the start: the merge is the acceptance, and a change that never merges takes its draft with it. Once landed it is **immutable**: an overturned or materially revised decision gets a new record that **supersedes** it — **partly**, with a pointer both ways, where the rest still stands — and **nothing is ever appended** — no `## Amendments`, no addendum. What was learned while a decision stands goes on the concept page. Typo and link fixes are the only edits. [REFERENCE.md](REFERENCE.md#lifecycle--append-only).

## Workflow

1. **Resolve the config** (`docs.*`) and read `docs/99.adr/index.md` fresh.
2. **Ask the threshold.** No → name where the material belongs, hand page writing to `write-docs` (absent → name the page and section), and write nothing here.
3. **Find the record it touches** — `grep` the log. Overturning a landed record is a **supersede**; refining an unlanded draft is an edit to it, never a second record.
4. **Draft** from [`templates/adr.md`](templates/adr.md): next free id, imperative title, required H2s, the [content test](REFERENCE.md#what-the-body-may-hold), the word count.
5. **Plan** — the record, its count, the `index.md` row, and on a supersede the old record's `status`, `date` and pointer — on a partial one, the pointer alone. **Confirm → apply**, in one change.
6. **Locales** — the record lives in the default-locale tree; `write-docs`' locale sweep renders translations. Name that in the report.

**Index job** — on "check the log": fix missing or stale `index.md` rows and broken links, propose a missing `title`/`description`, and report everything else ([index rules](REFERENCE.md#index-rules)).

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

## Guardrails

- **The threshold before the template**; an answer of no writes nothing into `99.adr/`.
- **Short by default** — ~300 words, over 500 only with a stated reason.
- **Append-only after landing** — supersede; never amend, rewrite, renumber or delete.
- **Plan/preview first; apply only after confirmation.** Respect plan-only / dry-run.
- **Only `docs/99.adr/`** — other pages are `write-docs`', named and never written here.
- **Attribution-free and secret-free**; **no cache** — the log is live state.

## Reference

**Open [REFERENCE.md](REFERENCE.md) before every record** — a landed record is permanent, so id, naming, sections, content and supersession have to be right on entry. Skeletons: [`templates/adr.md`](templates/adr.md), and [`templates/adr-index.md`](templates/adr-index.md) for a log that does not exist yet.
