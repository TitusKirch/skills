---
title: 'Enforce the AGENTS.md mirror in the gate'
description: 'Make the byte-identical copy a test, because the only path some changes take has no other check.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0009 — Enforce the AGENTS.md mirror in the gate

## Context

[ADR-0002](0002-keep-agents-md-byte-identical.md) keeps `CLAUDE.md` and `AGENTS.md` as two real files, byte-identical, and names its own weakness in the same breath: the copy is a manual step, drift is invisible in review — one reflowed line is enough — and nothing failed when the two disagreed.

What makes that weakness bite here is the path a change takes. CI runs `on: pull_request` only, and the AI work loop is configured `branch:dev`, committing to the integration branch with no PR. On that path `pnpm verify` is the sole automated check between an edit and the release branch. An invariant enforced only by review is, on the path where drift is most likely, enforced by nothing.

## Decision

The mirror is a test — `test/agent-instructions.test.ts`, part of `pnpm test` and therefore of `pnpm verify`. It reads both files and asserts they are identical. No assertion message is passed, so Node prints the line diff; the remedy never varies and lives in the test name instead.

Rejected: **a pre-commit hook.** It runs only where husky is installed, `--no-verify` walks past it, and the repo's other guarantees — the schema, skill self-containment, the CI-gate match — all sit in `test/`. A guard belongs where a reader already looks for guards.

Rejected: **a CI step.** CI never sees the commits most at risk, so the check would be absent exactly where it is needed and present only where review already had a chance.

Rejected: **generating one file from the other.** ADR-0002 turned this down for a file whose whole content is prose, and a guard that _writes_ rather than _compares_ would swallow a hand edit to `AGENTS.md` instead of reporting it.

ADR-0002 stands unchanged. Two real files, no symlink, and a difference fixed by letting one file win wholesale — this decision adds the gate that record notes as missing.

## Consequences

Drift can no longer reach the release branch quietly; it turns the local gate red, on the one path that had no other check.

The cost is a step that now fails loudly: editing either file without copying it over the other breaks `pnpm verify` until the copy is made. That is the trade accepted here — a red test in the moment, instead of two agent instruction files that disagree and no way to notice.

ADR-0002's closing paragraph now describes the state at the time it was written, not the state today. The log is append-only, so it stays as it stands; this record is where a reader finds the rest of the story.
