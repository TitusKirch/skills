---
title: 'Separate installable alone from runnable alone'
description: 'A skill that declares a required sibling and checks for it before any state change may assume that sibling’s REFERENCE.'
status: 'accepted'
date: '2026-07-31'
---

# ADR-0020 — Separate installable alone from runnable alone

## Context

[ADR-0003](0003-mirror-shared-content-into-each-skill.md) mirrors shared content into every skill because a skill is installable alone — `npx skills add` copies one folder, `pnpm skills:link` symlinks one folder — so a link out of that folder resolves to nothing on the installed copy. It closes with a second rejection:

> Rejected: **a runtime dependency between skills**, which would make an installed skill require a sibling it may not have.

Two skills have exactly that dependency, and say so in their own text. `work-implement-queue` states that `work-implement` is required, that the loop implements nothing itself, and that a missing worker stops the run **before the lock is taken** — before any issue is leased, any label moved, any state changed. `work-review-queue` says the same of `work-review`, and both repeat it as a guardrail. This is not an oversight but [ADR-0001](0001-split-the-work-loop-in-two.md)'s two-loop split working as designed: the queue skill is deliberately thin and the worker skill does the work.

The two claims are less a contradiction than a gap. ADR-0003 rejected a runtime dependency **introduced in order to avoid duplication** — a dependency minted to dedupe. The queue skills' dependency is functional and predates the question: they were never able to do the job themselves, and removing it would mean duplicating a worker skill wholesale. ADR-0003 simply does not describe a skill that installs fine and cannot **run** without a named sibling, so its rule reaches them by default.

What that default costs is measurable. Each queue `SKILL.md` runs to roughly 24 KB, of which about 15.4 KB — 63% — is mirrored blocks: `<skills-worklock>` 9,253 B, `<skills-config>` 3,339 B, `<skills-plan>` 1,694 B, `<skills-authority-reduced>` 1,077 B. These are the two largest `SKILL.md` files in the repo and the only two of the nineteen with no `REFERENCE.md`, so their blocks sit in the **unconditional** load path where every other skill keeps its blocks in the conditional one. Net of the blocks both are below the median: they are not written long, they carry the mirrors unconditionally.

And the blocks buy nothing in the one case they exist for. Installed without its worker, a queue skill loads the config contract, the authority rule, the plan rule and the whole lock protocol — then stops before the lock, because the worker is missing.

The split this implies is already written into the files. `work-implement`'s `REFERENCE.md` is titled _"work-implement / work-implement-queue — Reference"_ and is already the shared reference of the pair; the queue's step 1 delegates config resolution to it by name, and its Reference section says the lifecycle, selection query, lease rules and branch strategies live with the unit. What was never carried through to the mirrored blocks is that same construction.

## Decision

**The test is "runnable alone", not "installable alone".** Installable alone still holds for every skill without exception: nothing a skill ships may point out of its own folder. What ADR-0003 did not distinguish is the skill that installs perfectly and cannot run without a sibling it names — and for that skill, the mirrored copies are not what makes it work.

**A declared, checked dependency is legitimate.** A skill may require a named sibling when it (a) names that sibling in its own text, and (b) verifies the sibling is present **before any state change** — before a lock, a lease, a label, a commit. Both queue skills already meet this, checking before the lock precisely so a missing call is never discovered mid-drain with issues already leased.

**Such a skill may assume its sibling's `REFERENCE`.** It stops carrying its own copies of what the sibling's reference already states and names that reference as the place the rules live — **named, never linked**, which is the form ADR-0003 prescribes ("name the skill and drop the link"). This permission is narrower than "anything the sibling ships" and wider than today's "nothing": it is scoped to a sibling that is declared and checked, and there is no execution path where the blocks are needed without the sibling present, because the check comes first.

**A mirrored copy belongs where the mechanic is owned.** The dependent may read the owner's copy, which makes ownership the question to ask of each block rather than size — the single-flight lock is the **queue's** mechanic (it acquires the lock in step 1 and releases it in the final step), the config contract is delegated to the worker in the queue's own step 1. Which copies move as a result is follow-on work; this record is what licenses it.

**[ADR-0003](0003-mirror-shared-content-into-each-skill.md) stands as written, narrowed rather than superseded.** Its rejection was of a dependency created to avoid duplication, and that still holds; it is unchanged for the seventeen skills that declare no sibling.

**`test/isolation.test.ts` keeps enforcing that nothing a skill ships points out of its folder.** Assuming a sibling's content at runtime is not the same as linking to it, and only the latter is what that test exists to prevent.

**Rejected: removing the dependency** by making the queue skills able to implement or review on their own. That undoes ADR-0001's two-loop split and duplicates the worker skill wholesale — a far larger duplication than the blocks.

**Rejected: treating this as a size problem** and moving the blocks into a new `REFERENCE.md` in each queue skill. That is the mechanical half and saves little on its own: both skills resolve config and take the lock in step 1, so the reference would be read on nearly every run. It only becomes worthwhile once this question is settled.

**Rejected: superseding ADR-0003.** Mirroring remains the rule for shared content, and the isolation test remains its gate. This record fills a case it never described.

## Consequences

Siblings installed separately can drift in block version — the queue skill's copy of the rules is now the worker's copy, and nothing checks the pair at install time. `pnpm skills:sync` keeps them identical at the source, and in practice the pair is installed together; the risk is accepted rather than mitigated.

A new skill that wants to lean on a sibling has to earn it, and the classification is forced when the skill is added rather than after a run stops halfway: declare the sibling, and check it before the first state change. A skill that only turns out to need a sibling mid-run does not qualify.

The two queue skills lose the property that their `SKILL.md` is self-sufficient prose. An agent reading one of them without the worker installed will find rules named and not restated — which is the same experience it already has for the lifecycle, the selection query and the branch strategies, all of which those files have delegated by name since ADR-0001.
