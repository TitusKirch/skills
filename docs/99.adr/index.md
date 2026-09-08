---
title: 'Architecture decisions'
description: 'The decision log — every architecture decision recorded for this project.'
---

A decision earns an ADR when it constrains work that comes later and its reasoning would otherwise be lost: a choice between real alternatives, a convention every skill has to follow, a trade-off that looks like a mistake until the reason is known. Records are append-only — a reversed decision is written as a new ADR that supersedes the old one, never as an edit to it. Superseding is reserved for that reversal: a record whose decision still stands but whose stated reasoning has been overtaken is **amended** instead, by a dated addendum appended to it that adds what was learned without altering what already stands. Status and date stay put — the addendum carries its own date, so the Date column below still means the day the status last changed.

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
| [ADR-0031](/adr/0031-keep-rationale-as-repo-memory)                             | Keep rationale as repo memory                               | accepted   | 2026-08-26 |
| [ADR-0032](/adr/0032-select-a-dependency-request-by-its-author-alone)           | Select a dependency request by its author alone             | accepted   | 2026-08-26 |
| [ADR-0033](/adr/0033-classify-a-stale-branch-by-why-it-is-stale)                | Classify a stale branch by why it is stale                  | accepted   | 2026-08-26 |
| [ADR-0034](/adr/0034-judge-a-comment-against-the-code-beneath-it)               | Judge a comment against the code beneath it                 | accepted   | 2026-08-26 |
| [ADR-0035](/adr/0035-bind-the-release-skill-to-its-release-tool)                | Bind the release skill to its release tool, not its forge   | accepted   | 2026-08-26 |
| [ADR-0036](/adr/0036-bound-update-deps-by-the-repos-own-tooling)                | Bound update-deps by the repo's own tooling                 | accepted   | 2026-08-26 |
| [ADR-0037](/adr/0037-commit-a-handoff-into-the-repo-it-hands-off)               | Commit a handoff into the repo it hands off                 | accepted   | 2026-08-26 |
| [ADR-0038](/adr/0038-fix-the-tldr-frame-and-invoke-it-on-request)               | Fix the tldr frame and invoke it on request                 | accepted   | 2026-08-26 |
