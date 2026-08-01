---
title: 'Permit a thin shape for alias-style skills'
description: 'A second, named skill shape for a skill with nothing to sequence — gated by one criterion, so thin never reads as unfinished.'
status: 'accepted'
date: '2026-07-31'
---

# ADR-0022 — Permit a thin shape for alias-style skills

## Context

Every skill in the catalogue is a full product: intro, opt-out paragraph, numbered workflow, guardrails, config block, reference pointer. All of them sit above 6,400 bytes net of their mirrored blocks, and the spread across the catalogue is a factor of 2.7. There was no shape for a skill that only reaches for another one, or carries a single rule.

That floor was a convention nobody decided. It emerged because every skill so far genuinely needed the full shape — which is a different thing from the full shape being the only permitted one, and the difference was invisible to the next author, who had one shape to copy and no way to tell "this is required" from "this is what everyone happened to need".

Other catalogues do carry the small form: `mattpocock/skills` has nine skills under 1,500 bytes, one of them frontmatter plus the sentence `Run a /grilling session.`. Their median (skills over 4 KB) is 6,574 B and Laravel Boost's 5,752 B, against this repo's 10,139 B. That gap is a fact about what each repo publishes — engines here, entry points there — not evidence that these skills are overwritten.

## Decision

**Thin skills are permitted, as a named second form** — not as a smaller version of the full one — and **one criterion gates it**: a skill is thin when it has **no multi-step procedure**, meaning it carries a single rule or reaches for exactly one other skill. An ordered workflow makes it a full skill, which then takes the full shape.

The criterion is the decision. Naming the form without it would have been worse than not naming it, because "thin" would then mean "shorter", and every full skill's first draft qualifies as shorter.

Three things follow, and none of them relaxes an existing rule:

- **Mandatory frontmatter is unchanged.** `name` and `description` are required by the standard; `metadata.summary` is required here, because `pnpm skills:sync` reads it to build the README tables — dropping it breaks generation rather than merely looking sparse.
- **The opt-out paragraph and the `<skills-config>` block need no exception.** Both exist only in a skill that reads the config, and a thin skill reads none; it is absent from the mirrored-block rosters in `test/isolation.test.ts` exactly as every other config-free skill already is. A thin skill that read config would be carrying a procedure, which the criterion sends to the full shape.
- **`skills/README.md` names the form and states the criterion**, so a reviewer has something to check and the next author reads a two-paragraph `SKILL.md` as complete.

Rejected: **leaving it as is** — every skill a full product, the one-line alias simply never written. It is defensible, and its argument is real: one shape to learn, and a shape with zero members risks guessing what a thin skill needs before a real case has tested it. It lost on what happens at the moment a thin skill is first wanted. Unnamed, the form is not absent then — it is re-litigated, and the skill either gets padded into the full shape to look finished or ships looking half-done. Naming it costs nothing today (no existing skill changes, no check changes) and is cheap to reverse, which is the opposite of the hardening the objection warned about.

Rejected: **relaxing `metadata.summary` for thin skills.** It is not ceremony — the generated artifacts read it.

## Consequences

The catalogue is unchanged: no skill changes shape, no generated artifact moves, no test gains a case. What changes is that the full shape is now a **choice with a stated alternative** rather than the only path, and that a short `SKILL.md` can be reviewed against a criterion instead of an impression.

The cost is a second shape to learn and a judgement call at its boundary — a skill with two ordered steps is full, and someone has to say so. **The criterion is prose, not a gate**: nothing in `test/` can measure "multi-step", so it holds in review or not at all. That is the same standing as the [naming rules](../../skills/README.md#naming) and the reference rules beside it, and it is why the criterion is written as one sentence a reviewer can quote.
