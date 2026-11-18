---
title: 'Lock the issue and the tree, not the loop'
description: 'The work loops lock at three scopes — drain, issue and working tree — so direct runs on different issues no longer exclude each other, and a busy tree offers a worktree instead of failing.'
status: 'accepted'
date: '2026-11-18'
---

# ADR-0040 — Lock the issue and the tree, not the loop

## Context

Each work loop had one single-flight lock per checkout. `work-implement-queue` held `…/work/implement.lock` for its batch. A directly invoked `work-implement` also took that lock for its run, so a direct run and a drain could not lease the same issue, and the drain's reconcile could not mistake a live direct run's `working` issue for an orphan.

That one lock therefore did three jobs. It kept two drains apart. It kept two workers off one issue, because the label flip is not a true compare-and-swap. It also kept two runs out of one working tree. Because one lock did all three, two agents handed two different issues excluded each other, although nothing of theirs collided. Starting several agents and giving each a dedicated issue is an ordinary way to use the loop, and the lock blocked it.

## Decision

**Lock at three scopes, each excluding only its own collision.** The single-flight lock spec (`scripts/worklock-block.md`, mirrored into both work-loop units) now defines:

- A **drain** lock per loop (`…/work/implement.lock`, `…/work/review.lock`), taken by the queue skills only. It keeps two drains of one loop apart and nothing else.
- An **issue** lock per issue (`…/work/implement/<ref>.lock`, `…/work/review/<ref>.lock`), taken by every worker, direct or under a drain. It is taken before the tracker lease and released after the hand-off flip. It is the compare-and-swap the label flip lacks.
- A **tree** lock per working tree (`$(git rev-parse --git-dir)/…/work/tree.lock`), taken by every implement run in the tree it edits, and by a sequential drain for its batch. Review edits no working tree and takes none.

**Direct runs never take the drain lock, and a held drain lock never stops one.** Locks are taken in one fixed order (drain, tree, issue, lease) and never waited on, so they cannot deadlock. A live issue lock means the issue is being worked here, so both reconciles leave it alone outright. Their assignee and age guard still covers what a checkout-local lock cannot see. A counterpart's issue locks count as its heartbeat for the queue-state wait, because a direct run producing input holds no drain lock.

**A busy tree offers a worktree rather than failing.** A direct `work-implement` that finds the tree lock held stops before any tracker write and names the issue the holder is on. It then asks whether to continue in a worktree of its own. On a yes it makes one, as a parallel drain does for its workers, installs from the lockfile, and carries on there. Unattended, it stops and reports, because a worktree costs a full install and paying that is the human's call.

All three scopes keep the existing primitive (`mkdir`), owner record and heartbeat-timestamp stale rule. The owner record gains an `issue=` key, which the extensible `key=value` format already allowed.

## Consequences

Agents handed different issues now run at once, each in its own tree, and beside a running drain. Two runs still never lease one issue or edit one tree in the same checkout. The boundary has not moved: every lock is checkout-local, and across clones only the tracker lease is visible.

Workers now have locks of their own to heartbeat and release. A crashed worker leaves an issue lock behind, and the stale rule reclaims it once the window elapses, exactly as it reclaims a crashed drain's lock.

The changeover leaves a residual window. An old-spec direct run still takes the drain lock, so a new drain exits beside it; that costs a delay. A new-spec direct run beside an old-spec drain is protected by its lease label and the age-gated reconcile. What remains open is a self-select race between an old and a new copy. Handing each agent a named issue avoids it, and the window closes when the last old copy exits.

## Alternatives considered

- **Keep one lock and let direct runs skip it** would let two agents work at once, but it reopens the double lease and lets the reconcile reclaim a live direct run's issue. Those are the two hazards the direct-run rule existed to close.
- **Per-issue locks without a tree lock** would let two agents in one directory share an index and a set of files, which is the collision the clean-tree assert can only report after the damage.
- **Create a worktree automatically on a busy tree** is more convenient, but it silently commits the run to a full dependency install and a tree to clean up. Asking keeps that cost a human's choice, and one confirmation is all it takes.
