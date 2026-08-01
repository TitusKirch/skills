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

describe('the trustedBots allowlist', () => {
  test('accepts an empty list and entries carrying an id and a login', () => {
    accepts({ trustedBots: [] }, 'empty allowlist');
    accepts(
      { trustedBots: [{ id: 49699333, login: 'dependabot[bot]' }] },
      'integer id (GitHub user.id)'
    );
    accepts(
      { trustedBots: [{ id: 'app_123', login: 'kirchdev-release[bot]' }] },
      'string id'
    );
  });

  test('an entry must carry both the id and the login, and nothing else', () => {
    rejects({ trustedBots: [{ id: 1 }] }, 'login missing');
    rejects({ trustedBots: [{ login: 'x' }] }, 'id missing');
    rejects(
      { trustedBots: [{ id: 1, login: 'x', note: 'extra' }] },
      'unknown key in an entry'
    );
    rejects({ trustedBots: [{ id: 1, login: '' }] }, 'empty login');
    rejects({ trustedBots: {} }, 'not an array');
  });

  test('it can be overlaid in a profile', () => {
    accepts(
      { profiles: { ci: { trustedBots: [{ id: 1, login: 'x' }] } } },
      'profile trustedBots fragment'
    );
  });
});

describe('the reviewing lease label (opt-in review-loop lease)', () => {
  test('accepts a label string or false, like the other lifecycle labels', () => {
    accepts(
      { work: { labels: { reviewing: 'ai: reviewing' } } },
      'reviewing as a label string'
    );
    accepts(
      { work: { labels: { reviewing: false } } },
      'reviewing switched off'
    );
  });

  test('rejects a value that is neither a non-empty string nor false', () => {
    rejects({ work: { labels: { reviewing: '' } } }, 'empty reviewing label');
    rejects({ work: { labels: { reviewing: 1 } } }, 'numeric reviewing label');
    rejects({ work: { labels: { reviewing: true } } }, 'reviewing set true');
  });
});

// `cap` bounds the run, `concurrency` the moment. The pair only earns its keep if
// omitting `concurrency` stays valid — that absence is what makes it default to `cap`,
// and a schema that required it would break every config written before it existed.
describe('the concurrency bound beside the run cap', () => {
  test('it is optional, and an integer of at least one when present', () => {
    accepts({ work: { cap: 20 } }, 'cap alone — concurrency defaults to it');
    accepts({ work: { cap: 20, concurrency: 3 } }, 'the pair the key is for');
    accepts({ work: { concurrency: 1 } }, 'concurrency alone');
    accepts(
      { work: { cap: 2, concurrency: 8 } },
      'above cap is legal and simply inert — the lower of the two wins'
    );
  });

  test('it takes the same shape as cap, and no looser', () => {
    rejects({ work: { concurrency: 0 } }, 'concurrency minimum');
    rejects({ work: { concurrency: 2.5 } }, 'not an integer');
    rejects({ work: { concurrency: false } }, 'not a labelOrOff');
    rejects({ work: { concurrency: '3' } }, 'not a numeric string');
  });

  test('it can be overlaid in a profile, like every other work key', () => {
    accepts(
      { profiles: { ci: { work: { concurrency: 4 } } } },
      'profile concurrency fragment'
    );
    rejects(
      { profiles: { ci: { work: { concurrency: 0 } } } },
      'the minimum still applies inside a profile'
    );
  });
});

// work.loop paces a repeating driver between drains. Both keys are optional and
// independent — a repo tuning the poll interval must not be forced to restate the
// backstop — and both are whole seconds, so the seconds/milliseconds mix-up that a
// bare number invites is at least caught at the "0 means spin" end.
describe('the loop pacing keys', () => {
  test('accepts either key alone, and both together', () => {
    accepts({ work: { loop: { wait: 120 } } }, 'wait alone');
    accepts({ work: { loop: { maxWait: 1800 } } }, 'maxWait alone');
    accepts({ work: { loop: { wait: 60, maxWait: 600 } } }, 'both keys');
    accepts({ work: { loop: {} } }, 'an empty loop section');
  });

  test('rejects a non-positive, fractional or misspelled value', () => {
    rejects({ work: { loop: { wait: 0 } } }, 'a wait of zero');
    rejects({ work: { loop: { maxWait: -1 } } }, 'a negative maxWait');
    rejects({ work: { loop: { wait: 1.5 } } }, 'a fractional wait');
    rejects({ work: { loop: { interval: 120 } } }, 'an unknown loop key');
  });

  test('it is writable inside a profile, like every other work key', () => {
    accepts(
      { profiles: { ci: { work: { loop: { wait: 300 } } } } },
      'loop fragment in a profile'
    );
  });
});

// ADR-0018 split the tail of the Linear map in two: `accepted` is what the review
// verdict writes, `done` is the shipped state no work skill writes. The keys are
// independent — a repo can map either, both, or neither — because a config that maps
// only `done` has to keep validating while its accept verdict quietly writes no state
// at all. That is the migration path, so the schema must not turn it into an error.
describe('the accepted/done split in the Linear state map', () => {
  const linearWork = (states: Record<string, string>) => ({
    work: {
      tracker: 'linear',
      linear: { team: 'ENG', statuses: ['Todo', 'Accepted'], states },
      labels: { repo: 'repo: x' }
    }
  });

  test('accepts either key alone, and both together', () => {
    accepts(linearWork({ accepted: 'Accepted' }), 'accepted alone');
    accepts(linearWork({ done: 'Done' }), 'done alone — the unmigrated config');
    accepts(
      linearWork({ accepted: 'Ready for release', done: 'Done' }),
      'both, which is the shape the split is for'
    );
    accepts(linearWork({}), 'neither — the lifecycle runs on labels alone');
  });

  test('accepted is a non-empty string like every other state name', () => {
    rejects(linearWork({ accepted: '' }), 'empty accepted state');
    rejects(
      { work: { linear: { states: { accepted: 1 } } } },
      'numeric accepted state'
    );
    rejects(
      { work: { linear: { states: { accepted: false } } } },
      'accepted is a state name, not a labelOrOff'
    );
  });

  test('the old key is not silently re-spelled', () => {
    rejects(
      { work: { linear: { states: { shipped: 'Done' } } } },
      'shipped was the rejected alternative and is not a key'
    );
  });
});

// work.feedback routes the loops' round-by-round output to the PR or the issue. Its
// default is derived from work.branch rather than written into the schema, so the
// key has to stay omittable — a config that never sets it is the normal one.
describe('the feedback destination', () => {
  test('accepts either mode, at the root and in a profile', () => {
    accepts({ work: { feedback: 'pr' } }, 'feedback on the pull request');
    accepts(
      { work: { feedback: 'issue' } },
      "feedback in the issue's comments"
    );
    accepts(
      { profiles: { ci: { work: { feedback: 'pr' } } } },
      'a profile may switch the destination for its context'
    );
  });

  test('omitting it stays valid — the default comes from work.branch', () => {
    accepts({ work: { branch: 'branch:dev' } }, 'no feedback key');
  });

  test('rejects anything that is not one of the two modes', () => {
    rejects(
      { work: { feedback: 'both' } },
      'both was the rejected alternative'
    );
    rejects({ work: { feedback: '' } }, 'empty destination');
    rejects({ work: { feedback: false } }, 'feedback is not a labelOrOff');
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
