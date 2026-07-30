---
title: 'Render every plan where it is read'
description: 'A plan is read once, in a terminal, so nothing in it may sit behind a control a terminal cannot open — mirrored as one rule rather than decided per run.'
status: 'accepted'
date: '2026-07-30'
---

# ADR-0019 — Render every plan where it is read

## Context

`update-deps` produced a plan whose per-ecosystem package lists were wrapped in collapsible HTML `<details>` blocks. In a terminal those render as nothing: the `<summary>` line prints, the list underneath does not. The Node lists and the PHP list — the bulk of what the plan exists to show — never arrived, while every plain table and paragraph in the same plan came through intact. The failure tracked the **container**, not the content.

What makes that worse than a formatting slip is that it is silent on both sides. The skill believes it reported; the reader sees no marker saying anything is missing, so the confirmation gate every writing skill rests on gets answered on a plan whose contents never reached the person answering. And the sections that get folded are the long ones, which is to say the ones the decision actually rests on.

Nothing in the skill caused this. The plan step prescribed **what** to report — moved, held, and why — and said nothing about the **form** the report takes. With no constraint stated, the choice fell to the agent per run and drifted toward whatever compresses a long list; collapsible HTML is the obvious reach, and on GitHub it would have been the right one. The same gap sits in every other skill that presents a plan before writing, all of which produce lists of comparable length.

## Decision

**A plan renders where it is read.** Everything a skill puts in front of a human — plan, preview, candidate list, findings report — arrives fully rendered in the terminal, with no interaction needed to reveal any part of it. Nothing may sit behind a control the terminal has no way to open: `<details>`/`<summary>`, a tab strip, an accordion, a "show more".

**Length is handled by shortening, never by hiding.** Trim to what the decision needs, group the rest with a count per group, or split it across sections — and say what was left out, how much of it, and the exact command that shows the rest. Omission is a thing the reader can see; folding is not.

**The rule binds what a skill presents, not what it writes.** A `<details>` block inside a README, an issue body, a PR description or a docs page is rendered by a browser and stays entirely legitimate — `compact-readme` exists to write them. The constraint is on the message a human reads to decide.

**It is mirrored, not written per skill.** The canonical text lives in `scripts/plan-block.md` and `pnpm skills:sync` writes it into every skill carrying a `<skills-plan>` element, the mechanic [ADR-0003](0003-mirror-shared-content-into-each-skill.md) settled for shared content and the fifth contract to use it. A rule stated once per skill is a rule that gets worded fifteen ways and drifts; a rule stated in a repo-root document is one an installed skill cannot read at all.

**Carriers are declared, in `test/isolation.test.ts`.** Both failure directions are invisible on disk — a skill that starts presenting a plan without the block re-decides the form per run, and a carrier that lost its block keeps the prose promising it — so the roster is asserted against the tags rather than inferred from them. Half of it is derived as well: every skill announcing a plan-only mode must carry the block, since a skill promising to print a plan and stop is presenting one by definition.

**Rejected: fixing `update-deps` alone.** It is where the failure was observed, not where it lives. Every plan-presenting skill had the same unstated form, so a local fix would have left the next one to rediscover it.

**Rejected: forbidding HTML in a skill's output generally.** Too broad to be true — a skill writing a README or an issue body has good reason to emit HTML, and a rule contradicted by legitimate cases is a rule that gets ignored in the illegitimate one.

**Rejected: a length budget for plans.** It answers the wrong question. A long plan that renders is fine; a short plan that arrives folded is not.

## Consequences

Fifteen skills carry a section they did not need to write, and a sixteenth cannot be added without deciding whether it presents a plan — which is the intended cost: the classification is forced at the point a skill is added rather than after a plan arrives empty.

A skill presenting a genuinely large list now has to make the trimming visible instead of deferring it to a widget. That is more work per report and produces a shorter one, which is the trade the decision buys.

The two mechanisms sitting closest to this — the plan-only trigger vocabulary and the confirmation gate — both assume the plan reached the reader. This is the first rule that states the assumption rather than relying on it.
