# prune-adrs — reference

The mechanics of the migration: how the log is measured, what a batch map holds, how the script is run and what its exits mean. **What counts as an architecture decision, how long a record may run and why it never grows** are `write-adr`'s, read from its SKILL.md (**When a decision earns an ADR**) and its REFERENCE (**What the body may hold**, **Size**, **Lifecycle — append-only**). They are named here, not copied, because this skill never runs without `write-adr` installed.

## Inventory

Read-only, and shown before any record is judged. Body length excludes frontmatter:

```sh
log=docs/99.adr
for f in "$log"/[0-9][0-9][0-9][0-9]-*.md; do
  printf '%s\t%s\n' "$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' "$f" | wc -w)" "$f"
done | sort -n > "$tmp/lengths"
```

| Measure                         | How                                                                                                                |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| records, median, p90            | from `$tmp/lengths`                                                                                                |
| over budget                     | body over 500 words — `write-adr`'s stated-reason ceiling                                                          |
| amendments                      | records carrying a `## Amendments` heading                                                                         |
| supersede chains                | `Supersedes ADR-NNNN` / `Superseded by` pointers, with each record's first-commit date from `git log` (below)      |
| records arriving with a feature | the commit that added each record — `git log --diff-filter=A --format='%h %s' -- <record>` — typed `feat` or `fix` |

```sh
git log --follow --diff-filter=A --format=%as -- "$record" | tail -n 1   # the day a record entered git
```

**Never `--reverse` with `--follow`.** Git applies the rename tracking after the reversal, so on a renamed file the pair prints nothing and exits `0` — an empty date that reads as success. `tail -n 1` takes the oldest addition instead. It is still only the day the file entered git, not proof of when the decision fell: where the record's own text, an acceptance or a release dates it otherwise, that wins, and the plan names which source it used.

**A chain is measured in days — as a hint, not a rule.** Records that supersede one another within a few days are usually a decision still being worked out when it landed, and the classic `merge`. A supersede months later is usually a reversal, and both records stay. A log imported or committed in bulk carries no such signal: there the content decides whether the first decision was ever in force.

### Instruction files

A log pruned while the project's own agent instructions still demand an ADR per change grows straight back. Read every instruction file the repo commits — `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/`, nested copies in subprojects — and flag a line that:

| Flag                                                    | Proposed rewording                                                                               |
| :------------------------------------------------------ | :----------------------------------------------------------------------------------------------- |
| sends every reason, change or feature to `docs/99.adr/` | only architecture decisions go there, by `write-adr`'s threshold; the rest goes to pages         |
| requires code comments to cite `ADR-NNNN`               | cite the page that explains the subject; an ADR only where the comment is about the architecture |
| tells an agent to write or extend an ADR after a change | document the change as pages; offer an ADR only for an architectural decision                    |

```sh
git grep -n -i -E '(^|[^a-z])adrs?([^a-z0-9/-]|$)|decision record|99\.adr(/[^0-9]|[^/0-9]|$)' -- '*CLAUDE.md' '*AGENTS.md' '.github/copilot-instructions.md' '.cursor/rules/*'   # rules about ADRs, not citations of one record
```

Report each flag with file, line and the proposed wording, and change it **only on confirmation**, in the same diff as the batch. A file kept byte-identical with another (a `CLAUDE.md` mirrored to `AGENTS.md`) is changed in one and copied over the other, the way the repo already keeps them. A file a tool generates is reported, never edited. The `ADR-NNNN` tokens such a file cites are the script's, like any other reference; only the rule is a reading.

## The map

One **batch map** per batch, tab-separated, one record per line, `#` comments and blank lines ignored:

```text
# id	action	target	label
0021	keep
0038	trim
0598	merge	0601
0609	move	/concepts/smp/dragon-egg	the dragon egg page
0594	move	docs/2.concepts/shop/gift-cards.md	the gift card page
0412	drop
```

| Action          | `target`                                                                                                                                                                             | `label`                                  |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `keep` / `trim` | —                                                                                                                                                                                    | —                                        |
| `split`         | optional: the ids of the records split off it, comma-separated — `--reworded` checks each against this record's committed text                                                       | —                                        |
| `merge`         | the surviving record's id — a record kept or trimmed, never one removed in any batch                                                                                                 | —                                        |
| `move`          | the page's link target: a repo path — a docs page or a component's `DESIGN.md` (written relative to each linking file), or the site path the repo already links with (`/concepts/…`) | the text that replaces a bare `ADR-NNNN` |
| `drop`          | —                                                                                                                                                                                    | —                                        |

**Use the link form the repo already uses.** A rendered site that links records as `/adr/NNNN-slug` links pages the same way, so its `move` targets are site paths; a portable tree links files, so its targets are `docs/` paths. Mixing them leaves a tree that half-renders.

**The label reads in a sentence.** It replaces `ADR-0609` wherever it stands — a code comment, a link text, a table cell — so a noun phrase (`the dragon egg page`) works where a path would not.

**Where batch maps live** — under the git common dir, beside the other TitusKirch caches, so they survive across sessions and are never committed. Each batch gets a directory of its own, holding the map, the drafts the plan measured, and a `state` file: the commit the batch started from, the confirmed word counts, and the results of its last dry run and check — so a session that picks the migration up later starts from exactly that state:

```sh
maps="$(git rev-parse --git-common-dir)/tituskirch-skills/prune-adrs"
mkdir -p "$maps/batch-01/drafts"
printf 'base\t%s\n' "$(git rev-parse HEAD)" > "$maps/batch-01/state"
printf '%s\n' "$maps/batch-01/map.tsv"
```

**The common dir is per clone; the protocol is not.** Another clone, or another machine, sees none of these files. What it sees is the committed **protocol**, which `--apply` writes ([the protocol](#the-protocol)) — so a batch counts as handed over only once a human has committed it. Delete the directory once the migration's final check is clean; the protocol has its own, later end.

## Removed, not moved

Most borrowed material in an overgrown record is borrowed **from a file that still owns it** — the validation schema the record transcribed, the test whose roster it listed, the mirrored block whose rule it restated, a skill's REFERENCE section. Moving those sentences to a new page would create a second copy of the owner, which is the drift the expiry test exists to prevent. So:

- **Verify first.** Open the owning file and confirm it states what the sentences state. Where it states less, the difference is moved like any other material.
- **Remove, then link.** The sentences leave the record, and the record gains one link to the owning file in their place — written once, on entry, the way a split cross-links.
- **Name every one in the plan**, with the owning file and the section, and remove only on confirmation. A sentence whose owner cannot be found is moved, never dropped.

### Measured, not estimated

A plan's word counts are confirmed as the batch's result, so they have to be the result. Draft each `trim` and `split` before planning — as a copy in the batch's `drafts/` directory, never in the working tree, so a plan the human declines or stops at leaves the tree as it was — and count the body with the same recipe the inventory uses, before and after. The confirmed draft is what the apply step copies into place.
An estimate made from a reading drifts in one direction: it assumes more of a record is borrowed than turns out to be, because what is left after the borrowed material goes is reasoning, and reasoning is what a trim never cuts. A record still over 500 after an honest trim says so in the plan, with the reason `write-adr` asks for.

## The script

[`templates/rewrite-adr-refs.sh`](templates/rewrite-adr-refs.sh) — POSIX `sh`, `sed` and `awk`, run under `LC_ALL=C` from anywhere inside the repo. Its header is the full contract; this is how a batch uses it:

```sh
# Fill in this skill's own directory, as for the resolver.
skill=/absolute/path/to/this/skill
b="$maps/batch-01/map.tsv"
sh "$skill/templates/rewrite-adr-refs.sh" --diff "$b"       # dry run, with diffs
sh "$skill/templates/rewrite-adr-refs.sh" --apply "$b"      # refuse or rewrite, remove, protocol, check
sh "$skill/templates/rewrite-adr-refs.sh" --reworded "$b"   # sentences the batch rewrote instead of moved
sh "$skill/templates/rewrite-adr-refs.sh" --cites "$b"      # citations of trimmed records, to read
cat "$maps"/batch-*/map.tsv > "$maps/all.tsv"
sh "$skill/templates/rewrite-adr-refs.sh" --check "$maps/all.tsv"   # the closing check
sh "$skill/templates/rewrite-adr-refs.sh" --renumber                # then: dry run of the renumbering
sh "$skill/templates/rewrite-adr-refs.sh" --renumber --apply        # rename, rewrite, protocol, check
```

| Mode         | Does                                                                                                                                                                                     |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (default)    | dry run — every file it would change, every record it would remove, and every reason `--apply` would refuse; touches nothing                                                             |
| `--diff`     | with a dry run, a unified diff per changed file                                                                                                                                          |
| `--apply`    | refuses first (below); otherwise rewrites every reference, removes the index rows and the records in every locale tree, appends the batch to the protocol, then checks                   |
| `--check`    | only reports — every reference to a removed id, every link into the log whose record, slug, locale or `#anchor` does not exist, a removed record still present, a survivor citing itself |
| `--cites`    | only lists — every line citing a `trim` or `split` record, outside that record, for a human to read; always exits `0`                                                                    |
| `--reworded` | only reports — every sentence a batch left on a record or target page that is not a deletion from committed text (`--base=REV`, which must resolve, once the batch is committed)         |
| `--renumber` | after the last batch — gives every record its rank as id, renames the files in every locale tree, rewrites every reference in one pass; a dry run unless `--apply`, which also checks    |

| Option                                | For                                                                                                                                  |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| `--log=DIR`, `--width=N`              | a log outside `docs/99.adr`, or ids that are not four digits (read from the file names by default)                                   |
| `--route=PATH`                        | the site route the log renders under, default `/adr/`; `/<locale>/adr/…` resolves into the locale tree                               |
| `--repo-url=PREFIX`, `--site-url=URL` | absolute URLs that are this repo's files or this site's pages; the origin remote's GitHub or GitLab blob URLs are recognised unasked |
| `--batch=NAME`                        | the batch name in the protocol, default the map's file name                                                                          |
| `--fragments=drop`                    | lets a move collapse links carrying a `#fragment` onto the target page's top                                                         |

| Exit | Means                                                                                                                                                         |
| :--: | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | done, or clean                                                                                                                                                |
| `1`  | a finding, named line by line: a reference or dead link remains, a survivor cites itself, a sentence was reworded — or an apply refused, with nothing written |
| `2`  | invalid usage or map, or a search that failed — nothing was written                                                                                           |

**What counts as a reference — resolved, never pattern-matched.** Every text file git does not ignore is read — untracked ones included, because the pages a batch writes are still new when it runs — except changelogs and the protocol. In it, a **bare `ADR-NNNN`** (matched whole, so `ADR-00031` and `ADR-0030` are never touched for `0003`), and every **link target** — inline, reference-style, `href="…"`, `<…>` autolinks, and a path written as text in code or prose that names the log or its route. Each target is **resolved against the file it sits in** — `./` and `../` normalised, a leading `/` read as the site route or else the repo root, a known URL prefix stripped — and counts only when it lands on a record of this log, in the default or a locale tree. So `guide/0002-jobs.md` is never mistaken for record 0002, and `https://example.org/adr/0002-x` is left alone and named as a note. A merge keeps a link's form and anchor and swaps the record; a move replaces the target, written relative to each linking file, and turns the bare id into the label.

**What `--apply` refuses before writing anything.** A `drop` that something still references; a reference in a form the script cannot rewrite — a wiki link `[[0003-x]]`; a move that would collapse a link's `#fragment` onto a page top, unless `--fragments=drop` says that is meant. The dry run shows the same list, so nothing reaches the tree that would need undoing. A rerun after a partial apply is allowed: a removed record that is already gone is accepted when HEAD still has it, never when the log never did.

**What the check resolves.** In documents — Markdown, MDX, HTML, reStructuredText, AsciiDoc — every link into the log must land on a record that exists **in the locale it names**, under the slug it names, and its `#anchor` must be a heading of **that** file: a GitHub-style slug, a `{#id}` heading attribute or an `id="…"` anchor. A renderer whose slugs differ needs its own build as the second check. In code and as bare paths only a removed id is a finding, since a fixture or an example may name a record that never existed.

**What it validates before writing anything** — ids of the log's width, listed once, a record for each that stays, a known action, a merge target that exists and is not itself removed, a split-off record that exists, a `move` page that exists when it is a repo path, and a label on every `move`. Any failure exits `2` with the tree untouched. A file name holding a newline or a tab is refused the same way, because no line-based tool can carry it safely.

**What it deliberately does not do.** It never decides an action, never writes a page, never edits a record's prose beyond the reference tokens, and never touches a changelog. A survivor whose `Supersedes ADR-0598` line now reads `Supersedes ADR-0601` on record 0601 is reported, not repaired: whether the line goes or says something else is a reading, and the script makes none.

<a id="citations-of-a-trimmed-record"></a>

**Citations of a trimmed record.** A `trim` or `split` keeps its id, so `--check` has nothing to report — yet a comment, a page or another record may cite it **for a sentence that just left**, or link an anchor (`#amendments`) whose heading is gone. Whether a citation still holds is a reading, so the script does not judge it; it lists every candidate, grouped by id, so the reading is complete. For each line: the cited sentence is still in the record → leave it; it moved to an owning file or a page → re-point the citation there; it went to a `split`'s second record → cite that record. Changes are proposed and applied on confirmation, in the batch's diff.

### Sentences move, never get rewritten

The rule is literal provenance: every sentence a batch leaves behind is a committed sentence with words removed. It is the rule a batch is most likely to break unnoticed — a stale count updated, two clauses joined around a new link — and across a batch drafted by several agents nobody can hold it by reading. `--reworded` makes it mechanical. It compares every **trimmed** record, every record **split off** one (named in the map), every **merge target** and every **relative move target** against the committed text of the page and of the records that fed it, word sequence by word sequence, case-insensitively, with the map's own token rewrites applied first — a moved record's `ADR-NNNN` reads as its label.

**The named exceptions, and nothing else:**

- **The pointer lines** — `Supersedes …`, `Partly supersedes …`, `> **Superseded by** …`, `> **Partly superseded by** …`.
- **The head of a page the batch created** — its headings and the one paragraph under its H1, which a new record or a `DESIGN.md` needs and no source has.
- **A sentence carrying a link** is not refused but **listed**, as the pointer a trim leaves where removed material went. Read each one: a link added to new prose is still new prose.

A deletion that **dropped a negation** — `not`, `never`, `only`, `without` … from the sentence it came from — is listed too. A word-sequence check cannot see meaning, and that is the one deletion most likely to reverse it. A frozen count that has since gone stale stays, in the past tense the record was written in; it is history, not a claim about today.

### The protocol

`--apply` appends every row of its map to `<log>/migration.tsv`, with the batch's name and the commit it was applied on, and `--renumber --apply` appends every old id with its new one. It is the one place another clone, a reviewer or a reader holding an old link can look an old id up — **there are no redirects**, and a commit message, an issue or another repository that names an old id can only be resolved there.

```text
# batch	base	id	action	target	label
batch-01	2e162f3a91c0	0032	move	skills/repo/merge-deps/DESIGN.md	the merge-deps design notes
renumber	9b1c04d2e7aa	0039	renumber	0032
```

It is never scanned and never rewritten, so it keeps naming the old ids it maps. It stays committed until **every reviewer** has signed the migration off — every batch checked, the renumbering checked, nothing left open — and is then deleted in a commit of its own, on explicit confirmation. Nothing in the script deletes it.

### Renumbering

Ids stay stable through every batch, because maps, citations and reviews all name them. **After the last batch**, `--renumber` closes the gaps in one pass: each record of the default log gets its rank as id, the same id in every locale tree, and every reference the batch rules recognise moves with it — each one replaced once from the full old-to-new table, so `0004 → 0003` and `0003 → 0002` never chain into `0004 → 0002`. Changelogs and the protocol keep the old numbers; the protocol maps them. After writing, it checks every link into the log and every record's H1 against its file name.

**Run in batches, check once at the end.** Each `--apply` takes only its own batch map. The closing `--check` takes all of them at once and must be clean before the renumbering; after it, the old maps no longer describe the log, and the protocol is what remains.

## Import — a decision log written elsewhere

A repo may already hold ADRs that were written **somewhere else, in someone else's format** — another tool's `docs/adr/0001-slug.md` with no frontmatter and a two-sentence body, a migrated repo's log, a human contributor following a different convention. Such a file is not a numbering gap, not a missing `index.md`, not an unknown key on a page either skill owns. It is a page no docs reconcile looks at, so the decision it records is **absent from the decision log** — the one failure a log must not have, because an incomplete log still reads as complete.

This skill's **import** job therefore recognizes such a directory and offers to bring it into the contract. `write-docs`' reconcile reports such a directory and names this skill.

**Detection is a dedicated ADR directory, and nothing else.** Inside `docs/`, a directory whose whole content is decision records: `adr/`, `adrs/`, `decisions/`, `architecture-decisions/` and near variants of those names.

- **Never match on filenames.** A page called `adr-caching.md` sitting in a section, or an `adr/` holding a mix of decisions and other material, is **report only** — filename matching starts collecting documents nobody meant as decision records, and a wrong import is far more expensive than a missed one. Unsure → report, don't import.
- **A decision directory outside `docs/`** (a root-level `adr/`) is likewise **report only**: the import's blast radius stops at `docs/`, so name it in the report and leave the move to a human.

**The import is one proposal, and nothing moves unasked.** Move, rename, index row and the missing values are presented **together** and applied only on confirmation. Splitting the move out as a mechanical first step saves nothing — `title` / `description` / `status` have to be asked for anyway — and buys a half-imported log, which is worse than an unimported one.

### The threshold governs adopted records too

**Finding the directory is not the decision to admit it.** Admission is judged **per file**, against the same bar a record written here has to clear — **When a decision earns an ADR** in `write-adr`'s SKILL.md, together with the table of what is not an ADR, as the target repo's own `99.adr/index.md` states it. A threshold that governs which decisions earn an ADR governs adopted ones no differently; nothing about arriving in another tool's format earns a record a place this log would not otherwise give it.

**The gate belongs at the import step and nowhere later.** The log is append-only, so a record admitted wrongly can never be pruned — faithfully importing another tool's noise into a log that cannot be trimmed is a worse outcome than the blind spot the import exists to close. Ask it before the id is assigned, because after that there is no undo.

Admission has **four** outcomes, all of them proposed in the same plan:

| Outcome                                      | When                                                                                                                                                                                           |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import the record**                        | it clears the bar, and what it holds is what a record nobody may correct should hold                                                                                                           |
| **[Split it](#splitting-a-record-on-entry)** | it holds a decision this log wants **and** material the expiry test (**What the body may hold** in `write-adr`'s REFERENCE) rejects, and the two come apart without a sentence being rewritten |
| **Route it as an ordinary docs page**        | the content is worth keeping but is not a decision this log records — it goes through the routing matrix of `write-docs` like any other page                                                   |
| **Report it and leave it alone**             | there is nothing to keep, the call is genuinely the human's, or the decision will not come apart from the rest without prose being rewritten — named in the report, not moved, not imported    |

**Borderline is the human's call.** Name it in the plan and let them answer; never resolve it by importing "just in case", since that is the direction with no way back. Nothing is deleted either way — a record the import declines stays exactly where it is. The single deletion this job permits belongs to a confirmed [split](#splitting-a-record-on-entry), never to a record the threshold turned down.

| The import supplies    | From                                                                                                                                                                                             |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path + name            | `docs/99.adr/NNNN-title.md`, `NNNN` allocated by `write-adr`'s **Allocating an id** rule — one per admitted file, reserved together in the plan, in the source directory's own order             |
| `title`/`description`  | proposed from the H1 / first paragraph, confirmed like any other missing required field                                                                                                          |
| `status`               | proposed (`accepted` for a decision evidently in force, `proposed` while any required section is empty), confirmed — never silently defaulted                                                    |
| `date`                 | the file's **first commit**: `git log --follow --diff-filter=A --format=%as -- <file> \| tail -n 1` — never with `--reverse` ([why](#inventory)), and overruled by a date the file itself states |
| Body                   | the existing text **re-homed** under the required `Context` / `Decision` / `Consequences` H2s                                                                                                    |
| The decision log's row | `99.adr/index.md`, in the same change                                                                                                                                                            |

- **`date` is the decision's date, not the import's** — the first commit stands in for it, and the plan says so. The field records when the `status` last changed, and a record entering the log unchanged last changed when it was written — so the first commit, never the day it moved.
- **`--follow` is not optional here.** `git log` stops at a rename without it, and a foreign ADR directory has usually been moved at least once already — that is often how it ended up where the import found it. Drop the flag and the one value this section claims needs no guess quietly becomes the date of a move.
- **Untracked, or no commit for the file** → git has no answer; fall back to a date the file itself states, else propose today's and say which of the two it is.
- **The title states the decision, not the source's topic.** A foreign H1 is characteristically a noun phrase (`ADR-0003: Caching strategy`); the imported filename and `title` restate it in this log's shape — the naming rule of `write-adr`'s file schema applies to an adopted record exactly as to a written one. Entry is the **only** chance to get it right: nothing may rename a record once it is in `99.adr/`.
- **Re-homing is not rewriting.** The sentences are the author's and stay the author's — they move under the H2 they belong to, and a section the source never wrote is left empty rather than invented. Everything the import cannot place goes in the plan for a human to place — and an empty required section decides the `status` the record enters at (next bullet).
- **A record never lands `accepted` with a required section empty.** Immutability starts the moment the file enters `99.adr/`, so an empty `Context` / `Decision` / `Consequences` admitted at `accepted` is a hole append-only forbids ever filling. Either the human fills it **in the same plan, before the change is applied**, or the record lands `status: proposed` — the honest description of an incomplete one, and the status that leaves it free to be completed and accepted later, by the transition `write-adr` defines ([status transitions](https://github.com/TitusKirch/skills/blob/main/skills/docs/write-adr/REFERENCE.md#status-transitions)). Empty **and** accepted is the one combination the import must not produce.
- **Assigning an id does not break append-only.** The file was never accepted _in this log_, so the id is a **first assignment**, not a renumbering, and shaping it on entry is not an edit to an accepted record. From the moment it lands in `99.adr/` it is immutable like every other ADR.
- **References to the source files move by script too.** Once the admitted records have landed, run the script against the **source** directory — `--log=docs/adr`, its own `--width` — with one `move` row per admitted file: the new record's path as target, its new `ADR-NNNN` as label. That rewrites every link into the old file and removes it, as for any batch. **A bare `ADR-NNNN` is ambiguous** where the two logs' numbers overlap: the script cannot tell which log a token means, so the dry run's diff is read line by line, and a token meaning the other log is fixed by hand first. Where the repo had no log of its own before, nothing overlaps.
- **Idempotent** — an admitted record is gone from the source directory, so a second run has nothing left to propose for it; a split one is gone too, because both halves have landed. What the threshold declined is still there and is **reported** again, never re-proposed as an import; a directory emptied of everything admitted disappears from the job entirely.

### Splitting a record on entry

**A foreign record is rarely all one thing**, and the one that most needs importing is usually the worst offender: a genuine decision, plus a naming convention telling the reader to extend a list, plus a version, plus a component that "is being removed". Every whole-file outcome is wrong for it — importing carries material the expiry test (**What the body may hold** in `write-adr`'s REFERENCE) rejects into a log nobody may trim, routing loses the decision from the log, and leaving it alone is the blind spot the import exists to close.

**So the record is split, and the split is one proposal.** The decision enters `99.adr/` as the record; what fails the expiry test goes through the routing matrix of `write-docs` as an ordinary page — in the **same** confirmed change, never as a follow-up, since a half-applied split leaves the log holding a record whose other half is nowhere. It rests on the same licence as the id assignment above: the file was never accepted _in this log_, so shaping it on entry is not an edit to an accepted record. And entry is the only moment the licence exists — from the moment the record lands in `99.adr/` its body is append-only.

- **A split is a move, never a rewrite.** The sentences are the author's on both sides of it, exactly as re-homing leaves them, and each goes to one destination or the other whole. A record whose decision cannot be separated without rewriting prose is **not splittable** — report it and let the human decide, the same answer borderline admission gets.
- **The human confirms it, and the plan names it per file.** Which sentences become the record and which become the page is stated file by file in the plan, and applied only on confirmation — the shape the empty-required-section rule above already uses. What a sentence _is_ is a judgement, and it is not the import's to make alone.
- **Cross-link both halves, both ways.** The record points at the page that now carries the convention; the page points back at the decision that established it. Neither half is left orphaned, and both pointers are written on entry, because afterwards the record may not gain one.
- **A fragment that belongs on no page is dropped — the only thing an import deletes.** Prose that fails the expiry test, records no decision and would not earn a page anywhere — a bare statement of state, "`system.*` currently holds two permissions" — is neither imported nor routed. Name it in the import plan and remove it **only** on explicit confirmation. It is bound to the record being imported and to nothing else: it never reaches an existing `docs/` page, since trimming one is rewriting prose, which neither skill may do, and it never applies to a whole record — one that fails the threshold takes **report it and leave it alone**, where nothing is deleted either way.
- **A missing target section is created in the same proposal.** Routing a fragment needs a section to route it into, and the repo may not have one — a `conventions/` that never appeared because nothing had earned it yet. Create it, directory and `index.md`, alongside the rest of the change: that is structure inside `docs/`, and both are within the import's blast radius, and the page itself follows `write-docs`' contract. This holds for a plain **route it as an ordinary docs page** too, which always needed a target and never said what to do without one.
- **The `status` question needs no rule of its own.** A split that empties a required section is already answered above — the human fills it in the same plan, or the record lands `proposed`.
- **Unsure → report.** A wrong split costs what a wrong import costs, and the direction with no way back is unchanged. Propose one only where the seam is plain in the prose; otherwise name the record in the report and leave the call to the human.

**An unsplit import carries its expiring material, and that is a priced cost rather than an oversight.** A record admitted whole enters with the author's sentences intact — the _currently_, the version, the enumeration a later change will extend, all of it. Faithfulness is what that buys, and append-only is what it costs: nobody may fix those sentences afterwards. Say so in the plan rather than importing quietly, and where the human has not settled what the record should hold, `status: proposed` is available — the honest description of a record whose body is not yet what this log wants, and the status that leaves it free to be completed and accepted later.

## Config

`.tituskirch-skills.json` at the consuming repo's root is an optional, committed config shared across TitusKirch skills. This skill reads the **`docs.*`** section and adds no key of its own. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how.

| Key              | Effect here                                                                       |
| :--------------- | :-------------------------------------------------------------------------------- |
| `docs` = `false` | the skill is **disabled** — stop with a notice; an _absent_ block is not disabled |
| `docs.language`  | the language moved material is framed in on a new page                            |
| `docs.render`    | which link form a `move` target uses ([the map](#the-map))                        |

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
disabled=$(printf '%s' "$resolved" | jq -er 'if .docs == false then 1 else empty end' 2>/dev/null) || disabled=
render=$(printf '%s' "$resolved" | jq -er '.docs.render // empty' 2>/dev/null) || render= # empty = portable: docs/ paths
```

<skills-config>

### Reading the config

The config is `.tituskirch-skills.json` at the **consuming repo's** root — committed, optional, and shared by every TitusKirch skill. Absent means detection and built-in defaults, never an error. Its keys, types and defaults are defined by [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

**Resolve it before reading it.** A repo may define `profiles` — named overlays for an execution context, so a remote runner can open pull requests where a local session commits directly. [`templates/resolve-config.sh`](templates/resolve-config.sh) prints the resolved config, and every skill ships the same copy, so they all see the same values:

```sh
# Fill in this skill's own directory — the path this file was loaded from, not the
# repo being worked on. It is a blank to fill, not a variable that is already set.
skill=/absolute/path/to/this/skill

resolved=$(sh "$skill/templates/resolve-config.sh"); status=$?
case $status in
0)  [ -n "$resolved" ] || resolved='{}' ;;   # ran fine; empty means the repo has no config
10) resolved= ;;                           # no jq — read the file yourself, see below
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;   # 11: unknown profile named
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found, could not run, or was told to select a profile the config does not define, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset name, or a detected `ci` the config does not define, yields the base config unchanged. A `TITUSKIRCH_SKILLS_PROFILE` naming no defined profile exits `11` — a renamed profile stops the run rather than silently dropping its overlay.

**The merge is a rule, not just a command.** Objects merge recursively at any depth, arrays and scalars are replaced rather than concatenated, an explicit `null` sets null rather than deleting a key, and `profiles` is dropped from the result. Any path that resolves the config by other means owes the same semantics.

**`jq` may not be installed.** It ships preinstalled on none of Windows, macOS or Linux, and `gh`'s built-in `--jq` is no substitute — that filters API responses, it cannot read a local file. `resolve-config.sh` exits `10` in that case. Do **not** fall through to defaults: `Read` the file, apply the merge rule above, and carry on with the repo's real values. Nothing else is needed — no Node, no Python.

**Guard every read, resolve into a variable, then use it.** Never let a substitution reach a command flag directly — `jq -r` prints the literal string `null` for a missing key, and an empty value is silently ignored by some tools rather than matching nothing:

```sh
value=$(printf '%s' "$resolved" | jq -er '.section.key // empty' 2>/dev/null) || value=
[ -n "$value" ] || value=<documented default>
```

**Tell "off" apart from "absent".** `// empty` collapses `false` and a missing key into the same empty string, which turns a deliberately disabled mechanic into its default. Where a key may be `false`, resolve it as `select(. != null) | tostring` and test for the string afterwards.

**Snippets are POSIX `sh`.** No `[[ ]]`, no arrays, no `<<<`, and nothing that differs between GNU and BSD coreutils — the shell is whatever the user runs.

</skills-config>
