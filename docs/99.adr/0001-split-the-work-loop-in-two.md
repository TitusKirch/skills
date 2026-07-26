---
title: 'Split the AI work loop into implement and review'
description: 'Two independent loops that communicate only through the issue label, so neither reviews its own work.'
status: 'accepted'
date: '2026-07-22'
---

# ADR-0001 — Split the AI work loop into implement and review

## Context

A single agent that implements a change and then judges it is judging its own reasoning. It has the whole implementation in context — every assumption it made while writing the code is still loaded, and re-reading them produces agreement rather than scrutiny. The failure is not laziness; it is that the reviewer and the author share a mind.

Running the review in a subagent from the same session does not fix this: the parent decides what to hand over, and what it considers unimportant never reaches the reviewer.

## Decision

Work runs as **two independent loops**. `work-implement` builds and pushes; `work-review` judges the result as a structurally separate agent that reads the issue and the pushed diff from scratch. Nothing passes between them in memory — the issue's `ai:` label is the entire handover.

Rejected: **one skill with a review step**, which keeps author and reviewer in one context. Rejected: **a review subagent spawned by the implementer**, which lets the author curate the reviewer's inputs.

The label-only handover is what makes the two loops processes rather than phases: each has its own single-flight lock, a crashed run resumes instead of restarting, and both can drain at the same time.

## Consequences

Review costs a second full context — the reviewer re-reads what the implementer already knew. That is the price of the property being bought.

The label vocabulary becomes load-bearing. Seven states now carry meaning that four skills must agree on, and a relabel by hand mid-flight can strand an issue. The lifecycle is documented once, in `docs/1.concepts/2.ai-work-lifecycle.md`, because no single skill owns it.

Detailed mechanics — the state machine, leasing, the round cap, escalation — live in `skills/work/work-implement/DESIGN.md` and the two skills' own `REFERENCE.md` files, which travel with the installed skills. This record covers only why the split exists.
