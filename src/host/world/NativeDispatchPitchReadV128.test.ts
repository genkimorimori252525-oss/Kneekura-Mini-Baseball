import { afterAll, beforeAll, expect, it } from 'vitest';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaExecutedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';

type Evidence = ReturnType<typeof readSamePaExecutedPitchFromSqlite>;
type PitchReference = Parameters<typeof readSamePaExecutedPitchFromSqlite>[1];
let f: ReturnType<typeof directNativeDispatchFixture>;
let writer: ReturnType<typeof openSqliteSamePlateAppearanceDispatchStore>;
let pitch: Evidence['pitch'], fullRef: PitchReference;
beforeAll(() => {
  // Same actual first-TAKE ownership chain as DispatchExecution AX01. All
  // numerical declarations are explicit synthetic fixture inputs. Preserve
  // the original nine defenders and 32 accepted route calibrations.
  f = directNativeDispatchFixture();
  const sources = new Map<string, unknown>();
  writer = openSqliteSamePlateAppearanceDispatchStore(f.path, {
    readAcceptedConsumerSet: id => sources.get(id), readAcceptedEpisode: id => sources.get(id),
    readAcceptedRight: id => sources.get(id), readAcceptedPhysicalPitch: id => sources.get(id),
  });
  const s = f.acceptedAction.source, base = { sourceVersion: 'fixture-only-v1', enrollmentReference: s.enrollmentReference,
    viewReference: s.viewReference, firstPhysicalPitchSourceId: s.firstPhysicalPitchSourceId };
  const actionReference = reference('pa_dispatch_v1_action_plans', f.acceptedAction);
  const participantInputs = deriveSamePaDispatchRoles(f.actor, f.view).map(role => ({ member: role.member,
    calibrationReferences: f.acceptedCalibrations.calibrations.filter(v => v.source.member.playerId === role.member.playerId)
      .map(v => ({ route: v.source.route, calibrationReference: reference('pa_dispatch_v1_execution_calibrations', v) })) }));
  sources.set('native-consumers', { ...base, sourceId: 'native-consumers', capability: 'same_pa_consumer_set_v1', actionReference, participantInputs });
  const consumers = writer.acceptConsumerSet('native-consumers');
  if (consumers.kind !== 'consumer_set_prepared') throw new Error('genuine consumer set pending');
  const consumerSetReference = reference('pa_dispatch_v1_consumer_sets', consumers);
  sources.set('native-episode', { ...base, sourceId: 'native-episode', capability: 'same_pa_first_pitch_episode_v1', actionReference, consumerSetReference });
  const episode = writer.acceptEpisode('native-episode');
  if (episode.kind !== 'prospective_episode_prepared') throw new Error('genuine episode pending');
  sources.set('native-right', { ...base, sourceId: 'native-right', capability: 'same_pa_first_pitch_right_v1', actionReference, consumerSetReference,
    episodeReference: reference('pa_dispatch_v1_episodes', episode), prefixReference: f.view.source.prefixReference });
  const right = writer.acceptRight('native-right');
  if (right.kind !== 'immutable_right_prepared') throw new Error('genuine right pending');
  sources.set(s.firstPhysicalPitchSourceId, { sourceId: s.firstPhysicalPitchSourceId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_pitch_v1',
    actionReference, rightReference: reference('pa_dispatch_v1_rights', right) });
  const committed = writer.acceptPhysicalPitch(s.firstPhysicalPitchSourceId);
  if (committed.kind !== 'same_pa_first_pitch_executed_v1') throw new Error('genuine first TAKE pending');
  pitch = committed; fullRef = reference('pa_dispatch_v1_pitch_actions', committed);
}, 90_000);
afterAll(() => { writer?.close(); f?.close(); });
const read = (ref = fullRef) => readSamePaExecutedPitchFromSqlite(f.db, ref);
const phase = <T>(body: () => T) => withSqliteReadTransaction(f.db, () => withSamePaContinuationReadPhase(f.db, body));

// Scalar counters only: recording spies retain the returned Native statements
// and can change the workload being measured during this expensive replay.
function withModelProbe<T>(body: (counts: () => { batting: number; fielding: number }) => T): T {
  const db = f.db, original = db.prepare, own = Object.getOwnPropertyDescriptor(db, 'prepare');
  let batting = 0, fielding = 0;
  Object.defineProperty(db, 'prepare', { configurable: true, writable: true, value: function (sql: string) {
    if (sql.startsWith('SELECT * FROM main.world_player_batting_models WHERE source_id=? OR')) batting++;
    if (sql.startsWith("SELECT *, 'world_player_fielding_models' AS owner_table FROM world_player_fielding_models WHERE source_id=?")) fielding++;
    return original.call(db, sql);
  } });
  try { return body(() => ({ batting, fielding })); }
  finally { if (own) Object.defineProperty(db, 'prepare', own); else Reflect.deleteProperty(db, 'prepare'); }
}

it('shares one committed historical proof across sibling full-reference reads, and reauthenticates a new phase', () => {
  withModelProbe(counts => {
    let first!: Evidence, firstSql!: ReturnType<typeof counts>;
    phase(() => {
      first = withSamePaLifecycleReadPhase(f.db, () => read()); firstSql = counts();
      expect(firstSql.batting).toBeGreaterThan(0); expect(firstSql.fielding).toBeGreaterThan(0);
      expect(first.pitch).toEqual(pitch); expect(first.reference).toEqual(fullRef);
      expect(first.action).toEqual(f.acceptedAction); expect(first.consumer.calculation).toEqual(pitch.result);
      expect(first.pitch.originalActor.defenderBindings).toHaveLength(9);
      expect(f.acceptedCalibrations.calibrations).toHaveLength(32);
      expect(withSamePaLifecycleReadPhase(f.db, () => read({ ...fullRef }))).toEqual(first);
      expect(counts()).toEqual(firstSql);
    });
    phase(() => expect(read()).toEqual(first));
    expect(counts()).toEqual({ batting: firstSql.batting * 2, fielding: firstSql.fielding * 2 });
  });
});

it('freezes the entire returned wrapper and keeps independent operations and mismatched full pins separate', () => {
  phase(() => {
    const evidence = read(), before = hash(evidence), visited = new Set<object>();
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value); expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(visit);
    };
    visit(evidence); expect(Reflect.set(evidence, 'consumer', null)).toBe(false);
    expect(hash(read())).toBe(before);
  });
  withModelProbe(counts => withSqliteReadTransaction(f.db, () => {
    read(); const before = counts(); read();
    expect(counts().batting).toBeGreaterThan(before.batting);
    expect(counts().fielding).toBeGreaterThan(before.fielding);
  }));
  for (const change of [{ snapshotHash: hash('wrong-snapshot') }, { sourceHash: hash('wrong-source') }, { sourceId: 'missing-physical-pitch' }]) {
    let mismatch: unknown, retry: unknown;
    expect(() => phase(() => {
      read();
      try { read({ ...fullRef, ...change }); } catch (error) { mismatch = error; }
      try { read(); } catch (error) { retry = error; }
    })).toThrow(/phase expired/);
    expect(mismatch).toBeInstanceOf(Error); expect(String(retry)).toMatch(/phase expired/);
  }
});

it('refuses namespace or data changes before a completed hit and reauthenticates a corrupted original consumer kind', () => {
  for (const fault of ['namespace', 'DML'] as const) {
    let changed: unknown, retry: unknown;
    try {
      expect(() => phase(() => {
        read();
        if (fault === 'namespace') f.db.exec("ATTACH DATABASE ':memory:' AS unrelated_pitch_owner");
        else {
          f.db.exec('PRAGMA query_only=0');
          f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET snapshot_hash=snapshot_hash WHERE source_id=?').run(fullRef.sourceId);
          f.db.exec('PRAGMA query_only=1');
        }
        try { read(); } catch (error) { changed = error; }
        try { read(); } catch (error) { retry = error; }
      })).toThrow();
      expect(changed).toBeInstanceOf(Error); expect(String(retry)).toMatch(/phase expired/);
    } finally { if (fault === 'namespace') f.db.exec('DETACH DATABASE unrelated_pitch_owner'); }
  }
  // Raw corruption injection only. It never admits a different consumer kind.
  f.db.exec('SAVEPOINT historical_consumer_fault');
  try {
    const id = pitch.consumerReferences[0].sourceId;
    const row = f.db.prepare('SELECT snapshot_json FROM pa_dispatch_v1_consumer_actions WHERE source_id=?').get(id)!;
    const snapshot = JSON.parse(String(row.snapshot_json)); snapshot.kind = 'same_pa_observed_pitch_delivery_invocation_v1';
    f.db.prepare('UPDATE pa_dispatch_v1_consumer_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(JSON.stringify(snapshot), hash(snapshot), id);
    f.db.exec('PRAGMA query_only=1');
    expect(() => withSamePaContinuationReadPhase(f.db, () => read())).toThrow();
  } finally {
    f.db.exec('PRAGMA query_only=0'); f.db.exec('ROLLBACK TO historical_consumer_fault'); f.db.exec('RELEASE historical_consumer_fault');
  }
  expect(phase(() => read().pitch)).toEqual(pitch);
});

it('authenticates an independent fresh read after a caught physical child failure in the same parent snapshot', () => {
  withModelProbe(counts => phase(() => withBattedVenueLegalReadSnapshot(f.db, () => {
    const first = read(), before = counts();
    expect(first.pitch).toEqual(pitch);
    expect(before.batting).toBeGreaterThan(0); expect(before.fielding).toBeGreaterThan(0);
    expect(() => withBattedWorldPhysicalReadTraversal(f.db, () => {
      throw new Error('intentional historical physical child failure');
    })).toThrow('intentional historical physical child failure');
    // The failed child expires metadata reuse. It does not forbid a new fully
    // authenticated physical read whose result is independent of that proof.
    expect(read()).toEqual(first);
    expect(counts().batting).toBeGreaterThan(before.batting);
    expect(counts().fielding).toBeGreaterThan(before.fielding);
  })));
});

it('does not bypass a poisoned Continuation when the physical snapshot also requires a fresh read', () => {
  let physicalFailure: unknown, phaseFailure: unknown, retry: unknown;
  expect(() => phase(() => withBattedVenueLegalReadSnapshot(f.db, () => {
    read();
    try { withBattedWorldPhysicalReadTraversal(f.db, () => { throw Error('intentional physical snapshot failure'); }); }
    catch (error) { physicalFailure = error; }
    try { withSamePaContinuationReadPhase(f.db, () => { throw Error('intentional Native proof failure'); }); }
    catch (error) { phaseFailure = error; }
    try { read(); } catch (error) { retry = error; }
  }))).toThrow(/phase expired/);
  expect(String(physicalFailure)).toMatch(/intentional physical snapshot failure/);
  expect(String(phaseFailure)).toMatch(/intentional Native proof failure/);
  expect(String(retry)).toMatch(/phase expired/);
});
