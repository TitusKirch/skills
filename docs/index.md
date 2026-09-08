---
title: 'TitusKirch skills documentation'
description: 'Reusable agent skills — how they are built, configured per repo, and how they work together.'
---

This repository publishes reusable agent skills — for Claude Code, Codex, Cursor, OpenCode and friends. Each skill is self-documenting in place — `SKILL.md`, plus a `REFERENCE.md` where the mechanics need room (and, for `work-implement` alone, a `DESIGN.md`). A skill ships on its own, so it has to carry every rule that steers what it does.

That leaves two things without a home, and this tree is both: what spans **more than one** skill, and the **record of what was decided** — including a single skill's own shape, because a record addresses a human and an installed copy does not need it ([ADR-0031](/adr/0031-keep-rationale-as-repo-memory)).

## Sections

::page-cards
::

Everything else has a canonical home already: the [root README](https://github.com/TitusKirch/skills/blob/main/README.md) for the catalogue and installation, [`CONTRIBUTING.md`](https://github.com/TitusKirch/skills/blob/main/CONTRIBUTING.md) for the contribution workflow, [`skills/README.md`](https://github.com/TitusKirch/skills/blob/main/skills/README.md) for the skill layout and frontmatter contract, and [`tituskirch-skills.schema.json`](https://github.com/TitusKirch/skills/blob/main/tituskirch-skills.schema.json) for every config key. No section here restates them.
