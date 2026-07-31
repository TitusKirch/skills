---
title: 'State when a decision earns an ADR'
description: 'A decision earns an ADR when it binds later work and its reasoning would otherwise be lost — reversal cost is a sufficient sign, never a gate, and size is a permission rather than a ceiling.'
status: 'accepted'
date: '2026-07-31'
---

# ADR-0020 — State when a decision earns an ADR

## Context

`write-docs` specified the ADR **artifact** exhaustively — section, file schema, frontmatter, required H2s, the decision log, the append-only lifecycle — and never stated the **threshold**. The routing matrix answered "which page type is this", never "is there a record to make here at all". Left implicit, the question gets re-answered every run, and drifts either way: every settled question becomes an ADR, or one gets written only when someone remembers the section exists. Append-only makes the first failure the expensive one — noise cannot be pruned once accepted.

`templates/adr-index.md` already carried the slot (`{One short paragraph — what earns an ADR here.}`), so the skill had not forgotten the threshold; it had **delegated** it, without saying what a good one looks like.

The contract was equally silent on **size**. Three required H2s, and no statement that any of them may be one sentence. The 19 records here average **609 words** (11,571 in total), and the trend is not flat: `0001`–`0014` run 243 to 658, while the five since — `0015` 813, `0016` 895, `0017` 2070, `0018` 1135, `0019` 854 — all sit above 810. None of them is padded, but mandatory-looking sections invite filling, and that cost is paid at the moment of writing.

## Decision

**The threshold is this log's own, and it has two halves that both have to hold: the decision constrains work that comes later, and its reasoning would otherwise be lost.** It was already written in `docs/99.adr/index.md` and proven across the existing records; it now lives in `write-docs` SKILL.md, next to the routing matrix, because it is consulted before routing, and it is the template's default paragraph rather than a blank slot.

**Reversal cost is a sufficient sign, never a necessary one.** Hard to reverse, surprising without context, and the result of a real trade-off — all three together mean "certainly write it". Adopting that triad as an AND-gate was rejected: measured against the existing log it fails most of it, always on "hard to reverse". ADR-0009 and ADR-0013 are guards a test edit could move; ADR-0006 says of itself that the trade was strictly bad. A skills repo produces mostly cheap-to-change conventions that are easy to break by accident — exactly what the reversal-cost gate excludes, and exactly what this log is for. As an AND-gate it would retroactively delegitimise roughly half a log that cannot be pruned.

**Size is a permission, not a ceiling:** an ADR can be a single paragraph, and a required section may be one sentence. No word count in either direction — nothing measured was padded, and append-only means an over-long record cannot be trimmed later anyway.

**`write-docs` offers an ADR proactively** once a decision clearly clears the threshold, in the same shape as its existing post-approval trigger. Borderline stays the human's call.

## Consequences

The gate now selects on _would the reasoning be lost_ rather than _would reversing this be expensive_, so cheap-to-change conventions keep earning records. That admits more decisions than the reversal-cost test would, and the size permission is what keeps the resulting log affordable to write.

A threshold stated in the skill is one a foreign repo inherits by default instead of inventing. It also gives #147 a bar to measure adopted ADRs against — records that would not clear it here should not be imported.

The one thing neither rule settles is the borderline case, deliberately: it is offered to a human rather than decided by a criterion that would have to be sharper than the evidence supports.
