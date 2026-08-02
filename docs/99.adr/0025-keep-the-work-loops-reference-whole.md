---
title: "Keep the work loop's reference whole"
description: 'A reference is shaped by which skill owns each mechanic and which reader cannot delegate, not by its size — so the work loop keeps one named entry point instead of a rules/ directory behind an index.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0025 — Keep the work loop's reference whole

## Context

`skills/work/work-implement/REFERENCE.md` is the largest single file any skill here can pull into context, and four skills name it: `work-implement`, `work-implement-queue`, `work-review` and `work-review-queue`. At 56,388 B it was proposed for a split — a `rules/` directory with `REFERENCE.md` reduced to an index, so a task loads the rules it needs and the entry point stays one named file.

The proposal set its own test — **worth doing only if the unconditional set is materially smaller than the whole** — and two supporting questions: whether an index plus a second read costs more turns than it saves tokens, and what becomes of the mirrored blocks that `scripts/gen-skills.ts` locates by their element.

Measuring every `##` section answered the first, and the answer was not the one the proposal expected. Of the 21.1 KB that looked conditional, **15.9 KB was not conditional but misfiled**: the single-flight lock, dependency ordering and the selection query are the drain's mechanics living in the worker's reference. Subtract them and the genuinely conditional remainder was 5.1 KB — which fails the proposal's own test, and at that size answers the second question too, since an index and a second read per pass cost more than 5 KB is worth.

## Decision

**Do not split the file.** One named entry point stays, which is what the four skills that name it already expect, and the mirrored-block question disappears with the split — no new path for the generator to locate a block through, and no new way for copies to drift.

**Ownership is the axis, not size.** A file looks monolithic when it hosts mechanics it does not own, and that is the defect worth fixing. [ADR-0020](0020-separate-installable-alone-from-runnable-alone.md) already settled the rule — a mirrored copy belongs where the mechanic is owned — and left the moves as follow-on work; those moves landed for `<skills-config>` and `<skills-worklock>`, which the two queue skills now read from their worker's reference rather than carrying.

**Hosting follows the reader that cannot delegate.** The dependency between a unit and its drain runs one way: the queue declares and checks the worker, so it may assume the worker's `REFERENCE`; the worker runs standalone (`/work-implement 42`) and declares no sibling, so it may assume nothing of the queue's. The selection query, dependency ordering and the lease rules are named by `work-implement`'s own `SKILL.md`, so re-filing them _to_ the queue is not available — it would leave the worker naming a file it cannot reach. They stay where the reader that cannot delegate can read them, and the drain names them there. That is what completes the re-file, not a further move.

Rejected: **a `rules/` directory behind an index** — the machinery is a directory, an index, a second read per pass and a new generator path, against a genuinely conditional remainder that does not pay for it.

Rejected: **deleting content to shrink the file** — [ADR-0014](0014-let-rationale-travel-with-the-skill.md) is why the rationale is there, and an agent that knows why a rule exists does not route around it.

Rejected: **a `REFERENCE.md` per queue skill** to hold the drain-owned sections — already rejected by ADR-0020 as the mechanical half of the question, and it moves prose into a skill whose siblings cannot read it.

## Consequences

The load figure the proposal measured stands and is worth carrying: one work-loop pass — the queue `SKILL.md`, the worker `SKILL.md` and this reference — was ~88 KB before the issue body, the diff or any source file entered context. Fixing ownership is what reduces it; splitting the worker's own rules is not.

**The measurement is what to re-run, not the conclusion.** The same section census on 2026-08-02 reads 145,466 B — 2.6× the figure this decision was measured on, four days later. Classified the same way: ~81.6 KB unconditional on a worker pass, ~39.9 KB drain-owned (the lock, queue state, dependency ordering, the parallel-batch mutex, the selection query), and ~22.6 KB genuinely conditional. The remainder that failed the test at 5.1 KB is now 22.6 KB, and **20.1 KB of it is the two tracker recipes** — Linear, and the `local` driver that did not exist when this was decided ([ADR-0023](0023-back-the-local-tracker-with-committed-files.md)) — which a repo on one tracker never reads.

That is a different axis from the one rejected here. A split by **tracker**, where each recipe is conditional by construction and a repo reads exactly one, is not the per-task `rules/` split this record turns down, and nothing above pre-decides it. What this record does settle is that size alone never reopens the question: whoever reopens it names which sections are conditional **and for whom**, and shows the unconditional set is materially smaller than the whole.
