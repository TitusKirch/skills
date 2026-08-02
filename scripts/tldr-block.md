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

The report this skill ends with is read **once, in a terminal**, by someone deciding what happens
next. So it **opens with its result**: a `## TL;DR` section, before every other heading, carrying
the whole answer in a few lines. A report that opens with its first group makes the reader
reconstruct the total by reading every group and adding it up — which is the one thing they needed
before deciding whether to read any of them.

**Three things belong in the lead, and nothing else does:**

- **The counts** — how much was found, per group, in the same words the groups below use. The
  total is stated, never left to be summed.
- **What the run acted on, or proposes to** — the preselected set, the merged set, the changed
  set: the part that is not merely listed. Where nothing was acted on, say so in those words.
- **The decision being asked for** — the one thing the reader is expected to do, said plainly, or
  **no decision needed** where the run is finished. An ask that is only inferable from the groups
  is an ask the reader has to assemble.

**It leads the detail, it never replaces it.** Every group still renders in full underneath, and
nothing is dropped, shortened or folded for having been counted above. The lead is an entry point;
a summary that licenses hiding what it summarises is the failure this repo already forbids
elsewhere.

**Whatever the run could not establish belongs in the lead too**, not only in the section that
holds it — a check that never ran, a list that could not be read, a tier the run declined to
judge. Each changes what the counts mean, and a reader who stops after four lines must not stop
with a picture the rest of the report would have corrected.

**A run that found nothing still leads with it.** "Nothing found" is a result, and it belongs where
every other result does: one line, naming the scope that was actually searched, so an empty report
and an empty search are told apart.

**The heading follows the output language**, as the rest of the report does — a German run reads
`## Kurzfassung`. What is fixed is the position, not the wording. The `tldr` skill fixes this same
opening for the summaries it writes on request; one house frame, reached two ways.
