# Skills

Skills are grouped into **categories** — one directory level between `skills/` and the skill itself:

```text
skills/
  <category>/
    README.md         # generated — the category's landing page
    <skill-name>/
      SKILL.md        # required — frontmatter + body
      REFERENCE.md    # optional — mechanics, recipes, config tables
      DESIGN.md       # optional — why the skill is shaped this way
      templates/      # optional — templates, prompts, scripts the skill ships with
      evals/          # optional — dev-only eval fixtures; stripped by skill-creator packaging & skills:link
```

| Category | Holds                                                                       |
| :------- | :-------------------------------------------------------------------------- |
| `repo/`  | Commits, pull requests, releases, dependency updates.                       |
| `work/`  | Issues, the AI implement/review loops, session handoffs, session summaries. |
| `docs/`  | Documentation, READMEs, terminal demos.                                     |
| `meta/`  | Configuring the skills themselves.                                          |

Categories are a **display and navigation** device, not a namespace: a skill's `name` is still globally unique and unprefixed, and `pnpm skills:link` flattens them back into each of its destinations (`~/.claude/skills/` and `~/.agents/skills/`). Category membership comes from the filesystem; each category's title and description live in `CATEGORIES` in [`scripts/gen-skills.ts`](../scripts/gen-skills.ts) — adding a category means one entry there, or `pnpm skills:sync` fails loudly rather than silently dropping the folder.

## `SKILL.md` frontmatter

```markdown
---
name: skill-name
metadata:
  summary: Short one-liner shown in the root README skills table.
description: What the skill does and when to invoke it — imperative, keyword-rich, a short paragraph, ≤ 960 chars.
allowed-tools:
  - Read
  - Bash(git diff:*)
  - Bash(git log:*)
---

# Skill body

Instructions for Claude when this skill is invoked. Be specific about:

- When the skill should trigger.
- What inputs it expects.
- The steps to perform.
- What the final output should look like.
```

### Field notes

These skills track the [Agent Skills open standard](https://agentskills.io/specification); Claude Code layers its own extensions on top (its [frontmatter reference](https://code.claude.com/docs/en/skills)), and Cursor a smaller set of its own. Each field below is tagged **[standard]**, **[house]**, or with the clients that define it, so an author can tell portable from client-specific at a glance. **That client tag is a list, not a single name** — **[Claude Code]** where one client defines the field, **[Claude Code, Cursor]** where both do and both honour it as written. The singular form would assert something false about the shared fields, and a fourth tag would leave the reader still asking _which_ clients ([ADR-0007](../docs/99.adr/0007-permit-claude-code-frontmatter-extensions.md#amendments)). What this repo publishes today is the standard core, one house field (`summary`), and one Claude Code extension (`disallowed-tools`, on the two unattended queue skills).

- **`name`** _(required)_ **[standard]** — 1–64 characters, lowercase `a-z`, `0-9` and single hyphens (no leading, trailing, or consecutive hyphen); must match the folder name. Used as the invocation slug.
- **`description`** _(required)_ **[standard]** — **capped at 1024 characters** by the standard; **this repo budgets 960**, non-empty. This is the text Claude reads to decide _when_ to invoke the skill, so write it as _when to act_, not _what the skill is_: imperative, keyword-rich, key use case first, a few sentences to a short paragraph — and include the trigger phrases (with their other-language variants) a user would actually say. Descriptions tend to grow past what helps; the standard's [optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) is the guide. (Claude Code adds a second, softer budget: it truncates the combined `description` + `when_to_use` at 1,536 characters in the skill listing.)
  - **The 64 characters between the budget and the cap are the point.** A description gets edited whenever a trigger phrase is missing or a near-miss needs disambiguating, and 64 characters is about one trigger phrase plus its other-language variant — so that edit never has to be length-neutral. Writing to the cap instead makes every later edit a conformance risk, silently: the spec cap is a cliff, and a skill one character over is non-conformant while every check stays green. `pnpm skills:sync` and `pnpm skills:check` enforce the 960 budget, so going over is caught while the skill is still conformant.
- **`summary`** _(optional)_ **[house]** — this repo's own field, not part of the standard: the one-liner shown in the root README skills table, falling back to the first clause of `description`. It is read only by `pnpm skills:sync` when the artifacts are built — no agent ever sees it. It lives at `metadata.summary`, the standard's conforming home for a client-specific field like this (`metadata` exists for exactly this). Nine artifacts are generated from the skill folders via `pnpm skills:sync` (CI runs `pnpm skills:check`), so none is hand-edited: the root README table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, `skills.sh.json`'s groupings, the [mirrored config contract](#reading-the-config--mirrored-not-linked), the [author-authority block](../scripts/authority-block.md) mirrored into each skill that reads third-party text, the [check-command contract](../scripts/verify-block.md) mirrored into each skill that runs the repo's gate, the [single-flight-lock spec](../scripts/worklock-block.md) mirrored into the two work-loop **unit** skills (the two queues name it instead — see below), and the [plan-presentation rule](../scripts/plan-block.md) mirrored into each skill that puts a plan in front of a human.
- **`allowed-tools`** _(optional)_ **[standard, Experimental]** — **pre-approval, not restriction.** The tools Claude may use **without stopping to ask permission** during the turn that invokes the skill; the grant clears on your next message. It does **not** narrow the toolset — every tool stays callable, and your permission settings still govern anything unlisted. Scope it the way `.claude/settings.json` rules do: `allowed-tools: Bash(git diff:*) Bash(gh pr view:*) Read` pre-approves exactly those, not a blanket `Bash`. **The scoped form is the default here, and a bare `Bash` is a named exception** — [`test/allowed-tools.test.ts`](../test/allowed-tools.test.ts) lists every skill still granting one together with the reason, and fails both on a skill missing from the list and on a stale entry, so the list can only shrink ([ADR-0017](../docs/99.adr/0017-make-a-blanket-bash-grant-a-named-exception.md)). Every reason left on that list is **permanent rather than a backlog** — the migration is finished, so nothing on it is pending a per-skill pass. **Which kinds of reason qualify is enumerated once, in that test, and pinned in both directions** (a kind no skill claims fails, and so does a skill claiming a kind the file does not list); this page does not restate them, and carries no count and no roster either. That is deliberate rather than an omission: a number or a name list in prose is the one claim the gate cannot read, and it is what went stale each time the exception list moved. **Scope by what the prefix can reach, not by what you mean it to do** — a rule is a command-prefix match, so `Bash(sh:*)`, `Bash(find:*)`, `Bash(git:*)` and `Bash(gh:*)` each pre-approve arbitrary execution (`sh -c …`, `find -exec …`, `git -c alias.x='!…' x`, `gh alias set --shell x …` then `gh x`); the same test rejects a rule headed by such a command, so a narrowing has to be real, and it holds the examples on this page to the same check. What a cleared prefix promises is bounded too — it says the spelling cannot reach an exec route through its **arguments**, not that a repository cannot supply one through configuration (`core.pager`, `diff.external`), which is why the durable controls are the ones below and not this list. Where the run **is** attended, leaving a command off is a deliberate choice and not an omission — `validate-skills` does not pre-approve `uvx` or `pip`, so installing the validator asks first. The scoped skills follow one rule, and it has two halves: **a write the skill's own confirmation step already gates is pre-approved; a write that reaches the forge or the remote asks.** Pre-approved on the first half — `atomic-commit`'s `git add`, `git apply` and `git commit`, `prune-branches`' `git branch`: every one a write the skill performs, and every one behind a confirmation it already promised in prose. Left to ask on the second — the deleting `git push` (`prune-branches`), `gh pr create` (`pull-request`), `gh pr merge` (`release`), `issue`'s three `gh issue` writes: the actions that leave the machine. So the one prompt a run stops on is the action a person was going to be asked about anyway. `gh api` is the case the rule has to answer out loud rather than by implication: it is pre-approved wherever a skill's `gh` reads need it, and deliberately absent from [`issue`](work/issue/REFERENCE.md), whose sub-issue recipes drive it with `--method POST` and `--method DELETE` that a prefix cannot tell from a read. That split is consistent under the rule and **nothing enforces it** — which side a command falls on is per-skill judgement, not something the gate checks. Cache bookkeeping sits outside both halves: the `printf`, `mkdir` and heredoc `cat` that maintain the shared convention and catalog caches under the git common dir write nothing anyone would be asked about. **A grant is written at the narrowest prefix that covers every call the skill makes** — `Bash(git worktree list:*)` where that narrowing lands on a subcommand, `Bash(git branch --show-current:*)` where it lands on a flag — rather than granted at the parent and then explained away, so the enumeration above stays a list of writes the skills actually perform. The flag-anchored form is the more brittle of the two, because a flag can be reordered where a subcommand cannot; it holds where the call has one shape and no variants, which is a property of that call site rather than of the rule. **The subcommand half of that rule is read by the same test**, which parses the commands each skill's own `SKILL.md` and `REFERENCE.md` show it running and fails a rule sitting a subcommand above every call under it — so `Bash(git worktree:*)` cannot come back over a skill that only ever runs `git worktree list`. It also fails a rule no recipe demonstrates at all, with the same named-exception list and written reason a blanket grant costs. The flag half stays a review matter on purpose: demanding a flag anchor wherever a skill's calls happen to share one would sweep `jq -er`, `printf %s` and twenty more into the brittle form, which is the opposite of what "holds where the call has one shape" says. None of this **restricts** anything: an unlisted command still runs once someone says yes, so what the scoped form buys is a smaller silent surface, not a boundary. The standard writes it as a space-separated string; Claude Code also accepts a comma-separated string or a YAML list (the form these skills use). The standard flags the field itself **Experimental** ("support for this field may vary between agent implementations"), so despite the [standard] tag it is no portability guarantee — and every skill here depends on it.
- **`disallowed-tools`** _(optional)_ **[Claude Code]** — the field that **actually restricts**: tools **removed from Claude's pool** while the skill is active (cleared on your next message). This is the real "keep the skill away from X" control — e.g. `AskUserQuestion` on an unattended queue skill, where a question nobody answers would hang the run. Where a tool is named in both, `disallowed-tools` wins. Not part of the open standard.
- **`license`** _(optional)_ **[standard]** — the license applied to the skill: a license name, or a reference to a bundled license file.
- **`compatibility`** _(optional)_ **[standard]** — up to 500 characters stating environment requirements (intended product, required system packages, network access). All these skills omit it.
- **`metadata`** _(optional)_ **[standard]** — a string-to-string map for properties the standard does not define; the conforming home for a house field such as `summary`.

Clients define further frontmatter beyond `disallowed-tools` — thirteen more from Claude Code (`when_to_use`, `model`, `effort`, `hooks`, `paths`, `argument-hint` and the rest), plus Cursor's legacy `globs` — none of which these skills use today. The **complete** list, and which client defines each, is the extension matrix in [`validate-skills`](meta/validate-skills/REFERENCE.md#the-extension-matrix); adopt a field only after adding it there, or this repo's own conformance gate will call a deliberate choice malformed.

Two things that list makes visible and a per-client reading does not. **"Claude-only" is not always true** — `paths` and `disable-model-invocation` are Cursor's fields too, with the same names and meanings, so they cost less portability than the rest. And **extending need not cost conformance at all**: Codex keeps `SKILL.md` to `name` and `description` and puts its extensions in a sidecar at `<skill>/agents/openai.yaml`, which the standard permits outright. Where the job is UI naming, an invocation policy or a tool dependency, that sidecar does it for free.

## Naming

- Folder name = skill name = kebab-case.
- **The category carries the grouping, so the name should not.** A skill in `docs/` is `write-docs`, never `docs-write`. Where a family genuinely reads as one unit, keep the shared stem in the name (`work-implement`, `work-implement-queue`) — that pairs the two halves of a loop, which a folder alone would not.

## Shared config

Some skills read an optional, committed `.tituskirch-skills.json` at the **consuming repo's** root (not this repo) — a small, shared override surface. It is validated by [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json); point `$schema` at the raw URL for editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json",
  "language": "de",
  "pr": { "base": "dev" },
  "issue": { "tracker": "github" }
}
```

Resolution per setting: **config → native/detected → built-in default** — absent config means today's behavior. Four keys sit at the root because they are facts about the **repo**, not about one skill — `forge`, `forgeHost`, `language` and `verify`; everything else lives under a skill section (`pr.*`, `issue.*`). Each skill documents only the keys it reads, in its own `REFERENCE.md`:

- [`atomic-commit`](repo/atomic-commit/REFERENCE.md#config) — `language`, `commit.language`
- [`pull-request`](repo/pull-request/REFERENCE.md#config) — `language`, `pr.*`
- [`issue`](work/issue/REFERENCE.md#config) — `language`, `issue.*`
- [`refine-issue`](work/refine-issue/REFERENCE.md#config) — `language`, `issue.language`, `work.*`
- [`release`](repo/release/REFERENCE.md#config) — `language`, `release.*`, `pr.base`
- [`merge-deps`](repo/merge-deps/REFERENCE.md#config) — `language`, `verify`, `mergeDeps.*`
- [`prune-branches`](repo/prune-branches/REFERENCE.md#config) — `language`, `pr.base`, `pruneBranches.*`
- [`update-deps`](repo/update-deps/REFERENCE.md#config) — `language`, `verify` (owns no section of its own)
- [`prune-comments`](repo/prune-comments/REFERENCE.md#config) — `language`, `verify`, `pr.base` (owns no section of its own)
- [`handoff`](work/handoff/REFERENCE.md#config) — `language` (owns no section of its own)
- [`write-contributing`](docs/write-contributing/REFERENCE.md#config) — `language`, `verify`, `pr.base` (owns no section of its own)
- [`tldr`](work/tldr/REFERENCE.md#config) — `language` (owns no section of its own)
- [`write-docs`](docs/write-docs/REFERENCE.md#config) — `language`, `docs.*`
- [`compact-readme`](docs/compact-readme/REFERENCE.md#config) — `docs` (owns no section of its own)
- [`work-implement`](work/work-implement/REFERENCE.md#config) — `language`, `verify`, `work.*`, `pr.base`
- [`work-implement-queue`](work/work-implement/REFERENCE.md#config) — shares `work-implement`'s `work.*` config
- [`work-review`](work/work-review/REFERENCE.md#config) — `language`, `verify`, `work.*`, `work.review.*`
- [`work-review-queue`](work/work-review/REFERENCE.md#config) — shares `work-review`'s config

`tituskirch-skills-config` also carries the mirrored config block and resolver, but as the config's **author** rather than a consumer — it manages the file rather than reading it, so it sits outside this reader list.

Auto-detected data (commit conventions, issue catalogs) is cached separately under `tituskirch-skills/` in the git common dir — never committed, TTL-disposable.

## Reading the config — mirrored, not linked

**A skill may not link out of its own folder.** It can be installed on its own, so a link to another skill, to this file, or to anything at the repo root resolves to nothing on the installed copy. Whatever several skills need, each one has to carry.

So the config contract is written once in [`scripts/config-block.md`](../scripts/config-block.md) and mirrored by `pnpm skills:sync` into every skill that opts in by carrying a `<skills-config>` element. [`scripts/resolve-config.sh`](../scripts/resolve-config.sh) is copied to `templates/` in every skill that **names** it — every block host does, and so do the two queue skills, which delegate the contract's prose and still have to run the script. `pnpm skills:check` fails the moment a copy drifts, so the duplication is mechanical rather than something to maintain.

**One exception, and what earns it.** A skill that cannot **run** alone — it names a required sibling and verifies that sibling is installed before any state change — may name that sibling's `REFERENCE` for a contract instead of mirroring it. The two queue skills are the case: `work-implement-queue` checks for `work-implement` and `work-review-queue` for `work-review`, both before the lock, so no path reaches the config contract or the lock spec with the worker absent. They name both rather than carry ~12.5 KB of each in a `SKILL.md` with no `REFERENCE.md` to keep it out of the unconditional load path. **Installable alone is untouched** — nothing they ship points out of their folder, the resolver included, and `test/isolation.test.ts` still enforces it. Naming a skill is not linking to a path.

**The boundary is a tag, not an HTML comment.** A `SKILL.md` is a prompt, so where a block ends should be visible to the model reading it rather than hidden in a comment it may skip. It carries **no attributes** — naming its source file or the command that writes it would point at things the installed skill does not have, the same mistake as linking out. The tag is matched by name, so an attribute added later still cannot orphan a committed block:

```markdown
<skills-config>
…
</skills-config>
```

Two consequences worth knowing before editing a skill:

- **Never edit a mirrored block or a skill's `resolve-config.sh`** — edit the source in `scripts/` and re-run the sync, exactly as with the generated tables.
- **Reaching for a cross-skill link is the signal** that the content belongs in the mirrored block instead. Where it is genuinely a "see also", the rule is [name the skill, never a path](#referring-to-another-skill) — the mirrored block is what a shared _contract_ costs, and a bare name is what a shared _pointer_ costs.

The resolver exists because a repo may define **profiles** — named overlays merged onto the base config for an execution context, so a remote runner can open pull requests where a local session commits directly. Every skill running the same script is what makes them agree on the result.

## Referring to another skill

Every skill installs **on its own**, so a reference to a sibling is the one place a skill assumes something about its install environment — the referenced skill may simply not be there. Three rules follow: one about the **form** of the reference, one about **declaring** its kind, and one about **which kind it may be**. All three are house rules: the open standard says nothing about any of them, so `validate-skills` reports a breach as a **house-style** finding, never a spec violation.

### Name the skill, never a path

**A path is a path whether or not it is a link.** All three of these name a file that does not exist on an installed copy:

| Form                                 | Example                                     |
| :----------------------------------- | :------------------------------------------ |
| A relative link out of the folder    | `[…](../work-review/REFERENCE.md)`          |
| An absolute install path             | `~/.claude/skills/work-review/REFERENCE.md` |
| A bare path in prose, no link at all | `` `work-review/REFERENCE.md` ``            |

So **name the skill and drop the path** — `` `work-review` ``, not a pointer into its folder. An agent that has the skill installed can open it; one that does not gains nothing from a dangling path. Where a specific document is meant, name it by skill and heading in prose rather than by path. `test/isolation.test.ts` enforces the first form only — it reads `](…)` targets, so the prose path in the third row slips past it, and that repo-local test does not travel to repos consuming these skills at all. `validate-skills` covers what the test cannot.

### A call declares required or optional

A reference that is a **call** — the run hands work to that skill, or depends on it to proceed — states **which kind it is** and **what happens when the skill is absent**:

- **Required** → the run **stops**, naming the missing skill and why it cannot continue. A required call that says nothing fails somewhere mid-run instead of up front.
- **Optional** → the **fallback** is stated: what the run does instead — degrade, skip that pass, carry on. `issue` → `grilling` is the model to copy: "If the `grilling` skill is not installed, skip this pass and draft as today."

A reference that is only a **mention** — naming another skill as whose job something is ("committing is `atomic-commit`'s job", "the complement to `write-readme`") — is **not** a call and needs no declaration. What decides it is whether the run _hands over work_, not whether the name appears: adding a required/optional declaration to a mention is as wrong as omitting one from a call.

### Optional is the default; required is the exception

**Which** of the two a call may be is not the author's free choice. [ADR-0003](../docs/99.adr/0003-mirror-shared-content-into-each-skill.md) turned a runtime dependency between skills down for the reason above — an installed skill may not have its sibling — so making one a **precondition** is what has to earn itself. That is the axis the two words name: **required** means the sibling is checked **before any work starts**, and there is no degraded run to have; **optional** means the run starts regardless and takes a stated fallback at the call site. So the default runs one way:

| The call names                                                                                                  | Kind                | Why                                                                                                                                                                                                             |
| :-------------------------------------------------------------------------------------------------------------- | :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A skill this repo does not ship** — `grilling`, and every other external skill                                | **always optional** | Nothing here decides whether it is installed, and the calling skill did its job before the pass existed. Absent → skip that pass and carry on with the behaviour it would have had without it.                  |
| **A sibling in this repo** — `atomic-commit`, `pull-request`, `write-docs`, …                                   | **optional**        | Same degradation, same reason: each skill installs alone, so a sibling is an assumption about the install environment, never a precondition.                                                                    |
| **A queue skill's own worker** — `work-implement-queue` → `work-implement`, `work-review-queue` → `work-review` | **required**        | The **only** exception. The drain implements and reviews nothing itself, so there is no degraded run left to have. Checked **before any state changes**, so absence costs a stopped run and not a leased issue. |

**Optional is not a promise the run survives.** The two words say _when_ the absence is discovered and _whether a degraded run exists_ — not that every degradation is painless. An optional call's fallback is whatever the **caller's own** rules already say for that situation, and where those rules end the run the fallback is that ending: `work-implement` answers a rebase conflict it cannot resolve with `blocked` whether or not `resolving-merge-conflicts` is installed, so that call is optional and its stated fallback is a lifecycle stop. What the shape guarantees is that every absence has a **defined** outcome, not that every absence is survivable. **Required** is the different claim — the skill has no job at all without the sibling, so it checks first and attempts nothing, rather than stopping partway through work it has already begun.

Two things follow. A **required** call earns its own scrutiny — anything the skill could plainly carry on without is optional, however costly the fallback. And the degradation is stated **where the sibling is named**, in the skill's own text, so a reader never has to infer it: the safe-looking inference is "abort", and that is the wrong one.

**Prose, not frontmatter.** The declaration lives in the body beside the call, and there is no frontmatter key listing a skill's optional siblings. A new key would be a client extension no client reads ([ADR-0007](../docs/99.adr/0007-permit-claude-code-frontmatter-extensions.md)), so nothing would act on it — and a list at the top of the file is a second copy of what the body says, free to drift from it while the agent follows the body. The place the agent reads is the place the rule belongs.

## Two shapes: full and thin

Every skill in the catalogue is a **full** skill — an intro, an opt-out paragraph, a numbered workflow, guardrails, a config block and a reference pointer — and that is the shape to reach for. It is not the only one permitted. A skill with nothing to sequence takes the **thin** shape: a named second form, not a smaller version of the first and not a full one somebody stopped writing.

**One criterion decides which shape a skill takes:**

> A skill is **thin** when it has **no multi-step procedure** — it carries a single rule, or it reaches for exactly one other skill. The moment it has an ordered workflow, it is a **full** skill and takes the full shape.

That line is what the form is for. Without it, "thin" becomes the word for "unfinished": the next author opens a two-paragraph `SKILL.md` and reads abandoned work to complete rather than a complete skill to leave alone.

**Delegating is not what makes a skill thin — having nothing to sequence is.** The two `*-queue` skills implement nothing themselves and hand every issue to a worker, and both are **full** skills by this criterion: each carries an ordered workflow, a lock protocol and a report. Where older text calls one of them "thin" — [ADR-0020](../docs/99.adr/0020-separate-installable-alone-from-runnable-alone.md) does, and ADRs are append-only records of what was decided when — it means _delegating_, in the loose sense that predates this section. Read the criterion above, never the adjective.

What changes for a thin skill, and what does not:

- **The frontmatter contract is unchanged**, house field included. `name` and `description` are required by the standard, and `metadata.summary` is read by `pnpm skills:sync` to build the README tables — so a thin skill that drops it breaks the generated artifacts rather than merely looking sparse. There is nothing to relax here.
- **The opt-out paragraph and the `<skills-config>` block fall away by themselves**, and need no exception written for them. Both exist only in a skill that reads `.tituskirch-skills.json`; a thin skill reads none, so it is simply absent from the mirrored-block rosters in [`test/isolation.test.ts`](../test/isolation.test.ts) — the same as every other config-free skill here today. A thin skill that _did_ read config would be carrying a procedure, which the criterion above already sends to the full shape.
- **Reaching for one other skill is still a call**, so it declares [required or optional](#a-call-declares-required-or-optional) and what happens when that skill is absent. In a thin skill that declaration is most of the body rather than a line inside it.

**Nothing takes this shape today**, and that is not an argument against having it: the form exists so the first skill that qualifies is written as complete, instead of being padded into the full shape or shipped looking half-done. [ADR-0022](../docs/99.adr/0022-permit-a-thin-shape-for-alias-style-skills.md) records the decision and the alternative it beat.

## Adding a new skill

Create `<category>/<skill-name>/SKILL.md` per the frontmatter contract above — in the full shape unless it meets the [thin criterion](#two-shapes-full-and-thin), and using an existing skill of that shape as a structural reference — then run `pnpm skills:sync` to regenerate the root [`README.md`](../README.md) skills table, the category's `README.md`, the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) and the groupings in [`skills.sh.json`](../skills.sh.json) — never hand-edit any of them. Full workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Known deviations / open by design

A few skills depart from the layout above on purpose, and one frontmatter question is settled in principle but still open per skill. Recorded here so the next author copying a skill treats these as deliberate, not drift to "correct" blindly:

- **Supporting files are distributed unevenly.** `DESIGN.md` exists for `work-implement` only. The two queue skills (`work-implement-queue`, `work-review-queue`) carry their author-authority and plan blocks inline in `SKILL.md` and ship **no `REFERENCE.md`** — for them the drain _is_ the whole skill, and the two biggest contracts they would otherwise mirror (the config block and the lock spec) they [name on their worker](#reading-the-config--mirrored-not-linked) instead. Splitting a `SKILL.md` into a `REFERENCE.md` is a structural refactor (byte-identity, sync, mirrored-block boundaries), not a mechanical alignment, so it stays a per-skill judgement.
- **Reference chains run two levels deep, and stop there.** The standard recommends keeping file references **one level deep** — what `SKILL.md` points at should not itself require opening something else. Fourteen skills go one hop further: `SKILL.md` → `REFERENCE.md` → `templates/…`. That hop is what [mirrored, not linked](#reading-the-config--mirrored-not-linked) costs — a skill has to be installable alone, so `resolve-config.sh` and the document templates ship **inside** the folder, and the `REFERENCE.md` documenting the contract is where they are named. What bounds the depth is **what the second hop lands on**: an asset the agent runs or fills in — `templates/resolve-config.sh`, `handoff`'s and `write-docs`'s document templates, `write-readme`'s skeleton — never another document to read. So **sibling documents are not cross-linked**: `SKILL.md` links `REFERENCE.md` and `DESIGN.md`, and neither links the other, so each is entered from `SKILL.md` and read straight through. Flattening the chain instead would mean inlining the config contract into all twenty-two `SKILL.md`s — exactly what the mirrored block exists to prevent. Advisory either way: these are spec recommendations, not requirements, and `skills-ref` reports zero violations.
- **`allowed-tools` content is settled per skill, and the migration that settled it is finished.** The frontmatter contract settled the field's _semantics_ — pre-approval, not restriction (see the [field note](#field-notes) above) — while **what each skill declares** stayed a per-skill decision rather than one list for the whole catalogue, because rewriting the catalogue's tool lists on a guess would have been a large, likely-wrong diff. What changed is which form a skill gets for free. [ADR-0017](../docs/99.adr/0017-make-a-blanket-bash-grant-a-named-exception.md) made the scoped form the default and a blanket `Bash` a **named exception**, enumerated with its reason in [`test/allowed-tools.test.ts`](../test/allowed-tools.test.ts) and pinned in both directions — so a new skill cannot inherit the blanket grant by copying its neighbour. What is left is not a backlog: each skill still granting one does so for a reason that will not expire. **Which skills those are is the test's to say, not this page's** — a roster here is a second copy that goes stale the moment the list moves, which is exactly how this bullet came to name two skills long after eleven were scoped.

## Evaluating a skill

A skill earns its context cost only if the agent does **better with it than without**. Reading it is not evidence of that — a measurement is. The [Agent Skills standard](https://agentskills.io/skill-creation/evaluating-skills) defines two:

- **Trigger accuracy** — does the `description` fire the skill on the prompts it should and stay quiet on the near-misses it should not? ([optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions).) The close pairs here — `write-readme`/`compact-readme`, `update-deps`/`merge-deps`, `work-implement`/`work-implement-queue` — are exactly the near-miss shape it catches.
- **Output quality vs. a baseline** — run each case **with and without** the skill and grade the results, so the delta shows what the skill costs in time and tokens against what it buys in pass rate.

Anthropic's [`skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) is the **development tool** that runs both loops. It is a tool to _use_, not a template to imitate: it ships a Python toolchain — the opposite of this repo's no-runtime-code rule — so nothing it contains is committed here, and what it produces (graded runs, benchmarks) is workspace output, not a repo artifact.

Output-quality cases live in an **`evals/` directory inside the skill folder**, in `skill-creator`'s `evals.json` shape:

```json
{
  "skill_name": "write-readme",
  "evals": [
    {
      "id": 1,
      "prompt": "Write a README for a new kirchDev CLI called envprism.",
      "expected_output": "A README in the house style that reaches the install command within the first screen.",
      "expectations": [
        "It opens with a centered hero header",
        "It ends with Versioning and License sections"
      ]
    }
  ]
}
```

`evals/` is a **development artifact, not part of the installed skill** — a fixture the agent never reads at runtime. Two delivery paths strip it: `skill-creator`'s `package_skill.py` drops it when packaging, and for the same reason `pnpm skills:link` excludes it when it links a skill into each of its destinations — a linked skill carries no more than a packaged one would, in every client's skills directory it lands in, and the excluded dirs are named in one place, [`scripts/skills-lib.sh`](../scripts/skills-lib.sh). The repo's copy-based install paths make no such promise: the `skills.sh` CLI installs from [`skills.sh.json`](../skills.sh.json) and a hand-copy of the folder both take `evals/` along, and [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) points at the whole folder — so it is packaging and linking that leave the fixture behind, not every path. [`skills/docs/write-readme/evals/`](docs/write-readme/evals/evals.json) is a seed example; which skills to evaluate, how many cases, and how many iterations is left to whoever runs the tool.
