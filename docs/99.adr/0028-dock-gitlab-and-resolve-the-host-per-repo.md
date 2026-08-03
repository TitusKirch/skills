---
title: 'Dock GitLab on both axes, and resolve the host per repo'
description: 'GitLab as a second forge and a fourth tracker, driven by glab; and the forge host promoted to a resolved, per-repo fact mirrored into every skill that drives a forge.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0028 — Dock GitLab on both axes, and resolve the host per repo

## Context

Every forge-bound skill assumed GitHub. The root `forge` key had a single-value enum, `issue.tracker` and `work.tracker` offered `github` or `linear` (and, since [ADR-0023](0023-back-the-local-tracker-with-committed-files.md), `local`), and the skills drove `gh` directly. A repo hosted on GitLab could use neither `pull-request`, nor `prune-branches`, nor the work loop.

The forge axis was designed to take a second forge additively — the schema said so in its own description — but nothing had ever docked there, so it was an untested extension point. [ADR-0023](0023-back-the-local-tracker-with-committed-files.md) had just exercised the **tracker** axis and set the contract a third driver has to meet; the forge axis had no such precedent.

A second gap surfaced alongside it and is **not** GitLab-specific: the skills assumed a single **host**. Self-hosted GitLab is the normal deployment rather than the exception, and GitHub Enterprise has exactly the same shape. Which host a repo talks to is a per-repo fact, and nothing in the config could say so — every skill reached for whatever `gh` happened to be authenticated against.

## Decision

**GitLab docks on both axes as a driver, not as a second family of skills.** `forge` gains `gitlab`, `issue.tracker` and `work.tracker` gain `gitlab`, and the driver is `glab` — the official GitLab CLI and the direct `gh` counterpart. A parallel family of GitLab skills was the obvious alternative and was rejected: it doubles the surface, and the two axes exist precisely so a driver can dock without forking a skill.

**The host becomes a root key with a resolution ladder** — `forgeHost`, a bare hostname with an optional port, resolved config → the `origin` remote → whatever the CLI is already authenticated against. The order is deliberate: the remote sits above the CLI because the remote is a **repo-level** fact and the CLI's configured host is a **machine-level** one, and a session that works two repos must reach two instances. Authentication is never duplicated — the ladder resolves a name, the CLI holds the credentials.

**The rule is mirrored, not restated per skill.** It goes into a `<skills-forge>` block generated from `scripts/forge-block.md`, the seventh mirrored contract under [ADR-0003](0003-mirror-shared-content-into-each-skill.md), carried by the five skills that drive a forge: `pull-request`, `prune-branches`, `issue`, `work-implement`, `work-review`. The two work queues name their worker's REFERENCE for it, exactly as they already do for the config contract and the lock spec ([ADR-0020](0020-separate-installable-alone-from-runnable-alone.md)).

**`release` and `merge-deps` stay GitHub-only, and say so.** Each carries unresolved questions of its own — GitLab's release API and its own `glab` surface, Dependabot's absence there — and each is tracked separately. What they must not do is degrade silently, so both keep the existing stop: a `forge` they do not implement ends the run with a message rather than a guess.

## Consequences

**The extension point is now load-bearing rather than aspirational.** A third forge has a worked example to follow, and the shape it has to meet is visible: a CLI, an availability probe, a vocabulary, and the six or so calls each skill actually drives.

**Vocabulary follows the forge, and triggers do not.** GitLab's noun is a merge request, its branches are source and target, its number is `!42` and its templates live under `.gitlab/merge_request_templates/`. Everything a human reads uses those words; the skills' trigger phrases stay bilingual, because a user asking for "a PR" on a GitLab repo means the MR. That split is stated in the skills rather than left to taste.

**Two API differences are traps rather than details, and both are written down where they bite.** `glab issue list` **ANDs** a comma-separated `--label` where `gh`'s search qualifier **ORs** it, so the implement loop's two input labels are two calls unioned locally — comma-joining them selects issues carrying both and drains an empty queue in silence, the exact failure mode the selection query is written to prevent. And `glab` has no `--body-file`, so a multi-line body is passed by command substitution from the same temporary file the GitHub path writes.

**A fourth tracker is a fourth thing to keep in step**, the cost [ADR-0023](0023-back-the-local-tracker-with-committed-files.md) already accepted for the third. The mirrored block is what keeps the _host_ half from multiplying with it: one source, drift-checked, rather than five wordings of the same ladder.

**The host key can be set wrong in a way nothing detects.** A `forgeHost` naming an instance the CLI is not authenticated against fails at the availability probe, which is the right place — but a `forgeHost` naming the _wrong reachable_ instance succeeds and works against another project. The mitigation is prose, not machinery: the host is named in the plan whenever it is not the forge's public one, so the one reader who can spot it is shown it.

## Amendments

### 2026-08-03 — one of the two deferred skills came back

The decision above stands. One clause of it does not: `merge-deps` no longer stays GitHub-only.

The Decision paired `release` and `merge-deps` as skills with "unresolved questions of their own", each tracked separately. `merge-deps`' question was whether its **select-by-author guarantee** survives a forge where the author is not a constant — GitHub runs Dependabot, GitLab's Renovate is always self-run. It was answered yes, and the answer is [ADR-0029](0029-reproduce-the-author-guarantee-from-a-configured-identity.md): one configured identity, matched on an immutable id, in a key that can only ever narrow. So the `<skills-forge>` roster this record names as five skills is **six**, `merge-deps` included, and `test/isolation.test.ts` pins that rather than this paragraph.

`release`'s clause is untouched — it stays GitHub-only, and its question is still open. This addendum **refines, it does not supersede**: nothing about the axis, the driver or the host ladder changed, and the deferral was always stated as a deferral.
