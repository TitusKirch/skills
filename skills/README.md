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

| Category | Holds                                                    |
| :------- | :------------------------------------------------------- |
| `repo/`  | Commits, pull requests, releases, dependency updates.    |
| `work/`  | Issues, the AI implement/review loops, session handoffs. |
| `docs/`  | Documentation, READMEs, terminal demos.                  |
| `meta/`  | Configuring the skills themselves.                       |

Categories are a **display and navigation** device, not a namespace: a skill's `name` is still globally unique and unprefixed, and `pnpm skills:link` flattens them back into each of its destinations (`~/.claude/skills/` and `~/.agents/skills/`). Category membership comes from the filesystem; each category's title and description live in `CATEGORIES` in [`scripts/gen-skills.ts`](../scripts/gen-skills.ts) — adding a category means one entry there, or `pnpm skills:sync` fails loudly rather than silently dropping the folder.

## `SKILL.md` frontmatter

```markdown
---
name: skill-name
metadata:
  summary: Short one-liner shown in the root README skills table.
description: What the skill does and when to invoke it — imperative, keyword-rich, a short paragraph, ≤ 960 chars.
allowed-tools:
  - Bash(git:*)
  - Read
---

# Skill body

Instructions for Claude when this skill is invoked. Be specific about:

- When the skill should trigger.
- What inputs it expects.
- The steps to perform.
- What the final output should look like.
```

### Field notes

These skills track the [Agent Skills open standard](https://agentskills.io/specification); Claude Code layers its own extensions on top (its [frontmatter reference](https://code.claude.com/docs/en/skills)), and Cursor a smaller set of its own. Each field below is tagged **[standard]**, **[house]**, or with the client that defines it (**[Claude Code]**, **[Cursor]**) so an author can tell portable from client-specific at a glance. What this repo publishes today is the standard core, one house field (`summary`), and one Claude Code extension (`disallowed-tools`, on the two unattended queue skills).

- **`name`** _(required)_ **[standard]** — 1–64 characters, lowercase `a-z`, `0-9` and single hyphens (no leading, trailing, or consecutive hyphen); must match the folder name. Used as the invocation slug.
- **`description`** _(required)_ **[standard]** — **capped at 1024 characters** by the standard; **this repo budgets 960**, non-empty. This is the text Claude reads to decide _when_ to invoke the skill, so write it as _when to act_, not _what the skill is_: imperative, keyword-rich, key use case first, a few sentences to a short paragraph — and include the trigger phrases (with their other-language variants) a user would actually say. Descriptions tend to grow past what helps; the standard's [optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) is the guide. (Claude Code adds a second, softer budget: it truncates the combined `description` + `when_to_use` at 1,536 characters in the skill listing.)
  - **The 64 characters between the budget and the cap are the point.** A description gets edited whenever a trigger phrase is missing or a near-miss needs disambiguating, and 64 characters is about one trigger phrase plus its other-language variant — so that edit never has to be length-neutral. Writing to the cap instead makes every later edit a conformance risk, silently: the spec cap is a cliff, and a skill one character over is non-conformant while every check stays green. `pnpm skills:sync` and `pnpm skills:check` enforce the 960 budget, so going over is caught while the skill is still conformant.
- **`summary`** _(optional)_ **[house]** — this repo's own field, not part of the standard: the one-liner shown in the root README skills table, falling back to the first clause of `description`. It is read only by `pnpm skills:sync` when the artifacts are built — no agent ever sees it. It lives at `metadata.summary`, the standard's conforming home for a client-specific field like this (`metadata` exists for exactly this). Eight artifacts are generated from the skill folders via `pnpm skills:sync` (CI runs `pnpm skills:check`), so none is hand-edited: the root README table, each `skills/<category>/README.md`, `.claude-plugin/plugin.json`, `skills.sh.json`'s groupings, the [mirrored config contract](#reading-the-config--mirrored-not-linked), the [author-authority block](../scripts/authority-block.md) mirrored into each skill that reads third-party text, the [check-command contract](../scripts/verify-block.md) mirrored into each skill that runs the repo's gate, and the [single-flight-lock spec](../scripts/worklock-block.md) mirrored into the four `work-*` skills.
- **`allowed-tools`** _(optional)_ **[standard, Experimental]** — **pre-approval, not restriction.** The tools Claude may use **without stopping to ask permission** during the turn that invokes the skill; the grant clears on your next message. It does **not** narrow the toolset — every tool stays callable, and your permission settings still govern anything unlisted. Scope it the way `.claude/settings.json` rules do: `allowed-tools: Bash(git:*) Bash(gh:*) Read` pre-approves exactly those, not a blanket `Bash`. **The scoped form is the default here, and a bare `Bash` is a named exception** — [`test/allowed-tools.test.ts`](../test/allowed-tools.test.ts) lists every skill still granting one together with the reason, and fails both on a skill missing from the list and on a stale entry, so the list can only shrink ([ADR-0017](../docs/99.adr/0017-make-a-blanket-bash-grant-a-named-exception.md)). Two of those reasons are permanent rather than a backlog: a skill running the repo's own `verify` drives whatever the consuming repo declares, and an unattended queue skill has nobody to answer a prompt. These skills carry it because they drive `git`, `gh` and `pnpm` unattended (e.g. under `/loop`), where the first command would otherwise stall on a permission prompt. Where the run **is** attended, leaving a command off is a deliberate choice and not an omission — `validate-skills` does not pre-approve `uvx` or `pip`, so installing the validator asks first. The standard writes it as a space-separated string; Claude Code also accepts a comma-separated string or a YAML list (the form these skills use). The standard flags the field itself **Experimental** ("support for this field may vary between agent implementations"), so despite the [standard] tag it is no portability guarantee — and all nineteen skills here depend on it.
- **`disallowed-tools`** _(optional)_ **[Claude Code]** — the field that **actually restricts**: tools **removed from Claude's pool** while the skill is active (cleared on your next message). This is the real "keep the skill away from X" control — e.g. `AskUserQuestion` on an unattended queue skill, where a question nobody answers would hang the run. Where a tool is named in both, `disallowed-tools` wins. Not part of the open standard.
- **`license`** _(optional)_ **[standard]** — the license applied to the skill: a license name, or a reference to a bundled license file.
- **`compatibility`** _(optional)_ **[standard]** — up to 500 characters stating environment requirements (intended product, required system packages, network access). All these skills omit it.
- **`metadata`** _(optional)_ **[standard]** — a string-to-string map for properties the standard does not define; the conforming home for a house field such as `summary`.

Clients define further frontmatter beyond `disallowed-tools` — fourteen more from Claude Code (`when_to_use`, `model`, `effort`, `hooks`, `paths`, `argument-hint` and the rest), plus Cursor's legacy `globs` — none of which these skills use today. The **complete** list, and which client defines each, is the extension matrix in [`validate-skills`](meta/validate-skills/REFERENCE.md#the-extension-matrix); adopt a field only after adding it there, or this repo's own conformance gate will call a deliberate choice malformed.

Two things that list makes visible and a per-client reading does not. **"Claude-only" is not always true** — `paths` and `disable-model-invocation` are Cursor's fields too, with the same names and meanings, so they cost less portability than the rest. And **extending need not cost conformance at all**: Codex keeps `SKILL.md` to `name` and `description` and puts its extensions in a sidecar at `<skill>/agents/openai.yaml`, which the standard permits outright. Where the job is UI naming, an invocation policy or a tool dependency, that sidecar does it for free.

## Naming

- Folder name = skill name = kebab-case.
- **The category carries the grouping, so the name should not.** A skill in `docs/` is `write-docs`, never `docs-write`. Where a family genuinely reads as one unit, keep the shared stem in the name (`work-implement`, `work-implement-queue`) — that pairs the two halves of a loop, which a folder alone would not.

## Shared config

Some skills read an optional, committed `.tituskirch-skills.json` at the **consuming repo's** root (not this repo) — a thin, shared override surface. It is validated by [`tituskirch-skills.schema.json`](../tituskirch-skills.schema.json); point `$schema` at the raw URL for editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/TitusKirch/skills/main/tituskirch-skills.schema.json",
  "language": "de",
  "pr": { "base": "dev" },
  "issue": { "tracker": "github" }
}
```

Resolution per setting: **config → native/detected → built-in default** — absent config means today's behavior. Three keys sit at the root because they are facts about the **repo**, not about one skill — `forge`, `language` and `verify`; everything else lives under a skill section (`pr.*`, `issue.*`). Each skill documents only the keys it reads, in its own `REFERENCE.md`:

- [`atomic-commit`](repo/atomic-commit/REFERENCE.md#config) — `language`, `commit.language`
- [`pull-request`](repo/pull-request/REFERENCE.md#config) — `language`, `pr.*`
- [`issue`](work/issue/REFERENCE.md#config) — `language`, `issue.*`
- [`release`](repo/release/REFERENCE.md#config) — `language`, `release.*`, `pr.base`
- [`merge-deps`](repo/merge-deps/REFERENCE.md#config) — `language`, `verify`, `mergeDeps.*`
- [`prune-branches`](repo/prune-branches/REFERENCE.md#config) — `language`, `pr.base`, `pruneBranches.*`
- [`update-deps`](repo/update-deps/REFERENCE.md#config) — `language`, `verify` (owns no section of its own)
- [`prune-comments`](repo/prune-comments/REFERENCE.md#config) — `language`, `verify`, `pr.base` (owns no section of its own)
- [`handoff`](work/handoff/REFERENCE.md#config) — `language` (owns no section of its own)
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

So the config contract is written once in [`scripts/config-block.md`](../scripts/config-block.md) and mirrored by `pnpm skills:sync` into every skill that opts in by carrying a `<skills-config>` element — together with [`scripts/resolve-config.sh`](../scripts/resolve-config.sh), copied to that skill's `templates/`. `pnpm skills:check` fails the moment a copy drifts, so the duplication is mechanical rather than something to maintain.

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

Every skill installs **on its own**, so a reference to a sibling is the one place a skill assumes something about its install environment — the referenced skill may simply not be there. Two rules follow, one about the **form** of the reference and one about its **kind**. Both are house rules: the open standard says nothing about either, so `validate-skills` reports a breach as a **house-style** finding, never a spec violation.

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

## Adding a new skill

Create `<category>/<skill-name>/SKILL.md` per the frontmatter contract above (use an existing skill as a structural reference), then run `pnpm skills:sync` to regenerate the root [`README.md`](../README.md) skills table, the category's `README.md`, the `skills` array in [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) and the groupings in [`skills.sh.json`](../skills.sh.json) — never hand-edit any of them. Full workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Known deviations / open by design

A few skills depart from the layout above on purpose, and one frontmatter question is settled in principle but still open per skill. Recorded here so the next author copying a skill treats these as deliberate, not drift to "correct" blindly:

- **Supporting files are distributed unevenly.** `DESIGN.md` exists for `work-implement` only. The two queue skills (`work-implement-queue`, `work-review-queue`) carry their `<skills-config>` and author-authority blocks inline in `SKILL.md` and ship **no `REFERENCE.md`** — for them the drain _is_ the whole skill, and what a `REFERENCE.md` would hold is the lock spec they now mirror. Splitting a `SKILL.md` into a `REFERENCE.md` is a structural refactor (byte-identity, sync, mirrored-block boundaries), not a mechanical alignment, so it stays a per-skill judgement.
- **Reference chains run two levels deep, and stop there.** The standard recommends keeping file references **one level deep** — what `SKILL.md` points at should not itself require opening something else. Fourteen skills go one hop further: `SKILL.md` → `REFERENCE.md` → `templates/…`. That hop is what [mirrored, not linked](#reading-the-config--mirrored-not-linked) costs — a skill has to be installable alone, so `resolve-config.sh` and the document templates ship **inside** the folder, and the `REFERENCE.md` documenting the contract is where they are named. What bounds the depth is **what the second hop lands on**: an asset the agent runs or fills in — `templates/resolve-config.sh`, `handoff`'s and `write-docs`'s document templates, `write-readme`'s skeleton — never another document to read. So **sibling documents are not cross-linked**: `SKILL.md` links `REFERENCE.md` and `DESIGN.md`, and neither links the other, so each is entered from `SKILL.md` and read straight through. Flattening the chain instead would mean inlining the config contract into all nineteen `SKILL.md`s — exactly what the mirrored block exists to prevent. Advisory either way: these are spec recommendations, not requirements, and `skills-ref` reports zero violations.
- **`allowed-tools` content is settled per skill, one skill at a time.** The frontmatter contract settled the field's _semantics_ — pre-approval, not restriction (see the [field note](#field-notes) above) — and **what each skill should declare** is still a per-skill decision rather than one list for the whole catalogue: rewriting nineteen tool lists on a guess would be a large, likely-wrong diff. What changed is which form a skill gets for free. [ADR-0017](../docs/99.adr/0017-make-a-blanket-bash-grant-a-named-exception.md) made the scoped form the default and a blanket `Bash` a **named exception**, enumerated with its reason in [`test/allowed-tools.test.ts`](../test/allowed-tools.test.ts) and pinned in both directions, so the remaining skills are migrated deliberately instead of drifting — and a new skill cannot inherit the blanket grant by copying its neighbour. `validate-skills` and `prune-comments` are scoped; the rest are named.

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
