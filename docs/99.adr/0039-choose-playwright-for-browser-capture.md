---
title: 'Choose Playwright for browser capture'
description: 'Browser capture gets a sibling to vhs-demo, with application-owned TypeScript specifications and a pinned Docker environment; the choice follows workflow features rather than a speed claim.'
status: 'accepted'
date: '2026-10-12'
---

# ADR-0039 — Choose Playwright for browser capture

## Context

A terminal recording cannot demonstrate a browser UI. A useful documentation screenshot needs a committed recipe for the intended application state, because a valid PNG can still show an unhydrated page, missing fonts or the wrong theme. Capture also needs a browser and a running application, a different tool surface from writing documentation.

The evaluation behind [issue #286](https://github.com/TitusKirch/skills/issues/286) used `duxt/apps/www` as a real consumer. Desktop and mobile captures of its `/getting-started` page succeeded; hiding the changing development overlay made two desktop captures byte-identical. A four-driver comparison using one Chromium build and a frozen recording of that page found that all four produced valid, closely matching images. The [dated evaluation and retained evidence](/concepts/gui-capture-evaluation) explain what was measured and what was excluded. The results did not establish Playwright as the fastest driver.

## Decision

**Choose Playwright with TypeScript for a browser-capture sibling to `vhs-demo`, with Chromium as the default and a pinned Docker environment.** The package and browser-image versions must match. The choice values UI interactions, action waiting, failure traces and optional visual assertions together. These facilities support a recipe that can reach and explain a UI state; action waiting alone does not establish application hydration. Other browser engines and image-diff assertions are extensions, rather than prerequisites for a first PNG workflow.

**The application owns its executable capture specification and readiness assertions.** The intended flow is a committed spec, explicit UI readiness checks, PNG capture, output verification and a trace retained on failure. The recipe fixes viewport, device scale, locale, timezone and theme, waits for hydration, fonts and images, and suppresses known changing UI. Dimensions and file size verify an output, while application assertions verify its meaning. Consumer-specific executable specifications belong in the application repository; the published skill carries the capture workflow.

**Capture and documentation inclusion have separate owners.** The sibling owns the artifact and its reference. `write-docs` decides whether a page needs that artifact and applies its [media contract](https://github.com/TitusKirch/skills/blob/ef9f8eebc0ce10f1eba9344f6165658cef4564ec/skills/docs/write-docs/REFERENCE.md#media): documentation media and capture sources under `docs/_assets/`, README-specific media under `.github/assets/`, reuse where both contexts need the same artifact, and explicit verified locale variants where the visible UI language requires them. A translation sweep does not render captures. Capture evaluation does not depend on documentation inclusion being implemented.

## Consequences

The consumer prerequisite was satisfied by the Duxt evaluation. Implementing and naming the sibling skill remains follow-up work; this decision does not introduce a skill or a production capture spec.

A pinned browser environment narrows variation but does not guarantee byte identity or freshness. The application still supplies stable data and a readiness contract, and updates to the browser environment can change rendering. Failure traces make a broken recipe inspectable; the benchmark itself did not measure trace overhead or exercise a production failure-trace workflow.

## Alternatives considered

- **Puppeteer** produced comparable fresh-process results and lower screenshot-only medians in this evaluation. Its locators also wait for suitable element state. Playwright was chosen for the combined interaction, trace and assertion workflow, rather than an assertion that Puppeteer cannot capture or wait.
- **Rust through chromiumoxide or headless_chrome** produced valid images too. The benchmark did not show a general Rust advantage, and introduced a Rust dependency/build path into a TypeScript consumer without a corresponding workflow need. The lower chromiumoxide screenshot-only median did not decide the end-to-end capture design.
- **A screenshot mode in `write-docs`** would couple page inclusion to browser execution and widen a documentation skill's tool surface. Keeping the ownership seam permits capture tooling to evolve independently.
- **A GUI mode in `vhs-demo`** would join unrelated drivers: VHS operates a terminal, while this workflow operates browser UI. Native desktop application capture was outside the evaluated scope.
- **Hand-taken or session-only screenshots** can help inspect a change but do not supply the committed, regenerable recipe this workflow requires.
