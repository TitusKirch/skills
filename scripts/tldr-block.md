Canonical rule for how a skill's run report opens. `scripts/gen-skills.ts` writes it inside each
such skill's `<skills-tldr>` element; `pnpm skills:check` fails if a copy drifts. Edit it here,
never in a skill.

Everything below is self-contained on purpose: a skill can be installed on its own, so it must not
link to another skill or to a file at the repo root — name the other skill instead.

Which skills carry it is decided by **what a skill hands back when its run ends**: an account of
what happened or what was found — counts, groups, held items, verdicts — read once and acted on. A
skill whose closing output is a plan awaiting a yes is not one of them; the plan block governs
that, and a plan already opens with what it proposes to do. `tldr` is the deliberate absence, and
not on the criterion: this frame is that skill's whole product, fixed in its own workflow, so
mirroring the block there would leave one skill holding two statements of one rule.

`test/isolation.test.ts` records the resulting roster and asserts it against the tags on disk,
because a skill that should carry the block and does not looks exactly like one that should not.

<!-- tldr:body -->

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
