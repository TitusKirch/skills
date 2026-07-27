---
title: 'State what the authority table guarantees'
description: 'The tier is declared and checked four ways, not derived — and saying so is what keeps the guarantee honest.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0013 — State what the authority table guarantees

## Context

[ADR-0004](0004-derive-author-authority-from-a-criterion.md) replaced a name list with a criterion, because a list states the outcome without the reason and therefore does not extend itself — `prune-comments` and `prune-branches` fell straight through the old one. That decision was right and stands.

Its closing claim was not. It reads:

> `test/isolation.test.ts` asserts the criterion rather than the membership

What that file holds is a nineteen-entry table mapping each skill to a tier plus a written justification. The `reads` and `reason` strings were inert — no assertion looked at them — so a new skill declared `tier: 'none'` with a plausible sentence and no tag passed every test while reading issue comments. The suite checked membership; the record said it checked the criterion.

The gap is not a defect in the table. It is that "does this skill act on text from an identifiable author?" is a judgement about prose, and a test cannot make it.

## Decision

**Say what is guaranteed, and add the strongest check that is actually available.**

Four properties, all enforced:

- **Exhaustive** — the table's keys equal the skills on disk, so a new skill cannot be added without being classified.
- **Justified** — the union type makes `reads` (carriers) or `reason` (non-carriers) mandatory, so a tier cannot be declared without stating why.
- **Consistent** — the declared tier matches the block tag the skill carries.
- **Not contradicted** — a skill declared `none` must not reach for authored text in its own prose, and one declared `full` must show the text it claims to read. The signal is a narrow pattern (`gh issue view … comments`, `list_comments`, a handoff document); a hit is evidence, a miss is only the absence of evidence.

Rejected: **deriving the tier outright** from that signal. It would replace a judgement a human made deliberately with a grep that is wrong in both directions — a skill that reads authored text through a path the pattern misses would be silently downgraded, which is the failure mode that matters.

Rejected: **leaving the claim as it stood.** A record that describes a guarantee the code does not give is worse than one that describes a weaker guarantee accurately, because the next author trusts it.

## Consequences

The classification stays a declaration, and adding a skill still means making a judgement and writing it down. That is the honest ceiling.

The derivation catches the plainly-wrong case and nothing subtler. Its pattern is a maintained list of read-shapes — the thing ADR-0004 argued against — but here it guards a declaration rather than being the classification, so a gap in it weakens a cross-check instead of exempting a skill.

ADR-0004's decision is unchanged; only its claim about what the test proves is superseded by this record.
