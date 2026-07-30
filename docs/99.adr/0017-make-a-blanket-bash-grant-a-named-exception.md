---
title: 'Make a blanket Bash grant a named exception'
description: 'Scope allowed-tools one skill at a time, with a gate that makes the scoped form the default and the blanket grant something someone has to write down.'
status: 'accepted'
date: '2026-07-29'
---

# ADR-0017 — Make a blanket Bash grant a named exception

## Context

[ADR-0005](0005-keep-allowed-tools-as-pre-approval.md) established that `allowed-tools` is **pre-approval, not restriction**, and drew the consequence: "Scope the grant. `allowed-tools: Bash(git:*) Bash(gh:*) Read` pre-approves what a skill actually does, rather than a blanket `Bash`." The frontmatter contract in `skills/README.md` has required the scoped form ever since.

Nothing followed. All nineteen skills went on declaring a bare `Bash`, and `skills/README.md` recorded the gap as a known deviation — "`allowed-tools` content is unsettled per skill" — because rewriting nineteen tool lists in one pass would be a large diff built on guesses about what each skill actually drives.

That left the repo's own written contract violated nineteen times, in the one place where the violation has a security shape rather than a cosmetic one: a skill with blanket `Bash` runs any command unattended without a prompt, which is exactly what ADR-0005 said the scoping — not the field's presence — was there to prevent. And the deviation note was self-perpetuating: a new skill's author copies a neighbour, inherits the blanket grant, and adds a twentieth violation without ever making a decision.

## Decision

**Keep migrating one skill at a time, but invert which form is the default.** A blanket `Bash` is no longer what a skill gets by saying nothing; it is an entry someone has to add to a named list, with the reason it cannot be scoped. `test/allowed-tools.test.ts` holds that list and pins it in **both** directions:

- a skill granting bare `Bash` that is **not** on the list fails — so a new skill inherits the scoped form;
- a skill on the list that **no longer** grants bare `Bash` fails — so the list can only shrink, and scoping a skill forces its entry out.

The first two skills scoped are the read-only ones, where the set is least contentious: `validate-skills` (its guardrail is _Report, do not repair_) and `prune-comments` (report-first, confirms before removing, never commits). `prune-comments` is the sharper demonstration: its scoped list carries `git diff`, `git ls-files`, `git rev-parse` and `git symbolic-ref`, and leaves `git commit`, `git push` and `git checkout` **un-pre-approved** — they still run when a person says yes, they just never run silently, which matches a guardrail the skill already wrote down in prose.

**What reads is pre-approved; what writes asks.** That is the rule the remaining migrations followed, and it falls straight out of the one above: `prune-branches` leaves out the `git push` that deletes a branch, `pull-request` the `gh pr create`, `release` the `gh pr merge`, `issue` its three `gh issue` writes. Each of those skills already promised in prose to confirm before that exact action, so the grant and the guardrail now say the same thing, and the single prompt a run stops on is the one a person was going to be asked about anyway. A skill that reads and writes nothing outside the editor tools pre-approves **no** command at all — `write-readme` scaffolds a README through Read/Write/Edit and drives nothing, so requiring a token `Bash(…)` would have it invent one.

**Some subcommands are exec routes their head does not explain.** `git push --receive-pack=<cmd>` (also spelled `--exec=<cmd>`) and `git fetch --upload-pack=<cmd>` run their argument on the far side, which a filesystem remote makes this machine; `git config` writes the `core.pager`, `core.editor` and `alias.*` that the clears below declare out of scope, turning a one-step grant into a two-step one. These are not clearable at any narrowing, so the gate lists them separately and the skills that drive them let them ask. Clearing is otherwise by **token prefix** — an entry for `gh pr` covers `gh pr list`, because the reason a clear gives is a property of the subcommand — which is what lets a skill pin the narrow rule it needs without the list carrying an entry per subcommand.

**A scoped rule must not be a blanket `Bash` spelled narrowly.** A permission rule is a **command-prefix match**, so `Bash(sh:*)` matches `sh -c '<anything>'`, `Bash(find:*)` matches `find . -exec <anything> \;`, and `Bash(git:*)` matches `git -c alias.x='!<anything>' x`. A rule headed by a command whose job is to run another command grants everything the blanket form grants while reading, in review, as a narrowing — the one outcome this ADR exists to prevent. So the gate carries a second list: command heads that can execute, each with the mechanism named, and a small set of exact prefixes cleared despite an exec-capable head because that spelling cannot (`git diff`, `command -v`). Clearing costs a written reason, exactly as a blanket grant does. This is what removed `sh` and `sed` from `prune-comments` and `find`, `sed` and `sort` from `validate-skills` — the enumeration was real, the narrowing was not.

**The gate is a floor, not a proof of confinement.** It catches primitives whose _purpose_ is to run something else; it cannot catch every escape hatch in every binary, and a list that passes still confines nothing — [ADR-0005](0005-keep-allowed-tools-as-pre-approval.md) already settled that the durable controls are `disallowed-tools` and `.claude/settings.json` deny rules. What the scoped form buys is a smaller set of things that happen **without anyone being asked**, and a list whose claims are true. Any prose describing a scoped list as a boundary is wrong and should be corrected to say what it is: documented intent, and a reduced silent surface.

**Not every entry is a migration backlog.** With the migration finished, every reason left on that list is permanent, and the list records which:

- a skill that runs the repo's own `verify` drives **whatever the consuming repo declares**, and no fixed pattern pre-approves an arbitrary command without pre-approving every command;
- an unattended queue skill (`disallowed-tools: AskUserQuestion`) has nobody to answer a permission prompt, so a narrow grant converts a prompt into a hang;
- a skill whose work **is** a container invocation grants `docker`, which takes the command it runs as an argument — `vhs-demo` scoped would read `Bash(docker:*)`, the blanket grant spelled longer.

**What is deliberately left to prompt is part of the decision, not an oversight.** The field is pre-approval, so an unlisted command still runs — it just asks first. `validate-skills` therefore does **not** pre-approve `uvx`, `pip` or `python -m venv`: installing code from the network is the clearest such action, and the skill is invoked by a person who is present to give it. The per-skill reasoning lives with the skill ([ADR-0014](0014-let-rationale-travel-with-the-skill.md)); the list in the test carries only why the grant is still blanket.

Rejected: **rewriting all nineteen in one pass**, for the reason `skills/README.md` already gave — what each skill needs is a per-skill judgement, and a sweep would encode nineteen guesses at once. Rejected: **leaving it as a documented deviation**, which is the state that produced nineteen violations and would produce the twentieth. Rejected: **counting instead of naming** (an assertion that N skills are scoped), which ratchets a number without recording a single reason and passes just as well when the wrong skill is scoped.

## Consequences

The contract and the catalogue now agree by construction rather than by intention. The gap is closed: thirteen of the nineteen skills are scoped, and the six that are not each carry a reason that is permanent rather than pending. What the list guards from here is the twentieth skill, which inherits the scoped form instead of a neighbour's blanket grant.

The cost is a list to maintain, and it is real — the same two-copies-of-one-fact shape [ADR-0009](0009-enforce-the-agents-md-mirror-in-the-gate.md) and `test/conformance-gate.test.ts` already carry. It is bounded the same way: the list is pinned to the catalogue in both directions, so it cannot drift, only shrink.

Scoping a skill costs a permission prompt wherever the scoped list is wrong or incomplete. That is the correct failure mode and the reason the migration ran through human-attended skills only — a prompt is an inconvenience there and a hang in an unattended loop, which is why the two queue skills are on the permanent side of the list rather than in the migration. Resolving the config is the prompt every scoped skill now pays: it runs through `sh`, so it asks once per run.

Refusing the exec primitives raises that cost on purpose: a skill that reached for `sh`, `find` or `sed` now prompts where a one-line grant would have silenced it. Across the migration it also decided what a scoping was allowed to be — a skill whose real work runs through a shell or a container cannot be scoped honestly and belongs on the named-exception list, saying so, rather than carrying a `Bash(sh:*)` or a `Bash(docker:*)` that reads like progress.
