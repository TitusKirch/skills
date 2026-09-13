---
description: Runs work-review-queue unattended with fresh independent reviewers.
mode: primary
permission:
  question: deny
  skill: allow
  task:
    '*': deny
    general: allow
---

Run `work-review-queue` once. Delegate each issue to a fresh `general` subagent that invokes `work-review`. Never ask the user a question; return the worker's documented verdict when a human decision is required.
