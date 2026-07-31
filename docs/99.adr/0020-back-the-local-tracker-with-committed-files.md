---
title: 'Back the local tracker with committed issue files'
description: 'A third tracker driver whose store is a directory of committed markdown files, with the lifecycle in frontmatter, the review verdicts appended to the issue, and the solution deliberately left out.'
status: 'accepted'
date: '2026-07-31'
---

# ADR-0020 — Back the local tracker with committed issue files

## Context

The AI work loop could only run against GitHub Issues or Linear. Both are remote services, both need authentication, and both put every scratch issue on someone else's server — so a repo that wants to run the loop offline, or simply without publishing its backlog, could not run it at all.

What the loop actually needs from a tracker is small. [ADR-0001](0001-split-the-work-loop-in-two.md) split the loop in two and put the state between the halves in the issue's lifecycle label; everything else the queues ask for is a list of issues, each with a state, a priority and its dependency edges. None of that requires a service. A directory of committed markdown files answers it, in the same spirit as `.agents/handoffs/`.

Four things were genuinely open, and each has a plausible alternative that a later reader would otherwise have to re-derive.

**There are no labels, and the lifecycle lives in one.** Both existing drivers select on `ai: ready` / `ai: review requested` and advance by relabelling. A file has no labels, so the state has to live somewhere else — and wherever it lives has to survive the two drains running at once, which the two separate single-flight locks already permit.

**Review feedback has nowhere to go.** No PR conversation, no comment stream on a file.

**The document is right there and editable**, which makes writing the accepted answer into it tempting.

**A local number is not a forge number.** Priority, `blockedBy` and the branch names the loop derives all assumed a tracker that hands out identity.

## Decision

A third `tracker` value, `local`, on both `issue.tracker` and `work.tracker`, backed by `.agents/issues/NNNN-slug.md` — one numbered file per issue, committed alongside the code.

**Committed, under `.agents/`.** Being reviewable and shareable is the whole reason to choose files over a service; putting them in the git common dir would keep them out of history and hand every clone a different backlog. The directory is configurable (`local.dir`) and defaults to `.agents/issues`.

**The lifecycle lives in a frontmatter `state` field, holding the config key** (`ready`, `working`, `reviewRequested`, …), never the label string. Three consequences follow, and they are why the alternative lost:

- **Not a directory per state.** A transition would then be a `git mv`, and two drains transitioning two issues at once produce rename-shaped conflicts on a shared branch where a one-line frontmatter edit to two different files produces none. It also breaks every reference to the issue — branch names, cross-links, the path a human bookmarked — once per transition, for a fact that changes six times in an issue's life.
- **The key, not the string.** `work.labels.*` strings are display names for a tracker that has a label catalog; a file has none, so the key is the stable name and the label-string changeover hazard the single-flight-lock spec documents simply does not arise here. A `work.labels.<key>: false` still means the mechanic is off — the field is not written.
- **The write is a rename.** State is changed by writing a sibling temp file and `mv`-ing it over the issue, so a crashed run leaves either the old file or the new one and never a half-written one.

**Review feedback is appended to the issue file**, under an `## AI review — round N` heading, newest last. A sibling file would split one document in two, and the next implement run — which reads the body as the source of truth for scope — would have to know to look for both. The commit message is worse still: a `changes-requested` verdict exists to be read by the next round, not excavated. Appending also gives the round count a home: on GitHub it is derived from `reviewRequested` label-transition events, and a file has no event log, so the number of review sections **is** the round count.

**The file does not record the solution.** It carries the request and its lifecycle, and nothing else is written back. An issue that also holds the answer becomes a second, unversioned copy of the documentation, drifting from the code the moment the code changes — and this repo already has `docs/` and ADRs for that, written by `write-docs` once the work has cleared review.

**Identity is the number, and the forge axis is untouched.** `NNNN` is the ref the loop already derives branch names from (`ai/0042-slug`), priority is a frontmatter field matched against the existing `work.priorityLabels` ladder rather than a second knob, and `blockedBy` / `parent` are frontmatter lists read exactly like GitHub's relations. `local` is a **tracker**, not a forge: the root `forge` key is unaffected, so a repo may file its issues in-tree and still open its pull requests on GitHub.

## Consequences

The two drains run against it concurrently, which was the bar. They already hold separate locks, and the lifecycle guarantees that at any moment an issue's state names exactly one owning loop — so the implement drain and the review drain never write the same file, and two issues are two files. That argument is about **which file**, and it holds only once **which copy** is settled — the paragraph after next.

**The review lease loses its reason to exist, and nothing else covers what it covered.** Both leases become fields in a file **inside the checkout**, so their domain collapses onto the domain of the single-flight locks. For the implement loop's `working` that is the boundary the lock already declares out of scope. For the review loop's `reviewing` it is a real loss, because that label exists **precisely** to reach past the lock: on GitHub or Linear the tracker is one server both clones write to, and on `local` it is not — so two clones can both lease a `reviewRequested` issue and write **competing** verdicts, the hazard the lease was introduced to close. The reconcile's assignee/age guard does **not** cover it: that guard stops a sweep from reclaiming a review another clone is live on, and nothing in it adjudicates a `done` written in one clone against a `changes-requested` written in the other — no sweep ever sees both. The conclusion is therefore that on `local` the review lease buys nothing the review lock does not already give, and `work.labels.reviewing` should be left off (its default). That conclusion is **stated in `work-review`'s REFERENCE**, in the section defining the lease, because ADRs are not loaded at runtime and [ADR-0003](0003-mirror-shared-content-into-each-skill.md) puts the rule where its reader will look; this record carries only why.

**The store is one tree, and that is a rule, not an incidental.** The files are committed, so under `work.branch: worktree` every per-issue worktree holds its own copy of every issue file and a transition written into the wrong one is lost silently — the drain leases in one copy, the worker advances another, and the review queue greps a third and finds nothing. So the main working tree's directory is named as the authoritative store and a worktree's copy as a read-only checkout artifact. The alternative — putting the store in the git common dir, which every worktree shares — was rejected in the Decision above for a different reason (it keeps the issues out of history), and this is the price of that choice: one derived path both drains resolve identically, rather than a shared directory that needs no rule at all.

Against all of that, the file is versioned: `git log` on the issue is a real transition history, which neither existing driver gives without an API call.

**A third driver is a third thing to keep in step.** Every rule the loop states per tracker now has three statements of it, which is the cost [ADR-0003](0003-mirror-shared-content-into-each-skill.md) already accepts for shared content — a fact restated where each reader will look, at the price of having to move together.

**Offline is not free.** The implement half's contract is that the **push** is what makes work reviewable, and a repo with no reachable remote cannot push. There the artifact is the commit on the branch, and the reconcile's crash-before/after-push question is answered by `git log` rather than by a PR query. A repo that has a remote keeps pushing; `local` changes where the issues live, not what makes work reviewable.

**And one reconcile job goes inert with it.** The review drain's first sweep closes out a human's out-of-band action **on the PR** — merged means accepted, closed-unmerged means blocked. With no forge there is no PR to read, so that sweep has no input and the path it closes stays shut: a human who accepts the work outside the loop edits the issue file's `state` by hand instead. It degrades safely rather than wrongly (no artifact means nothing to reconcile), and on this tracker the manual fallback is a one-line edit rather than an API call — but it is a capability the offline case does not have, and it is stated beside the sweep in `work-implement`'s REFERENCE for the same reason the lease note is.
