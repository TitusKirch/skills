---
title: 'Renumber a migrated log once, and keep a protocol'
description: 'A prune-adrs migration ends by renumbering the log without gaps in one scripted pass, and a committed protocol maps every old id until every reviewer has signed the migration off.'
status: 'accepted'
date: '2026-11-24'
---

# ADR-0048 — Renumber a migrated log once, and keep a protocol

## Context

`write-adr` makes an id permanent: never reused, renumbered or gap-filled. A migration of a log grown to over 500 records leaves most of its ids as gaps, and the log that results reads as a sparse list whose numbers say nothing about its size. The ids were also never decision identifiers in any useful sense there — most of them named feature specs that the migration moves out.

## Decision

**A `prune-adrs` migration ends with one renumbering**, after its last batch: every record gets its rank as id, in every locale tree, and `rewrite-adr-refs.sh --renumber` rewrites every reference repo-wide in a single pass from the full old-to-new table, so no rewrite chains into another. Ids stay stable through every batch, because maps, citations and reviews name them.

**The script keeps a protocol**, `<log>/migration.tsv`: every applied map row and every renumbered id, with its batch and commit. It is never rewritten, and it is deleted by hand, in its own commit, only once every reviewer has confirmed the migration complete and correct. There are no redirects.

## Alternatives considered

- **Keep the gaps.** Every outside reference stays valid, but the migrated log keeps the numbering of the log it replaced.
- **Renumber per batch, or first.** Per batch, later maps mix old and new ids; first, the batches open new gaps.
- **Redirects instead of a protocol.** They serve one site and none of the commit messages, issues or other repositories that name an old id.

## Consequences

A commit message, a changelog or another repository naming an old id now means a different record. The protocol is the only way back while it exists, and after its deletion git history still holds it. `write-adr`'s id allocation counts history only from the renumbering commit on.
