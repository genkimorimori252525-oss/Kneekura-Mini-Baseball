import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { FreeAgentRightsEvent } from '../../core/world/roster/FreeAgentContract';
import { openSqlitePopularityHistoryStore,
  type SqlitePopularityHistoryStore } from './SqlitePopularityHistoryStore';

const rights: FreeAgentRightsEvent = {
  type: 'FREE_AGENT_RIGHTS_ACQUIRED', eventId: 'rights-1',
  careerId: 'career-a', clubId: 'club-a', playerId: 'player-a',
  contractId: 'contract-a', decisionId: 'decision-a',
  acceptanceId: 'acceptance-a', sourceClubEventId: 'club-event-a',
  effectiveDay: 10, beforeRevision: 0, afterRevision: 1,
  beforeRights: { rightsHolderClubId: null, contractId: null },
  afterRights: { rightsHolderClubId: 'club-a', contractId: 'contract-a' },
};
const policy = { policyId: 'popularity-update', version: 'v1',
  availableAtDay: 0, initialAwareness: 0, initialFavorability: 0.5,
  awarenessRate: 0.3, favorabilityRate: 0.2,
  maximumAwarenessStep: 0.1, maximumFavorabilityStep: 0.05 };
const request = { eventId: 'rights-1', careerId: 'career-a',
  personId: 'person-a', playerId: 'player-a', expectedRevision: 0,
  asOfDay: 12, policy,
  evidence: [{ evidenceId: 'audience-a', sourceCareerEventId: 'rights-1',
    audience: { kind: 'CLUB_FANS' as const, scopeId: 'club-a' },
    observedAtDay: 11, availableAtDay: 12,
    reach: 0.8, response: 0.9 }] };
const directories: string[] = [];
const stores: SqlitePopularityHistoryStore[] = [];
const databasePath = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-popularity-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const authority = { readAcceptedFreeAgentRightsEvent: (eventId: string) =>
  eventId === rights.eventId ? { rightsEvent: rights,
    personId: 'person-a', playerId: 'player-a',
    personLinkSourceId: 'person-link-a' } : null };
const open = (path: string,
  source = authority): SqlitePopularityHistoryStore => {
  const store = openSqlitePopularityHistoryStore(path, source);
  stores.push(store);
  return store;
};
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-popularity-')) {
      throw new Error('popularity test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

it('commits a source-checked slow update with CAS and replays idempotently after restart', () => {
  const path = databasePath();
  const first = open(path);
  first.initialize('career-a', 'person-a', null);
  const saved = first.apply(request);
  expect(saved.history).toMatchObject({ revision: 1,
    transfers: [{ toClubId: 'club-a' }],
    observations: [{ value: 0.1 }, { value: 0.55 }] });
  expect(first.readHead('career-a', 'person-a')).toEqual(saved.history);
  first.close();
  stores.splice(stores.indexOf(first), 1);
  const reopened = open(path);
  expect(reopened.readApplication('rights-1')).toEqual(saved);
  expect(reopened.apply(request)).toEqual(saved);
  expect(() => reopened.apply({ ...request,
    evidence: [{ ...request.evidence[0]!, reach: 0.3 }] }))
    .toThrow('eventId');
});

it('rejects missing source acceptance and stale revision without changing the head', () => {
  const path = databasePath();
  const store = open(path, { readAcceptedFreeAgentRightsEvent: () => null });
  store.initialize('career-a', 'person-a', null);
  expect(() => store.apply(request)).toThrow('accepted');
  expect(() => store.apply({ ...request, expectedRevision: 1 }))
    .toThrow('revision');
  expect(store.readHead('career-a', 'person-a')?.revision).toBe(0);
  expect(store.readApplication('rights-1')).toBeNull();
});

it('rejects a person identity that the accepted source does not link to the player', () => {
  const path = databasePath();
  const store = open(path, { readAcceptedFreeAgentRightsEvent: () => ({
    rightsEvent: rights, personId: 'another-person', playerId: 'player-a',
    personLinkSourceId: 'person-link-other',
  }) });
  store.initialize('career-a', 'person-a', null);
  expect(() => store.apply(request)).toThrow('person');
  expect(store.readHead('career-a', 'person-a')?.revision).toBe(0);
});

it('rolls back the head if recording the event application fails', () => {
  const path = databasePath();
  const store = open(path);
  store.initialize('career-a', 'person-a', null);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(path);
  try {
    external.exec(`CREATE TRIGGER fail_popularity_application
      BEFORE INSERT ON popularity_event_applications
      BEGIN SELECT RAISE(ABORT, 'injected popularity failure'); END;`);
    expect(() => store.apply(request)).toThrow('injected popularity failure');
    expect(store.readHead('career-a', 'person-a')?.revision).toBe(0);
    expect(store.readApplication('rights-1')).toBeNull();
    external.exec('DROP TRIGGER fail_popularity_application');
  } finally {
    external.close();
  }
  expect(store.apply(request).history.revision).toBe(1);
});
