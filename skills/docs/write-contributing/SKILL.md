---
name: write-contributing
metadata:
  summary: Writes and reconciles CONTRIBUTING.md in the house style, deriving every repo fact from the file that owns it.
description: Writes and maintains a repo's `CONTRIBUTING.md` in the house style — scaffolds one where none exists, reconciles an existing guide against the repo it describes. Every repo-specific statement is derived from the file that owns it (branch base from `pr.base`, the gate command from the root `verify` key, the commit convention from commitlint, intake links from `.github/ISSUE_TEMPLATE/`, the package manager from the lockfile) instead of retyped, so the guide cannot contradict the repo; hand-written prose is never rewritten. Previews a plan and writes only after confirmation. Use when the user wants to write, scaffold, fix, update or reconcile a contributing guide or `CONTRIBUTING.md`, says the guide is out of date or tells contributors the wrong branch, or says things like "write the contributing guide", "update CONTRIBUTING.md", "Contributing-Guide schreiben", "CONTRIBUTING aktualisieren". Not for READMEs or the `docs/` tree.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(jq:*)
  - Bash(grep:*)
  - Bash(git symbolic-ref:*)
  - Bash(gh repo view:*)
---

# write-contributing

`CONTRIBUTING.md` is the one document that tells a contributor **how work is done in this repo** — which branch to start from, which command has to pass, how a commit is worded, where a bug goes. This skill owns that convention: one house structure, the same in every repo, with the repo-specific values read out of the repo rather than typed in. Structure catalogue, derivation recipes and reconcile rules: [REFERENCE.md](REFERENCE.md). Skeleton to copy: [`templates/CONTRIBUTING.template.md`](templates/CONTRIBUTING.template.md).

It is the guide's generator **and** its linter — the same skill scaffolds a missing one and reconciles an existing one, because the failure this exists to prevent is not a missing guide but a stale one.

## Derived, not retyped

Almost nothing in a contributing guide is the guide's own fact. Split every statement in two, and the whole skill follows:

| Kind         | What it is                                                                                                                       | This skill                                                     |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Derived**  | A fact some **other file** decides — the branch base, the gate command, the commit convention, the runtime floor, an intake link | **owns it**: reads the owner every run and writes what it says |
| **Authored** | The project's own prose — what a good PR looks like, the review bar, what this project is picky about                            | **never rewrites it**; may report it as suspect                |

A derived statement is **re-derived on every run**, never carried over from the existing text and never copied from another repo's guide. That is the entire mechanism: a guide assembled from the files it describes cannot contradict them, and a guide reconciled against them stops being able to drift silently.

**A fact with no owning file is asked about, never assumed.** "The default branch is `main`" is exactly the assumption that puts a contributor on the wrong branch — and it is the shape of every derivation failure here. Where two candidate owners disagree, that is a **prompt**, not a judgement call ([reconcile](#reconcile--the-guide-exists)).

What each statement is derived **from** is the derivation table in [REFERENCE.md](REFERENCE.md#derivation-table) — one row per fact, with its owning file, its fallback chain, and what must never stand in for it.

## Jobs — pick by repo state + intent

| State / intent                                                 | Job           |
| :------------------------------------------------------------- | :------------ |
| No `CONTRIBUTING.md`                                           | **scaffold**  |
| It exists + "update / fix / align / reconcile it"              | **reconcile** |
| It exists + "document X in it" (a new contributor-facing step) | **add**       |

Verb shortcuts: `/write-contributing init`, `/write-contributing add <step>`, `/write-contributing reconcile`. Otherwise infer from repo state and the request. **Always: plan → confirm → apply.**

**Plan-only triggers** — "just show me", "dry run", "plan only", "nur den Plan", "nicht schreiben": print the plan and the derivation table, write nothing.

## Structure — the house order

| #   | Section               | Include when                                                             | Holds                                                                                |
| :-- | :-------------------- | :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| 1   | Title + intro         | Always                                                                   | One welcoming line; the only place an emoji is allowed                               |
| 2   | Code of Conduct       | `CODE_OF_CONDUCT.md` exists                                              | Two sentences and the link — never a summary of it                                   |
| 3   | Reporting issues      | Always                                                                   | One line per intake route, each a link ([derivation](REFERENCE.md#derivation-table)) |
| 4   | Development setup     | Always                                                                   | Runtime floor, package manager, clone + install                                      |
| 5   | Adding a new `<unit>` | The repo has a repeatable contribution unit (a skill, a package, a rule) | The numbered path from empty folder to commit                                        |
| 6   | Running the suite     | Always                                                                   | The gate first, then the few commands a contributor runs by hand                     |
| 7   | Branching & PRs       | Always                                                                   | The **base branch**, the commit convention, one concern per PR                       |
| 8   | Style & quality gates | Hooks or a formatter are configured                                      | What runs on commit, and what to do when it fails                                    |
| 9   | Releases              | Release automation exists                                                | Two sentences: what cuts a release, from where                                       |
| 10  | License               | Always                                                                   | The inbound=outbound sentence and the link                                           |

**A section whose signal is absent is left out, not written empty.** "This project has no release process" is a line that tells a contributor nothing and goes stale the day one appears.

### Style rules

- **Emoji in the intro line only** — never in a heading. A contributing guide is not the README; the section emojis `write-readme` prescribes stop at the README's front door.
- **Second person, imperative, short.** The reader is mid-task.
- **Callouts** use `> [!TIP]` / `> [!IMPORTANT]` / `> [!NOTE]`, never a plain blockquote.
- **Tables** are left-aligned (`| :--- |`).
- **Never transcribe a file — any file, any list.** The rule is about **every enumeration**, not one table: a list whose owner is another file is **linked, not copied**, whatever it enumerates — the manifest's scripts, the artifacts a sync or codegen command writes, a unit's frontmatter fields, the globs a hook matches. The suite table is only its most familiar case: it names the gate and the handful of commands a contributor types, not every script in the manifest. **And where such a list must appear, it appears without a count in front of it** — "regenerates the four artifacts" is the one claim no gate can check, and it goes stale the day a fifth is added while every item beside it still reads true. Link the owner and let the owner say how many; a transcribed list is the second-most-common stale block in any guide, after the branch name.
- **Repo files are linked relatively** (`CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`), forge routes absolutely (a `?template=` new-issue URL). A relative link is what survives a fork.

## Scaffold — no guide yet

1. **Resolve the config** — `pr.base`, root `verify`, root `language` ([REFERENCE.md](REFERENCE.md#config)).
2. **Derive every fact** in the [derivation table](REFERENCE.md#derivation-table). Anything with no owner and no answer: **ask**.
3. **Pick the sections** — the structure above, dropping each whose signal the repo does not show, and naming the drops in the plan.
4. **Show the plan**: the section list, plus the derived facts as `fact → value → the file it came from`. That table is the part a human can actually check; the prose is the part they cannot.
5. **On confirm** — fill [`templates/CONTRIBUTING.template.md`](templates/CONTRIBUTING.template.md) and write `CONTRIBUTING.md`.

## Add — the guide exists, document one more step

A human asks for a contributor-facing step the guide has never carried: a one-time setup command the install does not do, a second intake route, the path for adding a new unit. **Distinct from the reconcile pass's [Add](#reconcile--the-guide-exists) bullet** — that one is a _derived_ span whose owner already exists and the guide merely never mentioned, found by the pass itself; this one is a request, and its content may have no owning file at all.

1. **Place it by the catalogue, not by the request's wording.** The step belongs in whichever [structure](#structure--the-house-order) row it matches. A step matching **no** row gets a section of its own, at the position the [catalogue](REFERENCE.md#section-catalogue) suggests, and the plan says so rather than deciding quietly.
2. **The right section may not exist yet.** A repo that has just grown a release flow carries no Releases section. Then this job **creates that one section**, in house order — and no other.
3. **Derive whatever the new text states.** The [derivation table](REFERENCE.md#derivation-table) binds here exactly as in a scaffold: a step that names a branch, a command or a file reads it from the owning file, never from how the request phrased it. A fact with no owner is **asked about**, not assumed.
4. **Everything around it stays byte-identical.** Authored prose in the same section is untouched, and no other section is re-derived — re-deriving the whole guide is the **reconcile** job, and the user asked for this step. Drift noticed in passing is **named in the report**, never fixed here; offer the reconcile pass instead.
5. **Plan → confirm → apply** — show the placement, the derived values with their sources, and the diff.

## Reconcile — the guide exists

Desired-state and idempotent — a `--fix` linter over one file. Running it twice changes nothing the second time.

1. **Read the whole guide fresh**, then every owning file it makes a claim about. Both are live state; neither is cached.
2. **Classify each span** derived or authored, then group the plan into four:
   - **Rewrite** — derived, and it contradicts its owner. The owner wins, always: the repo is right and the guide follows. (`Branch off main` where `pr.base` is `dev`.)
   - **Add** — derived and missing. The repo grew a gate, an intake template, a hook the guide never mentions.
   - **Prompt** — derived and ambiguous. Two owners disagree — `engines` says one runtime, the CI matrix another — so the run **asks** instead of picking.
   - **Report only** — authored prose that reads stale, a section fitting nothing, a dead link, a detected secret. Named in the report, **never auto-edited**.
3. **Show the plan and the diff**; on confirm, apply. **Never rewrite authored prose. Only touch `CONTRIBUTING.md`.**

**A derived span whose owner is gone** — a command no longer in the manifest, a workflow deleted — is a **removal**, confirmed span by span and never in bulk: an owner that vanished is as often a rename as a deletion.

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

- **The repo is the source of truth; the guide follows it.** This skill never edits the file it derived a fact from, and never "fixes" the repo to match the guide — a mismatch is the guide's defect by definition.
- **Only `CONTRIBUTING.md`.** No sibling document, no config, no commit.
- **Plan first; write only after confirmation.** Respect plan-only / dry-run.
- **Never invent a value.** No default branch by assumption, no gate command by guess, nothing copied out of another repo's guide because it read well there.
- **Never rewrite authored prose** — the project's voice is not this skill's to normalise, however much shorter it could be.
- **Attribution-free** — no agent self-naming, no `Generated with`/🤖 line, no session URL.
- **No secrets** — a setup step is real, copy-pasteable shell: scan it for tokens and `.env` values, and show a placeholder rather than a live one.

## Reference

- Section catalogue, derivation table with per-fact recipes, reconcile rules and config keys: [REFERENCE.md](REFERENCE.md).
- Skeleton to fill: [`templates/CONTRIBUTING.template.md`](templates/CONTRIBUTING.template.md).
- Neighbours, named rather than called: `write-readme` owns `README.md`, `write-docs` owns the `docs/` tree. A contributing guide that starts explaining architecture belongs in `docs/`; one that starts selling the project belongs in the README.

## Gap report (mandatory final step)

End the turn with a short note listing anything [REFERENCE.md](REFERENCE.md) did not cover:

```text
Gap report — improvements for write-contributing:
- Section "{name}" — no catalogue entry; placed after {section}.
- Fact "{name}" — no derivation row; read from {file}.
- Fact "{name}" — no owning file in this repo; asked the user.
```

If everything matched: `Gap report: no gaps.` **Only report; do not edit REFERENCE.md yourself** — the user folds gaps back in.
