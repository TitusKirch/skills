---
name: prune-adrs
metadata:
  summary: Migrates an overgrown decision log onto write-adr's rules, rewriting every reference by script.
description: Migrates an overgrown docs/99.adr/ decision log onto write-adr's rules in reviewed batches — keeps the architecture decisions, moves feature specs, rules, parameters and amendments onto editable docs pages, merges supersede chains that formed before a decision settled, and deletes what remains. The judgement goes into a tab-separated map a human confirms; a shipped POSIX script then rewrites every ADR-NNNN token and ADR link across the repo, removes the records and their index rows, and proves no reference to a removed id is left. Breaks append-only once, on purpose, and records that it did. Invoke manually only — never fires proactively, never commits or pushes. Use when the user wants to prune, clean up, consolidate, shrink or migrate an ADR log, says the ADRs got out of hand, or says things like "clean up the ADRs", "prune the decision log", "ADRs aufräumen", "ADRs nach den neuen Regeln anpassen".
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(printf:*)
  - Bash(wc:*)
  - Bash(git status --porcelain:*)
  - Bash(git rev-parse:*)
  - Bash(git log:*)
---

# prune-adrs

Bring a decision log that grew past its contract back onto `write-adr`'s rules, and leave the repo with **every reference still pointing somewhere real**. The deliverable is a working tree with a log small enough to read, the knowledge that left it on pages that can be edited, and a clean check proving no `ADR-NNNN` dangles. **Manual invocation only**: nothing here fires proactively, and nothing is written before a human confirms the batch. This skill **never commits and never pushes**.

Its one principle:

> **Judgement in the map, mechanics in the script.** Which record stays, merges or moves is a reading of each record against `write-adr`'s threshold — an agent's and a human's call, made once and written down. Rewriting thousands of references is not a judgement at all, so no agent search does it: [`templates/rewrite-adr-refs.sh`](templates/rewrite-adr-refs.sh) applies the confirmed map, the same map always yields the same tree, and its check — not a model's confidence — is what says the migration is complete.

**This breaks append-only, once and on purpose.** `write-adr` forbids deleting or editing a landed record. A log that grew by hundreds of feature specs cannot be repaired inside that rule, so this skill is the single licensed exception: it runs as a deliberate migration, ends by recording that it ran, and leaves `write-adr`'s rule in force for everything afterwards.

**Opted out?** The log is part of the docs tree. If the repo config sets `docs` to `false`, stop immediately and tell the user docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Workflow

### 1. Preconditions — checked before anything is read

- **`write-adr` is required, and checked first.** It holds the rules this migration measures against — the threshold and its table of what is not an ADR, the size budget, the lifecycle. Not installed → stop, name it, and report that nothing was touched. That check is what licenses naming **When a decision earns an ADR** in its SKILL.md and **What the body may hold** and **Size** in its REFERENCE instead of carrying a second copy here.
- **A clean working tree.** The migration touches thousands of files, and the only way a human can review it is as one diff against a known state. `git status --porcelain` not empty → stop and ask for a commit or a stash. Suggest a branch of its own.
- **Resolve the config** with this skill's own [`templates/resolve-config.sh`](templates/resolve-config.sh), by the rules of **Reading the config** in [REFERENCE.md](REFERENCE.md#reading-the-config).

### 2. Inventory — read-only

Measure the log before judging any record of it, and show the numbers: records, median and 90th-percentile body length, records over 500 words, records carrying amendments, supersede chains and how many days each spanned, and how many records arrived in the same commit as a feature change. Recipes: [REFERENCE.md](REFERENCE.md#inventory). The inventory is also the go/no-go: a log that is already small and short needs no migration, and saying so is a complete run.

### 3. Classify — one batch at a time

Read each record **in full** against `write-adr`'s rules and give it exactly one action. Batches of about 50 records, in id order, keep each review readable.

| Action  | When                                                                                                                            | What happens                                                                                 |
| :------ | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| `keep`  | an architecture decision within budget, no amendments                                                                           | nothing                                                                                      |
| `trim`  | an architecture decision that carries borrowed material — parameters, behaviour, implementation detail — or amendments          | that material **moves**, whole sentences, to a page the record then links; the record stays  |
| `merge` | a record superseded before its decision settled (a chain formed within days, a refinement, a duplicate) by a record that stands | references move to the survivor; the record goes                                             |
| `move`  | not an architecture decision — a feature spec, rules, parameters, rollout mechanics, a fix                                      | its content moves, whole sentences, to a page; references move to that page; the record goes |
| `drop`  | nothing worth keeping and **nothing references it**                                                                             | the record goes                                                                              |

**A real reversal is history, not noise.** A decision that landed, was lived with, and was later overturned keeps both records — that is the log working. Only a supersede that happened while the decision was still being worked out is a merge.

**Unsure → `keep`.** A record wrongly kept costs a few hundred words in a log; a record wrongly removed loses the only statement of why. Name the borderline ones in the batch plan so the human decides them.

Write each batch's decisions to a **batch map** — one tab-separated line per record, format in [REFERENCE.md](REFERENCE.md#the-map). Batch maps live under the git common dir, never in the tree, so a run can resume across sessions and nothing of the migration's scaffolding is committed.

### 4. Plan the batch, then confirm

Present the batch: the counts per action, then every record that is not `keep` with its action, its target, and one line of reason. For `trim` and `move`, name the page each sentence group lands on. Nothing is written before the human confirms — they may change any line of the map.

### 5. Apply the batch

1. **Write the pages first** — the script refuses a `move` whose page does not exist. Sentences move whole and are never rewritten. A page follows `write-docs`' contract where that skill is installed; otherwise give it `title` + `description` frontmatter and put it in the section the plan named.
2. **Trim** the `trim` records: remove exactly the moved sentences and any `## Amendments` section, and add one line linking the page. This is an edit to a landed record, and this migration is the only thing that may make it.
3. **Dry run** the script against the batch map and show its summary. Then **`--apply`**. Exit `1` names every reference still pointing at a removed id, and every survivor that now cites itself (a `Supersedes` line rewritten onto its own id). Fix those by hand, then run `--check` until it exits `0`.
4. **Run the repo's own checks** — docs link checks, tests that read ADR ids — before calling the batch done.

Invocation and exit codes: [REFERENCE.md](REFERENCE.md#the-script).

### 6. Close the migration

After the last batch, run `--check` against **every** batch map at once — a later batch can reintroduce an id an earlier one removed. Then offer, through `write-adr`, **one** short record of the migration itself — that the log was pruned, by which rules, and that append-only holds again from here — and the matching sentence in the log's `index.md` introduction.

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

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, by someone deciding what happens
next. So it **opens with its result**: a `## TL;DR` section, before every other heading, carrying
the whole answer in a few lines. A report that opens with its first group makes the reader
reconstruct the total by reading every group and adding it up — which is the one thing they needed
before deciding whether to read any of them.

**Three things belong in the lead, and nothing else does:**

- **The counts** — how much was found, per group, in the same words the groups below use. The
  total is stated, never left to be summed.
- **What the run acted on, or proposes to** — the preselected set, the merged set, the changed
  set: the part that is not merely listed. Where nothing was acted on, say so in those words.
- **The decision being asked for** — the one thing the reader is expected to do, said plainly, or
  **no decision needed** where the run is finished. An ask that is only inferable from the groups
  is an ask the reader has to assemble.

**It leads the detail, it never replaces it.** Every group still renders in full underneath, and
nothing is dropped, shortened or folded for having been counted above. The lead is an entry point;
a summary that licenses hiding what it summarises is the failure this repo already forbids
elsewhere.

**Whatever the run could not establish belongs in the lead too**, not only in the section that
holds it — a check that never ran, a list that could not be read, a tier the run declined to
judge. Each changes what the counts mean, and a reader who stops after four lines must not stop
with a picture the rest of the report would have corrected.

**A run that found nothing still leads with it.** "Nothing found" is a result, and it belongs where
every other result does: one line, naming the scope that was actually searched, so an empty report
and an empty search are told apart.

**The heading follows the output language**, as the rest of the report does — a German run reads
`## Kurzfassung`. What is fixed is the position, not the wording. The `tldr` skill fixes this same
opening for the summaries it writes on request; one house frame, reached two ways.

</skills-tldr>

## Guardrails

- **Manual only; plan per batch; confirm before writing.** Respect plan-only / dry-run: stop after the batch plan, or after the script's dry run.
- **Judgement in the map, mechanics in the script.** References are rewritten by the script and by nothing else — never by an agent search-and-replace, which cannot prove it found every one.
- **Sentences move, they are never rewritten.** On a page and in a trimmed record alike, the author's words survive whole or not at all.
- **Ids are permanent.** A kept record is never renumbered; a removed id leaves a gap that stays.
- **Unsure → keep.** Removal is the direction with no way back.
- **Released history is left alone.** Changelogs keep the ids they shipped with; the script excludes them.
- **Never commits, never pushes.** The result is one reviewable diff in the working tree.
- **Attribution-free and secret-free** — no agent self-naming in pages or records; scan, warn, exclude.

## Reference

- **Open it before the inventory and before every apply** — the inventory recipes, the map's format and rules, the script's modes and exit codes, and where batch maps are kept: [REFERENCE.md](REFERENCE.md).
- **The script itself** documents its contract in its header: [`templates/rewrite-adr-refs.sh`](templates/rewrite-adr-refs.sh).
