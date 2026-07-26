---
title: 'Mirror shared content into each skill instead of linking'
description: 'A skill can be installed alone, so a link out of its folder resolves to nothing.'
status: 'accepted'
date: '2026-07-23'
---

# ADR-0003 — Mirror shared content into each skill instead of linking

## Context

Several skills need the same text: how to resolve `.tituskirch-skills.json`, and the author-authority rule. The instinct is to write it once and link to it.

That instinct is wrong here for a reason specific to what a skill is. A skill is **installable on its own** — `npx skills add` copies one folder, and `pnpm skills:link` symlinks one folder into `~/.claude/skills/`. A relative link out of that folder, to a sibling skill or to a file at the repo root, resolves to nothing on the installed copy. The reader is an agent, which will follow the path, find nothing, and continue without the rule.

## Decision

Whatever several skills need, **each one carries**. The canonical text lives once under `scripts/` and is mirrored by `pnpm skills:sync` into every skill that opts in by carrying the matching element — `<skills-config>` for the config contract, `<skills-authority>` for the authority rule — with `scripts/resolve-config.sh` copied into that skill's `templates/`. `pnpm skills:check` fails the moment a copy drifts.

Rejected: **linking to a shared file**, for the reason above. Rejected: **a runtime dependency between skills**, which would make an installed skill require a sibling it may not have.

Where content is genuinely a "see also", the rule is to **name the skill and drop the link** — `` `work-review` ``, not a path into its folder.

## Consequences

The repo contains many identical copies of the same block, which reads as duplication and is. It is mechanical duplication with a generator and a CI gate behind it, not maintained by hand — but a reader who edits a copy directly will have their change overwritten by the next sync, so the blocks say so.

Reaching for a cross-skill link becomes a signal rather than a convenience: it means the content belongs in a mirrored block. `test/isolation.test.ts` enforces that nothing a skill ships points out of its own folder.
