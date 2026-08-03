---
title: 'Leave reasoning effort to the caller'
description: 'A frontmatter effort pin reaches a worker only through the unit skill, and the one override that outranks it is session-global — so the two loops keep effort as a caller setting, recommended in prose rather than encoded.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0027 — Leave reasoning effort to the caller

## Context

The two work loops want different reasoning effort. Implementing is agentic coding, where a weak pass is expensive — it costs a full review round, and past `work.review.maxRounds` the issue escalates to a human. Reviewing is judgement over a diff with little output, and holds up at a lower setting. Today the only way to give them different efforts is to run each loop in its own session and set each by hand: an operational convention no skill enforces, or even states.

Claude Code defines `effort` as a `SKILL.md` frontmatter field, and [ADR-0007](0007-permit-claude-code-frontmatter-extensions.md) already prices it in the **optimisation only** tier — a conformant client that ignores it loses tuning, not capability. The [extension matrix](../../skills/meta/validate-skills/REFERENCE.md#the-extension-matrix) already lists it, so this repo's own conformance gate would not call it malformed. The field is therefore **permitted**; whether it is **earned** here is what this record settles.

Two facts had to be established first, and only one of them is the one the question was framed around.

**On the queue skills, a pin reaches nothing that matters.** Claude Code documents `effort` as the effort level _when this skill is active_, overriding the session level ([frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)). The Agent tool takes a per-invocation `model` parameter and **no** `effort` parameter, and whether an agent spawned while a skill is active inherits that skill's effort is **not documented** either way. So `effort` on `work-implement-queue` governs the drain's own run — resolve the config, reconcile, order the queue, spawn, report — which is the part of a drain that needs it least, and it reaches the workers only through behaviour nobody has written down.

**On the unit skills it reaches exactly the right agent, by the documented route.** A worker _is_ an agent that invokes `work-implement` or `work-review`, so the field would be operative for precisely the run that does the work. The premise that a `work-*` skill cannot set what its workers run at holds for the two queues and is false for the two units — which leaves a real decision here rather than one the facts foreclose.

## Decision

**No skill here declares `effort`.** Reasoning effort stays the caller's, and the per-loop recommendation is stated in prose — the "document instead of encode" answer, taken knowing that the frontmatter route does work on the unit skills.

Three things decide it:

- **The two invocation paths cannot be told apart.** `work-implement` is invoked both by a drain and directly by a human (`/work-implement 42`), out of one file, and frontmatter overrides the session level unconditionally. There is no conditional form of the field, so a pin buys the unattended case by taking the attended one away — it overrides a human's own `/effort` on every direct invocation.
- **The only override that outranks a pin is session-global.** `CLAUDE_CODE_EFFORT_LEVEL` outranks frontmatter; `/effort`, `--effort` and settings do not — the client states the order outright: "the environment variable takes precedence over all other methods, then your configured level, then the model default. Frontmatter effort applies when that skill or subagent is active, overriding the session level but not the environment variable" ([Set the effort level](https://code.claude.com/docs/en/model-config#set-the-effort-level)). So a consumer who disagrees with either pin answers with one number for the whole session, which flattens the implement/review split the pin existed to create. The escape hatch destroys the feature, which makes a pin all-or-nothing for every consumer of a published skill.
- **Effort is priced by whoever pays for the run.** Everything a consuming repo tunes here lives in `.tituskirch-skills.json`; effort has no key there and should not get one, because it is a budget and model-availability decision belonging to the caller rather than a property of the repo. `cap` and `concurrency` are the precedent in the same shape — split because "how much the queue should shrink" and "what the machine can stand" are different questions — and effort is the third: what the budget can stand.

And what a pin would encode is an assertion, not a measurement. Nothing here has measured that implementing needs more effort than reviewing; it is inferred from what each loop does. Prose can say _recommended_ where frontmatter can only say _is_.

Rejected: **a named subagent definition** (`.claude/agents/*.md`, pointed at via `subagent_type`). It does pin effort per worker, but it is doubly Claude Code specific and makes a published skill depend on a file existing in the consuming repo — a dependency none of these skills has, and one no fallback covers when it is absent.

Rejected: **the Workflow tool**, which takes a per-agent `effort`. It is opt-in, absent from the queue skills' `allowed-tools`, and rebuilding the drain around it is a far larger change than the setting is worth.

## Consequences

`skills/README.md`'s statement that none of the thirteen further Claude Code extensions are used stays true, and `disallowed-tools` remains the only extension this repo publishes. This record therefore adds **no precedent** for the other twelve: it is a "no" on `effort` for these skills' own reasons, and ADR-0007's cost test still governs each remaining field on its own merits.

The recommendation lives in `work-implement`'s `REFERENCE.md`, with `work-review`'s pointing at it — one home, the convention [ADR-0025](0025-keep-the-work-loops-reference-whole.md) already keeps the shared work-loop mechanics under. **It enforces nothing, and that is the cost this record accepts:** a caller who sets neither loop's effort gets whatever session they started with, exactly as before.

What is bought instead is that the probe is not run twice. The reach finding — **queues no, units yes** — is the expensive part of this question and it is recorded whichever way a later decision goes. Should someone measure the split and want it enforced, the route is a pin on the two **unit** skills and never on the queues, and reopening the question means bringing that measurement rather than repeating the argument.
