---
title: 'Keep the local tracker in one tree, without a review lease'
description: 'The main working tree holds the authoritative copy of the local issue files, and the review lease stays off there, because a file in the checkout reaches no further than the locks.'
status: 'accepted'
date: '2026-11-23'
---

# ADR-0045 — Keep the local tracker in one tree, without a review lease

## Context

[ADR-0023](/adr/0023-back-the-local-tracker-with-committed-files) backs the `local` tracker with committed issue files. A file in the checkout is not a server both clones write to, and a committed file has one copy per worktree, so two questions the remote trackers never raised need an answer: which copy is the store, and what still keeps two drains apart.

## Decision

**The store is one tree, and that is a rule, not an incidental.** The files are committed, so wherever the run uses worktrees — `work.branch: worktree`, and equally `branch:<name>` with `parallel: true`, which produces its work in isolated worktrees too — every per-issue worktree holds its own copy of every issue file and a transition written into the wrong one is lost silently — the drain leases in one copy, the worker advances another, and the review queue greps a third and finds nothing. So the main working tree's directory is the authoritative store ([Which tree is the tracker](https://github.com/TitusKirch/skills/blob/main/skills/work/work-implement/trackers/local.md#which-tree-is-the-tracker)). The alternative — putting the store in the git common dir, which every worktree shares — was rejected in the Decision above for a different reason (it keeps the issues out of history), and this is the price of that choice: one derived path both drains resolve identically, rather than a shared directory that needs no rule at all.

**The review lease loses its reason to exist, and nothing else covers what it covered.** Both leases become fields in a file **inside the checkout**, so their domain collapses onto the domain of the single-flight locks. For the implement loop's `working` that is the boundary the lock already declares out of scope. For the review loop's `reviewing` it is a real loss, because that label exists **precisely** to reach past the lock: on GitHub or Linear the tracker is one server both clones write to, and on `local` it is not — so two clones can both lease a `reviewRequested` issue and write **competing** verdicts, the hazard the lease was introduced to close. That conclusion — leave `work.labels.reviewing` off on `local` — and why the reconcile's guard does not cover the gap are **stated in [`work-review`'s REFERENCE](https://github.com/TitusKirch/skills/blob/main/skills/work/work-review/REFERENCE.md#the-reviewing-lease)**, in the section defining the lease, because ADRs are not loaded at runtime and [ADR-0003](/adr/0003-mirror-shared-content-into-each-skill) puts the rule where its reader will look; this record carries only why.

## Consequences

The two drains run against it concurrently, which was the bar. They already hold separate locks, and the lifecycle guarantees that at any moment an issue's state names exactly one owning loop — so the implement drain and the review drain never write the same file, and two issues are two files. That argument is about **which file**, and it holds only once **which copy** is settled.
