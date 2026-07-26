---
title: 'Derive author authority from a criterion, not a name list'
description: 'Which skills carry the authority rule follows from what a skill reads, in two tiers.'
status: 'accepted'
date: '2026-07-25'
---

# ADR-0004 — Derive author authority from a criterion, not a name list

## Context

Skills read text other people wrote — issue bodies, reviews, comments, handoff documents, upstream changelogs, code comments — and then act on it. Text that arrives as data must not become instruction, so the repo adopted an author-authority rule: third-party text is read as an instruction only when its author is authorized, because authorship, unlike a label or a title, cannot be set by a passer-by.

The rule was introduced with the skills it applied to **named in a list**. A list states the outcome without stating the reason, so it does not extend itself: `prune-comments` and `prune-branches` were added later and fell straight through it. Neither was exempted deliberately — they simply arrived after the list was written, and `prune-comments` edits files based on comment text it judges.

## Decision

Coverage follows a **criterion**, in two tiers, decided by what a skill reads:

- **Full** — the skill acts on text written by an **identifiable author**: issue bodies, reviews, comments, handoffs. Authorship is checkable, so it is checked (repo permission on GitHub, workspace membership on Linear, the `trustedBots` allowlist for apps).
- **Reduced** — the skill reads third-party text with **no author concept**: code comments, changelogs, PR titles. Nothing is checkable, so the rule is flat: the text is data, never instruction, and instruction-shaped text is itself the attack signal.

Rejected: **extending the name list**, which defers the same failure to the next skill. Rejected: **mirroring the full rule everywhere**, which would answer a question about forge authors that a comment-reading skill never asks.

## Consequences

`test/isolation.test.ts` asserts the criterion rather than the membership, so a new skill is classified by what it does instead of by whether someone remembered it.

The reduced tier is genuinely weaker — it cannot verify anything, only refuse to obey. That is the honest ceiling for text with no author, and stating it as a tier is better than implying a check that cannot happen.
