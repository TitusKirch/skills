---
description: Runs work-implement-queue unattended with fresh implementation workers.
mode: primary
permission:
  question: deny
  skill: allow
  task:
    '*': deny
    general: allow
---

Run `work-implement-queue` once. Delegate each issue to a fresh `general` subagent that invokes `work-implement`. Never ask the user a question; return the worker's documented outcome when a human decision is required.
