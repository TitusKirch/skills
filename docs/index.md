---
title: 'TitusKirch skills documentation'
description: 'Reusable Claude Code agent skills — how they are built, configured per repo, and how they work together.'
---

# TitusKirch skills

This repository publishes reusable Claude Code agent skills. Each skill is self-documenting in place — `SKILL.md`, plus `REFERENCE.md` and `DESIGN.md` where the mechanics or the reasoning need room. A skill ships on its own, so it has to carry its own documentation.

That leaves exactly one thing without a home: what spans **more than one** skill. This tree is only that.

## Sections

- [Concepts](1.concepts/) — how the skills reach each other, and the lifecycle their two work loops share.

Everything else has a canonical home already: the [root README](../README.md) for the catalogue and installation, [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contribution workflow, [`skills/README.md`](../skills/README.md) for the skill layout and frontmatter contract, and [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json) for every config key. No section here restates them.
