---
title: 'Refuse a grant headed by an exec-capable command'
description: 'A scoped allowed-tools rule whose head can run another command is a blanket Bash spelled narrowly, so the gate refuses it unless a named spelling is cleared with a reason.'
status: 'accepted'
date: '2026-11-23'
---

# ADR-0043 — Refuse a grant headed by an exec-capable command

## Context

[ADR-0017](/adr/0017-make-a-blanket-bash-grant-a-named-exception) made a blanket `Bash` grant a named exception and scoped every other skill one at a time. A scoped list only narrows if each rule does. A permission rule is a **command-prefix match**, so `Bash(sh:*)` matches `sh -c '<anything>'`, `Bash(find:*)` matches `find . -exec <anything> \;`, and `Bash(git:*)` matches `git -c alias.x='!<anything>' x`.

## Decision

**A scoped rule must not be a blanket `Bash` spelled narrowly.** A rule headed by a command whose job is to run another command grants everything the blanket form grants while reading, in review, as a narrowing. So the gate carries a second list: command heads that can execute, each with the mechanism named, and a small set of exact prefixes cleared despite an exec-capable head because that spelling cannot (`git diff`, `command -v`). Clearing costs a written reason, exactly as a blanket grant does.

**Some subcommands are exec routes their head does not explain.** `git push --receive-pack=<cmd>` and `git fetch --upload-pack=<cmd>` run their argument on the far side, which a filesystem remote makes this machine; `git config` writes the `core.pager`, `core.editor` and `alias.*` that the clears declare out of scope. These are not clearable at any narrowing, so the gate lists them separately and the skills that drive them let them ask. Clearing is otherwise by **token prefix**, because the reason a clear gives is a property of the subcommand.

**The gate is a floor, not a proof of confinement.** It catches primitives whose _purpose_ is to run something else; it cannot catch every escape hatch in every binary, and a list that passes still confines nothing — [ADR-0005](/adr/0005-keep-allowed-tools-as-pre-approval) already settled that the durable controls are `disallowed-tools` and `.claude/settings.json` deny rules. What the scoped form buys is a smaller set of things that happen **without anyone being asked**, and a list whose claims are true. Any prose describing a scoped list as a boundary is wrong and should be corrected to say what it is: documented intent, and a reduced silent surface.

The lists, each entry with its mechanism or its reason, live in [`test/allowed-tools.test.ts`](https://github.com/TitusKirch/skills/blob/main/test/allowed-tools.test.ts).

## Consequences

A skill that reached for `sh`, `find` or `sed` now prompts where a one-line grant would have silenced it. It also decided what a scoping was allowed to be — a skill whose real work runs through a shell or a container cannot be scoped honestly and belongs on the named-exception list, saying so, rather than carrying a `Bash(sh:*)` or a `Bash(docker:*)` that reads like progress.
