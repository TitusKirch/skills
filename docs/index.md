---
title: 'TitusKirch skills documentation'
description: 'Reusable agent skills — how they are built, configured per repo, and how they work together.'
---

# TitusKirch skills

This repository publishes reusable agent skills — for Claude Code, Codex, Cursor, OpenCode and friends. Each skill is self-documenting in place — `SKILL.md`, plus a `REFERENCE.md` where the mechanics need room (and, for `work-implement` alone, a `DESIGN.md`). A skill ships on its own, so it has to carry every rule that steers what it does.

That leaves two things without a home, and this tree is both: what spans **more than one** skill, and the **record of what was decided** — including a single skill's own shape, because a record addresses a human and an installed copy does not need it ([ADR-0031](99.adr/0031-keep-rationale-as-repo-memory.md)).

## Sections

- [Concepts](1.concepts/) — how the skills reach each other, and the lifecycle their two work loops share.
- [Architecture decisions](99.adr/) — the decision log: what was chosen, what lost, and why.

Everything else has a canonical home already: the [root README](../README.md) for the catalogue and installation, [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contribution workflow, [`skills/README.md`](../skills/README.md) for the skill layout and frontmatter contract, and [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json) for every config key. No section here restates them.
