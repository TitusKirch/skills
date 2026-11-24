---
title: "Keep a skill's rationale in its own design file"
description: 'Per-skill rationale leaves the decision log for a DESIGN.md in the skill folder, which nothing in the skill points at; the log keeps decisions that shape the repo.'
status: 'accepted'
date: '2026-11-23'
---

# ADR-0044 — Keep a skill's rationale in its own design file

Supersedes [ADR-0031](/adr/0031-keep-rationale-as-repo-memory).

## Context

[ADR-0031](/adr/0031-keep-rationale-as-repo-memory) moved each skill's `## Decisions` section out of its `REFERENCE.md` and into this log, one record per skill, on the argument that rationale addresses a human and an installed copy does not need it. The genre argument held. The destination did not: [ADR-0041](/adr/0041-give-adrs-their-own-skill-and-a-size-budget) admits only decisions that shape the system, and a record of how one skill settled its own defaults shapes that skill alone. The seven relocated records were also among the longest in the log, one past 3,000 words, and each kept growing with the skill it described, which is a living page wearing a record's id.

## Decision

**A skill's own rationale lives in a `DESIGN.md` inside its folder**, the file `work-implement` already keeps. The seven records move there whole, through `prune-adrs`.

ADR-0031's precondition stays: every part that steers behaviour is a rule in the skill's mechanics first, and `DESIGN.md` holds only what was decided and what lost. **Nothing in the skill points at it**, so an agent running the skill never loads it, and it links nothing outside its own folder, so it reads correctly on an installed copy.

**The log keeps what shapes the repo** — a decision that binds more than one skill, or the way skills are built.

## Consequences

The log loses its largest records and its rule about what belongs in it becomes true again. Every skill now has one place for its rationale, the same place in each, and `work-implement`'s `DESIGN.md` stops being the exception.

An installed skill now carries its rationale on disk. It costs bytes, not context, since nothing reads it unprompted.

A `DESIGN.md` is a page, not a record: it is edited as the skill changes, and the history of a reversed choice is its git log, not a superseded entry.

## Alternatives considered

**Keep the records in the log.** It leaves seven records that fail the log's own threshold, and they would keep growing.

**Move them to `docs/` pages.** `docs/` is not installed, and a page per skill outside the skill is the split ADR-0031 had to argue around.
