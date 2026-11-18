---
name: write-adr
metadata:
  summary: Writes, supersedes and imports architecture decision records in docs/99.adr/ — short, rare, append-only.
description: Writes, supersedes and imports architecture decision records (ADRs) in a project's `docs/99.adr/` decision log — the TitusKirch ADR format, Nygard's Context / Decision / Consequences, append-only. Gates every record on a threshold first and turns away what is not an architecture decision — feature behaviour, rules, limits, rollout steps and implementation detail go to an editable docs page instead. Keeps each record short (aim ~300 words, over 500 only with a stated reason), never amends an accepted one, and supersedes instead. Always previews a plan, writing only after confirmation. Use when the user wants to write, record, supersede or import an ADR or an architecture decision, asks whether a decision earns one, or says things like "write an ADR", "record this decision", "supersede ADR 12", "import our old ADRs", "ADR schreiben", "Entscheidung festhalten". Offer it proactively only for an architectural change, never once per feature.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(grep:*)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
---

# write-adr

The TitusKirch **decision log** — `docs/99.adr/`, one architecture decision per file, append-only. This skill owns the log: whether a decision earns a record, what the record looks like, how a decision is overturned, and how a log written elsewhere is brought in. The record's contract lives in [REFERENCE.md](REFERENCE.md), the skeletons in [`templates/`](templates/). Every other page of the `docs/` tree belongs to `write-docs`.

**A log is only read if it stays small.** A reader comes to the log to learn why the system is shaped the way it is. Fifty short records answer that. Five hundred long ones bury it, because nobody can tell which records carry the shape and which carry the details of a feature. So this skill's main job is to say **no**: most decisions a change contains belong on a page that can be edited when they change, and the few that remain fit in a few hundred words.

**Opted out?** The log is part of the docs tree, so this skill reads the `docs` section of the config. If the repo config sets `docs` to `false`, **stop immediately** (including the proactive offer) and tell the user docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Jobs

| Intent                                                   | Job           |
| :------------------------------------------------------- | :------------ |
| "record this decision" / a decision just surfaced        | **write**     |
| a decision overturns one already in the log              | **supersede** |
| ADRs sit in another format or folder (`docs/adr/`, …)    | **import**    |
| "check the log" / the `index.md` table looks out of step | **index**     |

**Always: threshold → plan → confirm → apply.** The threshold comes first in every job, import included, because an append-only log cannot be pruned afterwards.

## When a decision earns an ADR

**The threshold.** A decision earns an ADR when it is **architectural**, **binds work that comes later**, and **its reasoning would otherwise be lost**. All three have to hold.

Architectural means it shapes the system rather than a feature of it: where a boundary runs, which part owns which state, how parts integrate, a technology that brings lock-in, a cross-cutting convention every part has to follow, or a deliberate deviation from the obvious path. The usual tell is that the decision would still matter if the feature that prompted it were removed.

**What is not an ADR**, however much it binds and however well it is argued:

| Not an ADR                                                                                | Goes to                                                        |
| :---------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Product behaviour and rules** — what a feature does, game or business rules, user flows | a concept or guide page, through `write-docs`                  |
| **Parameters** — durations, limits, thresholds, prices, sizes                             | the page describing the feature, or the code that holds them   |
| **Implementation detail** — endpoints, migrations, class and table names, data formats    | the code and its own reference output                          |
| **Rollout mechanics of one change** — a staged switch, a two-release dance, a backfill    | the pull request; a `conventions` page if it is a general rule |
| **A fix to how a decision was implemented**, when the decision itself still stands        | nothing — the commit says it                                   |
| **Refining a decision that has not yet landed**                                           | an edit to its draft ([lifecycle](#lifecycle))                 |

**Done is not a trigger.** A finished feature is documented as pages, never as an ADR by default. When one feature after another arrives with its own record, the threshold has stopped being applied: say so in the plan whenever most recent feature changes in the log's history came with an ADR.

**Borderline is the human's call.** Name it in the plan with the row it may belong to, and let them answer. Never resolve it by writing the record "just in case" — that is the direction with no way back.

**Offer an ADR proactively** only when a change clearly clears the threshold — same shape as any write: plan → confirm → apply, never unasked.

## Size

**Aim for about 300 words; over 500 needs a reason, stated in the plan.** Count the body, frontmatter excluded, before presenting the plan, and show the count. Each required section may be a single sentence, and the whole record may be one paragraph.

**Length comes from borrowed material.** Over the budget, look first for what fails the threshold table above — parameters, behaviour, implementation detail — and move it to a page the record links to. What remains past 500 is a decision with genuinely many forces or alternatives, and the plan says which. A record is never cut by dropping the reasoning; reasoning is the one thing it exists for. Full rule: [REFERENCE.md](REFERENCE.md#size).

## Lifecycle

**A record is a draft until it lands on the integration branch.** While the change that adds it is still unmerged, the record is edited freely — that is where a decision gets refined. Once it has landed it is **immutable**:

- **A decision overturned or materially revised → a new ADR that supersedes the old one.** The old record keeps its prose; only its `status`, `date` and a `Superseded by` pointer change.
- **Never an amendment.** An accepted record never grows: no `## Amendments`, no dated addendum, no appended section. What was learned while the decision still stands goes on the concept page that explains the subject today, which can be edited when it moves. A record that already carries amendments keeps them; the log gains no new ones.
- **Typo and link fixes** are the only edits to a landed record.

Mechanics: [REFERENCE.md](REFERENCE.md#lifecycle--append-only).

## Write / supersede

1. **Resolve the config** (`docs.*`) and read `docs/99.adr/index.md` fresh, never from memory.
2. **Ask the threshold.** Fails → name where the material belongs (the table above), hand page writing to `write-docs`, and write nothing here. `write-docs` absent → say which page and section it would go in, and stop.
3. **Look for the record it touches.** `grep` the log for the subject. A decision overturning a landed record is a **supersede**. One refining a record still in this change's draft is an **edit to that draft**, not a second record.
4. **Draft** from [`templates/adr.md`](templates/adr.md): the next free id, an imperative title, the required H2s, then the [content test](REFERENCE.md#what-the-body-may-hold). Count the words.
5. **Plan** — the record, its word count, the `index.md` row, and on a supersede the old record's three changes. Then **confirm → apply**, all of it in one change.
6. **Locales** — the default-locale tree holds the record. Where `docs.locales` is set, `write-docs`' locale sweep renders translations of it. Name that in the report and write no translation here.

## Import

A dedicated decision directory in another format (`docs/adr/`, `docs/decisions/`, …) is brought into the log **one file at a time, through the same threshold**. What clears it is moved, renamed and re-homed under the required H2s. What holds a decision plus material the content test rejects is split. What is not a decision is routed to `write-docs` as a page, or reported and left alone. All of it is one proposal, applied only on confirmation, sentences moved and never rewritten. Detection, the four outcomes, the `date` derivation and the split: [REFERENCE.md](REFERENCE.md#foreign-adrs--a-decision-log-written-elsewhere).

## Index

`index.md` is the decision log's table, one row per record in id order. Fix a missing or stale row and a broken link. **Never** renumber a record, close an id gap, rename a record, or touch an accepted body or its `status` — report those instead ([REFERENCE.md](REFERENCE.md#index-rules)).

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

- **The threshold before the template.** No record is drafted before the threshold is answered, and an answer of no writes nothing into `99.adr/`.
- **Short by default.** Aim ~300 words, over 500 only with a reason stated in the plan; borrowed material moves to a page.
- **Append-only after landing.** Supersede, never amend, never rewrite, never renumber, never delete.
- **Plan/preview first; apply only after confirmation.** Respect plan-only / dry-run.
- **Only `docs/99.adr/`.** Pages elsewhere are `write-docs`', named and never written from here — except the page half of a confirmed import split, which lands in the same change.
- **Attribution-free and secret-free** — no agent self-naming, no `Generated with`/🤖 line; scan, warn, exclude.
- **No cache** — the log is live state, always read fresh.

## Reference

- **Open it before writing, superseding or importing a record, every time.** A landed record is permanent, so the id, the naming, the sections, what the body may hold and the supersession rule have to be right on entry: [REFERENCE.md](REFERENCE.md).
- **Copy the skeleton** for a record: [`templates/adr.md`](templates/adr.md); for a log that does not exist yet: [`templates/adr-index.md`](templates/adr-index.md).
