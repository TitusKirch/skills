---
title: '{The decision, in a few words}'
description: '{One line — what was decided and why it matters.}'
status: '{proposed | accepted | rejected | deprecated | superseded}'
date: '{YYYY-MM-DD}'
---

# ADR-{NNNN} — {The decision, in a few words}

<!-- The filename and this title are a present-tense imperative verb phrase — what was
     decided, as something done: "let-the-review-establish-green", never "review-policy".

     Once superseded, keep the prose untouched, set status: superseded, refresh date,
     and add the pointer here:  > **Superseded by** [ADR-{NNNN}]({NNNN-slug}.md) -->

<!-- Aim for about 300 words of body; over 500 needs a reason in the plan. Any section may be a
     single sentence, and the whole record may be a single paragraph.

     This is an architecture decision, not a feature spec: no behaviour, rules, parameters,
     endpoints, migrations or rollout steps — those go on a page that can be edited.

     Nothing written here can ever be corrected once it lands, and nothing is ever appended
     (no amendments): every sentence has to still be true years from now. No "currently" /
     "is being", no version number, no field list or option table copied out of code, no list
     a later change will extend. Freezing a fact on purpose is fine — put it in the past tense. -->

## Context

{What forced this decision — the problem, the constraints, what makes it a real decision rather than an obvious call. Neutral; no verdict yet. Not an inventory of the project as it stood: that is false within a release, and nobody may fix it.}

## Decision

{What was decided, in the active voice — "We will …". Keep this the decision itself; the options that lost go in the optional section below, unless naming one here is what makes the decision legible.}

## Consequences

{What follows — what becomes easier, what becomes harder, and the trade-offs now accepted. Include the ones that hurt. A line prescribing how future work is to be done is a convention, not a consequence: put it where it can be edited and link it.}

<!-- Optional fourth section. Keep it when there were real alternatives — that reasoning is
     what a later reader comes back for. Drop the whole H2 when there were none; it is never
     required, so an existing ADR without it is not out of contract. -->

## Alternatives considered

{One short block per option that lost — what it was, and the reason it lost. Not a survey; only the options that were genuinely in play.}
