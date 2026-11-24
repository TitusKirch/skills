---
title: 'Back the local tracker with committed issue files'
description: 'A third tracker driver whose store is a directory of committed markdown files, with the lifecycle in frontmatter, the review verdicts appended to the issue, and the solution deliberately left out.'
status: 'accepted'
date: '2026-07-31'
---

# ADR-0023 — Back the local tracker with committed issue files

## Context

The AI work loop could only run against GitHub Issues or Linear. Both are remote services, both need authentication, and both put every scratch issue on someone else's server — so a repo that wants to run the loop offline, or simply without publishing its backlog, could not run it at all.

What the loop actually needs from a tracker is small. [ADR-0001](/adr/0001-split-the-work-loop-in-two) split the loop in two and put the state between the halves in the issue's lifecycle label; everything else the queues ask for is a list of issues, each with a state, a priority and its dependency edges. None of that requires a service. A directory of committed markdown files answers it, in the same spirit as `.agents/handoffs/`.

Four things were genuinely open, and each has a plausible alternative that a later reader would otherwise have to re-derive.

**There are no labels, and the lifecycle lives in one.** Both existing drivers select on `ai: ready` / `ai: review requested` and advance by relabelling. A file has no labels, so the state has to live somewhere else — and wherever it lives has to survive the two drains running at once, which the two separate single-flight locks already permit.

**Review feedback has nowhere to go.** No PR conversation, no comment stream on a file.

**The document is right there and editable**, which makes writing the accepted answer into it tempting.

**A local number is not a forge number.** Priority, `blockedBy` and the branch names the loop derives all assumed a tracker that hands out identity.

## Decision

A third `tracker` value, `local`, on both `issue.tracker` and `work.tracker`, backed by `.agents/issues/NNNN-slug.md` — one numbered file per issue, committed alongside the code.

**Committed, under `.agents/`.** Being reviewable and shareable is the whole reason to choose files over a service; putting them in the git common dir would keep them out of history and hand every clone a different backlog.

**The lifecycle lives in a frontmatter `state` field, holding the config key** (`ready`, `working`, `reviewRequested`, …), never the label string. Consequences follow, and they are why the alternative lost:

- **Not a directory per state.** A transition would then be a `git mv`, and two drains transitioning two issues at once produce rename-shaped conflicts on a shared branch where a one-line frontmatter edit to two different files produces none. It also breaks every reference to the issue — branch names, cross-links, the path a human bookmarked — once per transition, for a fact that changes six times in an issue's life.
- **The key, not the string.** `work.labels.*` strings are display names for a tracker that has a label catalog; a file has none, so the key is the stable name and the label-string changeover hazard the single-flight-lock spec documents simply does not arise here.

**Review feedback is appended to the issue file**, under an `## AI review — round N` heading, newest last. A sibling file would split one document in two, and the next implement run — which reads the body as the source of truth for scope — would have to know to look for both. The commit message is worse still: a `changes-requested` verdict exists to be read by the next round, not excavated. Appending also gives the round count a home: on GitHub it is derived from `reviewRequested` label-transition events, and a file has no event log, so the number of review sections **is** the round count.

**The file does not record the solution.** It carries the request and its lifecycle, and nothing else is written back. An issue that also holds the answer becomes a second, unversioned copy of the documentation, drifting from the code the moment the code changes — and this repo already has `docs/` and ADRs for that, written by `write-docs` once the work has cleared review.

**Identity is the number, and the forge axis is untouched.** `NNNN` is the ref the loop already derives branch names from (`ai/0042-slug`). The file's fields, how a transition is written, and the untouched `forge` key are stated in [`work-implement`'s local tracker recipe](https://github.com/TitusKirch/skills/blob/main/skills/work/work-implement/trackers/local.md).

## Consequences

Which copy of the files is the store, and what keeps two drains apart on it, is [ADR-0045](/adr/0045-keep-the-local-tracker-in-one-tree-without-a-review-lease).

The file is versioned: `git log` on the issue is a real transition history, which neither existing driver gives without an API call.

**A third driver is a third thing to keep in step.** Every rule the loop states per tracker now has three statements of it, which is the cost [ADR-0003](/adr/0003-mirror-shared-content-into-each-skill) already accepts for shared content — a fact restated where each reader will look, at the price of having to move together.

**Offline is not free.** The implement half's contract is that the **push** is what makes work reviewable, and a repo with no reachable remote cannot push. A repo that has a remote keeps pushing; `local` changes where the issues live, not what makes work reviewable.

**And one reconcile job goes inert with it.** With no forge the review drain's PR sweep has no input — a capability the offline case does not have, stated beside the sweep in [`work-implement`'s REFERENCE](https://github.com/TitusKirch/skills/blob/main/skills/work/work-implement/REFERENCE.md#reconcile) for the same reason the lease note is.
