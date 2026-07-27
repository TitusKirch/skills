---
title: 'Let rationale travel with the skill'
description: 'A skill keeps its own Decisions section, because the ADR log it would otherwise point at does not get installed.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0014 — Let rationale travel with the skill

## Context

Six skills end their `REFERENCE.md` with a `## Decisions` section — 35 KB in total, 4–7 KB each — recording what was settled about that skill and why: why `prune-branches` uses four categories instead of one flat list of "stale" branches, why `merge-deps` selects on a PR's author, why `update-deps` never commits.

That is ADR genre in a mechanics document, and `docs/99.adr/` is the house home for it. An architecture review reads the six sections as duplication of a structure that exists — this repo's own review said exactly that — and proposes moving them.

The move does not work. `docs/` is not installed: `npx skills add` copies one skill folder, `pnpm skills:link` symlinks one skill folder. A skill pointing at `docs/99.adr/0007-…` resolves to nothing on the installed copy, which is the same failure [ADR-0003](0003-mirror-shared-content-into-each-skill.md) settled for the config contract. Mirroring is the answer there — but rationale differs from a contract in a way that matters: a contract is text the skill must **follow**, and mirroring keeps every copy identical. Rationale is text the agent should **understand**, and it is specific to one skill, so there is nothing to share.

## Decision

**A skill's own rationale stays in the skill, in its `REFERENCE.md`.** It is neither moved to `docs/99.adr/` nor mirrored from a shared source.

The reason it earns its place: an agent that knows _why_ a rule exists is the one that does not route around it when the situation is slightly off the script. `prune-branches` reads that its four categories exist because a flat "stale" list collapses distinctions a human needs — and then does not invent a fifth. The cost is paid only on a read of `REFERENCE.md`, not on every invocation, because `SKILL.md` is what loads unconditionally.

What belongs in `docs/99.adr/` instead is what spans **more than one** skill — the two-loop split, the mirroring rule, the marker convention. That boundary already exists in `docs/index.md`; this record states which side per-skill rationale falls on.

Rejected: **moving the sections to `docs/99.adr/`**, which strips the reasoning from every installed copy. Rejected: **deleting them** to save the 35 KB, which buys context back at the price of an agent that follows rules without knowing what they protect.

## Consequences

The six sections stay, and the next architecture review will flag them again. This record is the answer to that flag; a reviewer who finds it does not need to re-derive the reasoning.

`REFERENCE.md` therefore holds two genres — mechanics and rationale — which the [layout](../../skills/README.md) describes as separate files (`REFERENCE.md`, `DESIGN.md`). Only `work-implement` has a `DESIGN.md`; the other six keep rationale as a closing section. That inconsistency is real and deliberately left: splitting a file is a structural refactor touching mirrored-block boundaries, and it buys nothing an agent can use.

The size cost is stated rather than hidden: 35 KB of rationale across six skills, none of it in the unconditional load path.
