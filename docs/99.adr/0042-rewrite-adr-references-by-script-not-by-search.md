---
title: 'Rewrite ADR references by script, not by search'
description: 'prune-adrs migrates an overgrown decision log in reviewed batches; a shipped POSIX script, covered by test/, applies the confirmed map — the second runtime file this repo ships.'
status: 'accepted'
date: '2026-11-18'
---

# ADR-0042 — Rewrite ADR references by script, not by search

## Context

[ADR-0041](/adr/0041-give-adrs-their-own-skill-and-a-size-budget) stops a decision log from growing past its contract, but it repairs nothing already grown. The log that prompted it held over 500 records cited more than 11,000 times across thousands of files. Removing or merging records there means rewriting every citation, and an agent's search-and-replace at that scale cannot prove it found them all. This repo shipped no runtime code beyond the config resolver.

## Decision

A manually invoked `prune-adrs` skill migrates such a log. Agent and human classify each record against `write-adr`'s rules into a tab-separated map, batch by batch. A shipped POSIX script applies the confirmed map: it rewrites references, removes records and index rows, and exits non-zero while any reference to a removed id remains. The script is the second runtime file this repo ships and is covered by `test/`. The migration breaks append-only once and ends by recording that it did.

## Consequences

The same map always produces the same tree, and completeness is proven by a check rather than asserted. The repo now carries a second script to keep portable across GNU and BSD tools.
