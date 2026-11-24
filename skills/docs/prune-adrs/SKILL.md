---
name: prune-adrs
metadata:
  summary: Migrates an overgrown or foreign decision log onto write-adr's rules, rewriting every reference by script.
description: Migrates an existing ADR log in approved batches — prunes an overgrown docs/99.adr/ or imports ADRs kept elsewhere, moving what is not an architecture decision onto docs pages and rewriting every reference by a shipped script. For one new or superseding decision, or a single index row, link or typo, use write-adr. Invoke manually only — never fires proactively, never commits or pushes. Use when the user wants to prune, clean up, migrate or import an ADR log, says the ADRs got out of hand, or says things like "clean up the ADRs", "import our old ADRs", "ADRs aufräumen", "ADRs nach den neuen Regeln anpassen".
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

Whatever this skill puts in front of a human to decide on — a plan, a preview, a candidate list, a
findings report — is read **once, in a terminal**, so **every part of it renders on arrival**.

- **Never fold it behind a control.** A terminal cannot open `<details>`/`<summary>`, a tab or a
  "show more": only the summary line prints, and the human confirms a plan whose body never
  reached them.
- **Shorten instead of hiding.** Show every item that needs a decision, each with a visible id and
  its effect. Group the rest by something the reader already thinks in (kind, verdict, ecosystem)
  with a count and a reason, and name the command that shows them in full.
- **This binds the message, not the files it writes.** A `<details>` block in a README, an issue,
  a pull request or a docs page renders in a browser and is fine there.

</skills-plan>

<skills-tldr>

## Leading the report

The report this skill ends with is read **once, in a terminal**, so it **opens with its result**:
a `## TL;DR` section before every other heading — `## Kurzfassung` in a German run — holding, in a
few lines:

- **the counts**, per group, in the words the groups below use, with the total stated;
- **what the run acted on**, or proposes to — or that it acted on nothing;
- **the decision asked for**, said plainly, or **no decision needed**;
- **whatever the run could not establish** — a check that never ran, a list it could not read —
  because a reader who stops here must not leave with a picture the rest would correct.

**The lead opens the detail, it does not replace it.** Every item that needs action renders in full
below. A group that needs none may be counted with its reason and the command that lists it.
**"Nothing found" is a result too:** one line, naming the scope that was searched. The `tldr`
skill fixes the same opening for the summaries it writes on request.

</skills-tldr>

## Guardrails

- **Manual only; plan per batch; confirm before writing.** Respect plan-only / dry-run: stop after the batch plan, or after the script's dry run.
- **References are rewritten by the script and nothing else** — an agent search cannot prove it found every one.
- **Sentences move, never get rewritten** — the named exceptions are the pointer lines and a new page's head. **Ids stay stable through every batch**; the one renumbering at the end closes the gaps, and the protocol maps the old ids until sign-off.
- **Unsure → keep.** **Changelogs keep their ids.** **Never commits, never pushes.**
- **Attribution-free and secret-free.**

## Reference

**Open [REFERENCE.md](REFERENCE.md) before the inventory and before every apply** — recipes, the map, the script's modes and exits, the import. The script documents its own contract in its header.
