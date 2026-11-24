---
name: prune-adrs
metadata:
  summary: Migrates an overgrown or foreign decision log onto write-adr's rules, rewriting every reference by script.
description: Migrates a decision log onto write-adr's rules in reviewed batches — prunes an overgrown docs/99.adr/ (keeps the architecture decisions, moves feature specs, rules, parameters and amendments onto editable docs pages, merges supersede chains that formed before a decision settled) and imports ADRs written elsewhere (docs/adr/ and similar) record by record through the same threshold. The judgement goes into a tab-separated map a human confirms; a shipped POSIX script rewrites every ADR-NNNN token and log link, removes the records, proves every link resolves, renumbers once at the end and keeps a protocol of old ids. Breaks append-only once, on purpose. Invoke manually only — never fires proactively, never commits or pushes. Use when the user wants to prune, clean up, migrate or import an ADR log, says the ADRs got out of hand, or says things like "clean up the ADRs", "import our old ADRs", "ADRs aufräumen", "ADRs nach den neuen Regeln anpassen".
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

Bring a decision log back onto `write-adr`'s rules and leave **every reference pointing somewhere real**: a log small enough to read, the knowledge that left it on pages that can be edited, and a check proving no `ADR-NNNN` dangles. **Manual invocation only**; nothing is written before a human confirms the batch, and this skill **never commits or pushes**.

> **Judgement in the map, mechanics in the script.** Which record stays, merges or moves is a reading — an agent's and a human's, made once and written into a map. Rewriting thousands of references is no judgement at all, so no agent search does it: [`templates/rewrite-adr-refs.sh`](templates/rewrite-adr-refs.sh) applies the confirmed map, the same map always yields the same tree, and its check — not a model's confidence — says the migration is complete.

**This breaks append-only and permanent ids, once and on purpose.** A log that grew by hundreds of feature specs cannot be repaired inside `write-adr`'s rules, so this skill is their single licensed exception: records are trimmed, and after the last batch the log is renumbered without gaps. The run ends by recording that it ran, and the **migration protocol** (`<log>/migration.tsv`, written by the script) maps every old id to what replaced it until everyone involved has signed the migration off.

**Opted out?** If the repo config sets `docs` to `false`, stop immediately and say docs are turned off in `.tituskirch-skills.json`. An _absent_ `docs` block is **not** disabled. Check `.docs == false` on the resolved config before any job — and before indexing `.docs.*`. A missing `jq` or config exits non-zero too, so a pass is not evidence the config was read.

## Jobs

| State                                                      | Job        |
| :--------------------------------------------------------- | :--------- |
| `docs/99.adr/` grew past `write-adr`'s rules               | **prune**  |
| decisions sit in another format or folder (`docs/adr/`, …) | **import** |

## 1. Preconditions — before anything is read

- **`write-adr` is required, checked first.** It holds the rules measured against — **When a decision earns an ADR** in its SKILL.md, **What the body may hold**, **Size** and **Lifecycle — append-only** in its REFERENCE. Absent → stop, name it, report that nothing was touched.
- **A clean working tree** — `git status --porcelain` empty — so the result is one reviewable diff. Suggest a branch of its own. **Each batch starts from the commit a human made of the one before**: this skill never commits, so the human is the integrator, and the next batch begins on that commit, tree clean.
- **Resolve the config** with this skill's own [`templates/resolve-config.sh`](templates/resolve-config.sh) ([Reading the config](REFERENCE.md#reading-the-config)).

## 2. Prune

1. **Inventory, read-only.** Show the numbers first — records, median and p90 length, over 500 words, amendments, supersede chains in days, records a later one overturns or narrows without a pointer, records arriving with a feature change ([recipes](REFERENCE.md#inventory)). A log already small and short needs no migration; saying so is a complete run. **Check the instruction files too** — `CLAUDE.md`, `AGENTS.md` and their kin — for rules that will regrow the log (an ADR per change, comments citing `ADR-NNNN`), and list each with its line and a proposed rewording ([recipe](REFERENCE.md#instruction-files)). They change only on confirmation, in the same diff as the batch they belong to.
2. **Classify one batch of about 50 records**, each read in full, each given one action: `keep`, `trim` (stays, borrowed material and amendments move to a page), `split` (two decisions in one record: trim it to one, and write the other as a new record through `write-adr` — references stay on the original), `merge` (into the record that superseded it before the decision settled), `move` (not an architecture decision — content to a page), or `drop` (nothing worth keeping, nothing references it). **A real reversal is history**: a decision lived with and later overturned keeps both records. **Unsure → `keep`** — a record wrongly kept costs words, one wrongly removed loses the only statement of why. Decisions go into a **batch map** under the git common dir ([format and rules](REFERENCE.md#the-map)).
3. **Plan the batch** — counts per action, then every non-`keep` record with target and one line of reason, and for `trim`/`move` the page each sentence group lands on, borderline ones named. **Word counts are measured, never estimated** — each `trim` and `split` is drafted first, **in the batch directory beside the map, never in the working tree**, and counted with `wc -w`, before and after, so the number confirmed is the number that lands and a declined plan leaves nothing behind ([why](REFERENCE.md#measured-not-estimated)). Name every pair a later record overturns in part with no pointer between them, and propose the partial-supersede pointers. **Confirm** before writing; the human may change any line.
4. **Apply the batch.** Write the pages first, sentences moved whole and never rewritten — a docs page (`write-docs`' contract where installed, else `title` + `description` frontmatter), or where the repo keeps per-component rationale, such as a skill's `DESIGN.md`, which may then link nothing outside its own folder. **Material another file already owns is removed, not moved** — a schema, a test, a mirrored block's source, a skill's REFERENCE: check it really says the same, then drop the sentences and link that file, so no copy of it is created. The plan names each such file. **A target section that does not exist yet is created in the same batch**, through `write-docs` where installed. Write each `split`'s second record through `write-adr`. Trim the `trim` records — the moved sentences and any `## Amendments` go, one link to the page is added. Run the script as a **dry run**, then **`--apply`** — it refuses before writing anything while a dropped record is still referenced, a reference has a form it cannot rewrite, or a move would collapse a `#fragment`, and it appends the batch to the protocol; fix every line its exit `1` names by hand and `--check` until it exits `0`. Then **`--reworded`** — every sentence the batch left on a record or a target page must be a deletion from committed text, the named exceptions aside ([which](REFERENCE.md#sentences-move-never-get-rewritten)) — and **`--cites`**: every line still citing a `trim` or `split` record, read against what the record now says — a citation leaning on a sentence that left is re-pointed to where that sentence lives now, on confirmation ([citations](REFERENCE.md#citations-of-a-trimmed-record)). Run the repo's own checks ([the script](REFERENCE.md#the-script)).
5. **Close** — after the last batch, `--check` against every batch map at once. Then **renumber once**: `--renumber` as a dry run, then `--apply` — every record gets its rank as id, in every locale tree, and every reference repo-wide moves in one pass ([renumbering](REFERENCE.md#renumbering)). Offer one short record of the migration through `write-adr`.
6. **Sign-off, then the protocol goes.** The protocol stays committed while anyone may still need an old id — reviewers, other clones, an old link. Delete it **only** when every reviewer has confirmed that everything is migrated and correct, as its own change, on explicit confirmation; until then a closing `--check` and the renumbering's check are the evidence, never a reason to delete it early.

## 3. Import

A dedicated decision directory in another format is brought into `docs/99.adr/` **one file at a time, through the same threshold**: imported, split (the decision into the log, the rest onto a page), routed whole as a page, or reported and left alone — one proposal, applied on confirmation, sentences moved and never rewritten. Detection, the four outcomes, the `date` derivation and the split: [REFERENCE.md](REFERENCE.md#import--a-decision-log-written-elsewhere).

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
- **References are rewritten by the script and nothing else** — an agent search cannot prove it found every one.
- **Sentences move, never get rewritten** — the named exceptions are the pointer lines and a new page's head. **Ids stay stable through every batch**; the one renumbering at the end closes the gaps, and the protocol maps the old ids until sign-off.
- **Unsure → keep.** **Changelogs keep their ids.** **Never commits, never pushes.**
- **Attribution-free and secret-free.**

## Reference

**Open [REFERENCE.md](REFERENCE.md) before the inventory and before every apply** — recipes, the map, the script's modes and exits, the import. The script documents its own contract in its header.
