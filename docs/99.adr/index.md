---
title: 'Architecture decisions'
description: 'The decision log — every architecture decision recorded for this project.'
---

A decision earns an ADR when it is architectural, constrains work that comes later, and its reasoning would otherwise be lost: a choice between real alternatives, a convention every skill has to follow, a trade-off that looks like a mistake until the reason is known. Feature behaviour, parameters and rollout steps are not decisions this log records. Records aim for about 300 words and are append-only — a reversed or materially revised decision is written as a new ADR that supersedes the old one, never as an edit or an amendment to it. Amendments written before [ADR-0041](/adr/0041-give-adrs-their-own-skill-and-a-size-budget) were moved out by the migration [ADR-0042](/adr/0042-rewrite-adr-references-by-script-not-by-search) introduced; no new ones are added.

| ADR                                                                             | Decision                                                    | Status     | Date       |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------- | :--------- | :--------- |
| [ADR-0001](/adr/0001-split-the-work-loop-in-two)                                | Split the AI work loop into implement and review            | accepted   | 2026-07-22 |
| [ADR-0002](/adr/0002-keep-agents-md-byte-identical)                             | Keep CLAUDE.md and AGENTS.md byte-identical                 | accepted   | 2026-07-23 |
| [ADR-0003](/adr/0003-mirror-shared-content-into-each-skill)                     | Mirror shared content into each skill instead of linking    | accepted   | 2026-07-23 |
| [ADR-0004](/adr/0004-derive-author-authority-from-a-criterion)                  | Derive author authority from a criterion, not a name list   | accepted   | 2026-07-25 |
| [ADR-0005](/adr/0005-keep-allowed-tools-as-pre-approval)                        | Keep allowed-tools, as pre-approval rather than restriction | accepted   | 2026-07-25 |
| [ADR-0006](/adr/0006-move-summary-into-metadata)                                | Move summary into metadata.summary                          | accepted   | 2026-07-25 |
| [ADR-0007](/adr/0007-permit-claude-code-frontmatter-extensions)                 | Permit Claude Code frontmatter extensions, at a stated cost | accepted   | 2026-07-25 |
| [ADR-0008](/adr/0008-keep-eval-fixtures-out-of-the-package)                     | Keep eval fixtures in the skill folder, out of the package  | accepted   | 2026-07-25 |
| [ADR-0009](/adr/0009-enforce-the-agents-md-mirror-in-the-gate)                  | Enforce the AGENTS.md mirror in the gate                    | accepted   | 2026-07-27 |
| [ADR-0010](/adr/0010-choose-marker-syntax-by-its-reader)                        | Choose marker syntax by its reader                          | accepted   | 2026-07-27 |
| [ADR-0011](/adr/0011-mirror-the-check-command-contract)                         | Mirror the check-command contract                           | accepted   | 2026-07-27 |
| [ADR-0012](/adr/0012-let-the-review-establish-green)                            | Let the review establish green                              | accepted   | 2026-07-27 |
| [ADR-0013](/adr/0013-state-what-the-authority-table-guarantees)                 | State what the authority table guarantees                   | accepted   | 2026-07-27 |
| [ADR-0014](/adr/0014-let-rationale-travel-with-the-skill)                       | Let rationale travel with the skill                         | superseded | 2026-08-26 |
| [ADR-0015](/adr/0015-tier-an-extension-by-the-clients-that-define-it)           | Tier an extension by the clients that define it             | accepted   | 2026-07-29 |
| [ADR-0016](/adr/0016-link-into-every-client-skills-path)                        | Link into every client skills path, always                  | accepted   | 2026-07-29 |
| [ADR-0017](/adr/0017-make-a-blanket-bash-grant-a-named-exception)               | Make a blanket Bash grant a named exception                 | accepted   | 2026-07-29 |
| [ADR-0018](/adr/0018-split-ai-accepted-from-shipped)                            | Split AI-accepted from shipped                              | accepted   | 2026-07-30 |
| [ADR-0019](/adr/0019-render-every-plan-where-it-is-read)                        | Render every plan where it is read                          | accepted   | 2026-07-30 |
| [ADR-0020](/adr/0020-separate-installable-alone-from-runnable-alone)            | Separate installable alone from runnable alone              | accepted   | 2026-07-31 |
| [ADR-0021](/adr/0021-state-when-a-decision-earns-an-adr)                        | State when a decision earns an ADR                          | accepted   | 2026-07-31 |
| [ADR-0022](/adr/0022-permit-a-thin-shape-for-alias-style-skills)                | Permit a thin shape for alias-style skills                  | accepted   | 2026-07-31 |
| [ADR-0023](/adr/0023-back-the-local-tracker-with-committed-files)               | Back the local tracker with committed issue files           | accepted   | 2026-07-31 |
| [ADR-0024](/adr/0024-settle-a-body-comment-conflict-by-rule)                    | Settle a body–comment conflict by rule                      | accepted   | 2026-08-02 |
| [ADR-0025](/adr/0025-keep-the-work-loops-reference-whole)                       | Keep the work loop's reference whole                        | accepted   | 2026-08-02 |
| [ADR-0026](/adr/0026-lead-a-run-report-with-its-result)                         | Lead a run report with its result                           | accepted   | 2026-08-02 |
| [ADR-0027](/adr/0027-leave-reasoning-effort-to-the-caller)                      | Leave reasoning effort to the caller                        | accepted   | 2026-08-02 |
| [ADR-0028](/adr/0028-dock-gitlab-and-resolve-the-host-per-repo)                 | Dock GitLab on both axes, and resolve the host per repo     | accepted   | 2026-08-02 |
| [ADR-0029](/adr/0029-reproduce-the-author-guarantee-from-a-configured-identity) | Reproduce the author guarantee from a configured identity   | accepted   | 2026-08-03 |
| [ADR-0030](/adr/0030-gate-ci-on-the-draft-state)                                | Gate CI on the draft state                                  | accepted   | 2026-08-03 |
| [ADR-0031](/adr/0031-keep-rationale-as-repo-memory)                             | Keep rationale as repo memory                               | superseded | 2026-11-23 |
| [ADR-0039](/adr/0039-choose-playwright-for-browser-capture)                     | Choose Playwright for browser capture                       | accepted   | 2026-10-12 |
| [ADR-0040](/adr/0040-lock-the-issue-and-the-tree-not-the-loop)                  | Lock the issue and the tree, not the loop                   | accepted   | 2026-11-18 |
| [ADR-0041](/adr/0041-give-adrs-their-own-skill-and-a-size-budget)               | Give ADRs their own skill and a size budget                 | accepted   | 2026-11-18 |
| [ADR-0042](/adr/0042-rewrite-adr-references-by-script-not-by-search)            | Rewrite ADR references by script, not by search             | accepted   | 2026-11-18 |
| [ADR-0043](/adr/0043-refuse-a-grant-headed-by-an-exec-capable-command)          | Refuse a grant headed by an exec-capable command            | accepted   | 2026-11-23 |
| [ADR-0044](/adr/0044-keep-a-skills-rationale-in-its-own-design-file)            | Keep a skill's rationale in its own design file             | accepted   | 2026-11-23 |
