// What resolve-config.sh promises, checked against a real repo and a real copy of
// the script. Every case here was a bug at some point or is a rule a skill relies
// on; none of them is theoretical.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { sandbox, resolve, pathWithoutJq, type Sandbox } from './helpers.ts';

const boxes: Sandbox[] = [];
const open = (fixture: string | null, skill?: string) => {
  const box = sandbox(fixture, skill);
  boxes.push(box);
  return box;
};
after(() => boxes.forEach((b) => b.cleanup()));

const parse = (stdout: string) => JSON.parse(stdout) as Record<string, unknown>;

describe('profile selection', () => {
  test('no profile selected leaves the base config alone', () => {
    const box = open('with-profiles.json');
    const out = parse(resolve(box).stdout);
    assert.equal((out.work as Record<string, unknown>).branch, 'branch:dev');
    assert.deepEqual(out.release, { promote: 'auto' });
  });

  test('TITUSKIRCH_SKILLS_PROFILE selects the overlay', () => {
    const box = open('with-profiles.json');
    const out = parse(resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'ci' }).stdout);
    assert.equal((out.work as Record<string, unknown>).branch, 'worktree');
    assert.equal(out.release, false, 'a profile can disable a skill');
  });

  test('CI=true selects the ci profile', () => {
    const box = open('with-profiles.json');
    const out = parse(resolve(box, { CI: 'true' }).stdout);
    assert.equal((out.work as Record<string, unknown>).branch, 'worktree');
  });

  test('CI=false does NOT select it — a non-empty value is not a truthy one', () => {
    const box = open('with-profiles.json');
    const out = parse(resolve(box, { CI: 'false' }).stdout);
    assert.equal((out.work as Record<string, unknown>).branch, 'branch:dev');
  });

  test('an explicit profile beats CI detection', () => {
    const box = open('with-profiles.json');
    const out = parse(
      resolve(box, { CI: 'true', TITUSKIRCH_SKILLS_PROFILE: 'audit' }).stdout
    );
    assert.equal((out.work as Record<string, unknown>).branch, 'branch:dev');
    assert.deepEqual(out.commit, { scopeVocab: ['only-this'] });
  });

  test('an unknown profile degrades to the base config, and says so', () => {
    const box = open('with-profiles.json');
    const run = resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'typo' });
    assert.equal(run.status, 0);
    assert.equal(
      (parse(run.stdout).work as Record<string, unknown>).branch,
      'branch:dev'
    );
    assert.match(run.stderr, /no profile named 'typo'/);
  });
});

describe('merge semantics', () => {
  test('objects merge recursively — siblings survive', () => {
    const box = open('with-profiles.json');
    const out = parse(resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'ci' }).stdout);
    const work = out.work as Record<string, unknown>;
    const labels = work.labels as Record<string, unknown>;
    assert.equal(labels.ready, 'ci: queued', 'overlay wins');
    assert.equal(
      labels.review,
      'ai: review requested',
      'untouched sibling survives'
    );
    assert.equal(labels.done, 'ai: done');
    assert.equal(work.cap, 10, 'untouched key in the same section survives');
  });

  test('arrays are replaced, never concatenated', () => {
    const box = open('with-profiles.json');
    const out = parse(
      resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'audit' }).stdout
    );
    assert.deepEqual((out.commit as Record<string, unknown>).scopeVocab, [
      'only-this'
    ]);
  });

  test('an explicit null sets null rather than deleting the key', () => {
    const box = open('with-profiles.json');
    const out = parse(
      resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'audit' }).stdout
    );
    assert.ok('verify' in out, 'the key is still present');
    assert.equal(out.verify, null);
  });

  test('profiles never appear in the resolved output', () => {
    const box = open('with-profiles.json');
    const envs: Record<string, string>[] = [
      {},
      { TITUSKIRCH_SKILLS_PROFILE: 'ci' }
    ];
    for (const env of envs) {
      assert.equal('profiles' in parse(resolve(box, env).stdout), false);
    }
  });

  test('a config without profiles resolves to itself', () => {
    const box = open('minimal.json');
    assert.deepEqual(parse(resolve(box).stdout), { language: 'de' });
  });
});

describe('exit codes — the difference between "nothing to do" and "broken"', () => {
  test('no config at all is exit 0 with no output, not an error', () => {
    const box = open(null);
    const run = resolve(box);
    assert.equal(run.status, 0);
    assert.equal(run.stdout.trim(), '');
  });

  test('a missing jq is exit 10, which routes the skill to reading the file', () => {
    const box = open('with-profiles.json');
    const run = resolve(box, { PATH: pathWithoutJq(box) });
    assert.equal(run.status, 10);
  });

  test('a wrong path is NOT mistaken for a missing jq', () => {
    // The reason 10 was chosen: `sh missing.sh` exits 2 on its own, so a low code
    // would make an unresolved path indistinguishable from an absent jq — and a
    // skill would silently proceed on defaults.
    const box = open('with-profiles.json');
    const run = resolve(
      box,
      {},
      join(box.skill, 'templates', 'does-not-exist.sh')
    );
    assert.notEqual(run.status, 0);
    assert.notEqual(run.status, 10, 'must not look like "no jq"');
  });
});

describe('installed in isolation', () => {
  test('the resolver works from a skill copied out of the repo', () => {
    // The copy has no repo root above it, so anything reaching outside the skill
    // folder would fail here — which is the whole point of the arrangement.
    const box = open('with-profiles.json', 'repo/atomic-commit');
    const run = resolve(box);
    assert.equal(run.status, 0);
    assert.equal(parse(run.stdout).language, 'en');
  });

  test('every skill shipping a resolver resolves identically', () => {
    const paths = [
      'work/work-implement',
      'work/work-review-queue',
      'repo/merge-deps',
      'docs/write-docs',
      'meta/tituskirch-skills-config'
    ];
    const results = paths.map(
      (p) => resolve(open('with-profiles.json', p), { CI: 'true' }).stdout
    );
    const first = results[0];
    assert.ok(first, 'at least one skill must resolve');
    for (const out of results) {
      assert.deepEqual(parse(out), parse(first), 'copies must not drift');
    }
  });
});
