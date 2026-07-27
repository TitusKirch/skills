---
title: 'Architecture decisions'
description: 'The decision log — every architecture decision recorded for this project.'
---

# Architecture decisions

A decision earns an ADR when it constrains work that comes later and its reasoning would otherwise be lost: a choice between real alternatives, a convention every skill has to follow, a trade-off that looks like a mistake until the reason is known. Records are append-only — a reversed decision is written as a new ADR that supersedes the old one, never as an edit to it.

| ADR                                                           | Decision                                                    | Status   | Date       |
| :------------------------------------------------------------ | :---------------------------------------------------------- | :------- | :--------- |
| [ADR-0001](0001-split-the-work-loop-in-two.md)                | Split the AI work loop into implement and review            | accepted | 2026-07-22 |
| [ADR-0002](0002-keep-agents-md-byte-identical.md)             | Keep CLAUDE.md and AGENTS.md byte-identical                 | accepted | 2026-07-23 |
| [ADR-0003](0003-mirror-shared-content-into-each-skill.md)     | Mirror shared content into each skill instead of linking    | accepted | 2026-07-23 |
| [ADR-0004](0004-derive-author-authority-from-a-criterion.md)  | Derive author authority from a criterion, not a name list   | accepted | 2026-07-25 |
| [ADR-0005](0005-keep-allowed-tools-as-pre-approval.md)        | Keep allowed-tools, as pre-approval rather than restriction | accepted | 2026-07-25 |
| [ADR-0006](0006-move-summary-into-metadata.md)                | Move summary into metadata.summary                          | accepted | 2026-07-25 |
| [ADR-0007](0007-permit-claude-code-frontmatter-extensions.md) | Permit Claude Code frontmatter extensions, at a stated cost | accepted | 2026-07-25 |
| [ADR-0008](0008-keep-eval-fixtures-out-of-the-package.md)     | Keep eval fixtures in the skill folder, out of the package  | accepted | 2026-07-25 |
| [ADR-0009](0009-enforce-the-agents-md-mirror-in-the-gate.md)  | Enforce the AGENTS.md mirror in the gate                    | accepted | 2026-07-27 |
