import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { spinPracticeFixtureV123 } from './SpinMasteryV123.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readNativeDevelopmentEpisodeFromSqlite } from './NativeDevelopmentEpisodeFromSqlite';
import * as api from './SqliteSpinControlMasteryV123';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const inputs = (f: Awaited<ReturnType<typeof spinPracticeFixtureV123>>) => ({
  calibration: { sourceId: 'spin-qualification-calibration', sourceVersion: 'synthetic-test-v1', acceptedAtDay: 12,
    status: 'MODEL_VERIFIED' as const, technique: 'BACKSPIN' as const, minimumIntentionalContacts: 3,
    minimumDirectionalSpinRadPerSecond: 0.001, minimumSuccessFraction: 0.5 },
  source: { sourceId: 'mastery-backspin', sourceVersion: 'synthetic-test-v1', sourceEffectIdentity: 'player-p1-backspin',
    careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', acceptedAtDay: 17, technique: 'BACKSPIN' as const,
    exposureRef: { sourceId: f.exposure.source.sourceId, sourceVersion: f.exposure.source.sourceVersion,
      sourceHash: hash(f.exposure.source), snapshotHash: hash(f.exposure) },
    repertoireRef: { sourceId: f.batting.repertoire.sourceId, sourceVersion: f.batting.repertoire.sourceVersion },
    calibrationRef: { sourceId: 'spin-qualification-calibration', sourceVersion: 'synthetic-test-v1' }, distinctiveness: 0.9,
    policy: { policyId: 'synthetic-qualified-mastery', version: 'v1', availableAtDay: 10,
      minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1, minimumDistinctiveness: 0.8 } },
});

it('accepts only genuine intended batting contacts, retries frozen sources and restores offline without reapplying effects', async () => {
  const f = await spinPracticeFixtureV123(cleanup), { source, calibration } = inputs(f);
  expect(api.readNativeSpinControlMasteryV123).toBeTypeOf('function');
  expect(() => api.readNativeSpinControlMasteryV123(f.db, source.sourceId)).toThrow('active original snapshot');
  f.db.exec('BEGIN');
  try { expect(api.readNativeSpinControlMasteryV123(f.db, source.sourceId)).toBeNull(); }
  finally { f.db.exec('ROLLBACK'); }
  f.db.exec('BEGIN');
  const trace = vi.spyOn(f.db, 'prepare');
  try {
    const revision = f.exposure.episode.revision;
    expect(readNativeDevelopmentEpisodeFromSqlite(f.db, 'episode', revision)?.episode).toEqual(f.exposure.episode);
    const prefixes = trace.mock.calls.filter(([sql]) => /SELECT \* FROM world_development_initiations/.test(sql)).length;
    expect(prefixes, 'each original episode prefix is authenticated once per Native read invocation').toBeLessThanOrEqual(revision);
  } finally { trace.mockRestore(); f.db.exec('ROLLBACK'); }
  expect(f.observations.map(o => o.backspinSignedRadPerSecond)).toEqual(expect.arrayContaining([expect.any(Number)]));
  expect(f.observations.every(o => o.backspinRadPerSecond !== null && o.backspinRadPerSecond > 0.001), JSON.stringify(f.observations)).toBe(true);
  expect(api.openSqliteSpinControlMasteryV123).toBeTypeOf('function');
  const sources = new Map([[source.sourceId, source]]), calibrations = new Map([[calibration.sourceId, calibration]]);
  const owner = api.openSqliteSpinControlMasteryV123(f.path, {
    readAcceptedMastery: id => sources.get(id) ?? null, readAcceptedCalibration: id => calibrations.get(id) ?? null,
  }); cleanup.push(owner.close);
  const before = f.snapshot('world_player_workload_activities');
  calibrations.set(calibration.sourceId, { ...calibration, acceptedAtDay: 18 });
  expect(() => owner.accept(source.sourceId)).toThrow('future');
  calibrations.set(calibration.sourceId, calibration);
  sources.set(source.sourceId, { ...source, exposureRef: { ...source.exposureRef, snapshotHash: '0'.repeat(64) } });
  expect(() => owner.accept(source.sourceId)).toThrow('exposure');
  sources.set(source.sourceId, source);
  expect(owner.read(source.sourceId)).toBeNull();
  const admitted = owner.accept(source.sourceId);
  expect(admitted).toMatchObject({ boundary: 'NATIVE_SPIN_MASTERY_QUALIFICATION', nativeAdmission: true,
    projection: { effectiveStateId: 'BLUE_BACKSPIN', masteredTechniqueSet: ['BACKSPIN'] } });
  expect(admitted.contacts).toHaveLength(3);
  f.db.exec('BEGIN');
  try { expect(api.readNativeSpinControlMasteryV123(f.db, source.sourceId)).toEqual(admitted); }
  finally { f.db.exec('ROLLBACK'); }
  expect(owner.accept(source.sourceId)).toEqual(admitted);
  expect(f.snapshot('world_player_workload_activities')).toBe(before);
  sources.set(source.sourceId, { ...source, distinctiveness: 0.95 });
  expect(() => owner.accept(source.sourceId)).toThrow('frozen');
  sources.set(source.sourceId, source);
  f.closeAllOriginalOwners();
  const offline = api.openSqliteSpinControlMasteryV123(f.path); cleanup.push(offline.close);
  expect(offline.read(source.sourceId)).toEqual(admitted);
  expect(offline.selectAtDay('career-a', 'p1', 16).effectiveStateId).toBe('NONE');
  expect(offline.selectAtDay('career-a', 'p1', 17)).toMatchObject({ effectiveStateId: 'BLUE_BACKSPIN', masteredTechniqueSet: ['BACKSPIN'],
    motorQualifications: [{ technique: 'BACKSPIN', qualificationRef: { sourceId: source.sourceId, sourceVersion: source.sourceVersion },
      motorProfileRefs: [{ profileId: f.batting.repertoire.values.profiles[0].profile.profileId,
        version: f.batting.repertoire.values.profiles[0].profile.version }] }] });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite'), db = new DatabaseSync(f.path); cleanup.push(() => db.close());
  const futureForgery = { ...source, acceptedAtDay: 100 };
  db.prepare('UPDATE main.world_spin_mastery_v123 SET accepted_at_day=?,source_json=?,source_hash=? WHERE source_id=?')
    .run(100, json(futureForgery), hash(futureForgery), source.sourceId);
  expect(offline.selectAtDay('career-a', 'p1', 17)).toMatchObject({ effectiveStateId: 'NONE',
    rejected: [{ sourceId: source.sourceId, reason: 'ORIGINAL_SOURCE_INVALID' }] });
  db.prepare('UPDATE main.world_spin_mastery_v123 SET accepted_at_day=?,source_json=?,source_hash=? WHERE source_id=?')
    .run(source.acceptedAtDay, json(source), hash(source), source.sourceId);
  db.prepare('UPDATE main.world_spin_mastery_v123 SET snapshot_hash=? WHERE source_id=?').run('forged', source.sourceId);
  expect(() => offline.read(source.sourceId)).toThrow();
  expect(offline.selectAtDay('career-a', 'p1', 17)).toMatchObject({ effectiveStateId: 'NONE',
    masteredTechniqueSet: [], rejected: [{ sourceId: source.sourceId, technique: 'BACKSPIN', reason: 'ORIGINAL_SOURCE_INVALID' }] });
});

it('never certifies natural spin as deliberate skill even with consolidated technical practice and a claimed Gold name', async () => {
  const f = await spinPracticeFixtureV123(cleanup, false), { source, calibration } = inputs(f);
  const owner = api.openSqliteSpinControlMasteryV123(f.path, {
    readAcceptedMastery: () => source, readAcceptedCalibration: () => calibration,
  }); cleanup.push(owner.close);
  expect(() => owner.accept(source.sourceId)).toThrow('intent');
  expect(owner.read(source.sourceId)).toBeNull();
  expect(owner.selectAtDay('career-a', 'p1', 17).effectiveStateId).toBe('NONE');
});
