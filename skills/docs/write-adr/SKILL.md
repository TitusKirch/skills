---
name: write-adr
metadata:
  summary: Writes and supersedes architecture decision records in docs/99.adr/ — short, rare, append-only.
description: Writes one new architecture decision record (ADR) in docs/99.adr/, or supersedes one, in the TitusKirch format — short, append-only, previewed before writing — and does the log's small upkeep, such as a missing index row, a broken link or a typo. For migrating a whole existing log in batches, use prune-adrs; for documenting how a feature behaves, use write-docs. Turns away what is not an architecture decision and names the docs page it belongs on instead. Use when the user wants to write, record or supersede an ADR, asks whether a decision earns one, or says things like "write an ADR", "record this decision", "supersede ADR 12", "ADR schreiben", "Entscheidung festhalten". Offer it proactively only for an architectural change, never once per feature.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(grep:*)
  - Bash(git rev-parse:*)
  - Bash(git log:*)
  - Bash(ls:*)
  - Bash(tail:*)
  - Bash(expr:*)
---

# write-adr

The TitusKirch **decision log** — `docs/99.adr/`, one architecture decision per file, append-only. This skill decides whether a decision earns a record and writes it; the record's contract is in [REFERENCE.md](REFERENCE.md), the skeletons in [`templates/`](templates/). Every other docs page is `write-docs`'. Migrating a log that grew past this contract, or importing one written elsewhere, is `prune-adrs`'.

**Its main job is to say no.** A log is read to learn why the system is shaped the way it is. Fifty short records answer that; five hundred long ones bury it. "If every decision is architectural, no decision is architectural."

**Opted out?** The log is part of the docs tree. If the repo config sets `docs` to `false`, **stop immediately** (including the proactive offer) and say docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## When a decision earns an ADR

**All three must hold:** the decision is **architectural**, it **binds later work**, and its **reasoning would otherwise be lost**. Architectural means it shapes the system, not a feature of it — structure and boundaries, which part owns which state, interfaces and integration, dependencies with lock-in, non-functional characteristics, a cross-cutting convention, a deliberate deviation from the obvious path. The tells: it is **costly to reverse**, and it would still matter if the feature that prompted it were removed.

| Not an ADR                                                                                               | Goes to                                                        |
| :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Product behaviour and rules** — what a feature does, game or business rules, user flows                | a concept or guide page, through `write-docs`                  |
| **Parameters** — durations, limits, thresholds, prices, sizes                                            | the page describing the feature, or the code that holds them   |
| **Implementation detail** — enumerating endpoints, fields and formats; migrations, class and table names | the code and its own reference output                          |
| **Rollout mechanics of one change** — a staged switch, a two-release dance, a backfill                   | the pull request; a `conventions` page if it is a general rule |
| **A fix to how a decision was implemented**, the decision itself unchanged                               | nothing — the commit says it                                   |
| **Refining a decision that has not landed yet**                                                          | an edit to its draft                                           |

**A public contract is the exception to that row.** Deciding a contract's compatibility or ownership — who owns a long-lived event format, what its consumers may rely on — is architecture and earns a record even when one feature triggered it; listing its fields does not.

**Done is not a trigger.** A finished feature becomes pages, never an ADR by default. When one feature after another arrives with its own record, say so in the plan. **Borderline is the human's call** — name the row it may belong to and let them answer; never write "just in case", the direction with no way back. **Offer a record proactively** only when a change clearly clears the bar, and never write one unasked.

## Size and lifecycle

**Aim for about 300 words of body; over 500 needs a reason, stated in the plan.** Count before presenting and show the count. Over budget, move borrowed material to a page first — parameters, behaviour, detail — and never cut the reasoning, which is what the record is for. Past about 800 words it is almost always two decisions: propose two records. Full rule and its sources: [REFERENCE.md](REFERENCE.md#size).

**A record is a draft until it lands on the integration branch**, and is edited freely until then. It is written as `status: accepted` from the start: the merge is the acceptance, and a change that never merges takes its draft with it. Once landed it is **immutable**: an overturned or materially revised decision gets a new record that **supersedes** it — **partly**, with a pointer both ways, where the rest still stands — and **nothing is ever appended** — no `## Amendments`, no addendum. What was learned while a decision stands goes on the concept page. Typo and link fixes and the [status transitions](REFERENCE.md#status-transitions) are the only edits. [REFERENCE.md](REFERENCE.md#lifecycle--append-only).

## Workflow

1. **Resolve the config** (`docs.*`) and read `docs/99.adr/index.md` fresh.
2. **Ask the threshold.** No → name where the material belongs, hand page writing to `write-docs` (absent → name the page and section), and write nothing here.
3. **Find the record it touches** — `grep` the log. Overturning a landed record is a **supersede**; refining an unlanded draft is an edit to it, never a second record.
4. **Draft** from [`templates/adr.md`](templates/adr.md): next id by the [allocation rule](REFERENCE.md#allocating-an-id) — never just the live log's highest plus one — imperative title, required H2s, the [content test](REFERENCE.md#what-the-body-may-hold), the word count.
5. **Plan** — the record, its count, the `index.md` row, and on a supersede the old record's `status`, `date` and pointer — on a partial one, the pointer alone. **Confirm → apply**, in one change.
6. **Locales** — the record lives in the default-locale tree; `write-docs`' locale sweep renders translations. Name that in the report.

**Index job** — on "check the log": fix missing or stale `index.md` rows and broken links, propose a missing `title`/`description`, and report everything else ([index rules](REFERENCE.md#index-rules)).

<skills-plan>

## Presenting the plan

Whatever this skill puts in front of a human to decide on — a plan, a preview, a candidate list, a
findings report — is read **once, in a terminal**, so **every part of it renders on arrival**.

- **Never fold it behind a control.** A terminal cannot open `<details>`/`<summary>`, a tab or a
  "show more": only the summary line prints, and the human confirms a plan whose body never
  reached them.
- **Shorten instead of hiding.** Show every item that needs a decision, each with a visible id and
  its effect. Group the rest by something the reader already thinks in (kind, verdict, ecosystem)
  with a count and a reason, and name the command that shows them in full.
- **This binds the message, not the files it writes.** A `<details>` block in a README, an issue,
  a pull request or a docs page renders in a browser and is fine there.

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
