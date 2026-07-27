// CLAUDE.md and AGENTS.md are one set of instructions written to disk twice — Claude
// Code reads the first, the vendor-neutral tools read the second — and ADR-0002 keeps
// them as two real files rather than a symlink, because not every tool resolves one.
//
// That decision names its own weakness: the copy is manual, drift is invisible in
// review (one reflowed line is enough), and nothing failed when the two disagreed.
// This is that gate. It belongs in `pnpm verify` rather than in CI, because the AI
// work loop commits straight to `dev` with no pull request — on that path the local
// gate is the only automated check the change ever meets.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const read = (name: string) => readFileSync(join(ROOT, name), 'utf8');

describe('the two agent instruction files stay identical', () => {
  // No assertion message on purpose: node prints a line diff of the two files when
  // one is absent, and that diff is the thing a reader needs. The fix never differs.
  test('AGENTS.md is CLAUDE.md — drifted? `cp CLAUDE.md AGENTS.md`, never merge by hand', () => {
    assert.equal(read('AGENTS.md'), read('CLAUDE.md'));
  });
});
