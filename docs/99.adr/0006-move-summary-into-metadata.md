---
title: 'Move summary into metadata.summary'
description: 'The standard offers a defined home for client-specific fields; a top-level invention had none.'
status: 'accepted'
date: '2026-07-25'
---

# ADR-0006 — Move summary into metadata.summary

## Context

Every skill carried a top-level `summary` field — this repo's own invention, read only by `pnpm skills:sync` when building the README tables. No agent ever sees it.

The Agent Skills specification defines six frontmatter fields and offers `metadata` for anything else: "Clients can use this to store additional properties not defined by the Agent Skills spec." A house field at the top level therefore had a conforming home it was not using — and the standard's reference validator rejects unknown top-level keys outright, so all nineteen skills failed validation on a field that does nothing at runtime.

## Decision

`summary` moves to **`metadata.summary`**. `scripts/gen-skills.ts` reads it from there.

Rejected: **keeping it at the top level as a documented house deviation.** The trade was strictly bad — the field buys nothing at runtime, so a portability cost for it is a cost without a benefit. That distinguishes it from ADR-0007, where the extensions at least do something.

## Consequences

The frontmatter now uses only standard fields, apart from the deliberate `disallowed-tools` on the two queue skills. Nineteen skills validate where none did.

The nesting is slightly less convenient to read and to grep. That is the whole cost, and it buys conformance in every client that enforces the spec.
