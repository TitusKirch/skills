---
title: 'Lead a run report with its result'
description: 'Every skill whose run ends in a report opens it with a TL;DR, and the rule is a mirrored block rather than a call into the tldr skill, because the report belongs to the skill that produced it.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0026 — Lead a run report with its result

## Context

A run report is the longest thing these skills print and it is read once, in a terminal. Eight skills end in one, and a survey of what each opened with found the same shape everywhere:

| Skill                  | The report opened with                                                   |
| :--------------------- | :----------------------------------------------------------------------- |
| `prune-branches`       | _Deleted_ — the first of four groups                                     |
| `prune-comments`       | _Removed_ — the first of six                                             |
| `merge-deps`           | _Merged_ — the first of four                                             |
| `update-deps`          | a sentence on form, then _Moved_ — the first of five                     |
| `validate-skills`      | _Spec violations_ — with a per-skill pass/fail **Summary** last of seven |
| `release`              | version, tag, url and PRs as one undifferentiated list                   |
| `work-implement-queue` | a per-issue enumeration, counts scattered through the prose              |
| `work-review-queue`    | the same                                                                 |

So "no TL;DR" was the house default rather than a gap in the two prune skills, and `validate-skills` is the proof the need is real: it had already written the roll-up and put it at the **end**, where a reader reaches it after the twenty findings it was meant to frame.

`<skills-plan>` already binds what these reports may not do — nothing folded behind a control, length handled by shortening rather than hiding. It says nothing about where the result goes, so every skill answered that for itself.

## Decision

**The report opens with a `## TL;DR` carrying the counts, what the run acted on, and the decision being asked for — before the first group.** Anything the run could not establish is named there too, because it changes what the counts mean; a run that found nothing leads with that, naming the scope searched.

**The rule is a mirrored block, `scripts/tldr-block.md` → `<skills-tldr>`, not a call into the `tldr` skill.** Both were live candidates. `tldr` fixes the same `## TL;DR`-first frame and is meant to summarise work performed, and `issue` invoking `grilling` on its own initiative is precedent that a skill may drive another. It still does not fit: `tldr` summarises **on request**, owns its whole output, and sources it from the conversation and the repo's git state — while the material for a prune report's lead (which branches, on which side, held for which reason) exists only inside the run that produced it. A call would have to hand the summariser every fact it was to summarise, which is not summarising. So `tldr` keeps its scope untouched, and the block names it as the frame it shares.

**The roster is the eight skills above, and it is a strict subset of the plan block's.** The criterion is what a skill hands back **when its run ends** — an account of what happened — where the plan block's is anything a skill puts in front of a human. A skill leads with a result only where it closes by reporting one; a plan awaiting a yes already opens with what it proposes. `tldr` is the one deliberate absence that is not about the criterion: the frame is its entire product, already fixed in its own workflow, and mirroring the block there would leave one skill holding two statements of one rule.

## Consequences

A sixth mirrored block, on the mechanic ADR-0003 established and four blocks already use — one source, drift-checked by `pnpm skills:check`, roster asserted in `test/isolation.test.ts` against the tags on disk. That is the cost: another block to keep, and a second rule governing the same message the plan block governs.

Two rules on one message is the arrangement, not an accident. They bind opposite ends — what may be hidden in a report, and what it opens with — and folding the second into `plan-block.md` would have widened it to every plan and preview, where there is no result yet to lead with. `test/isolation.test.ts` asserts the containment instead, so a skill can never carry the lead rule without the render rule.

`validate-skills` keeps its Summary section; the lead states the counts, the summary states which skills they were. #131's `tldr` skill is untouched, and #157 — `update-deps` burying its package lists — is a separate symptom of the same reading, unaffected by this record.
