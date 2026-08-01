# tldr — Reference

Mechanics for the [`tldr`](SKILL.md) skill. No tracker, no forge, no file: the output is a message, and the only thing it reads besides the conversation is the repo's own git state.

## Principle

> **The frame is fixed so the content can vary.** The first section and the last are the same every run; only the middle is named for what it carries. A reader who has seen one summary knows where to look in the next — which is the entire value, and the thing a per-run "sensible structure" destroys.

## Config

**None.** `tldr` owns no section in `.tituskirch-skills.json`; it reads only the shared root `language`, which decides the prose and the heading names. Precedent: `handoff` and `update-deps` own no section either — and here there is nothing left for a repo to vary, because the frame is deliberately not negotiable ([Decisions](#decisions)).

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

## Scope

Three scopes, one per invocation. They differ only in **how far back the read goes**; everything after that is identical.

| Scope                      | Boundary                                                  | Typical request                                         |
| :------------------------- | :-------------------------------------------------------- | :------------------------------------------------------ |
| **the last answer**        | the immediately preceding response, and nothing before it | "tldr", "shorter", "recap that", "kurzfassung"          |
| **the task just finished** | from where the current task started to now                | "summarise what you just did", "what changed"           |
| **the whole session**      | everything since the session began                        | "summarise this session", "was haben wir heute gemacht" |

- **A bare request is the last answer.** It is the cheapest of the three and the most common form the request takes.
- **An inferred scope is named**, in the opening clause of the lead section — "Over the last answer: …". A stated scope needs no such line.
- **A scope is never widened to fill the frame.** A one-line answer summarised at "last answer" scope produces a one-line `## TL;DR` and nothing else; reaching back into the session for more material answers a question nobody asked.

## The section frame

| Position   | Section                  | Holds                                                                            |
| :--------- | :----------------------- | :------------------------------------------------------------------------------- |
| **first**  | `TL;DR`                  | the answer in one to three sentences — what happened, and whether it is finished |
| **middle** | `Changes` · `Verified`   | **work**: what the tree/history now says; what was run and what it returned      |
| **middle** | `Key points` · `Caveats` | **text or an answer**: the claims that matter; where they do not hold            |
| **last**   | `Open`                   | unfinished, undecided, or waiting on a person                                    |

**The middle is chosen by subject, not by scope.** A session that both did work and answered questions takes the sections it has content for — `Changes`, `Verified` and `Caveats` in one summary is a correct result, not a mixed metaphor. What never varies is that `TL;DR` opens and `Open` closes.

**An empty section is dropped.** Not `None.`, not `n/a`, not a heading with a dash under it — the same rule the `issue` skill applies to its own default body structure. A summary of a clean, finished task is legitimately two sections long.

**`Verified` is the section that can lie.** It holds what was actually run and what it returned — a command and its result. A check that was skipped, deferred, or assumed does not belong there; if it matters, it is an entry under `Open` ("the suite has not been run since the last edit"). Nothing else in the frame carries this risk, because nothing else in the frame makes a claim about a machine.

**`Open` is last and stays its own section.** It is the part a reader scrolls to, and folding it into the lead is how "still open" becomes invisible. Nothing open → the section is dropped, and its absence says the same thing far more credibly than an `## Open` reading "nothing".

### Language

Headings are written in the resolved output `language`, so a German run reads:

```markdown
## TL;DR

## Änderungen

## Offen
```

**The frame is positional, not lexical.** What must not move is that the lead comes first, the named middle second, and the open items last. The English words above are the reference spelling, not the contract — a repo running in German gets German headings, and a translation that keeps the order keeps the frame.

## Content source

| Subject                              | Read                                                          |
| :----------------------------------- | :------------------------------------------------------------ |
| **work performed**                   | the conversation **plus** `git status`, `git log`, `git diff` |
| **an explanation, a decision, text** | the conversation alone — no git command is run                |

**Why git is not optional for work.** A summary assembled from recollection alone goes quietly incomplete after a context compaction: the transcript is compressed away and nothing announces that it was. The working tree and the history are not compacted, so reading them is what keeps `Changes` a report rather than a memory. `handoff` and `pull-request` draw on the repo for the same reason.

**Where the two disagree, the repo wins** — and the disagreement is itself worth a line. A change the conversation describes that the tree does not have is the single most useful thing a summary can surface.

**Outside a repo**, or where the git commands fail, say so in one clause and summarise from the conversation. A summary that silently drops to recollection is the failure this rule exists to prevent.

**Read-only, always.** `git status`, `git log`, `git diff` and `git rev-parse` are the whole vocabulary. This skill runs no build, no test and no formatter — a `Verified` section reports what the session already ran, it does not run anything to fill itself.

## Relationship to the siblings

| Skill           | Relationship                                                                                                                                                                                                                                                                                        |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handoff`       | **Different reader, different artifact.** A handoff is a **committed document** written for **another agent** to continue from, and it is deleted when the work lands. A summary is **terminal text** for the **human in this session**, and nothing outlives the message. Neither calls the other. |
| `pull-request`  | **Different input.** A PR body is composed from a **branch's commits** and lands on the forge. A summary covers a scope of the **conversation**, most of which never becomes a commit, and lands nowhere.                                                                                           |
| `atomic-commit` | **Adjacent, not overlapping.** Both read the working diff; one turns it into commits, the other into prose a person reads once. A summary never commits, and a commit message is not a summary of the session.                                                                                      |

## Decisions

Settled in a `grilling` pass on the issue that specified this skill, rather than inferred:

- **One skill, invoked on request — not a persistent formatter.** The obvious second half, "shorten every answer from now on", is a different genus: it is an **output style**, and it fights the mechanism a skill is invoked by. A skill fires on a description match, which is exactly the reliability an "every response" promise needs and cannot have — the persistent formatters that exist have to write "still active if unsure" precisely to compensate. Two skills would also put two near-identical descriptions in competition at every invoke.
- **The "last answer" scope stays.** It is the cheapest of the three, runs on the same machinery, and dropping it would leave the skill unable to answer the most common form of the request.
- **Fixed frame, named middle.** Naming every section for its content maximises fit per run and destroys skimmability across runs; fixing every section produces `## Verified — none` on a summary of a paragraph of prose. Fixing the ends and naming the middle keeps the shape a reader has learned while letting the substance be called what it is.
- **An empty section is dropped, not filled.** Rejected: **every section always, "none" included** — maximally predictable and diffable, but it pads a two-line summary with empty headings, and a frame that is mostly filler stops being read.
- **Git is read whenever the subject is work.** Rejected: **conversation context only** — cheap, and usable outside a repo, but it goes quietly incomplete after a compaction with nothing to signal the gap.
- **Terminal text, never a file.** This is the line against `handoff`. A summary that lands in the repo is a document with a lifecycle, an id and a deletion rule, which is a different skill and already exists.
- **No config section.** The frame is fixed on purpose, so there is nothing for a repo to vary; a `tldr.*` section could only ever be empty, and adding one later is additive while removing one is a break. `language` is read because every skill that writes prose reads it.
- **`work/`, not a new category.** Its neighbour `handoff` is likewise neither an issue nor a work loop, and a fifth category holding exactly one skill would be reserved for neighbours that do not exist. `docs/` was the other candidate — it is the category that produces text — but everything in it writes a file into the repo, and this skill writes none.
- **The name is `tldr`, not `work-tldr`.** The category carries the grouping; a shared stem is for a family read as one unit (`work-implement` / `work-implement-queue`), which this is not.
