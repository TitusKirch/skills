---
title: 'Let the review establish green'
description: 'The reviewer runs the repo gate itself instead of inheriting the implementer verdict.'
status: 'accepted'
date: '2026-07-27'
---

# ADR-0012 — Let the review establish green

## Context

[ADR-0001](0001-split-the-work-loop-in-two.md) splits the work loop so that a **different** agent, with fresh context, judges what an implementer built — no "it works because I wrote it".

`work-review` applied that to everything except the one fact a machine can settle. It required checks to be green (`a red or missing check is a review finding, not a pass`) while reading neither the root `verify` key nor anything that could produce a verdict of its own. The only source available to it was the forge's check list.

Under `work.branch: "branch:<name>"` — commit straight to the integration branch, no PR — that list is empty by construction, because CI runs `on: pull_request`. Taken literally the rule made every review a finding; taken loosely it made the reviewer accept the implementer's own green run, which is the inheritance the two-loop split exists to prevent. Neither reading is the one intended.

The gap widens on a shared branch. `work-implement` runs the gate **before** pushing; by the time a review happens, other issues have landed on the same branch. Issue A green, issue B pushed after it, A and B together red — and nothing in the loop looks again.

## Decision

`work-review` **establishes** green rather than inheriting it. It reads the root `verify` key like the other four gate-running skills ([ADR-0011](0011-mirror-the-check-command-contract.md)) and runs it against the pushed head in a **throwaway worktree**.

Read-only is scoped to the **user's tree**, which was always what it meant — not to the machine, and not to running nothing. Forge checks stay a source where the base genuinely triggers them; they are corroboration, and an empty check list stays `unknown`, never green.

Rejected: **trusting the implementer's run.** It proves a tree passed before the push, on a branch that has moved. Every other claim in the review is re-derived from scratch; exempting the cheapest one is backwards.

Rejected: **forge checks only**, which is what exists today and yields nothing at all on the branch strategy this repo actually uses.

Rejected: **moving the check into `work-implement` only, later in its sequence.** It would still be the author grading their own work, and still blind to what lands between its run and the review.

## Consequences

A review costs an install plus a suite run. On the queue drain that is per issue, and it is the largest single cost this change introduces.

**Red is no longer automatically the reviewed issue's fault.** On a shared branch the gate judges the combined tree, so attribution becomes a step of its own: a failure outside this issue's commit range escalates to `needs human` rather than bouncing a diff that is fine. That is a new outcome the loop did not previously produce — and a branch that does not pass is worth surfacing whoever broke it.

A repo with no detectable check command gets `unknown` from the reviewer, which is a finding rather than a pass. Repos that never declared `verify` will notice this loop asking for one.
