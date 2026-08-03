---
title: 'Settle a body–comment conflict by rule'
description: 'The issue body is the scope and a newer body edit supersedes an older comment, except where that comment explicitly revised a named earlier decision and the body never mentions it — so the loops stop escalating a question nobody had written down.'
status: 'accepted'
date: '2026-08-02'
---

# ADR-0024 — Settle a body–comment conflict by rule

## Context

The work loops carried a rule for a label disagreeing with a body ([label vs body precedence](../../skills/work/work-implement/REFERENCE.md)) and a rule for two labels disagreeing with each other (`needsTriage` beside a lifecycle label). They carried none for the pair that actually occurs most: the **issue body** disagreeing with a **comment**, both written by the same authorized author.

Neither side wins on authority there, and both are text the loops read as instruction. So the implementer surfaced the conflict — correctly, per the author-authority rule's _surface it, never silently obey_ — worked the body, and the reviewer, meeting two owner decisions with nothing to prefer either by, escalated to `ai: needs human`.

What that cost is measurable rather than hypothetical. **Five issues sat on `ai: needs human` at once, four of them on this pair alone** — #112, #110, #126 and #136 — each with a green gate, complete work and a merged or mergeable PR. In every case the shape was identical: a decision recorded in a comment on 2026-07-29, and a body edited on 2026-07-31 with a `Decided (grilling pass)` block that restated the superseded premise and never mentioned the comment, written seconds before `ai: ready` was applied. One of them, #136, had already been re-litigated once.

Escalation is the right answer to a decision an agent must not make. It is the wrong answer to a decision **nobody had written down** — there the human is not being asked to exercise judgement, only to supply a precedence rule that could have been stated once.

## Decision

**The body is the scope, so a newer body edit supersedes an older comment.** The body is the field a human edits to restate what the work is, and the existing precedence table already makes it the answer to _what is the work?_. A comment that argues, proposes or annotates loses to it however recent.

**One exception, deliberately narrow: a comment that explicitly revises a named earlier decision stands until the body names it back.** "This revises the comment above", "decided instead", "superseded by" — such a comment is aimed at a specific prior statement, and a later body edit that never mentions it reads equally well as written without it in view. Where a newer body restates the very premise the revision rejected and is silent about the revision, the revision is live and the body is the stale text. A body that names the revision and overrides it is the ordinary case again, and wins.

**Both statements are named either way** — the two texts, their timestamps and which one the run followed — in the run's report and at the feedback destination, so a wrong call is visible rather than buried.

**Escalation survives for the genuinely undecidable**: two statements each explicitly revising the other, or a choice that changes the work materially with nothing to settle which was meant.

Rejected: **newest wins outright.** It makes an explicit "this revises the comment above" losable to an unrelated typo fix in the body — the deliberate act is exactly what the rule should protect. Rejected: **escalate on every such pair** — the status quo, which turns a documented precedence question into a human interrupt on finished work. Rejected: **the label decides**, as it does against the body — a label carries no scope, so there is nothing in it to prefer.

## Consequences

The reviewer's **ambiguous intent** escalation narrows: a body–comment disagreement is no longer that case, and the verdict now says which statement the run followed and why. The four issues above are the last of their kind that should have to reach a human.

The rule can pick wrong — a maintainer who edits a body without recalling their own revision now gets the revision, not the edit. That is the trade, and naming both statements in the report is what keeps it cheap to correct: the human reads one line instead of reconstructing two timelines.

It also puts a small burden on the author: a body edit that intends to override an explicit revision has to say so. That is one clause, and it is the same clause the revision itself had to write to earn its standing.
