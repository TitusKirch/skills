---
name: tldr
metadata:
  summary: Summarises the last answer, the task just finished, or the whole session into a fixed section order.
description: Summarises what just happened into a fixed section order — a TL;DR first, a middle named for what it carries, open items last — over one scope taken from the request, either the last answer, the task just finished, or the whole session. Reads the conversation, and the repo's own git state whenever the subject is work performed, so what changed is evidenced rather than remembered. Prints terminal text, writes no file, and never turns into a mode that reformats later answers. Use when the user wants a summary, recap, digest or overview of what happened, asks what changed or what is still open, or says things like "tldr", "summarise this session", "recap that", "give me the short version", "fasse das zusammen", "kurzfassung", "was ist offen".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(jq:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git rev-parse:*)
---

# tldr

Answer **"what actually happened, and what is still open?"** in a shape that is the same every time — a short lead, a middle named for what it carries, and the open items last. One scope, taken from the request. **Terminal text**, never a file. **On request**, never a mode that stays on.

The frame is the product. A summary whose sections move between runs cannot be skimmed, and skimming is the only reason anyone asks for one.

## Workflow

### 1. Fix the scope

Three scopes, and the request picks one:

| The request                                      | Scope                      | What is summarised                                            |
| :----------------------------------------------- | :------------------------- | :------------------------------------------------------------ |
| "tldr", "shorter", "recap that"                  | **the last answer**        | the immediately preceding response, nothing before it         |
| "summarise what you just did", "what changed"    | **the task just finished** | the work of the current task, from where it started until now |
| "summarise this session", "what did we do today" | **the whole session**      | everything since the session began                            |

- **A bare "tldr" is the last answer** — the cheapest of the three and the most common form of the request.
- **Name the scope when it was inferred rather than stated**, in the opening clause of the lead section. A reader who asked for one scope and received another has to reconstruct which, which costs more than the sentence saves.
- The scope bounds what is read. Never widen it to make a thin summary look fuller.

### 2. Gather what the sections will hold

Statements come from the conversation — but **as soon as the subject is work performed, read the repo**, so the changes are evidenced rather than remembered:

```sh
git status --short          # what is uncommitted right now
git diff --stat             # the shape of it
git log --oneline <since>   # what landed during the scope
```

This is the half that survives a context compaction: the transcript can be compressed away, the working tree cannot.

- **Evidence beats recollection.** Where the two disagree, the repo wins and the disagreement is worth a line of its own.
- **No repo, or nothing performed** (summarising an explanation, a decision, a piece of text) → the conversation is the whole source, and no git command is run.
- **Read only.** This skill runs no build, no test, no formatter, and changes nothing.

### 3. Write the sections

The **first and last sections are always the same; the middle is named for what it carries**:

| Position | Summarising work            | Summarising text or an answer |
| :------- | :-------------------------- | :---------------------------- |
| first    | `## TL;DR`                  | `## TL;DR`                    |
| middle   | `## Changes`, `## Verified` | `## Key points`, `## Caveats` |
| last     | `## Open`                   | `## Open`                     |

- **A section with no content is dropped**, not filled with "none".
- **Heading names follow the output language** — a German run reads `## Änderungen` / `## Offen`. What is fixed is the frame's positions and their order, not the English wording. Language resolution: [REFERENCE.md](REFERENCE.md#config).
- **`## Verified` holds what was actually run and what it returned** — never a check that was skipped, and never "should pass".
- **`## Open`** is what is unfinished, undecided, or waiting on a person. It is the section a reader scrolls to, which is why it is last and never merged into the lead.

Section contract, worked examples and the mixed case: [REFERENCE.md](REFERENCE.md#the-section-frame).

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

- **On request, never a mode.** One summary per invocation. This skill never promises to reformat later answers, and never says it is "still active" — a mode that reformats every turn is an output style, and a skill is invoked by description match rather than by staying on.
- **Terminal text, no file.** Nothing is written to the repo and nothing is committed. Work that needs to travel to another agent is `handoff`'s job; a branch's commits becoming a PR description is `pull-request`'s. Both are mentions, not calls — this skill hands work to neither.
- **Summarise, never extend.** No new work, no fixes, no commits, no pushes — and nothing in the summary that did not happen. A gap in the record is reported as a gap.
- **Drop, never pad.** An empty section disappears; it is never filled with "none", "n/a" or a restatement of the lead.
- **Attribution-free** — no `Generated with`/🤖 line, no session url, no agent self-naming.
- **Secret-free.** A summary that quotes a diff, a log line or an env dump is exactly where a token gets copied out of the repo and into a chat log. Scan what is quoted and leave it out, naming where it lives instead.

## Reference

**Open it at step 1 whenever the request does not name its scope** — last answer, the task just finished, or the whole session — because resolving that wrong summarises the wrong thing convincingly. **At step 2** for the content-source rule that decides when git state has to be read rather than the session recalled, and **at step 3** for the section frame in full and the language the headings take: [REFERENCE.md](REFERENCE.md). Where a summary is the wrong artefact altogether, the same file names the neighbours it hands to — `handoff` and `pull-request`.
