---
title: 'Keep CLAUDE.md and AGENTS.md byte-identical'
description: 'Two real files rather than a symlink, because not every agent tool resolves one.'
status: 'accepted'
date: '2026-07-23'
---

# ADR-0002 — Keep CLAUDE.md and AGENTS.md byte-identical

## Context

Claude Code reads `CLAUDE.md`. Vendor-neutral agent tools — Codex, OpenCode, Cursor, Copilot, and whatever follows them — read `AGENTS.md`. The same instructions have to reach both, and the repo cannot know which tool opens it next.

## Decision

Both files exist as **two real files, kept byte-identical**. After editing either, copy it over the other:

```bash
cp CLAUDE.md AGENTS.md   # or the reverse, whichever was just edited
```

Rejected: **a symlink**, which is the obvious answer and fails quietly — not every tool follows one, and some checkouts (Windows without developer mode, some CI archive steps) do not materialise it as a link at all. A tool that reads a symlink as a text file finds a path string.

Rejected: **generating one from the other** in the sync step, which would put a third artifact in play for a file whose entire content is prose.

## Consequences

The two can drift, and drift is invisible in review — one reflowed line is enough. `diff CLAUDE.md AGENTS.md` must print nothing, and a difference is treated as a defect fixed by letting one file win wholesale, never by merging them.

The copy is a manual step with no gate behind it. That is the accepted weakness of this decision: nothing today fails when the two disagree.
