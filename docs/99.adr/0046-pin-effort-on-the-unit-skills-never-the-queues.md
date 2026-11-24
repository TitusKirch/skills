---
title: 'Put any effort pin on the unit skills, never the queues'
description: 'A frontmatter effort pin on a queue skill governs only the drain, while one on a unit skill reaches the worker that does the work — so any pin belongs on the units.'
status: 'accepted'
date: '2026-11-23'
---

# ADR-0046 — Put any effort pin on the unit skills, never the queues

## Context

[ADR-0027](/adr/0027-leave-reasoning-effort-to-the-caller) leaves reasoning effort to the caller. Whether a `SKILL.md` `effort` pin could set what the work-loop workers run at had to be established first, and the answer differs by skill.

## Decision

**On the queue skills, a pin reaches nothing that matters.** Claude Code documents `effort` as the effort level _when this skill is active_, overriding the session level ([frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)). The Agent tool takes a per-invocation `model` parameter and **no** `effort` parameter, and whether an agent spawned while a skill is active inherits that skill's effort is **not documented** either way. So `effort` on `work-implement-queue` governs the drain's own run, which is the part of a drain that needs it least, and it reaches the workers only through behaviour nobody has written down.

**On the unit skills it reaches exactly the right agent, by the documented route.** A worker _is_ an agent that invokes `work-implement` or `work-review`, so the field would be operative for precisely the run that does the work. The premise that a `work-*` skill cannot set what its workers run at holds for the two queues and is false for the two units — which leaves a real decision here rather than one the facts foreclose.

## Consequences

The reach finding — **queues no, units yes** — is the expensive part of this question and it is recorded whichever way a later decision goes. Should someone measure the split and want it enforced, the route is a pin on the two **unit** skills and never on the queues, and reopening the question means bringing that measurement rather than repeating the argument.
