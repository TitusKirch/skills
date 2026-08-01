// What resolve-config.sh promises, checked against a real repo and a real copy of
// the script. Every case here was a bug at some point or is a rule a skill relies
// on; none of them is theoretical.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT,
  sandbox,
  resolve,
  pathWithoutJq,
  type Sandbox
} from './helpers.ts';

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
      labels.reviewRequested,
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

// The block above `scripts/config-block.md` is mirrored into seventeen skills and
// drift-checked against that source, and the resolver beside it is copied byte-exact —
// but nothing held the source honest about the script it describes. Change the fallback
// profile or the exit code in the sh and the prose in every skill stays confidently
// wrong, on a green board, because the two were only ever checked apart.
//
// Each case below pins one sentence of the prose to the behaviour it claims, so neither
// can move alone: edit the script and the behaviour assertion fails; edit the sentence
// and the prose assertion fails, in the same test, next to each other.
describe('the config block describes the resolver it ships beside', () => {
  const block = readFileSync(join(ROOT, 'scripts', 'config-block.md'), 'utf8');

  test('the variable it names is the one that selects a profile', () => {
    assert.match(block, /The profile comes from `TITUSKIRCH_SKILLS_PROFILE`/);

    const box = open('with-profiles.json');
    const out = parse(
      resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'audit' }).stdout
    );
    assert.deepEqual(out.commit, { scopeVocab: ['only-this'] });
  });

  test('the CI fallback it names is the profile actually selected', () => {
    assert.match(block, /falling back to `ci` when `CI` holds a truthy value/);

    const box = open('with-profiles.json');
    const out = parse(resolve(box, { CI: 'true' }).stdout);
    assert.equal((out.work as Record<string, unknown>).branch, 'worktree');
  });

  test('an unknown name yields the base config, as it says', () => {
    assert.match(
      block,
      /An unset or unknown name yields the base config unchanged/
    );

    const box = open('with-profiles.json');
    const run = resolve(box, { TITUSKIRCH_SKILLS_PROFILE: 'typo' });
    assert.equal(run.status, 0);
    assert.equal(
      (parse(run.stdout).work as Record<string, unknown>).branch,
      'branch:dev'
    );
  });

  test('the four-part merge rule it states is the merge performed', () => {
    assert.match(block, /Objects merge recursively at any depth/);
    assert.match(
      block,
      /arrays and scalars are replaced rather than concatenated/
    );
    assert.match(
      block,
      /an explicit `null` sets null rather than deleting a key/
    );
    assert.match(block, /`profiles` is dropped from the result/);

    const ci = parse(
      resolve(open('with-profiles.json'), { CI: 'true' }).stdout
    );
    const work = ci.work as Record<string, unknown>;
    // Recursive, at two levels: an overlaid label leaves its siblings and its
    // grandparent's siblings standing.
    assert.equal((work.labels as Record<string, unknown>).ready, 'ci: queued');
    assert.equal(
      (work.labels as Record<string, unknown>).done,
      'ai: done',
      'a sibling two levels down survives'
    );
    assert.equal(work.cap, 10, 'a sibling one level down survives');
    assert.ok(!('profiles' in ci), 'profiles is dropped');

    const audit = parse(
      resolve(open('with-profiles.json'), {
        TITUSKIRCH_SKILLS_PROFILE: 'audit'
      }).stdout
    );
    assert.deepEqual(
      audit.commit,
      { scopeVocab: ['only-this'] },
      'an array is replaced, not concatenated'
    );
    assert.ok('verify' in audit, 'an explicit null is kept as a key');
    assert.equal(audit.verify, null, 'and its value is null');
  });

  test('the exit code it names is the one a missing jq produces', () => {
    assert.match(block, /`resolve-config\.sh` exits `10` in that case/);

    const box = open('with-profiles.json');
    assert.equal(resolve(box, { PATH: pathWithoutJq(box) }).status, 10);
  });
});
