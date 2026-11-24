---
title: 'Gate CI on the draft state'
description: 'Every PR workflow skips drafts and the work loop opens its pull requests as drafts, so CI is spent once per finished implementation rather than once per push — at the cost of two rules every later workflow and every check reader has to honour.'
status: 'accepted'
date: '2026-08-03'
---

# ADR-0030 — Gate CI on the draft state

## Context

CI here runs `on: pull_request` only. What that leaves unchecked is [CI gotchas](https://github.com/TitusKirch/skills/blob/main/AGENTS.md#ci-gotchas) in `AGENTS.md`.

The AI work loop pushes on **every round**, not once per issue: `work-implement` implements, pushes and hands the issue to the review loop; a `changes requested` verdict sends it back and the next round pushes again. Each of those pushes opened or updated a pull request, and each therefore spent a full CI run on an implementation nobody had judged yet.

Two properties of this repo made that worse than it sounds. `codeql.yml` carries **no `paths:` filter**, so both matrix legs analyse every pull request — including the markdown-only ones that make up most changes in a skills repo. And the review loop's whole point is that a verdict arrives _after_ the push, so the runs being paid for were, by construction, the ones whose outcome nobody was waiting on.

## Decision

**The draft state is the gate, and it is load-bearing rather than incidental.** `work-implement` opens every pull request as a **draft** on purpose, and `work-review` marks one **ready for review** only once it would accept it. CI is therefore spent once per _finished_ implementation instead of once per push.

**Every PR workflow needs both halves, and one without the other is silent.** What the two halves are, and what each alone fails to do, is [the draft gate](https://github.com/TitusKirch/skills/blob/main/skills/work/work-implement/REFERENCE.md#the-draft-gate) in `work-implement`'s REFERENCE.

**The gate sits on the job, not on the workflow.** A gated job reports one `skipping` row per job; an ungated workflow that never starts reports an _empty_ check list, which is indistinguishable from having no checks configured.

**The wait for that CI is bounded**, by the timeout [marking ready, then waiting for CI](https://github.com/TitusKirch/skills/blob/main/skills/work/work-review/REFERENCE.md#marking-ready-then-waiting-for-ci) in `work-review`'s REFERENCE sets.

## Consequences

**Anything reading a pull request's checks must discard `skipping` outright.** This is the sharp edge of the decision. A draft's check list is _not_ a pass — it is a list of deliberately skipped jobs, and a reader that treats "nothing failing" as green will accept an implementation no workflow ever looked at. The rule cannot be inferred from the check list itself, which is exactly why it is recorded here.

**Every workflow added later inherits an obligation.** This is the part that binds work that comes later.

**A human reading a draft PR sees skipping rows.** That is intended — the rows say the checks exist and are waiting, rather than leaving the impression that the branch has none.

**The decision is scoped to pull requests and changes nothing about `dev`.**

## Alternatives considered

**Leave CI running on every push.** No rules to honour and no `skipping` rows to interpret. Rejected on cost: the loop pushes per round, and with CodeQL unfiltered a markdown-only round pays for two full matrix legs to learn nothing.

**Filter by `paths:` instead of by draft state.** This would cut the markdown case, but not the case that actually wastes the run — an implementation still in progress, which touches exactly the paths a filter would let through. It would also have to be repeated and kept aligned across workflows, with the same silent-drift failure the two-halves rule already has.

**Gate the workflow rather than the job.** Cheaper to write, but an unstarted workflow reports an empty check list rather than skipped jobs, and "no checks" and "checks deliberately deferred" are opposite facts to whoever is reading the pull request.
