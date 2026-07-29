// The skill conformance gate has one thing worth guarding: it reproduces a rule that
// already exists in prose. `validate-skills` documents a single sanctioned re-tier —
// the frontmatter keys skills-ref rejects that a named client actually defines — and
// scripts/check-conformance.sh has to carry the same matrix, because a gate that only
// checks an exit code goes red on `disallowed-tools`, a field ADR-0007 records as
// deliberate.
//
// Two copies of one list is exactly the drift shape ci-gate.test.ts and
// agent-instructions.test.ts exist for. This is the third, and it pins both halves of
// each row: the field *and* the clients that define it. The clients are not decoration —
// `paths` and `disable-model-invocation` are Cursor's as well as Claude Code's, and a
// finding that calls them Claude-only tells an author they lost a portability they
// still have.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const SCRIPT = 'scripts/check-conformance.sh';
const REFERENCE = 'skills/meta/validate-skills/REFERENCE.md';
const WORKFLOW = '.github/workflows/skills-conformance.yml';

/**
 * The script's mirror: field → the clients that define it, read out of its
 * `CLIENT_EXTENSIONS=( … )` array, whose entries are `'field=clients'`.
 */
function scriptExtensions(): Map<string, string> {
  const block = /CLIENT_EXTENSIONS=\(([^)]*)\)/.exec(read(SCRIPT))?.[1];
  assert.ok(block, `${SCRIPT} should define a CLIENT_EXTENSIONS array`);
  const entries = block
    .split('\n')
    .map((l) => l.trim().replace(/^'|'$/g, ''))
    .filter((l) => l !== '' && !l.startsWith('#'));
  return new Map(
    entries.map((entry) => {
      const at = entry.indexOf('=');
      assert.ok(at > 0, `${SCRIPT}: "${entry}" should read field=clients`);
      return [entry.slice(0, at), entry.slice(at + 1)] as const;
    })
  );
}

/**
 * The source: the skill's extension matrix, read out of the table under its anchor.
 *
 * A targeted read of the one table rather than the whole document — it is the single
 * list the skill's prose refuses to re-type, so anchoring the parse to it is what
 * makes "one source, one mirror" checkable.
 */
function referenceExtensions(): Map<string, string> {
  const after = read(REFERENCE).split('<a id="the-extension-matrix"></a>')[1];
  assert.ok(after, `${REFERENCE} should anchor the extension matrix`);
  // Markdown tables carry no blank line, so the first paragraph after the anchor is
  // exactly the table.
  const table = after.trimStart().split('\n\n')[0] ?? '';
  const rows = [...table.matchAll(/^\| `([^`]+)`\s*\|\s*(.+?)\s*\|$/gm)];
  assert.ok(rows.length > 0, `${REFERENCE}: the extension matrix parsed empty`);
  return new Map(rows.map((m) => [m[1] as string, m[2] as string]));
}

describe('the gate reproduces the skill the rule lives in', () => {
  test('check-conformance.sh re-tiers exactly the fields validate-skills names', () => {
    assert.deepEqual(
      [...scriptExtensions().keys()].sort(),
      [...referenceExtensions().keys()].sort()
    );
  });

  test('and attributes each one to the same clients', () => {
    assert.deepEqual(scriptExtensions(), referenceExtensions());
  });

  test('the deliberate `disallowed-tools` is among them, so the gate is not red on day one', () => {
    assert.ok(scriptExtensions().has('disallowed-tools'));
  });

  test('the fields Cursor shares are not filed as Claude-only', () => {
    const matrix = referenceExtensions();
    for (const field of ['paths', 'disable-model-invocation']) {
      assert.match(
        matrix.get(field) ?? '',
        /Claude Code, Cursor/,
        `${field} is defined by Cursor as well as Claude Code`
      );
    }
  });

  test('a second client is actually represented, not just mentioned', () => {
    // Cursor's legacy spelling of `paths` belongs to no Claude Code list, so its
    // presence is what proves the matrix outgrew its single-client origin.
    assert.equal(scriptExtensions().get('globs'), 'Cursor');
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
