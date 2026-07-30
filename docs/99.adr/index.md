---
title: 'Architecture decisions'
description: 'The decision log — every architecture decision recorded for this project.'
---

# Architecture decisions

A decision earns an ADR when it constrains work that comes later and its reasoning would otherwise be lost: a choice between real alternatives, a convention every skill has to follow, a trade-off that looks like a mistake until the reason is known. Records are append-only — a reversed decision is written as a new ADR that supersedes the old one, never as an edit to it.

| ADR                                                                 | Decision                                                    | Status   | Date       |
| :------------------------------------------------------------------ | :---------------------------------------------------------- | :------- | :--------- |
| [ADR-0001](0001-split-the-work-loop-in-two.md)                      | Split the AI work loop into implement and review            | accepted | 2026-07-22 |
| [ADR-0002](0002-keep-agents-md-byte-identical.md)                   | Keep CLAUDE.md and AGENTS.md byte-identical                 | accepted | 2026-07-23 |
| [ADR-0003](0003-mirror-shared-content-into-each-skill.md)           | Mirror shared content into each skill instead of linking    | accepted | 2026-07-23 |
| [ADR-0004](0004-derive-author-authority-from-a-criterion.md)        | Derive author authority from a criterion, not a name list   | accepted | 2026-07-25 |
| [ADR-0005](0005-keep-allowed-tools-as-pre-approval.md)              | Keep allowed-tools, as pre-approval rather than restriction | accepted | 2026-07-25 |
| [ADR-0006](0006-move-summary-into-metadata.md)                      | Move summary into metadata.summary                          | accepted | 2026-07-25 |
| [ADR-0007](0007-permit-claude-code-frontmatter-extensions.md)       | Permit Claude Code frontmatter extensions, at a stated cost | accepted | 2026-07-25 |
| [ADR-0008](0008-keep-eval-fixtures-out-of-the-package.md)           | Keep eval fixtures in the skill folder, out of the package  | accepted | 2026-07-25 |
| [ADR-0009](0009-enforce-the-agents-md-mirror-in-the-gate.md)        | Enforce the AGENTS.md mirror in the gate                    | accepted | 2026-07-27 |
| [ADR-0010](0010-choose-marker-syntax-by-its-reader.md)              | Choose marker syntax by its reader                          | accepted | 2026-07-27 |
| [ADR-0011](0011-mirror-the-check-command-contract.md)               | Mirror the check-command contract                           | accepted | 2026-07-27 |
| [ADR-0012](0012-let-the-review-establish-green.md)                  | Let the review establish green                              | accepted | 2026-07-27 |
| [ADR-0013](0013-state-what-the-authority-table-guarantees.md)       | State what the authority table guarantees                   | accepted | 2026-07-27 |
| [ADR-0014](0014-let-rationale-travel-with-the-skill.md)             | Let rationale travel with the skill                         | accepted | 2026-07-27 |
| [ADR-0015](0015-tier-an-extension-by-the-clients-that-define-it.md) | Tier an extension by the clients that define it             | accepted | 2026-07-29 |
| [ADR-0016](0016-link-into-every-client-skills-path.md)              | Link into every client skills path, always                  | accepted | 2026-07-29 |
| [ADR-0017](0017-make-a-blanket-bash-grant-a-named-exception.md)     | Make a blanket Bash grant a named exception                 | accepted | 2026-07-29 |
| [ADR-0018](0018-split-ai-accepted-from-shipped.md)                  | Split AI-accepted from shipped                              | accepted | 2026-07-30 |
