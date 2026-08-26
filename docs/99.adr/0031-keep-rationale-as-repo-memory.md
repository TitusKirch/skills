---
title: 'Keep rationale as repo memory'
description: 'Per-skill rationale moves out of every REFERENCE.md and into this log, after every behaviour-steering part of it has been folded into the mechanics as a positively phrased rule.'
status: 'accepted'
date: '2026-08-26'
---

# ADR-0031 — Keep rationale as repo memory

Supersedes [ADR-0014](0014-let-rationale-travel-with-the-skill.md).

## Context

[ADR-0014](0014-let-rationale-travel-with-the-skill.md) kept each skill's `## Decisions` section inside its own `REFERENCE.md`, on the grounds that "an agent that knows _why_ a rule exists is the one that does not route around it". That is a **bet on agent behaviour, and it was never measured**. Since it was written the sections have grown from six to seven and from 35 KB to **57.5 KB** — `update-deps` 19.8 KB, `merge-deps` 10.6 KB, `release` 8.1 KB, `prune-branches` 7.3 KB, `prune-comments` 4.9 KB, `handoff` 4.0 KB, `tldr` 2.7 KB.

The counter-argument ADR-0014 did not consider is a genre one. Those sections are written as **Context / Decision / Rejected / Consequences** — the form of a record kept **for a human**, complete with the alternatives that lost. An agent reading "Rejected: X" learns nothing about its own behaviour that a positively phrased rule in the mechanics would not say better and shorter. Reading the seven sections against the mechanics beside them bears that out: almost every behaviour-steering claim in them was already stated as a rule elsewhere in the same file, and the section repeated it with the rejected alternatives attached.

ADR-0014's objection to `docs/99.adr/` was **mechanical**, not editorial: `docs/` is not installed, so a skill pointing at `docs/99.adr/0007-…` resolves to nothing on the installed copy. **That objection stops applying once the rationale is repo memory rather than agent context** — an installed copy does not need the record, so nothing points at it and nothing resolves to nothing.

Prior art outside: [`mattpocock/skills`](https://github.com/mattpocock/skills) ships rationale on **none** of its three install routes, keeping it in `docs/`, `.agents/adr/` and `.out-of-scope/` at the repo root. Its position is that rationale addresses a human.

## Decision

**A skill's rationale lives in this log, not in the skill.** Each `## Decisions` section becomes one record here, and the skill folder ships mechanics only.

**The move has a hard precondition: every behaviour-steering part is folded into the mechanics first, positively phrased.** Anything that would change what an agent does has to survive the move by **becoming a rule** — the reason Go's `major` is not performed (it lives in the module path, so moving to it edits every importing file) belongs _in the rule_, not in a log beside it. Only the record of what was decided and what was rejected leaves. In practice the fold is small, because the mechanics were already carrying most of it; what it removes is the last handful of `see [Decisions](#decisions)` pointers, each of which marked a place where a rule stated _what_ and deferred _why_ to a section a reader had to jump to.

**No skill points at its record.** A pointer would resolve to nothing on an installed copy — ADR-0014's objection, still correct — and it is not needed, because after the fold the installed copy holds every statement that steers behaviour.

**One record per skill, not one per bullet.** These sections settle a skill's shape across a dozen linked questions in one pass, and splitting them into sixty records would bury a log this size to say nothing new. [ADR-0021](0021-state-when-a-decision-earns-an-adr.md) already makes size a permission rather than a ceiling, and the through-line of each pass is what the record is titled for.

**`docs/index.md`'s boundary moves with this, and says so.** It read "this tree is only what spans more than one skill", which a per-skill record makes false. The tree now holds two things — what spans more than one skill, and the record of what was decided, a single skill's own shape included.

## Consequences

Seven `REFERENCE.md` files lose 57.5 KB between them, none of it from the unconditional load path (`SKILL.md`) and all of it from the file an agent reads when it needs the mechanics. That is the measure this move was filed under, and it is a side effect rather than the reason: the reason is who the text is written for.

This log grows by seven records in one change, which is the largest single append it has taken. They are relocations, not new decisions, and they are dated to the day they moved rather than to the day each was settled — the original dates are not recoverable per bullet, and pretending otherwise would put a false precision in the log.

**The bet ADR-0014 made is still unmeasured, and this record does not settle it either.** It relocates the text on a genre argument, not on evidence that an agent behaves the same without it. The honest check is a per-skill `evals/` run with and without the rationale in the file, which stays available and is now cheaper to construct, since the two states are a file boundary apart.

**`work-implement`'s `DESIGN.md` is deliberately not moved.** ADR-0014 already named the two-genre inconsistency — one skill keeps its rationale in a file of its own, the rest kept it as a closing section — and this change removes the closing sections without touching the file. That leaves 50 KB of rationale still shipping inside one skill, and the gap is stated rather than quietly closed: it is a **separate** decision, since `DESIGN.md` is a whole document with its own cross-references from the skill's mechanics, not a section that lifts out. Whoever reopens it has this record's argument to reuse and this record's precondition to satisfy.

A later architecture review that flags the log's size finds this record, exactly as ADR-0014 intended to be found — the difference being that what it now defends is a log of records in the place the house keeps records, rather than the same genre embedded in seven mechanics documents.
