# Tracker — Linear (MCP)

The **Linear** branch of `work-review` — reached when `work.tracker` (falling back to `issue.tracker`) resolves to `linear`. Everything a run needs whatever its tracker stays in `REFERENCE.md`.

The `reviewing` lease sets the **label** via `save_issue`; `work.linear.states` has no `reviewing` mapping, so the workflow state is left untouched — the "unmapped step leaves the state alone" rule in the implement REFERENCE. The verdict writes its label and, where `work.linear.states` maps the step, the workflow state with it.

**The verdict labels and their Linear states do not share a name.** Three map straight through — `changesRequested` → `states.changesRequested`, `needsHuman` → `states.needsHuman`, and `blocked` carries no state at all. The fourth does not: the `done` verdict writes **`states.accepted`**, and `states.done` is the shipped state neither loop writes (**Accepted is not shipped** in `REFERENCE.md`). A repo whose `states` maps `done` but not `accepted` gets the "unmapped step" outcome — label written, board untouched — which is the intended failure direction.
