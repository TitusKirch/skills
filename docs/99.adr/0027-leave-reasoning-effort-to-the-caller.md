---
title: 'Leave reasoning effort to the caller'
description: 'A frontmatter effort pin reaches a worker only through the unit skill, and the one override that outranks it is session-global — so the two loops keep effort as a caller setting, recommended in prose rather than encoded.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0027 — Leave reasoning effort to the caller

## Context

The two work loops want different reasoning effort. Implementing is agentic coding, where a weak pass is expensive — it costs a full review round, and past `work.review.maxRounds` the issue escalates to a human. Reviewing is judgement over a diff with little output, and holds up at a lower setting. Today the only way to give them different efforts is to run each loop in its own session and set each by hand: an operational convention no skill enforces, or even states.

Claude Code defines `effort` as a `SKILL.md` frontmatter field, and [ADR-0007](/adr/0007-permit-claude-code-frontmatter-extensions) already prices it in the **optimisation only** tier — a conformant client that ignores it loses tuning, not capability. The [extension matrix](https://github.com/TitusKirch/skills/blob/main/skills/meta/validate-skills/REFERENCE.md#the-extension-matrix) already lists it, so this repo's own conformance gate would not call it malformed. The field is therefore **permitted**; whether it is **earned** here is what this record settles.

Where a pin would reach, and so where any later pin belongs, is [ADR-0046](/adr/0046-pin-effort-on-the-unit-skills-never-the-queues).

## Decision

**No skill here declares `effort`.** Reasoning effort stays the caller's, and the per-loop recommendation is stated in prose — the "document instead of encode" answer, taken knowing that the frontmatter route does work on the unit skills.

Three things decide it:

- **The two invocation paths cannot be told apart.** `work-implement` is invoked both by a drain and directly by a human (`/work-implement 42`), out of one file, and frontmatter overrides the session level unconditionally. There is no conditional form of the field, so a pin buys the unattended case by taking the attended one away — it overrides a human's own `/effort` on every direct invocation.
- **The only override that outranks a pin is session-global.** `CLAUDE_CODE_EFFORT_LEVEL` outranks frontmatter; `/effort`, `--effort` and settings do not ([`work-implement`'s REFERENCE](https://github.com/TitusKirch/skills/blob/main/skills/work/work-implement/REFERENCE.md#worker-effort) quotes the client's own statement of the order). So a consumer who disagrees with either pin answers with one number for the whole session, which flattens the implement/review split the pin existed to create. The escape hatch destroys the feature, which makes a pin all-or-nothing for every consumer of a published skill.
- **Effort is priced by whoever pays for the run.** Everything a consuming repo tunes here lives in `.tituskirch-skills.json`; effort has no key there and should not get one, because it is a budget and model-availability decision belonging to the caller rather than a property of the repo. `cap` and `concurrency` are the precedent in the same shape — split because "how much the queue should shrink" and "what the machine can stand" are different questions — and effort is the third: what the budget can stand.

And what a pin would encode is an assertion, not a measurement. Nothing here has measured that implementing needs more effort than reviewing; it is inferred from what each loop does. Prose can say _recommended_ where frontmatter can only say _is_.

Rejected: **a named subagent definition** (`.claude/agents/*.md`, pointed at via `subagent_type`). It does pin effort per worker, but it is doubly Claude Code specific and makes a published skill depend on a file existing in the consuming repo — a dependency none of these skills has, and one no fallback covers when it is absent.

Rejected: **the Workflow tool**, which takes a per-agent `effort`. It is opt-in, absent from the queue skills' `allowed-tools`, and rebuilding the drain around it is a far larger change than the setting is worth.

## Consequences

Which extensions this repo publishes is stated in [`skills/README.md`](https://github.com/TitusKirch/skills/blob/main/skills/README.md#field-notes). This record adds **no precedent**: it is a "no" on `effort` for these skills' own reasons, and ADR-0007's cost test still governs each remaining field on its own merits.

The recommendation lives in `work-implement`'s `REFERENCE.md`, with `work-review`'s pointing at it — one home, the convention [ADR-0025](/adr/0025-keep-the-work-loops-reference-whole) already keeps the shared work-loop mechanics under. **It enforces nothing, and that is the cost this record accepts:** a caller who sets neither loop's effort gets whatever session they started with, exactly as before.
