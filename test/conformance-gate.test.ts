// The skill conformance gate has one thing worth guarding: it reproduces a rule that
// already exists in prose. `validate-skills` documents a single sanctioned re-tier —
// the frontmatter keys skills-ref rejects that Claude Code actually defines — and
// scripts/check-conformance.sh has to carry the same list, because a gate that only
// checks an exit code goes red on `disallowed-tools`, a field ADR-0007 records as
// deliberate.
//
// Two copies of one list is exactly the drift shape ci-gate.test.ts and
// agent-instructions.test.ts exist for. This is the third. The list is known
// incomplete (issue #109 completes it) — that is a reason to keep the copies pinned
// to each other, not a reason to skip the pin.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const SCRIPT = 'scripts/check-conformance.sh';
const REFERENCE = 'skills/meta/validate-skills/REFERENCE.md';
const WORKFLOW = '.github/workflows/skills-conformance.yml';

/** The keys the script re-tiers, read out of its `CLIENT_EXTENSIONS=( … )` array. */
function scriptExtensions(): string[] {
  const block = /CLIENT_EXTENSIONS=\(([^)]*)\)/.exec(read(SCRIPT))?.[1];
  assert.ok(block, `${SCRIPT} should define a CLIENT_EXTENSIONS array`);
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

/**
 * The keys the skill's prose names, read out of the re-tiering bullet.
 *
 * A targeted read of the one sentence rather than the whole document: the bullet
 * names each key in backticks, which is the only shape either copy relies on.
 */
function referenceExtensions(): string[] {
  const bullet = /^-\s+\*\*A known Claude Code extension\*\*(.*)$/m.exec(
    read(REFERENCE)
  )?.[1];
  assert.ok(
    bullet,
    `${REFERENCE} should name the re-tiered keys in a "A known Claude Code extension" bullet`
  );
  return [...bullet.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
}

describe('the gate reproduces the skill the rule lives in', () => {
  test('check-conformance.sh re-tiers exactly the keys validate-skills names', () => {
    assert.deepEqual(scriptExtensions().sort(), referenceExtensions().sort());
  });

  test('the deliberate `disallowed-tools` is among them, so the gate is not red on day one', () => {
    assert.ok(scriptExtensions().includes('disallowed-tools'));
  });

  test('the validator is pinned, because the pin is what the gate asserts', () => {
    assert.match(read(SCRIPT), /VALIDATOR='skills-ref==\d+\.\d+\.\d+'/);
  });
});

describe('the conformance check stays out of the pnpm gate', () => {
  const scripts = (
    JSON.parse(read('package.json')) as { scripts: Record<string, string> }
  ).scripts;

  // `pnpm verify` is the only automated check on the branch:dev path, so it has to
  // run anywhere pnpm does. The conformance check needs Docker, which is why it is
  // its own workflow and its own script — see the header of check-conformance.sh.
  test('`verify` does not reach it, so the local gate needs nothing but pnpm', () => {
    assert.ok(scripts['skills:conformance']);
    assert.ok(!scripts['verify']?.includes('conformance'));
  });
});

describe('the workflow is scoped the way CodeQL is scoped', () => {
  const workflow = read(WORKFLOW);

  test('it triggers on skill changes rather than on every pull request', () => {
    const paths = /^ {4}paths:\n((?: {6}- .*\n)+)/m.exec(workflow)?.[1];
    assert.ok(paths, `${WORKFLOW} should carry a paths: filter`);
    assert.match(paths, /'skills\/\*\*'/);
    // A gate that cannot re-check itself is a gate one commit can silently disarm.
    assert.match(paths, /'scripts\/check-conformance\.sh'/);
  });

  test('a draft PR does not run it, matching the CI workflow', () => {
    assert.match(workflow, /if: github\.event\.pull_request\.draft == false/);
  });
});
