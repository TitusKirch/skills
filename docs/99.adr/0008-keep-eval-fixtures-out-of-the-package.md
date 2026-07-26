---
title: 'Keep eval fixtures in the skill folder, out of the package'
description: 'evals/ is a development artifact: versioned beside the skill, excluded from anything installed.'
status: 'accepted'
date: '2026-07-25'
---

# ADR-0008 — Keep eval fixtures in the skill folder, out of the package

## Context

Evaluating a skill needs test cases — prompts, expected outputs, assertions — and the standard's method puts them in `evals/evals.json` **inside** the skill directory. That collides with this repo's rule that a skill ships self-contained: everything in the folder travels to the installation, and an installed skill has no use for its own test fixtures.

The apparent choice was between conforming to the method and keeping installations clean.

## Decision

Both. `evals/` lives **inside** the skill folder and is **excluded from anything installed**. Anthropic's own tooling resolves it the same way — `package_skill.py` carries `ROOT_EXCLUDE_DIRS = {"evals"}`, excluding the directory at the skill root while leaving a nested one alone. None of the seventeen skills in `anthropics/skills` ships an `evals.json`.

`pnpm skills:link` follows the same rule: a skill carrying a dev-artifact directory is linked entry by entry rather than whole-folder, so the fixture stays out of `~/.claude/skills/`.

Rejected: **a central `test/evals/<skill>/` tree**, which keeps installations clean but breaks the method's own layout and separates a fixture from the thing it tests.

## Consequences

"Self-contained" now means _what ships_ is self-contained, not _what is versioned_ — a distinction the rule did not previously have to make, and one that any future dev-artifact directory inherits.

The exclusion lives in two places (packaging and `skills:link`) and must agree. A third distribution path added later has to be taught the same rule, or a fixture leaks into an installation.
