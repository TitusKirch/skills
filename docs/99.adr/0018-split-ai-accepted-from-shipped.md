---
title: 'Split AI-accepted from shipped'
description: 'The AI review verdict writes a non-terminal Linear state, and the terminal Done is left to whatever observes the change reaching the default branch.'
status: 'accepted'
date: '2026-07-30'
---

# ADR-0018 — Split AI-accepted from shipped

## Context

The AI work loop ends at a verdict, not at a merge. [ADR-0001](0001-split-the-work-loop-in-two.md) put a review loop after the implement loop and made its accept verdict terminal for the queue, and `work-implement`'s REFERENCE says what that terminality does and does not mean:

> **`done` = AI-reviewed and accepted** (low-risk), or accepted by a human via `needs human`. It does **not** mean "merged": GitHub's `Closes #<n>` and Linear's integration fire only on a **default-branch** merge, which a non-default `pr.base` (e.g. `dev`) never triggers — so shipping is the rollup merge's business, not the queue's.

The Linear mapping contradicted that one section later. `work.linear.states` mapped each lifecycle step to a workflow state, and the review loop wrote `states.done` on its accept verdict — a key whose name invites `"Done"`, which is what every repo mapping it by hand wrote. So the board said shipped while the work sat on `pr.base`: unmerged, unreleased, and — because Linear's integration only fires on a default-branch merge — with no later event to correct it. The issue stayed wrong for however long the branch waited for its rollup.

The lifecycle the states were mapping is longer than the mapping admitted — ready, working, review requested, reviewing, **accepted**, _(merge)_, _(release)_, **shipped**. The map stopped at the fifth moment and labelled it as the eighth. The label was never wrong — `ai: done` means "the AI is finished with this", which is true and useful. Only the board was claiming something the work had not earned.

This is Linear-only in effect. A GitHub issue has labels and no workflow state, so there is nothing there to mis-set.

## Decision

`work.linear.states` carries **two** keys for the tail of the lifecycle, and the work loop writes only one of them.

- **`states.accepted`** — written by the review loop on its accept verdict, alongside `work.labels.done`, in the same `save_issue` call. Deliberately **not** a terminal column: name it for what it is (`Accepted`, `Ready for release`). It belongs in `statuses` too, because a human handing an accepted issue back relabels it without moving the state — the same trap `changesRequested` already documents.
- **`states.done`** — the terminal **shipped** state: the change is on the repo's **default branch**. Written by **neither loop**. Where `pr.base` _is_ the default branch, Linear's own GitHub integration already writes it and no skill needs to. Where it is not, the `release` skill writes it, at the promotion merge whose `base` is the default branch — the moment it performs, and therefore the one moment in the toolchain positioned to observe the ship.
- **The label is untouched.** `work.labels.done` keeps its string and its meaning. The step key (`done`) and the state key (`accepted`) therefore differ — the one place in the map where they do, and exactly where the two meanings diverge.
- **Unmapped is a real answer.** A repo that promotes by hand, with no release tool for the `release` skill to drive, has no writer for `states.done` and should leave it unmapped rather than map a `Done` nothing will observe. The board resting at accepted is honest; a `Done` nobody wrote is not.

**Why not re-point `states.done` at the accepted state and add `states.shipped`.** This was the alternative that "breaks fewer existing configs", and that framing is the trap: what it actually does is leave every existing config **wrong**. Their `done: "Done"` would keep being written at accept time, silently and unchanged, which is the entire defect. The chosen split fails the other way — a config that maps only `done` hits the existing "a step omitted from `states` leaves the workflow state untouched" rule, so the accept verdict writes no state at all. A board that lags is a smaller wrong than a board that lies, and it is visible to the person reading it.

**Why not rename the `done` label.** `ai: done` already means AI-accepted, which is correct. Renaming it churns every repo's config and every tracker's label set for a meaning that was not the problem, and a label changeover is the same silent-split hazard the single-flight-lock spec documents for label strings generally.

**Why not have the work loop wait for the merge.** It would hold issues open indefinitely on a merge it does not perform, coupling the queue to the release process its own contract says it does not own.

**Why the default branch and not the release tag.** "Released" is a release-tool concept, so a repo without one would have no trigger at all; "on the default branch" is a moment every repo has. A repo that means the tag can leave `states.done` unmapped and say so on its board, rather than acquiring a config knob to answer a question most repos do not ask.

**Why nothing for GitHub.** A second label — `ai: shipped` — would be a new mechanic every repo has to create on its tracker, carrying information the default branch and the releases already hold. GitHub cannot show the distinction; the honest answer is that `ai: done` there means AI-accepted and the ship is answered elsewhere.

## Consequences

Repos already mapping `states` need a one-line migration: add `accepted`, add it to `statuses`, and decide whether anything will write `done`. Until they do, accepted issues stop moving on the board — the intended failure direction, and the reason the change is safe to ship without a coordinated relabel.

The `release` skill gains its first tracker write. It stays narrow: one workflow state, never a label, only for issues the work loop already accepted, and only after a merge a human confirmed — so it can neither hand an issue to a work loop nor take one from it. It reads its candidates from the tracker rather than from the promoted commit range, because the range dies with the merge that empties it and a run failing between merge and write would lose the set; a tracker query is resumable and also catches work accepted after its code landed.

The gap that remains is a repo on a non-default `pr.base` that never runs the `release` skill. Nothing observes its default branch, so nothing writes `states.done` — which is why leaving the key unmapped is documented as the right answer there, rather than treated as an omission.

Two skills that had no coupling now share a contract: `work-review` writes the state `release` finishes. It is stated in both REFERENCEs and in the schema, which is the same mirroring [ADR-0003](0003-mirror-shared-content-into-each-skill.md) accepts for shared content — a fact restated where each reader will look, at the cost of having to move together.
