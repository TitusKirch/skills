---
title: 'Give ADRs their own skill and a size budget'
description: 'The decision log moves from write-docs to a new write-adr skill, which admits architecture decisions only, aims for about 300 words per record and allows no amendments.'
status: 'accepted'
date: '2026-11-18'
---

# ADR-0041 — Give ADRs their own skill and a size budget

Partly supersedes [ADR-0021](/adr/0021-state-when-a-decision-earns-an-adr): its threshold stands, its rule that size is "a permission rather than a ceiling" does not.

## Context

`write-docs` owned both the docs pages and the decision log, and it fired proactively once every feature was approved. In a consuming repo run by an agent, that produced an ADR per feature: more than 500 records in two months, most of them feature specifications with rules, parameters, endpoints and rollout steps. With no size limit and dated amendments allowed, single records grew to thousands of words. The log stopped answering the one question it exists for, which is why the system is shaped the way it is.

## Decision

The decision log moves to a new `write-adr` skill, and `write-docs` only names it. `write-adr` admits a decision only when it is architectural, binds later work, and its reasoning would otherwise be lost. It lists what is not an ADR: product behaviour, parameters, implementation detail, rollout mechanics, and fixes to a decision that still stands. A record aims for about 300 words, and anything over 500 needs a reason stated in the plan. A record is a draft until it lands, and immutable afterwards. A changed decision supersedes, and no record is ever amended.

## Consequences

The log stays small enough to read, and feature knowledge lives on pages that can be edited. Logs already grown past the contract are not repaired by either skill. That cleanup is a deliberate migration and gets its own skill.
