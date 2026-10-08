import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';

import { receivedPolicySource as sourceFor } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';

test('RP-D01 explicit imported inert data owns exact original Player Person and fielding bytes', async () => {
  const path = './SqliteReceivedUmpireDefenderPolicyDataStore';
  expect(existsSync(new URL(path + '.ts', import.meta.url)), 'RECEIVED_POLICY_DATA_OWNER_MISSING').toBe(true);
  const { openSqliteReceivedUmpireDefenderPolicyDataStore: open } = await import(path) as typeof import('./SqliteReceivedUmpireDefenderPolicyDataStore');
  const f = playerFieldingModelFixture();
  try {
    const fieldingModel = f.models.accept(f.source.sourceId), source = sourceFor(f);
    const original = () => ({ people: f.db.prepare('SELECT * FROM world_player_person_links').all(),
      models: f.db.prepare('SELECT * FROM world_player_fielding_models').all() });
    const before = original(), store = f.track(open(f.path, { readAcceptedPolicyData: () => source }));
    const value = store.accept(source.sourceId);
    expect(value).toEqual({ source, fieldingModel });
    expect(Object.keys(store).sort()).toEqual(['accept', 'close', 'read']);
    expect(Object.isFrozen(value.source.profiles.out)).toBe(true);
    expect(Object.isFrozen(value.fieldingModel.person)).toBe(true);
    source.profiles.out.ballPursuitPriority = 0.8;
    expect(value.source.profiles.out!.ballPursuitPriority).toBe(0.1);
    store.close();
    const reopened = f.track(open(f.path));
    expect(reopened.read('policy-a')).toEqual(value);
    expect(reopened.accept('policy-a')).toEqual(value);
    expect(reopened.read('missing')).toBeNull();
    expect(original()).toEqual(before);
  } finally { f.close(); }
});

test('RP-D02 exact inert Source rejects missing foreign executable and implicit policy values', async () => {
  const f = await policyFixture();
  try {
    const malformed: unknown[] = [null, [], {}, ...Object.keys(f.source).map(key => Object.fromEntries(Object.entries(f.source).filter(([k]) => k !== key))),
      ...['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId'].flatMap(key =>
        ['', ' ', ' leading', 'trailing ', 1, null].map(value => ({ ...f.source, [key]: value }))),
      ...[NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, '11'].map(acceptedAtDay => ({ ...f.source, acceptedAtDay })),
      { ...f.source, capability: 'received_umpire_defender_policy_data_v2' },
      { ...f.source, provenance: 'calibrated_production_policy' }, { ...f.source, personId: 'person-a' },
      ...['availableAt', 'pitch', 'observation', 'clock', 'sequence', 'decision', 'replan'].map(key => ({ ...f.source, [key]: null })),
      ...[null, [], {}, { out: null }, { safe: null }, { out: null, safe: null, default: null }].map(profiles => ({ ...f.source, profiles })),
      ...[undefined, {}, [], { ballPursuitPriority: 0 }, { holdPriority: 0 }, { ballPursuitPriority: 0, holdPriority: 0, extra: 0 },
        ...[NaN, Infinity, -0.1, 1.1, '0', null].flatMap(value => [
          { ballPursuitPriority: value, holdPriority: 0 }, { ballPursuitPriority: 0, holdPriority: value }])]
        .flatMap(profile => ['out', 'safe'].map(key => ({ ...f.source, profiles: { ...f.source.profiles, [key]: profile } })))];
    for (const source of malformed) {
      f.sources.set('policy-a', source);
      expect(() => f.store.accept('policy-a'), JSON.stringify(source)).toThrow();
      expect(f.rows()).toEqual([]);
    }
    for (const kind of ['getter', 'symbol', 'inherited', 'nonenumerable']) {
      const source = kind === 'inherited' ? Object.assign(Object.create({ hidden: true }), f.source) : { ...f.source };
      let called = false;
      if (kind === 'getter') Object.defineProperty(source, 'profiles', { enumerable: true, get() { called = true; return f.source.profiles; } });
      if (kind === 'symbol') source[Symbol('hidden')] = 1;
      if (kind === 'nonenumerable') Object.defineProperty(source, 'hidden', { value: 1 });
      f.sources.set('policy-a', source); expect(() => f.store.accept('policy-a')).toThrow(); expect(called).toBe(false);
    }
  } finally { f.close(); }
});

test('RP-D03 explicit null and future-day data remain inert without a pitch or current-game selection', async () => {
  for (const profiles of [{ out: null, safe: null }, { out: { ballPursuitPriority: 0, holdPriority: 1 }, safe: null },
    { out: null, safe: { ballPursuitPriority: 1, holdPriority: 0 } }]) {
    const f = await policyFixture();
    try {
      const source = { ...f.source, acceptedAtDay: Number.MAX_SAFE_INTEGER, profiles };
      f.sources.set('policy-a', source);
      expect(f.store.accept('policy-a').source).toEqual(source);
      expect(Object.keys(f.store.read('policy-a')!)).toEqual(['source', 'fieldingModel']);
      expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'actual_%'").all()).toEqual([]);
    } finally { f.close(); }
  }
});

test('RP-D04 one immutable Player baseline preserves historical bytes and rejects changed Source callbacks', async () => {
  const f = await policyFixture();
  try {
    const value = f.store.accept('policy-a'), before = f.rows();
    expect(f.store.accept('policy-a')).toEqual(value); expect(f.rows()).toEqual(before);
    const second = { ...f.source, sourceId: 'policy-b' }; f.sources.set('policy-b', second);
    expect(() => f.store.accept('policy-b')).toThrow(/baseline/);
    f.sources.set('policy-a', { ...f.source, profiles: { ...f.source.profiles, out: null } });
    expect(() => f.store.accept('policy-a')).toThrow(/frozen/);
    f.sources.clear(); expect(f.store.accept('policy-a')).toEqual(value); expect(f.rows()).toEqual(before);
    f.store.close(); f.store.close(); expect(() => f.store.read('policy-a')).toThrow(/closed/);
    expect(() => f.store.accept('policy-a')).toThrow(/closed/);
    expect(() => f.open('')).toThrow(); expect(() => f.open(f.path, {} as never)).toThrow();
  } finally { f.close(); }
});

test('RP-D05 original fielding and Person scope day and stored hashes cannot be substituted', async () => {
  const f = await policyFixture();
  try {
    for (const patch of [{ careerId: 'other' }, { playerId: 'player-b' }, { personLinkSourceId: 'other' },
      { fieldingModelSourceId: 'other' }, { acceptedAtDay: 9 }]) {
      f.sources.set('policy-a', { ...f.source, ...patch });
      expect(() => f.store.accept('policy-a')).toThrow(/scope/); expect(f.rows()).toEqual([]);
    }
    f.sources.set('policy-a', f.source); f.store.accept('policy-a');
    for (const column of ['source_hash', 'snapshot_hash', 'source_version', 'fielding_model_source_id', 'person_link_source_id']) {
      const before = f.rows()[0];
      f.db.prepare(`UPDATE world_received_umpire_defender_policy_data SET ${column}='wrong'`).run();
      expect(() => f.store.read('policy-a')).toThrow(/archive/);
      f.db.prepare(`UPDATE world_received_umpire_defender_policy_data SET ${column}=?`).run(before[column]);
    }
    f.db.exec("UPDATE world_player_fielding_models SET source_hash='changed'");
    expect(() => f.store.read('policy-a')).toThrow();
  } finally { f.close(); }
});
