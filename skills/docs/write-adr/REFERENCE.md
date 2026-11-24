# write-adr — reference

The contract of the decision log: where it lives, what a record looks like, what it may hold, how long it runs, how it is overturned, and how a log written elsewhere is brought in. **Whether a decision earns a record at all** is the threshold in [SKILL.md](SKILL.md#when-a-decision-earns-an-adr), asked before anything here.

An **ADR** records one architectural decision and the reasoning behind it. It is a **structurally distinct artifact** within the docs tree — its own filename schema, extra frontmatter and an append-only lifecycle — and everything here **overrides** the general page contract `write-docs` holds for every other page.

## Architecture decision records

### Section

ADRs live in **`docs/99.adr/`** — a numbered house section like any other, never an unprefixed `docs/adr/`.

- **The `99` prefix is fixed**, identical in every repo, so readers and tooling can rely on one path.
- **Pinned last**, after every reading section: an ADR set is a decision log — an appendix, not front-of-manual reading. `99` also leaves the reading sections room to grow without ever renumbering the ADR section.
- **Flat** — pages sit directly in the section. No subfolders, no subject grouping.
- **Never scaffolded empty** — the section appears with the first ADR.

### File schema

`NNNN-title.md` — 4-digit zero-padded id, **hyphen**, kebab title (`0007-drop-the-legacy-queue.md`). The H1 is `ADR-{NNNN} — {title}`.

- The id is a **permanent decision identifier**, taken once by the [allocation rule](#allocating-an-id). It is what cross-references point at (`superseded by ADR-0007`), so it is **never reused, renumbered or gap-filled** — outside the one renumbering a `prune-adrs` migration ends with, which keeps a protocol of every old id until the migration is signed off.
- **The title is a present-tense imperative verb phrase** — `0012-let-the-review-establish-green`, not `0012-review-green-policy`. A decision is something a project _did_, so the filename says what was done; a noun phrase names the topic instead and reads like a concept page. The H1 and the `title` frontmatter carry the same phrase, capitalized (`Let the review establish green`).
- This is deliberately **not** the house `N.kebab.md` dot-schema: that prefix is reading order and may be renumbered by `write-docs`' reconciler — a decision id may not. The hyphen keeps the two schemas impossible to confuse.
- **`index.md` is the decision log** — a table of every ADR (id, decision, status, date), in id order. Update it in the same change that adds an ADR. Template: [`templates/adr-index.md`](templates/adr-index.md).

### Allocating an id

**The next id is 1 + the highest id any record file in the log has ever carried** — in git history on every ref, plus the working tree. The live log alone is not enough: once a migration removed the highest records, the next run would hand their ids out again, and a cross-reference to the old record would silently point at the new one.

- **Count only history since the log's latest renumbering**, when a migration protocol records one (`prune-adrs` renumbers as its last step and appends a `renumber` row per id to `migration.tsv`; the commit that added those rows is the renumbering, and git finds it after the protocol is deleted too). Before it, the ids were different ones. A branch forked before the renumbering still counts its old names — that leaves a gap, never a reuse.
- **Parallel drafts reserve their ids up front, in one place** — the batch plan names every id before any draft is written; two drafts never each pick "the next one".
- **Re-check before landing** that the id, the file and the index row are each unique — another branch may have landed the same id in the meantime. A collision is resolved on the unlanded side, by taking a fresh id.

```sh
log="$(git rev-parse --show-toplevel)/docs/99.adr"
since=   # the latest commit that added `renumber` rows to the protocol; empty when there is none
for c in $(git log --all --format=%H -G '^renumber' -- "$log/migration.tsv"); do
  git show "$c" -- "$log/migration.tsv" | grep -q '^+renumber' && { since=$c; break; }
done
ids() { { git log --all --name-only --format= ${since:+"^$since"} -- "$log"; ls "$log"; } | sed -n 's|^.*/||; /^[0-9]\{4\}-.*\.md$/p'; }

max=$(ids | sed 's/-.*//' | sort -n | tail -n 1)
next=$(printf '%04d' "$(expr "${max:-0}" + 1)")

# before landing: the first lists this record's own file name only, the second exactly one row
ids | grep "^$next-" | sort -u
grep "($next-" "$log/index.md"
```

### Frontmatter

House `title` + `description` (so an ADR renders and indexes like any other page) plus the ADR fields:

```yaml
---
title: Drop the legacy queue
description: Retire the hand-rolled queue in favour of the managed broker.
status: accepted
date: 2026-07-15
---
```

- **`status`** — `proposed` · `accepted` · `rejected` · `deprecated` · `superseded`.
- **`date`** — ISO `YYYY-MM-DD`; the day the status last changed — it moves with a [status transition](#status-transitions) and with nothing else.
- **Nothing else.** MADR's `decision-makers` / `consulted` / `informed` are a deliberate **no**: who decided is already recorded, timestamped and unforgeable, on the issue and pull request the ADR came out of, and a retyped list only goes stale beside it.

### Body

Context, decision and consequences are **body sections, not frontmatter** — they are prose, and prose belongs where it renders. Template: [`templates/adr.md`](templates/adr.md).

| H2                        | Required     | Holds                                                             |
| :------------------------ | :----------- | :---------------------------------------------------------------- |
| `Context`                 | **yes**      | the forces at play, neutral — no verdict yet                      |
| `Decision`                | **yes**      | what was decided, active voice                                    |
| `Consequences`            | **yes**      | what becomes easier, what becomes harder, the trade-offs accepted |
| `Alternatives considered` | **optional** | the options that lost, and why each lost                          |

In that order, the optional one last.

- **The three required sections are Nygard's** — cite him and no one else. MADR requires a **different** set (`Context and Problem Statement`, `Considered Options`, `Decision Outcome`, with `Consequences` merely optional), so naming it alongside would claim a backing this shape does not have.
- **`Alternatives considered` is optional on purpose.** The reasoning it holds is what a later reader comes back for, and without a home it ends up buried mid-`Decision` or dropped entirely — but required is the one thing it must not be: the lifecycle below is append-only, so a section made mandatory today could never be added to the records already written, and it would freeze every one of them out of conformance permanently. An ADR whose alternatives are genuinely covered inside `Decision` omits the section rather than padding it.
- **Optional is about writing it, not about editing it later.** Once the record is accepted this section is as immutable as the three above it — the [lifecycle](#lifecycle--append-only) governs the whole body, so an omitted `Alternatives considered` is not an invitation to add one to an accepted ADR afterwards.

### What the body may hold

The [lifecycle](#lifecycle--append-only) makes this a **content** rule rather than a length one: no sentence in an accepted record can ever be corrected, so **every sentence has to still be true years from now**.

**The expiry test — a record may hold no sentence its author would later want to fix.** The tells are mechanical, and each marks a fact that belongs to a page which _may_ be edited when it moves:

| Tell in the prose                                | What it actually is                                                                     |
| :----------------------------------------------- | :-------------------------------------------------------------------------------------- |
| _currently_ · _for now_ · _at present_ · _today_ | a state of the world, not a decision                                                    |
| _is being_ removed / replaced / migrated         | work in flight, finished before the next reader arrives                                 |
| a version, a release, a dependency's shape       | an implementation state, correct for exactly one release                                |
| a claim about what some tickets contain          | their contents move; a pointer to the record's origin is fine, a summary of them is not |
| a field list, an option table, a signature       | transcribed from code that stays correct on its own                                     |
| any enumeration a later change will extend       | a convention, and conventions grow                                                      |

Freezing a fact **on purpose** is legitimate — the state something was in on the day it was decided is often what makes the decision legible at all. Write it in the **past tense**, so the record dates its own claim instead of asserting it forever.

Two sections attract borrowed material in particular:

- **`Context` states the constraint, not the inventory.** It answers what _forced_ this decision, never what the project looked like at the time. A workaround that shipped with a bug is context — it proves the discipline did not hold; a tour of what the repo contained is not, and it is false within a release.
- **`Consequences` are not conventions.** The moment a consequence prescribes how _future_ work is to be done, it is a rule, and it belongs in `conventions/` — where it is found without reading this record, and edited when it changes. What follows _from_ the decision stays; what is now _required of everyone_ moves out and is linked.

**The delta principle binds hardest here.** The docs tree never transcribes values, versions and option tables out of a file; in an append-only record the copy cannot even be corrected once that file moves on. Name the file and what is surprising about it — never its contents.

**A record never instructs its own continuation.** "Extend this list here when you add one" describes a living page, which is the one thing the lifecycle forbids: the list belongs in `conventions/`, and the record decides only that it exists. An accepted ADR grows nothing at all ([lifecycle](#lifecycle--append-only)).

### Size

**Aim for about 300 words of body; over 500 needs a reason, stated in the plan.** Frontmatter does not count. The three H2s are required as _headings_, not as a word budget: any of them may be one sentence, and a whole record may be a single paragraph. `Consequences` still names **at least one concrete consequence** — or says explicitly why none beyond the decision itself is known; "the consequences are the obvious ones" is not a section.

**The number sits at the strict end of what the practice recommends.** Nygard, who introduced the format, wrote that "the whole document should be one or two pages long". Zimmermann asks for "the bare minimum of essential information" — sometimes a slide with a few sentences, up to a few pages for a complex decision — and names the overgrown forms as anti-patterns: the **Mega-ADR**, the **Novel**, the **Blueprint in disguise**. One page is about 500 words, so the ceiling is one page and the aim well under it.

**The budget exists because append-only makes length permanent.** A record that ran long can never be trimmed, and a log of long records is one nobody reads to the end, so the decisions that carry the system's shape drown among the ones that do not. An earlier version of this contract set no number in either direction, on the reasoning that content rules alone bound a record. In practice they did not: records grew into feature specifications, with parameters, endpoints and rollout steps a page should have held.

**Over budget, move material before cutting reasoning.** In order:

1. Anything the [threshold table](SKILL.md#when-a-decision-earns-an-adr) rejects — behaviour, parameters, implementation detail, rollout steps. It goes on the page the record links to.
2. Anything the [content test](#what-the-body-may-hold) rejects — state of the world, transcribed values, enumerations that will grow.
3. An `Alternatives considered` entry for an option that was never really in play.

What is left past 500 words is a decision with genuinely many forces, or several real alternatives. That is legitimate, and the plan names which it is. A record past about 800 words is almost always two decisions, and the plan proposes splitting it into two records.

### Lifecycle — append-only

**A record is a draft until the change adding it lands on the integration branch** (`pr.base`, else the default branch). It carries `status: accepted` from the first draft — the merge is the acceptance, so nobody has to flip the status afterwards, and a change that never merges takes its draft with it. `proposed` is for a record deliberately put up for decision on its own — or an import `prune-adrs` landed incomplete — never for a draft waiting on its change. Before landing it is edited freely, and refining a decision means editing its draft, never opening a second record in the same change. Once it has landed it is **immutable**: the log records what was decided and when, so a superseded decision has to survive intact.

- **Overturning or materially revising a decision writes a new ADR.** The old one keeps its prose and only flips `status` to `superseded`, gains a `Superseded by ADR-NNNN` pointer under its H1, and updates `date`. The new ADR points back (`Supersedes ADR-NNNN`).
- **Overturning part of a decision writes a new ADR too — a partial supersede.** Where one part of a record stops holding and the rest still stands, the new record opens with `Partly supersedes ADR-NNNN:` and one sentence naming what stands and what does not. The old record keeps its prose, its `status` and its `date` — it is still in force — and gains one pointer under its H1, `> **Partly superseded by** ADR-NNNN:` with the same sentence. Both in one change. A later record that only builds on an earlier one, overturning nothing, needs no pointer: a link in its Context is enough.
- **No amendments.** An accepted record never grows: no `## Amendments` section, no dated addendum, no appended paragraph. An earlier version of this contract allowed a dated amendment where a decision held but a fact it priced had moved. Records then accumulated amendments until a single one ran to thousands of words, which is a living page wearing a record's id. What was learned while the decision still stands goes on the **concept page** that explains the subject today. If it changes the reasoning enough that the record now misleads, that is a supersede.
- **A record that already carries amendments keeps them** — append-only binds them too, and the log simply gains no new ones. The one exception is a deliberate migration with `prune-adrs`, which may move them to the concept page as part of trimming the record.
- **Never** rewrite a landed ADR's Context/Decision/Consequences, delete an ADR, or renumber one. Typo and link fixes are the only in-place edits besides the [status transitions](#status-transitions).
- **A chain of supersedes inside a few days is a smell.** It means records landed while the decision was still being worked out. Say so in the plan, and prefer letting the next decision wait until it has settled.
- The general page rules **do not apply**: no edit-in-place for a changed decision, no one-topic-per-page dedupe (several ADRs may touch the same topic — that is the log working, not duplication), and no prose reconcile.

### Status transitions

**The only changes a landed record takes**, besides typo and link fixes. A transition that changes `status` lands with its `index.md` row updated in the same change; `date` moves exactly where `status` does.

| Transition                         | What may change                                                                                                                                                   |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposed` → `accepted`/`rejected` | `status`, `date`, the index row's status and date. While it is `proposed`, a landed record may also have its sections **completed** — never its decision reversed |
| `accepted` → `superseded`          | `status`, `date`, the `> **Superseded by**` line under the H1, the index row                                                                                      |
| `accepted` → `deprecated`          | `status`, `date`, the index row — the decision stopped applying, with no successor                                                                                |
| partial supersede                  | the `> **Partly superseded by**` line only — `status`, `date` and the index row stay                                                                              |

**Not yet landed is not landed.** A record still on an unmerged branch is a draft, and anything in it may be corrected, `status` included. `rejected`, `superseded` and `deprecated` are final.

## Index rules

The **index** job keeps the table honest and nothing more:

| Finding                                                                                                                            | Action                                                                                 |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| a record with no row, a row with no record, a row whose status or date differs from the record's frontmatter                       | fix, in the plan                                                                       |
| a broken link inside `99.adr/`                                                                                                     | fix, in the plan                                                                       |
| a missing `title` / `description` on a record                                                                                      | propose a value, confirm                                                               |
| a record a later one overturns or narrows, with no `Supersedes` / `Superseded by` pointer — or their `Partly` forms — between them | **report only** — a human decides whether it is a supersede, a partial one, or neither |
| an id gap, a non-imperative title, a missing `Alternatives considered`, an amendment, a record over budget                         | **report only**                                                                        |

It **never** renumbers a record, normalizes `NNNN-title.md` to the house dot-schema, closes a numbering gap, renames a record, or touches body prose or `status` — ids are permanent, gaps are not deviations, and the body is append-only. Cleaning up a log that grew past its contract, or importing one written elsewhere, is a deliberate migration and `prune-adrs`' job, never an index fix.

**Render mode.** Where the repo sets `docs.render`, the log keeps this contract unchanged: a record's H1 is part of its file schema, and append-only forbids removing it from the records already written, so a mode switched on later would split the log into two shapes. A second heading on a rendered ADR is cosmetic; a split log is not.

**Locales.** The log's authority is the default-locale tree. A translated ADR under `docs/<locale>/99.adr/` is a rendering of a record, regenerated by `write-docs`' locale sweep with ids, filenames and `status` copied untouched. A decision is never written, superseded or imported from inside a locale tree.

## Config

`.tituskirch-skills.json` at the consuming repo's root (`$(git rev-parse --show-toplevel)`) is an optional, committed config shared across TitusKirch skills. The log is part of the docs tree, so this skill reads the **`docs.*`** section `write-docs` also reads, and adds no key of its own. **Resolve it before reading it** — [Reading the config](#reading-the-config) is the single statement of how, including what happens when `jq` is absent.

| Key                 | Effect here                                                                                                     |
| :------------------ | :-------------------------------------------------------------------------------------------------------------- |
| `docs` = `false`    | the skill is **disabled** — stop with a notice; an _absent_ block is not disabled                               |
| `docs.language`     | the language records are written in; falls back to root `language`, then the log's existing language, then `en` |
| `docs.locales`      | named in the report only — translations are `write-docs`' sweep ([index rules](#index-rules))                   |
| `docs.render`       | changes nothing in the log ([index rules](#index-rules))                                                        |
| `docs.instructions` | free-text wording guidance — additive, never overriding this contract                                           |

Full schema: the repo-root [`tituskirch-skills.schema.json`](https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json).

```bash
# $resolved comes from the resolver — see "Reading the config" in this file.
disabled=$(printf '%s' "$resolved" | jq -er 'if .docs == false then 1 else empty end' 2>/dev/null) || disabled=
lang=$(printf '%s' "$resolved" | jq -er '.docs.language // .language // empty' 2>/dev/null) || lang= # may be a { title, body } object, not a scalar
instructions=$(printf '%s' "$resolved" | jq -er '.docs.instructions // empty' 2>/dev/null) || instructions=
```

This skill keeps **no cache** — its only inputs are the live `docs/99.adr/` tree and that tree's git history, read for the [next id](#allocating-an-id).

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

## Anti-patterns

- ❌ A record for a feature — its behaviour, rules, parameters, endpoints or rollout — instead of a page that can be edited when the feature changes.
- ❌ An ADR per finished feature, by default.
- ❌ A record past 500 words with no reason stated in the plan, or past about 800 that was not proposed as two — the Mega-ADR, the Novel, the Blueprint in disguise.
- ❌ A `## Amendments` section, a dated addendum, or any paragraph appended to a landed record.
- ❌ A second record in the same change that refines the first instead of editing its draft.
- ❌ An unprefixed `docs/adr/`, or any prefix other than `99`, for the ADR section.
- ❌ An ADR id that is renumbered, reused, gap-filled, or written in the house `N.title.md` dot-schema.
- ❌ An ADR title that names the topic (`0021-adr-format`) instead of stating the decision as an imperative (`0021-drop-the-legacy-queue`).
- ❌ Rewriting a landed ADR to reflect a new decision instead of superseding it.
- ❌ Context/decision/consequences as ADR frontmatter fields instead of body sections.
- ❌ An ADR sentence describing the repo at the moment of writing rather than the decision — _currently_, _is being_, a version number, a transcribed field list ([the content test](#what-the-body-may-hold)).
- ❌ An ADR instructing its own continuation ("extend this list here") instead of deciding that the list exists and pointing at the page allowed to grow.
- ❌ A `Consequences` entry prescribing how future work is to be done — that is a convention, and it belongs where it can be edited.
- ❌ MADR fields (`decision-makers`, `consulted`, `informed`) or MADR's section names on an ADR — the shape here is Nygard's.
- ❌ Superseding, importing or writing a record from inside a locale tree — the record is the source file; the translation is a rendering of it.
