// `skills:link` installs into every user-scope skills directory the clients this repo
// publishes for actually read — ~/.claude/skills for Claude Code, ~/.agents/skills for
// Codex, Cursor, OpenCode and Gemini CLI (ADR-0016). Both, always, so that
// `skills:unlink` can clear both without remembering how the link run was invoked.
//
// The symmetry is the whole design, and it is the thing that breaks quietly: a check
// left guarding one destination, an exclusion applied once instead of per destination,
// an unlink that clears the path it was written for. These tests run the real scripts
// against a throwaway HOME and assert the pair stays symmetric.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.ts';
import { discoverSkills, paths } from '../scripts/gen-skills.ts';

/** The destinations under a given HOME, in the order skills-lib.sh names them. */
const destsUnder = (home: string) => [
  join(home, '.claude', 'skills'),
  join(home, '.agents', 'skills')
];

const homes: string[] = [];
after(() => homes.forEach((h) => rmSync(h, { recursive: true, force: true })));

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tituskirch-skills-link-'));
  homes.push(dir);
  return dir;
}

/**
 * Run one of the scripts with `HOME` pointed at the sandbox.
 *
 * The scripts locate the repo from their own path, so they link the real tree — only
 * the destinations move. A bare env keeps the host's own HOME out of reach.
 */
function run(script: string, at: string) {
  const result = spawnSync('bash', [join(ROOT, 'scripts', script)], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: at }
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

/** What each link is called: the skill's directory, which is what the script links by. */
const linkNames = () => discoverSkills(paths(ROOT)).map((s) => s.dir);

/** A skill carrying the dev-artifact dir the link tree exists to leave behind. */
function skillWithEvals(): string {
  const withEvals = discoverSkills(paths(ROOT)).find((s) =>
    existsSync(join(ROOT, 'skills', s.path, 'evals'))
  );
  assert.ok(withEvals, 'expected at least one skill to carry evals/');
  return withEvals.dir;
}

describe('skills:link destinations', () => {
  test('links every skill into every destination', () => {
    const at = home();
    const linked = run('link-skills.sh', at);
    assert.equal(linked.code, 0, linked.stderr);

    for (const dest of destsUnder(at)) {
      for (const name of linkNames()) {
        const target = join(dest, name);
        assert.ok(existsSync(target), `${target} should exist`);
      }
      // The run announces where it wrote, so a reader can tell the two apart.
      assert.ok(
        linked.stdout.includes(`${dest}:`),
        `the run should report writing to ${dest}`
      );
    }
  });

  test('leaves dev artifacts behind in every destination', () => {
    const at = home();
    assert.equal(run('link-skills.sh', at).code, 0);

    const name = skillWithEvals();
    for (const dest of destsUnder(at)) {
      const target = join(dest, name);
      assert.ok(
        lstatSync(target).isDirectory(),
        `${target} should be a link tree, not a whole-folder symlink`
      );
      const entries = readdirSync(target);
      assert.ok(
        entries.includes('SKILL.md'),
        `${target} should carry SKILL.md`
      );
      assert.ok(
        !entries.includes('evals'),
        `${target} should not carry evals/`
      );
    }
  });

  test('unlink clears every destination', () => {
    const at = home();
    assert.equal(run('link-skills.sh', at).code, 0);

    const unlinked = run('unlink-skills.sh', at);
    assert.equal(unlinked.code, 0, unlinked.stderr);
    for (const dest of destsUnder(at))
      assert.deepEqual(readdirSync(dest), [], `${dest} should be empty`);
  });

  test('unlink keeps what it did not create', () => {
    const at = home();
    assert.equal(run('link-skills.sh', at).code, 0);

    // A real skill dir of the user's own, and a symlink pointing somewhere else.
    const [claudeDest, agentsDest] = destsUnder(at) as [string, string];
    mkdirSync(join(agentsDest, 'mine'));
    writeFileSync(join(agentsDest, 'mine', 'SKILL.md'), 'mine\n');
    symlinkSync(tmpdir(), join(claudeDest, 'elsewhere'));

    assert.equal(run('unlink-skills.sh', at).code, 0);
    assert.deepEqual(readdirSync(agentsDest), ['mine']);
    assert.deepEqual(readdirSync(claudeDest), ['elsewhere']);
  });

  test('a destination symlinked into the repo fails the run before anything is written', () => {
    const at = home();
    // The second destination is the trap; the first is the one that must stay untouched.
    const [claudeDest, agentsDest] = destsUnder(at) as [string, string];
    mkdirSync(join(at, '.agents'), { recursive: true });
    symlinkSync(join(ROOT, 'skills'), agentsDest);

    const linked = run('link-skills.sh', at);
    assert.equal(linked.code, 1);
    assert.match(linked.stderr, /symlink into this repo/);
    assert.ok(
      !existsSync(claudeDest),
      'a bad destination must abort the run, not half-link it'
    );
    assert.equal(
      readlinkSync(agentsDest),
      join(ROOT, 'skills'),
      'the trap symlink should be reported, not replaced'
    );
    // What the guard exists for: links landing in the repo's own skills/ tree, which
    // holds categories and nothing else.
    for (const name of linkNames())
      assert.ok(
        !existsSync(join(ROOT, 'skills', name)),
        `skills/${name} — a link was written through into the repo`
      );
  });
});
