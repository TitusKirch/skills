# decide — Reference

Mechanics for the [`decide`](SKILL.md) skill. No tracker, no forge, no branch files: the input is the session, the output is a set of answers, and the only file it touches is the one the decisions already lived in.

## Principle

> **The questions are given; only the form is this skill's.** Everything it adds sits between a decision that was already named and a human who was always going to answer it — options instead of prose, one at a time instead of a wall, and an answer written back instead of retyped. The moment it starts deciding _which_ questions exist, it has become the interview it is supposed to be calling.

## Config

**No section of its own.** `decide` reads two shared root keys and nothing else: `grillWith` (the interview engine) and `language` (the prose the questions and the written answers are in). Precedent for owning no section: `tldr`, `handoff` and `update-deps`. There is nothing here for a repo to vary — the dialog form is the skill, so a `decide.*` key could only ever switch off the one thing it does.

### Reading `grillWith` — three states, not two

`grillWith` has three states and the ordinary recipe collapses two of them, silently. `select(. != null)` filters an explicit `null` **exactly as it filters an absent key** — both yield the empty string and fall through to the default — so `"grillWith": null` would read as absent and this run would drive `grilling` where the repo said no engine. (`false` survives that recipe, stringifying to `"false"`; only `null` inverts, and `null` is what a `ci` profile sets.) So ask for **presence** first and the **value** second:

```sh
engine=grilling
if printf '%s' "$resolved" | jq -e 'has("grillWith")' >/dev/null 2>&1; then
  engine=$(printf '%s' "$resolved" | jq -r '.grillWith | select(. != null) | tostring' 2>/dev/null) || engine=
  [ "$engine" = "false" ] && engine=
fi
```

`has("grillWith")` is asked of the **resolved root**, not of a section — the key is a root key, and asking it of any section reports every config as absent.

An empty `$engine` here is the **no engine** state, and for this skill it is not a stop. `refine-issue` reports its decisions and ends there, because without an engine it has nothing left to do; `decide` still has its entire contribution to make, so it forms the questions from the context itself and asks them as dialogs anyway. The same fallback covers an engine that is **named but not installed** — that is an absent skill, not a configured refusal, and both land on the same path.

**One value is never valid, whatever the key says.** An engine declaring `disable-model-invocation: true` cannot be driven by a skill at all (`grill-me` and `batch-grill-me` both do). Report that as a config error and take the no-engine path — never substitute another engine, because a run that reports success on an interview nobody configured is worse than one that says the key is wrong.

**And `decide` is not a value for this key.** It calls the engine; it is not one. Naming it there configures a loop, and it is worth saying out loud because the skill sits close enough to an interview to look like one from the config file.

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
*)  echo "resolve-config failed ($status)" >&2; exit 1 ;;
esac
```

**A failure here is never silent.** Any exit other than `0` or `10` means the resolver could not be found or could not run, and the only wrong response is to carry on with `{}` — that reports the repo's defaults as if they were its settings. Stop and say what failed.

The profile comes from `TITUSKIRCH_SKILLS_PROFILE`, falling back to `ci` when `CI` holds a truthy value, and to no profile otherwise. An unset or unknown name yields the base config unchanged.

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

## What counts as an input decision

The list is the session's, not this skill's. What qualifies is a decision **a run has already named as open** — and the wording of that naming is what gets asked, not a paraphrase that quietly rescopes it.

| Source                                           | What it looks like                                                   |
| :----------------------------------------------- | :------------------------------------------------------------------- |
| a `refine-issue` verdict that ended `still open` | the questions holding the issue back from a human's approval         |
| a plan or proposal                               | the alternatives it laid out without picking one                     |
| a gap or findings report                         | the choices it says a human has to make before the work can continue |
| a design note                                    | trade-offs it named and left standing                                |

Four disqualifiers, and each one removes a question rather than reshaping it:

- **Already answered in the repo.** A choice this repo has made elsewhere is made; asking it invites an answer that contradicts the codebase. The interview engine already carries the rule that what is findable gets looked up — this skill inherits it and does not restate it.
- **Already answered later in the session.** The list was written before the answer arrived. Drop it and say so.
- **An implementer's decision.** Naming, file layout, which helper, how to test it — spending a human's attention on the work they delegated. `refine-issue` states the same boundary from the other side.
- **Not actually named.** A decision the run implies rather than lists is a decision this skill would be inventing. It is not on the list.

**No decisions left is a real outcome.** Report which were dropped and why, and stop — a run with an empty list has nothing to ask, and a picker built to fill the silence is the exact failure the skill is against.

## Ordering

Ask in the order the answers **constrain** one another:

1. **Decisions nothing else depends on, that other decisions depend on** — the ones whose answer changes the shape of what follows.
2. **Decisions dependent on those**, formed only after their prerequisite is answered.
3. **Independent decisions**, in the order the caller listed them.

Two consequences worth stating: an answer that **collapses** a later question removes it — say which one it closed rather than asking it anyway; and an answer that **creates** a decision the list did not have is reported as a new open decision, never silently appended to the run and asked.

## Forming the options

An option is a **decision stated as taken**, not a label for a debate:

- **Good** — "Keep the answers in the issue body, so the loop reads them."
- **Bad** — "Body vs comment."

Rules for a dialog:

- **Two to four options.** One is not a question; five is a list the human has to re-read before answering, which costs more than typing.
- **The recommendation is first and is named as the recommendation**, with the one clause that makes it the recommendation. An unmarked "best" option is an opinion presented as an ordering.
- **Options are mutually distinct.** Two spellings of the same choice is a dialog that decides nothing, and it is how a fabricated option usually enters.
- **An escape is always available** — decline, defer, or answer off-menu. A decision answered off-menu takes the answer given; a declined one stays open.

### When a decision resists options

Ask it **in prose**, or leave it open. Both are outcomes, neither is a degradation. The shapes that qualify:

- **An open-ended value** — a name, a threshold, a budget, a date. The answer space is not a set.
- **A continuum** — "how strict", "how much". Cutting it into three named points invents a granularity the decision does not have.
- **A question whose honest options are unknown to the run.** Where the alternatives would have to be guessed, the guess is what gets picked — a fabricated option is indistinguishable from a considered one once it is on screen, and it is picked with the same confidence.

The failure this rule prevents is specific: pressing every decision into a picker makes the skill **look** like it worked while producing a decision nobody actually made. The status quo — the question printed as prose — is better than that, which is why the fallback is written into the workflow rather than left to judgement.

## Where the answers go

**The context names the target; the run never picks one for convenience.**

| The decisions came from                             | Target                                       | Shape                                      |
| :-------------------------------------------------- | :------------------------------------------- | :----------------------------------------- |
| an **issue** the session points at                  | that issue's body                            | the `Decided` block `refine-issue` defines |
| an **artifact** — a plan, a design note, a doc page | that artifact, where the decisions are named | the artifact's own conventions             |
| **nothing named**                                   | the terminal                                 | the report, and no file is touched         |

- **The `Decided` block is named, not copied.** Its dating, its one-bullet-per-decision rule and its supersedes rule live in `refine-issue` and are read there. Copying them here would give one format two definitions, and the copy is the one that goes stale. **Optional call**: without `refine-issue` installed, the answers still go into the body — written as a dated block, one bullet per decision, superseding stated rather than silent — and the report says the shape was not read from its owner.
- **More than one target named → ask which**, as a dialog like any other decision. Writing to both duplicates an answer that then drifts.
- **No forge, no tracker.** A write into an issue goes through the path the **session already established** for reading and writing that issue. Where the session established none, the target is not an issue: fall back to the terminal and say so. This skill resolves no forge and ships no tracker recipe, so reaching for one would be inventing a route it never verified.
- **Never rewrite what a human wrote.** An answer that contradicts an earlier line says so; the earlier line stays where its author put it.
- **In the configured language** (root `language`), whatever language the dialogs happened in.

## Report output

The run ends here, and it is read once in a terminal:

```text
decide — 4 decisions, from the refine-issue run on #283
  engine   : grilling (root grillWith)
  closed   : 3
             - where the answers go       → the issue body, as a Decided block
             - what a decision without options gets → asked in prose, never invented options
             - who may name it in grillWith → nobody; it is a caller, not an engine
  prose    : 1 asked as free text (the block's heading wording)
  open     : 1 deferred — the release timing, waiting on a person who is not here
  written  : issue #283 body, Decided block appended (3 bullets)
```

- **An open decision is reported as open.** Never rounded up, never answered on the human's behalf to make the line read better.
- **The engine line names what was actually driven**, including "none — grillWith is null" or "none — the named engine is not installed", so a reader can tell a full interview from the fallback that still asked the questions.
