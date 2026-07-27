---
title: 'Mirror the check-command contract'
description: 'One source for how a skill reaches for verify, detects it when absent, and installs the tree it runs in.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0011 — Mirror the check-command contract

## Context

Five skills run the repo's own gate — `update-deps` after updating, `prune-comments` after its removals, `work-implement` before pushing, `merge-deps` against a dependency PR's head, `work-review` against a pushed head. All five answer the same question, and the root `verify` key is the repo's one answer to it.

What was shared was the **reading**: [ADR-0003](0003-mirror-shared-content-into-each-skill.md) mirrors the resolver into every skill, byte-identical and drift-checked. What was not shared was everything that follows it.

Detection — what to do when a repo declares no `verify` — was written three times in three shapes: "the repo's detected check/test/build", "detected — tests, lint, build", and "the repo's detected check (`pnpm check`, `composer lint`, whatever it declares)". None defines the order, and the third names `pnpm check` two sentences after explaining that detecting `pnpm check` where the repo says `pnpm verify` runs the wrong gate.

The second gap was worse because it was invisible. `merge-deps` runs its command in a throwaway worktree checked out from a PR head — a tree with **no dependencies installed** — and left the install to the repo, documented as an override a repo "needing a full install" would write. This repo, the skills' own, did not write it for two months. The command still ran, resolved against globally installed tooling, and reported green without ever installing the lockfile the PR existed to change. A default whose own author misses it is not a documentation problem.

## Decision

The check-command contract becomes the **third mirrored block**, alongside the config contract and the author-authority rule, sourced from `scripts/verify-block.md` and drift-checked by `pnpm skills:check`. Marker syntax follows [ADR-0010](0010-choose-marker-syntax-by-its-reader.md): a named element, because the body is instruction a model must act on.

Two variants, keyed by **the tree the command runs in** — the same criterion-not-roster shape [ADR-0004](0004-derive-author-authority-from-a-criterion.md) uses, so a skill added later is classified by what it does:

- **`<skills-verify>`** — the command runs in the working tree, already installed.
- **`<skills-verify-isolated>`** — the command runs against someone else's head, where nothing is installed. It carries the base body plus an install cascade keyed to the head's own lockfile.

**Installing is the skill's job, not the repo's.** `mergeDeps.verify` stays, but only for a genuinely different command — an audit, a narrower suite. Prepending an install there is now called out as wrong in both the schema and the skill.

Rejected: **leaving detection to each skill**, the status quo, which is three descriptions of one mechanic and drifts by construction.

Rejected: **one central file the skills link to**, which every skill's self-containment forbids — an installed skill has no repo root to reach.

Rejected: **keeping the install a repo responsibility.** The evidence against it is this repo: the author of the skill, configuring the skill's own repo, got it wrong and could not see it, because the failure mode is a false green rather than an error.

## Consequences

Seven generated artifacts instead of six, and one more roster to keep honest — `test/isolation.test.ts` fails if a skill carries a variant it is not listed for, or is listed and lost its block.

A new skill that runs checks now inherits the detection order, the package-manager mapping, the install cascade, and the rule that an undetectable gate is reported as unrun rather than passed. That last one is the part most likely to have been re-derived wrongly.

The cost is prompt length: five skills carry a block they previously stated in one line. That is the standing trade of [ADR-0003](0003-mirror-shared-content-into-each-skill.md) — the alternative is a link that resolves to nothing once the skill is installed.

The generator's per-contract mirror loop is now generic. The third copy is where the contracts would have started disagreeing about what counts as drift.
