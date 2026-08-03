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

// The triage flag is the only `work.labels.*` key the loops never write — naming it
// turns on the contradiction check (untriaged + a lifecycle label → withheld and
// reported, never worked). It is a repo convention rather than a lifecycle state, so
// it must stay opt-in: absent has to keep validating, and `false` has to remain
// expressible, or "off" collapses into "use some guessed string".
describe('the needsTriage label (opt-in contradiction check)', () => {
  test('accepts a label string or false, like the other labels', () => {
    accepts(
      { work: { labels: { needsTriage: 'needs triage' } } },
      'needsTriage as a label string'
    );
    accepts(
      { work: { labels: { needsTriage: false } } },
      'needsTriage switched off'
    );
    accepts(
      { work: { labels: { ready: 'ai: ready' } } },
      'needsTriage omitted entirely'
    );
  });

  test('rejects a value that is neither a non-empty string nor false', () => {
    rejects(
      { work: { labels: { needsTriage: '' } } },
      'empty needsTriage label'
    );
    rejects(
      { work: { labels: { needsTriage: 1 } } },
      'numeric needsTriage label'
    );
    rejects(
      { work: { labels: { needsTriage: true } } },
      'needsTriage set true'
    );
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

// The queue branch is the one work mode that strands its output when the repo it
// runs in cannot land it: issue PRs pile up on `ai/queue-<hash>` and nothing ever
// merges them without the fast-forward workflow. So the gate has to be opt-in in
// the schema itself — absent must stay valid and must mean off, or every config
// written before the key existed would silently acquire the mode.
describe('the queue-branch gate', () => {
  test('it is optional, and a boolean when present', () => {
    accepts({ work: { branch: 'worktree' } }, 'absent — the mode stays off');
    accepts(
      { work: { branch: 'worktree', queueBranch: true } },
      'the opt-in the key exists for'
    );
    accepts(
      { work: { branch: 'worktree', queueBranch: false } },
      'written out explicitly, which is also the default'
    );
  });

  test('it is a gate, not a branch name', () => {
    rejects({ work: { queueBranch: 'ai/queue-abc' } }, 'not a branch string');
    rejects({ work: { queueBranch: 'true' } }, 'not a boolean-ish string');
    rejects({ work: { queueBranch: 1 } }, 'not a number');
    rejects({ work: { queueBranch: null } }, 'not null');
  });

  test('it can be overlaid in a profile, like every other work key', () => {
    accepts(
      { profiles: { ci: { work: { queueBranch: true } } } },
      'profile queueBranch fragment'
    );
    rejects(
      { profiles: { ci: { work: { queueBranch: 'yes' } } } },
      'the type still applies inside a profile'
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
    accepts({ work: { loop: { maxWait: 600 } } }, 'maxWait alone');
    accepts({ work: { loop: { wait: 60, maxWait: 300 } } }, 'both keys');
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

// `mode` says how the wait is *paced*, where `wait`/`maxWait` say how long — three
// named strategies rather than a number, so an unknown one has to be caught here
// instead of being read as "some pacing nobody implements". Omitting it has to keep
// validating too: `auto` is the default, and every config written before this key
// existed means exactly that.
describe('the loop pacing mode', () => {
  test('accepts each of the three modes, and omitting it entirely', () => {
    accepts({ work: { loop: { mode: 'fixed' } } }, 'the portable floor');
    accepts({ work: { loop: { mode: 'adaptive' } } }, 'tracker-driven backoff');
    accepts({ work: { loop: { mode: 'auto' } } }, 'the heartbeat default');
    accepts(
      { work: { loop: { wait: 120 } } },
      'mode omitted — it defaults to auto'
    );
  });

  test('rejects a mode that is not one of the three', () => {
    rejects({ work: { loop: { mode: 'event' } } }, 'an unimplemented mode');
    rejects({ work: { loop: { mode: 'Auto' } } }, 'the wrong case');
    rejects({ work: { loop: { mode: '' } } }, 'an empty mode');
    rejects({ work: { loop: { mode: false } } }, 'mode is not a labelOrOff');
  });

  test('it is writable inside a profile, like the pacing numbers', () => {
    accepts(
      { profiles: { ci: { work: { loop: { mode: 'fixed' } } } } },
      'mode fragment in a profile'
    );
    rejects(
      { profiles: { ci: { work: { loop: { mode: 'event' } } } } },
      'the enum still applies inside a profile'
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

// ADR-0023 added a third tracker whose store is a directory of committed files. The
// asymmetry worth pinning is that `local` needs no companion key: `linear` cannot be
// used without a team, because a team name is underivable, while every local key has a
// default. So a bare {tracker:"local"} has to validate at the ROOT — not only inside a
// profile, which is where the bare linear fragment is confined.
describe('the local file tracker', () => {
  test('a bare {tracker:local} is valid at the root, unlike linear', () => {
    accepts({ issue: { tracker: 'local' } }, 'root issue, no companion key');
    accepts({ work: { tracker: 'local' } }, 'root work, no companion key');
  });

  test('the directory is an optional non-empty string on both sections', () => {
    accepts(
      { issue: { tracker: 'local', local: { dir: 'docs/issues' } } },
      'issue.local.dir'
    );
    accepts(
      { work: { tracker: 'local', local: { dir: '.agents/issues' } } },
      'work.local.dir'
    );
    accepts({ work: { tracker: 'local', local: {} } }, 'dir left to default');
    rejects({ work: { local: { dir: '' } } }, 'empty dir');
    rejects({ issue: { local: { dir: 1 } } }, 'numeric dir');
    rejects({ work: { local: { path: '.agents/issues' } } }, 'unknown key');
  });

  test('the linear constraints are not extended to it', () => {
    accepts(
      { work: { tracker: 'local', labels: { ready: 'ai: ready' } } },
      'no linear/labels.repo/statuses demanded of a local tracker'
    );
  });

  test('an unknown tracker is still rejected', () => {
    rejects({ work: { tracker: 'files' } }, 'files is not the name');
    rejects({ issue: { tracker: 'gitea' } }, 'no forge doubles as a tracker');
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

// The forge axis was designed to take a second forge additively, and GitLab is the
// first to dock. Both halves are asserted here because the axis is only useful if the
// two move together: the enum has to widen, and the host has to be sayable — a
// self-hosted instance is the normal GitLab deployment, not the edge case.
describe('the GitLab forge', () => {
  test('the forge axis accepts either forge, at the root and in a profile', () => {
    accepts({ forge: 'github' }, 'the forge that was already there');
    accepts({ forge: 'gitlab' }, 'the second forge docking on the axis');
    accepts(
      { profiles: { ci: { forge: 'gitlab' } } },
      'a profile may switch the forge for its context'
    );
  });

  test('an unimplemented forge is still rejected', () => {
    rejects({ forge: 'gitea' }, 'no third forge is implemented');
    rejects({ forge: '' }, 'an empty forge');
    rejects({ forge: false }, 'forge is not a disable switch — it is an axis');
  });
});

// merge-deps selects its queue by authorship, and on GitHub that author is a constant
// (app/dependabot). On GitLab it is not: Renovate is always self-run there, so its
// account is a per-repo, per-instance fact and has to be configured. The schema's job
// is to make sure the key can only ever *narrow* — exactly one identity, matched on an
// immutable id — because a key that could widen would dissolve the skill's one hard
// guarantee. Every rejection below is a way of widening it.
describe("merge-deps' GitLab bot identity", () => {
  test('it is one identity, carrying both the id that matches and the login that reads', () => {
    accepts(
      { mergeDeps: { gitlab: { bot: { id: 4207, login: 'renovate-bot' } } } },
      'the numeric id GitLab mints for a user'
    );
    accepts(
      {
        mergeDeps: {
          gitlab: { bot: { id: 12, login: 'project_4_bot_a1b2c3' } }
        }
      },
      'the internal bot user behind a project access token'
    );
    accepts(
      {
        mergeDeps: { merge: 'grouped', gitlab: { bot: { id: 7, login: 'r' } } }
      },
      'it sits beside the existing keys, not instead of them'
    );
  });

  test('it is omittable — absent means the skill stops, not that it guesses', () => {
    accepts(
      { mergeDeps: { merge: 'patch' } },
      'a GitHub repo names no identity'
    );
    accepts(
      { forge: 'gitlab' },
      'the stop is a runtime rule, not a schema constraint'
    );
  });

  test('half an identity is not an identity', () => {
    rejects(
      { mergeDeps: { gitlab: { bot: { login: 'renovate-bot' } } } },
      'a login alone — the login is for reading, never for matching'
    );
    rejects(
      { mergeDeps: { gitlab: { bot: { id: 4207 } } } },
      'an id alone — unreadable, so a rename would never be spotted'
    );
    rejects(
      { mergeDeps: { gitlab: { bot: { id: 4207, login: '' } } } },
      'an empty login'
    );
    rejects({ mergeDeps: { gitlab: { bot: {} } } }, 'an empty identity');
  });

  test('it names an identity, never a way of finding one', () => {
    rejects(
      { mergeDeps: { gitlab: { bot: 'renovate-bot' } } },
      'a bare login — nothing immutable to match on'
    );
    rejects(
      { mergeDeps: { gitlab: { bot: [{ id: 1, login: 'a' }] } } },
      'a list — the key names exactly one author, never a set'
    );
    rejects(
      {
        mergeDeps: {
          gitlab: {
            bot: { id: 1, login: 'a', selector: 'label:dependencies' }
          }
        }
      },
      'a selector — the one thing that would let a repo widen what must not widen'
    );
    rejects(
      { mergeDeps: { gitlab: { botBranchPrefix: 'renovate/' } } },
      'a branch prefix — settable by anyone, so never a selection input'
    );
  });

  test('it is writable inside a profile, like every other section', () => {
    accepts(
      {
        profiles: {
          ci: {
            mergeDeps: { gitlab: { bot: { id: 4207, login: 'renovate' } } }
          }
        }
      },
      'profile mergeDeps fragment'
    );
    rejects(
      { profiles: { ci: { mergeDeps: { gitlab: { bot: { id: 4207 } } } } } },
      'the constraint still applies inside a profile'
    );
  });
});

// The host is a per-repo fact on both forges: self-hosted GitLab is the normal
// deployment and GitHub Enterprise has the same shape. It has to be omittable, since
// resolution falls back to the repo's own remote and then to the CLI's own default.
describe('the forge host', () => {
  test('it is an optional hostname, and null says "derive it"', () => {
    accepts({ forgeHost: 'gitlab.example.com' }, 'a self-hosted instance');
    accepts({ forgeHost: 'github.example.com' }, 'GitHub Enterprise');
    accepts({ forgeHost: null }, 'explicitly derived');
    accepts(
      { forge: 'gitlab' },
      'omitted — derived from the remote or the CLI'
    );
  });

  test('it is a bare hostname, never a URL or an empty string', () => {
    rejects({ forgeHost: '' }, 'an empty host');
    rejects({ forgeHost: 'https://gitlab.example.com' }, 'a URL, not a host');
    rejects({ forgeHost: 'gitlab.example.com/group' }, 'a path, not a host');
    rejects({ forgeHost: 1 }, 'a numeric host');
  });

  test('it can be overlaid in a profile, like every other root key', () => {
    accepts(
      { profiles: { ci: { forgeHost: 'gitlab.example.com' } } },
      'profile forgeHost fragment'
    );
    rejects(
      { profiles: { ci: { forgeHost: '' } } },
      'the constraint still applies inside a profile'
    );
  });
});

// GitLab docks on the tracker axis the way `local` did (ADR-0023): a third driver
// meeting the same contract. Like `github` and unlike `linear`, it needs no companion
// key — the project is the repo and its labels are flat — so a bare fragment has to
// validate at the ROOT, not only inside a profile.
describe('the GitLab issue tracker', () => {
  test('a bare {tracker:gitlab} is valid at the root, like github', () => {
    accepts({ issue: { tracker: 'gitlab' } }, 'root issue, no companion key');
    accepts({ work: { tracker: 'gitlab' } }, 'root work, no companion key');
  });

  test('the linear constraints are not extended to it', () => {
    accepts(
      { work: { tracker: 'gitlab', labels: { ready: 'ai: ready' } } },
      'no linear/labels.repo/statuses demanded of a gitlab tracker'
    );
  });

  test('it is writable inside a profile, like every other tracker', () => {
    accepts(
      { profiles: { ci: { work: { tracker: 'gitlab' } } } },
      'profile work fragment'
    );
  });
});

// grillWith names the interview skill the drafting skills drive, at the root
// because two of them drive it (issue and refine-issue) and an interview style is
// a property of the repo. It names a *skill*, not a mode, so a round-based engine
// docks by having its name typed here — no schema change, no release.
describe('the interview engine', () => {
  test('a skill name is what the key takes', () => {
    accepts({ grillWith: 'grilling' }, 'the default engine, named explicitly');
    accepts(
      { grillWith: 'batch-grilling' },
      'a second engine docks by name alone'
    );
  });

  test('off is spelled either way, and absent is not off', () => {
    accepts({ grillWith: null }, 'null — never grill');
    accepts({ grillWith: false }, "false — the repo's other spelling for off");
    accepts({ language: 'en' }, 'absent — drive grilling when installed');
  });

  test('a profile may switch the engine for its context', () => {
    accepts(
      { grillWith: 'grilling', profiles: { ci: { grillWith: null } } },
      'an unattended context never grills'
    );
  });

  test('rejects what cannot name a skill', () => {
    rejects({ grillWith: '' }, 'empty skill name');
    rejects({ grillWith: true }, 'true names no skill');
    rejects({ grillWith: ['grilling'] }, 'one engine, not a list');
    rejects({ grillWith: { skill: 'grilling' } }, 'a name, not an object');
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
