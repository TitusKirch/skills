---
name: decide
metadata:
  summary: Closes the open decisions a run already named by asking each one as a select dialog.
description: Closes the open decisions a run has already named by putting each one in front of the human as a select dialog — concrete options with the recommendation first, one question at a time, in dependency order, and a prose question where a decision has no distinct options. It drives whichever interview skill grillWith names, forcing the dialog form; with no engine configured it forms the questions itself and asks them as dialogs anyway. The answers go back where the context says they belong — an issue body, the artifact the decisions came from, or the terminal — previewed and confirmed first. Manually invoked only, never inside an unattended loop. Use when a run ended by listing open questions, decisions or trade-offs and the user wants to work through them, asks to decide, settle or answer them, or says things like "let's decide these", "ask me these as options", "entscheide die offenen Punkte", "frag mich das der Reihe nach".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - Bash(jq:*)
  - Bash(printf:*)
---

# decide

Take the decisions a run has **already named** and close them — each one arriving as a **select dialog** with concrete options, rather than as a paragraph somebody has to answer by typing. One decision at a time, in dependency order, with a recommendation offered first.

**The dialog is the whole contribution.** The interviewing itself stays with whichever engine the repo configures; this skill supplies that engine with the decisions, forces the form every question arrives in, and carries the answers back. A wrapper that started asking questions of its own would be a second interview competing with the one the repo already chose.

**Where this sits next to `grilling`.** `grilling` **generates** questions — it probes freely and adversarially, and widens until nothing is left unexamined. This skill **closes** questions that already exist: it takes a list that is fixed before the run starts, and the run is over when that list is answered. Same territory, opposite direction. `grilling` is not this repo's skill, so the boundary is stated here only, and stated as **this skill's own limit** rather than as a claim about what `grilling` does.

**Manually invoked, never inside a drain.** The entire product is a question a human answers, so it has no meaning unattended — the work-loop queues remove the dialog tool outright, and this skill lives on the other side of that line: somebody types `/decide`.

**It is not itself an interview engine.** `grillWith` names the skill that conducts an interview; this one is a **caller** of that skill, so it never belongs in that key. A repo that names it there has configured a loop.

## Workflow

### 1. Collect the decisions

**The input is the session, not a tracker.** What this skill closes is a list that already exists — a `refine-issue` run that ended `still open`, a plan's open questions, a gap or findings report, a design note that named its trade-offs. Take them **as the run named them**, in the caller's own words, and add none.

- **Nothing named, nothing to close.** Where no run in the session listed any decision, say so and stop. Manufacturing a list to have something to ask is the failure this skill exists to avoid, not its fallback.
- **Look up what is findable rather than asking it.** A question the repo's own files, its git state, or the issue the session points at already answers is not an open decision. That rule comes with the interview engine, which already states it — it is not restated here, and it is not this skill's to relax.
- **Drop what the session has since settled.** A decision answered later in the same session is closed already; asking it again spends the attention this skill is trying to save.

Where the decisions come from and what disqualifies one: [REFERENCE.md](REFERENCE.md#what-counts-as-an-input-decision).

### 2. Load config and resolve the engine

Resolve `.tituskirch-skills.json` via [`templates/resolve-config.sh`](templates/resolve-config.sh), never by reading the raw file ([REFERENCE.md](REFERENCE.md#reading-the-config) states how, missing `jq` included). Two root keys, and nothing else: **`grillWith`** names the interview engine, and **`language`** decides the language the questions and the written answers are in. This skill owns no config section, resolves no forge, and reads no tracker.

- **Three values means three states, so read `grillWith` by presence** — absent means `grilling`, a name means that skill, and an explicit `null` / `false` means no engine at all. The `// empty` recipe collapses an explicit `null` into an absent key and would drive `grilling` where the repo configured otherwise: [REFERENCE.md](REFERENCE.md#reading-grillwith--three-states-not-two) states the read.
- **The engine is an optional call, and its fallback is not a stop.** Installed → drive it, seeded with the decisions from step 1. **Absent, or `null` / `false` → drive no engine**: form the likely questions from the context itself and **still ask them as dialogs**. The dialog is what this skill contributes, and it survives the engine's absence — which is the one way it differs from `refine-issue`, whose run has nothing left to do without one.
- **An engine no skill may drive is a config error, not a substitution.** `grill-me` and `batch-grill-me` declare `disable-model-invocation: true`, so neither is a valid value. Report the error, then take the no-engine path above — never quietly swap in a different engine.

### 3. Order them, dependency first

Ask in the order the answers **constrain** each other, not in the order the list happened to be written. The first answer usually decides the shape of the rest, and a question asked before the one it depends on either gets answered twice or gets answered wrong.

- **Independent decisions keep the caller's order.** Reordering what does not need reordering only makes the list harder to recognise.
- **A dependency that collapses a later question removes it.** Say which question the answer just closed, rather than asking it anyway for symmetry.

### 4. Form the options — or ask in prose

Each decision becomes **two to four concrete options**, and the recommendation comes **first and is named as the recommendation**. An option states the decision it makes ("keep the answers in the issue body"), never a label for a discussion ("body vs comment"). Options must be **mutually distinct**: two spellings of the same choice is a dialog that decides nothing.

**A decision that does not fit a small set of distinct options is asked in prose.** This is a first-class outcome, not a degradation — an open-ended value (a name, a threshold, a budget), an answer on a continuum, or a question whose honest options are "whatever you had in mind" all belong here. **Inventing alternatives to fill a picker is worse than the plain question**, because a fabricated option is indistinguishable from a considered one once it is on screen. Leaving a decision open is likewise a real answer, and it is reported as one.

What earns the prose form, and how the options are shaped: [REFERENCE.md](REFERENCE.md#forming-the-options).

### 5. Ask them, one dialog at a time

Drive the engine over the ordered list, **forcing the dialog form** on every question that has one. One question on screen at a time; the next is formed after the previous is answered, so a dependent decision is shaped by the answer it depends on rather than guessed alongside it.

- **Every dialog can be escaped.** A decision the human declines, defers, or answers off-menu stays open and is reported as open. A picker with no way out turns a question into a trap.
- **A batch of questions is not this skill.** Presenting the whole list at once loses the ordering that made it worth asking one at a time.

### 6. Write the answers where they belong, then report

**The context decides the target, and every write is previewed first:**

| The decisions came from                             | The answers go to                                                                |
| :-------------------------------------------------- | :------------------------------------------------------------------------------- |
| an **issue** the session points at                  | that issue's body, in the shape `refine-issue`'s `Decided` block already defines |
| an **artifact** — a plan, a design note, a doc page | that artifact, where the decisions it names live                                 |
| **nothing named**                                   | the terminal, and nothing is written                                             |

- **The `Decided` block is named, never copied.** Its shape, its dating and its supersedes rule belong to `refine-issue` and are read there; restating them here would give one format two definitions to drift apart. **Optional call** — without `refine-issue` installed the answers still go into the body, written in the plainest form of that block this run can state, and the report says the shape was not read from its owner.
- **It resolves no forge and no tracker.** A write into an issue goes through the path the **session has already established** for that issue. Where the session established none, the target is not an issue — fall back to the terminal and say so, rather than reaching for a forge this skill does not resolve.
- **Preview the whole edit, then write only after confirmation** — once per target, every time. **Plan-only triggers** ("nur den Plan", "dry run", "just show me", "don't write it", "nicht schreiben") → print the exact edit and **stop**.
- **The report is what closed and what did not** — each decision with the answer taken, each one left open with why, and where the answers were written. An open decision is never rounded up to a closed one.

Target resolution and the report's shape: [REFERENCE.md](REFERENCE.md#where-the-answers-go).

<skills-plan>

## Presenting the plan

Everything this skill puts in front of a human — plan, preview, candidate list, findings report —
is read **once, in a terminal**, and answered there. So **every section of it renders on arrival**,
with no interaction needed to reveal it: prose, lists, tables, fenced code.

**Never fold content behind a control.** `<details>`/`<summary>` is a browser widget, and a
terminal has no way to open it: the summary line prints and everything under it does not. The plan
then arrives as headings with nothing beneath them, and the failure is silent on **both** sides —
the skill believes it reported, and the reader sees no marker saying anything is missing, so a
human confirms a plan whose contents never reached them. What gets folded is whatever ran long,
which is to say the part the decision actually rested on. The same holds for anything else needing
a click: a tab strip, an accordion, a "show more".

**Length is handled by shortening, never by hiding.** This is a fixed rule of the skill, not a
per-run judgement, so it holds however long the list runs. Trim to what the decision needs, group
the rest by something the reader already thinks in (ecosystem, kind, verdict) with a count per
group, or split it across sections. What is left out is left out **visibly**: say how many, why,
and the exact command that shows the rest.

**This binds what the skill presents, not what it writes.** A `<details>` block inside a README, an
issue body, a pull request description or a docs page is rendered by a browser and is entirely
legitimate there. The rule is about the message a human reads to decide — never about the content
of a file.

</skills-plan>

## Guardrails

- **Close named decisions, never invent them.** The list comes from the session; a run with no list says so and stops.
- **One question on screen, in dependency order.** Never a batch, never the caller's order where the answers constrain each other.
- **The recommendation is offered, never applied.** No decision is taken on the human's behalf, and a declined or deferred question stays open in the report.
- **Never press a decision into a picker.** No small set of distinct answers means a prose question or an open decision — inventing options to fill a dialog is the one failure worse than not asking.
- **It asks; it does not implement.** No branch, no commit, no push, no label, and no change to the code the decisions are about. The only thing it writes is the answers, into the target it previewed.
- **A missing engine degrades, never blocks.** Without the skill `grillWith` names — or with the key set to `null` / `false` — form the questions from the context and ask them anyway. An engine that is present but declares `disable-model-invocation` is reported as a config error and never silently swapped for another.
- **Attended only.** This skill is never part of an unattended drain, and it never answers its own questions to keep a run moving.
- **Attribution-free & secret-free** — no `Generated with`/🤖 line, no session url, no agent self-naming in what is written; scan the answers and the context for secrets and exclude them.

## Reference

**Open it at step 1** when it is unclear whether something the session listed is an input decision at all — the disqualifiers are what keep a run from asking questions the repo has already answered. **At step 2** for the `grillWith` read, which has three states and a recipe that silently collapses two of them. **At step 4** before forming options for a decision that resists them, which is where a picker gets fabricated. And **at step 6** to settle which target the answers belong to when the session names more than one: [REFERENCE.md](REFERENCE.md).

What finds the open decisions on a filed issue in the first place is `refine-issue` — a mention, not a call: nothing here hands it work, and the one thing this run reads from it is the `Decided` block's shape at step 6, which is the optional call declared there. The free, adversarial probing this skill deliberately does not do belongs to whichever engine `grillWith` names, and driving that engine is step 2's optional call.
