Canonical rule for the form a skill's plan takes on arrival. `scripts/gen-skills.ts` writes it
inside each such skill's `<skills-plan>` element; `pnpm skills:check` fails if a copy drifts. Edit
it here, never in a skill.

Everything below is self-contained on purpose: a skill can be installed on its own, so it must not
link to another skill or to a file at the repo root — name the other skill instead.

Which skills carry it is decided by **what a skill puts in front of a human**: any skill that
presents a plan, a preview, a candidate list or a findings report and then waits to be answered. A
skill whose whole output is a short acknowledgement has nothing that could arrive folded, and
carries nothing. The criterion decides; `test/isolation.test.ts` records the resulting roster and
asserts it against the tags on disk, because a skill that should carry the block and does not looks
exactly like one that should not.

<!-- plan:body -->

## Presenting the plan

Whatever this skill puts in front of a human to decide on — a plan, a preview, a candidate list, a
findings report — is read **once, in a terminal**, so **every part of it renders on arrival**.

- **Never fold it behind a control.** A terminal cannot open `<details>`/`<summary>`, a tab or a
  "show more": only the summary line prints, and the human confirms a plan whose body never
  reached them.
- **Shorten instead of hiding.** Show every item that needs a decision, each with a visible id and
  its effect. Group the rest by something the reader already thinks in (kind, verdict, ecosystem)
  with a count and a reason, and name the command that shows them in full.
- **This binds the message, not the files it writes.** A `<details>` block in a README, an issue,
  a pull request or a docs page renders in a browser and is fine there.
