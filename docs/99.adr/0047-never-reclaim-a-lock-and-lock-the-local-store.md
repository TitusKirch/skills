---
title: 'Never reclaim a lock, and lock the local store'
description: 'A run never reclaims a stale work-loop lock; it reports it for a human to remove, a per-run id decides whose lock a heartbeat or release may touch, and a short store lock serialises writes to the local tracker.'
status: 'accepted'
date: '2026-11-24'
---

# ADR-0047 — Never reclaim a lock, and lock the local store

Partly supersedes [ADR-0040](/adr/0040-lock-the-issue-and-the-tree-not-the-loop): the three lock scopes stand; the stale rule reclaiming a crashed run's lock does not — such a lock is reported, and a human removes it.

## Context

The work loops' locks were judged stale by a heartbeat window, and a run that found one stale reclaimed it: it checked the timestamp, removed the lock, and took it again. Those were three steps, not one atomic operation. Two runs that both judged one lock stale could each remove it, and the slower one removed the lock the faster one had just taken, so both ran. A holder that was only suspended could return after the window and release a lock that had since become another run's.

A second gap sat in the `local` tracker. Its store is one directory in the main working tree, so workers on different issues and the review loop all wrote and committed there. Two writes at once could stage each other's file or move the branch tip under each other's commit. The issue and tree locks did not cover it: the writers held different issues and sat in different trees.

## Decision

**No run reclaims a lock.** A lock past its window is reported as probably orphaned, with its owner, age, path and the command that removes it. An unattended run stops for that issue or tree; an attended run may offer the removal to the human.

**Every lock records a unique run id.** A heartbeat or release touches a lock only while its record still carries the run's own id.

**Writes to the `local` store take a short store lock**, in the git common dir, shared by both loops and held only around one transition and its commit.

## Consequences

A crashed run's lock now waits for a human, so an unattended loop stalls on that issue or tree until someone clears it. That cost is a delay, never two runs on one issue. A suspended run that returns finds its lock gone or foreign and stops instead of acting on it. `local` writes serialise, at the price of a second lock for every transition.

## Alternatives considered

- **A safer reclaim**, renaming the stale lock aside before retaking it, narrows the race but does not close it, and a returning holder could still act on a lock it no longer owned.
