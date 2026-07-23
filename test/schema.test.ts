// The schema is the contract every skill reads through, so what it accepts and
// rejects is worth asserting rather than assuming.
//
// The load-bearing case is the shape/constraint split that profiles required: a
// fragment like {"tracker":"linear"} has to be writable inside a profile while the
// root keeps rejecting it, because the root's if/then demands `linear` and `labels`
// alongside it. Get that wrong in either direction and profiles are unusable or
// the schema stops catching real misconfiguration.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020, type AnySchema, type ErrorObject } from 'ajv/dist/2020.js';
import { ROOT } from './helpers.ts';

const schema = JSON.parse(
  readFileSync(join(ROOT, 'tituskirch-skills.schema.json'), 'utf8')
) as AnySchema;
const validate = new Ajv2020({ strict: false, allErrors: true }).compile(
  schema
);

const why = () =>
  (validate.errors ?? [])
    .map((e: ErrorObject) => `${e.instancePath} ${e.message}`)
    .join(' | ');

const accepts = (config: unknown, note: string) =>
  assert.ok(validate(config), `${note} — rejected: ${why()}`);
const rejects = (config: unknown, note: string) =>
  assert.equal(
    validate(config),
    false,
    `${note} — was accepted but should not be`
  );

describe('configs that actually exist', () => {
  test("this repo's own config validates", () => {
    accepts(
      JSON.parse(readFileSync(join(ROOT, '.tituskirch-skills.json'), 'utf8')),
      '.tituskirch-skills.json'
    );
  });

  test('every test fixture validates', () => {
    const dir = join(ROOT, 'test', 'fixtures');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    assert.ok(files.length > 0, 'there should be fixtures to check');
    for (const file of files) {
      accepts(JSON.parse(readFileSync(join(dir, file), 'utf8')), file);
    }
  });
});

describe('profiles accept fragments the root must still reject', () => {
  test('a bare {tracker:linear} is rejected at the root', () => {
    rejects({ issue: { tracker: 'linear' } }, 'root issue without linear.team');
    rejects({ work: { tracker: 'linear' } }, 'root work without linear/labels');
  });

  test('the same fragment is valid inside a profile', () => {
    accepts(
      { profiles: { ci: { issue: { tracker: 'linear' } } } },
      'profile issue fragment'
    );
    accepts(
      { profiles: { ci: { work: { tracker: 'linear' } } } },
      'profile work fragment'
    );
  });

  test('a partial section keeps its siblings optional', () => {
    accepts(
      { profiles: { ci: { work: { branch: 'worktree' } } } },
      'work.branch only'
    );
    accepts({ profiles: { ci: { pr: { base: 'main' } } } }, 'pr.base only');
  });

  test('a profile may disable a skill outright', () => {
    accepts(
      { profiles: { ci: { release: false, mergeDeps: false } } },
      'sections set false'
    );
  });

  test('root keys are allowed in a profile', () => {
    accepts(
      {
        profiles: {
          ci: { verify: 'pnpm check', language: 'de', forge: 'github' }
        }
      },
      'root-level keys'
    );
  });
});

describe('profiles do not become an escape hatch', () => {
  test('types, enums and patterns still apply inside one', () => {
    rejects(
      { profiles: { ci: { release: { promote: 'nope' } } } },
      'invalid enum'
    );
    rejects(
      { profiles: { ci: { work: { branch: 'pr:dev' } } } },
      'branch pattern'
    );
    rejects({ profiles: { ci: { work: { cap: 0 } } } }, 'cap minimum');
    rejects({ profiles: { ci: { verify: '' } } }, 'empty verify');
  });

  test('unknown keys are rejected, in a profile as at the root', () => {
    rejects({ profiles: { ci: { nope: 1 } } }, 'unknown key in profile');
    rejects(
      { profiles: { ci: { work: { nope: 1 } } } },
      'unknown key in a section'
    );
    rejects({ nope: 1 }, 'unknown key at the root');
  });

  test('profiles do not nest and cannot be empty', () => {
    rejects(
      { profiles: { ci: { profiles: { inner: { verify: 'x' } } } } },
      'nested profiles'
    );
    rejects({ profiles: { ci: {} } }, 'an empty profile says nothing');
    rejects({ profiles: {} }, 'an empty profiles object');
  });
});

describe('nothing about existing configs changed', () => {
  test('a config with no profiles key is still valid', () => {
    accepts({ language: 'en', pr: { base: 'dev' } }, 'plain config');
    accepts({}, 'empty config');
  });

  test('a complete linear config still validates at the root', () => {
    accepts(
      {
        issue: { tracker: 'linear', linear: { team: 'ENG' } },
        work: {
          tracker: 'linear',
          linear: { team: 'ENG', statuses: ['Todo'] },
          labels: { repo: 'repo: x' }
        }
      },
      'linear with everything its if/then requires'
    );
  });
});
