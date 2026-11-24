---
title: 'Keep one instruction file, AGENTS.md'
description: 'Claude Code now reads AGENTS.md itself, so the repo drops CLAUDE.md and the byte-identical mirror with its gate test.'
status: 'accepted'
date: '2026-11-24'
---

# ADR-0049 — Keep one instruction file, AGENTS.md

Supersedes [ADR-0002](/adr/0002-keep-agents-md-byte-identical) and [ADR-0009](/adr/0009-enforce-the-agents-md-mirror-in-the-gate).

## Context

ADR-0002 kept `CLAUDE.md` and `AGENTS.md` as two byte-identical files because Claude Code read only the first and every other agent tool only the second; ADR-0009 made the copy a gate test, since drift was invisible in review. Claude Code has since learned to read `AGENTS.md` directly (v2.1.277), with one precedence rule: a `CLAUDE.md` in the working directory or above makes it read that file and ignore `AGENTS.md`.

## Decision

**`AGENTS.md` is the only instruction file, and the repo keeps no `CLAUDE.md`.** The mirror test goes with the mirror, because there is nothing left to drift.

## Alternatives considered

- **A `CLAUDE.md` holding only `@AGENTS.md`.** It also reaches Claude Code releases before v2.1.277 and the sessions that read only `CLAUDE.md` before v2.1.281, but it keeps a second file whose only job is a workaround the current client no longer needs.
- **Keep the mirror.** Every instruction stays written twice for a reader that no longer needs the second copy.

## Consequences

A Claude Code older than v2.1.277, or a session that reads only `CLAUDE.md`, sees no project instructions in this repo. Adding a `CLAUDE.md` later — even a short one — silently hides `AGENTS.md` from Claude Code, so `AGENTS.md` says so where it describes itself. Skills are unaffected: Claude Code still loads them only from `.claude/skills/` paths, so `skills:link` keeps linking into both destinations ([ADR-0016](/adr/0016-link-into-every-client-skills-path)).
