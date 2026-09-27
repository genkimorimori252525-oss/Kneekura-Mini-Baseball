import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openSqlitePlayerRelationshipStore } from
  './SqlitePlayerRelationshipStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-relationships-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const policy = { policyId: 'relationships-v1',
  version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 2, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 4, trust: 0, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 5 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 3 },
    JOINT_FAILURE: { affinity: 0, trust: 0, coordination: -10 },
    CONFLICT: { affinity: -5, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: -6, coordination: 0 },
    ROLE_COMPETITION: { affinity: -2, trust: 0, coordination: 0 },
  },
};
const setup = () => {
  const directory = mkdtempSync(join(tmpdir(),
    'kneekura-relationships-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const store = openSqlitePlayerRelationshipStore(path, {
    readAcceptedPolicy: sourceId => sourceId === 'policy-1'
      ? { sourceId, careerId: 'career-a', policy } : null,
    readAcceptedEvidence: sourceId => sourceId === 'joint-1'
      ? { sourceId, careerId: 'career-a', evidence: {
        eventId: 'joint-event-1', sourceEventId: 'official-joint-1',
        atDay: 10, fromPlayerId: 'a', toPlayerId: 'b',
        kind: 'JOINT_REPETITION', task: 'MIDDLE_INFIELD' } }
      : sourceId === 'support-1'
        ? { sourceId, careerId: 'career-a', evidence: {
          eventId: 'support-event-1',
          sourceEventId: 'official-support-1', atDay: 20,
          fromPlayerId: 'b', toPlayerId: 'a',
          kind: 'MUTUAL_SUPPORT' } } : null,
  });
  stores.push(store);
  return { path, store };
};

it('replays sparse directional edges and historical coordination after restart', () => {
  const { path, store } = setup();
  const initial = store.initialize('policy-1');
  expect(initial.links).toEqual([]);
  expect(store.apply('career-a', 'joint-1', 0).links)
    .toMatchObject([{ fromPlayerId: 'a', toPlayerId: 'b',
      coordinationByTask: { MIDDLE_INFIELD: 55 },
      affinity: 50 }]);
  const latest = store.apply('career-a', 'support-1', 1);
  expect(latest.links).toMatchObject([
    { fromPlayerId: 'a', toPlayerId: 'b', affinity: 50 },
    { fromPlayerId: 'b', toPlayerId: 'a', affinity: 54,
      coordinationByTask: {} },
  ]);
  expect(store.readAtDay('career-a', 9)).toEqual(initial);
  expect(store.readAtDay('career-a', 10)?.links).toHaveLength(1);
  expect(store.readAtDay('career-a', 20)).toEqual(latest);
  store.close(); stores.splice(stores.indexOf(store), 1);
  const reopened = openSqlitePlayerRelationshipStore(path);
  stores.push(reopened);
  expect(reopened.read('career-a')).toEqual(latest);
  expect(reopened.apply('career-a', 'joint-1', 0).revision)
    .toBe(1);
  expect(() => reopened.apply('career-a', 'joint-1', 1))
    .toThrow('retry');
  expect(() => reopened.apply('career-a', 'unknown', 2))
    .toThrow('authority');
  expect(latest.links[0]).not.toHaveProperty('battingModifier');
});
