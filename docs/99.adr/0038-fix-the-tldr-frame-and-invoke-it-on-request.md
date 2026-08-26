---
title: 'Fix the tldr frame and invoke it on request'
description: 'What was settled for tldr: a fixed first and last section with a named middle, an empty section dropped rather than filled, terminal text rather than a file, and no persistent formatting mode.'
status: 'accepted'
date: '2026-08-26'
---

# ADR-0038 — Fix the tldr frame and invoke it on request

## Context

`tldr` summarises what just happened into a fixed section order over one scope. Its shape was settled in a `grilling` pass on the issue that specified it, rather than inferred. Relocated from the skill's `REFERENCE.md` under [ADR-0031](0031-keep-rationale-as-repo-memory.md); every part of it that steers what the skill does now lives in the skill's own mechanics as a rule.

## Decision

- **One skill, invoked on request — not a persistent formatter.** The obvious second half, "shorten every answer from now on", is a different genus: it is an **output style**, and it fights the mechanism a skill is invoked by. A skill fires on a description match, which is exactly the reliability an "every response" promise needs and cannot have — the persistent formatters that exist have to write "still active if unsure" precisely to compensate. Two skills would also put two near-identical descriptions in competition at every invoke.
- **The "last answer" scope stays.** It is the cheapest of the three, runs on the same machinery, and dropping it would leave the skill unable to answer the most common form of the request.
- **Fixed frame, named middle.** Naming every section for its content maximises fit per run and destroys skimmability across runs; fixing every section produces `## Verified — none` on a summary of a paragraph of prose. Fixing the ends and naming the middle keeps the shape a reader has learned while letting the substance be called what it is.
- **An empty section is dropped, not filled.** Rejected: **every section always, "none" included** — maximally predictable and diffable, but it pads a two-line summary with empty headings, and a frame that is mostly filler stops being read.
- **Git is read whenever the subject is work.** Rejected: **conversation context only** — cheap, and usable outside a repo, but it goes quietly incomplete after a compaction with nothing to signal the gap.
- **Terminal text, never a file.** This is the line against `handoff`. A summary that lands in the repo is a document with a lifecycle, an id and a deletion rule, which is a different skill and already exists.
- **No config section.** The frame is fixed on purpose, so there is nothing for a repo to vary; a `tldr.*` section could only ever be empty, and adding one later is additive while removing one is a break. `language` is read because every skill that writes prose reads it.
- **`work/`, not a new category.** Its neighbour `handoff` is likewise neither an issue nor a work loop, and a fifth category holding exactly one skill would be reserved for neighbours that do not exist. `docs/` was the other candidate — it is the category that produces text — but everything in it writes a file into the repo, and this skill writes none.
- **The name is `tldr`, not `work-tldr`.** The category carries the grouping; a shared stem is for a family read as one unit (`work-implement` / `work-implement-queue`), which this is not.

## Consequences

Fixing the ends and naming the middle is what makes a repo-level knob pointless: there is nothing left to vary, which is why the skill owns no config section and why adding one later stays additive.

Refusing the persistent-formatter half is the boundary worth remembering. "Shorten every answer from now on" is an **output style**, and a skill fires on a description match — exactly the reliability that promise needs and cannot have.
