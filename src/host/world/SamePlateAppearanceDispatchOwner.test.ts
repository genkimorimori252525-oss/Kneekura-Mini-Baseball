import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dispatchOwnerFixture } from './SamePlateAppearanceDispatchOwner.test-support';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as actor from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertNoSamePaPlayerReservation } from './SamePlateAppearanceReservationGuard';
import { assertFreshPaDispatchEnrollment, assertNoPaDispatchPlayerClaim } from './SamePlateAppearanceDispatchClaimGuard';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import * as persons from './SqlitePlayerPersonLinkStore';
const modules = import.meta.glob('./SqliteSamePlateAppearanceDispatchStore.ts');
const implementation = async () => { const load = modules['./SqliteSamePlateAppearanceDispatchStore.ts']; expect(load, 'dispatch prerequisite owner missing').toBeTypeOf('function'); return await load() as any; };
const fixtures: ReturnType<typeof dispatchOwnerFixture>[] = [], owners: { close(): void }[] = [];
afterEach(() => { owners.splice(0).forEach(o => o.close()); fixtures.splice(0).forEach(f => f.close()); vi.restoreAllMocks(); });
const setup = async () => { const api = await implementation(), f = dispatchOwnerFixture(); fixtures.push(f); const owner = api.openSqliteSamePlateAppearanceDispatchStore(f.path, f.authority); owners.push(owner); return { ...f, owner, api }; };
it('DO01 missing accepted Sources stay pending and reads never bootstrap the exact namespace', async () => {
  const f = await setup(), before = rawCensus(f.db), schema = schemaCensus(f.db);
  expect(f.owner.acceptAction('missing')).toMatchObject({ kind: 'pending', missingAcceptedSourceIds: ['missing'] }); expect(f.owner.readAction('missing')).toBeNull();
  expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
});
it('DO02 exact action acceptance bootstraps ten tables and freezes the original actor geometry and delivery inputs', async () => {
  const f = await setup(), before = rawCensus(f.db), result = f.owner.acceptAction('action');
  expect(result.kind).toBe('action_prepared'); expect(result.source).toEqual(f.action); expect(result.roles).toEqual(f.roles);
  expect(f.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name GLOB 'pa_dispatch_v1_*'").get()!.n).toBe(10);
  expect(rawCensus(f.db).filter(r => !String(r.table).startsWith('pa_dispatch_v1_'))).toEqual(before);
  expect(f.owner.readAction('action')).toEqual(result);
});
it('DO03 foreign original actor equipment stale ready time and missing explicit geometry reject before schema writes', async () => {
  const f = await setup(), before = rawCensus(f.db), schema = schemaCensus(f.db);
  for (const change of [(s: any) => s.batterPlayerId = 'home-2', (s: any) => s.nominalPitch.batter.ballRadiusMeters = 0.04,
    (s: any) => s.nominalPitch.delivery.readyAtUs = 99, (s: any) => delete s.nominalPitch.batter.strikeZone]) {
    const s = structuredClone(f.action); change(s); f.accepted.set('action', s); expect(() => f.owner.acceptAction('action')).toThrow();
  }
  expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
});
it('DO04 one canonical exact32 calibration operation writes all32 once and retains each nominal and effective hash', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const before = rawCensus(f.db), read = vi.mocked(actor.readPhysicalPlateAppearanceActorFromSqlite); read.mockClear();
  const value = f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId)); expect(value.kind).toBe('execution_calibration_set'); expect(value.calibrations).toHaveLength(32);
  for (const [i, result] of value.calibrations.entries()) { expect(result.source).toEqual(f.calibrations[i]); expect(result.effectiveResponseHash).toBe(hash(result.source.response)); }
  expect(read.mock.calls.length).toBeLessThan(16); expect(f.db.prepare('SELECT count(*) AS n FROM pa_dispatch_v1_execution_calibrations').get()!.n).toBe(32);
  expect(rawCensus(f.db).filter(r => r.table !== 'pa_dispatch_v1_execution_calibrations')).toEqual(before.filter(r => r.table !== 'pa_dispatch_v1_execution_calibrations'));
  expect(f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId))).toEqual(value);
});
it('DO05 omitted duplicate aliased foreign and reused provenance calibration inputs cannot create partial sets', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const ids = f.calibrations.map(s => s.sourceId), before = rawCensus(f.db);
  expect(() => f.owner.acceptCalibrationSet(ids.slice(1))).toThrow(); expect(() => f.owner.acceptCalibrationSet([...ids.slice(1), ids[1]])).toThrow();
  const missing = ids[0]; f.accepted.delete(missing); expect(f.owner.acceptCalibrationSet(ids)).toMatchObject({ kind: 'pending', missingAcceptedSourceIds: [missing] }); f.accepted.set(missing, f.calibrations[0]);
  const s = structuredClone(f.calibrations[1]); s.member.projectedStateHash = hash('foreign'); f.accepted.set(s.sourceId, s); expect(() => f.owner.acceptCalibrationSet(ids)).toThrow();
  f.accepted.set(s.sourceId, { ...f.calibrations[1], provenance: f.calibrations[0].provenance }); expect(() => f.owner.acceptCalibrationSet(ids)).toThrow();
  expect(rawCensus(f.db)).toEqual(before);
});
it('DO06 exact retry uses historical view while fresh prerequisite acceptance rejects actual v2 work', async () => {
  const f = await setup(), saved = f.owner.acceptAction('action');
  f.db.prepare('INSERT INTO pa_dispatch_v1_pitch_heads VALUES(?,?,?,?,?,?,?,?)').run('enrollment', 'career-a', 'game', 1, 'first-pitch', 1, 'first-pitch', hash('future'));
  expect(() => f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId))).toThrow(/dispatch/);
  vi.mocked(actor.assertPhysicalActorOpenFrame).mockImplementation(() => { throw new Error('fresh frame unavailable'); });
  expect(f.owner.readAction('action')).toEqual(saved); expect(f.owner.acceptAction('action')).toEqual(saved);
  expect(() => f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId))).toThrow();
});
it('DO10 partial live authority cannot hide a changed saved calibration Source on exact retry', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const ids = f.calibrations.map(s => s.sourceId); f.owner.acceptCalibrationSet(ids);
  f.accepted.delete(ids[0]); f.accepted.set(ids[1], { ...f.calibrations[1], sourceVersion: 'changed' });
  expect(() => f.owner.acceptCalibrationSet(ids)).toThrow(/frozen|differs/);
});
const nativePrototype = () => (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync.prototype;
it('DO11 actual forced commit preserves all32 durable rows and retires the owner without compensating repair', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const proto = nativePrototype(), prepare = proto.prepare; let forced = 0;
  vi.spyOn(proto, 'prepare').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    const statement = prepare.call(this, sql);
    if (sql.startsWith('INSERT INTO main.pa_dispatch_v1_execution_calibrations')) {
      const run = statement.run.bind(statement), db = this;
      statement.run = ((...args: Parameters<typeof statement.run>) => { const result = run(...args); db.exec('COMMIT'); forced++; return result; }) as typeof statement.run;
    }
    return statement;
  });
  expect(() => f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId))).toThrow(/retired/); expect(forced).toBe(1);
  expect(f.db.prepare('SELECT count(*) AS n FROM pa_dispatch_v1_execution_calibrations').get()!.n).toBe(32);
  expect(() => f.owner.readAction('action')).toThrow(/retired|closed/);
});
it('DO12 unexpected durable mutation at the single INSERT rolls back every calibration row', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const before = rawCensus(f.db), proto = nativePrototype(), prepare = proto.prepare;
  vi.spyOn(proto, 'prepare').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    const statement = prepare.call(this, sql);
    if (sql.startsWith('INSERT INTO main.pa_dispatch_v1_execution_calibrations')) {
      const run = statement.run.bind(statement), db = this;
      statement.run = ((...args: Parameters<typeof statement.run>) => { const result = run(...args); prepare.call(db, "UPDATE pa_dispatch_v1_action_plans SET source_version='unexpected'").run(); return result; }) as typeof statement.run;
    }
    return statement;
  });
  expect(() => f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId))).toThrow(); expect(rawCensus(f.db)).toEqual(before);
});
it('DO13 calibrations wait for the canonical action without inventing a Source id or bootstrapping storage', async () => {
  const f = await setup(), schema = schemaCensus(f.db), value = f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId));
  expect(value).toMatchObject({ kind: 'pending', missingAcceptedSourceIds: [], prerequisites: [{ playerId: 'home-1', route: 'pitch_delivery', reason: 'missing_action_plan' }] });
  expect(schemaCensus(f.db)).toEqual(schema);
});
it('DO14 surviving prerequisite dependencies reject recreation of a deleted action without repair', async () => {
  const f = await setup(); f.owner.acceptAction('action'); f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId));
  f.db.exec('DELETE FROM pa_dispatch_v1_action_plans'); const before = rawCensus(f.db);
  expect(() => f.owner.acceptAction('action')).toThrow(/dispatch/); expect(rawCensus(f.db)).toEqual(before);
});
it('DO15 moved future indexes cannot hide a typed reference to the original prospective action', async () => {
  const f = await setup(), action = f.owner.acceptAction('action'), other = enrollmentFixture('-other'); owners.push(other);
  const otherOwner = openSqliteSamePlateAppearanceEnrollmentStore(other.path, { readAcceptedEnrollment: () => other.source });
  try { expect(otherOwner.accept(other.source.sourceId).kind).toBe('reserved'); } finally { otherOwner.close(); }
  for (const row of other.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
    const table = String(row.name);
    for (const value of other.db.prepare('SELECT * FROM ' + table).all()) f.db.prepare('INSERT OR IGNORE INTO ' + table + ' VALUES(' + Object.keys(value).map(() => '?').join(',') + ')').run(...Object.values(value));
  }
  f.db.prepare('INSERT INTO pa_dispatch_v1_pitch_actions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('moved-future', 'fixture-v1', 'career-a', 'game-other', 1,
    'enrollment-other', 'first-pitch-other', 'moved-view', 'opaque-right', 'opaque-episode', 1, '"opaque future source"', hash('opaque'), '"opaque future payload"', hash('opaque'));
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).not.toThrow();
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?').run(JSON.stringify({ actionReference: reference('pa_dispatch_v1_action_plans', action) }));
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?').run(JSON.stringify({ actionReference: { ...reference('pa_dispatch_v1_action_plans', action), sourceId: 'missing-action' } }));
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?,snapshot_json=?').run('"opaque future source"', JSON.stringify({ lineage: { actorReference: f.enrollment.source.actorReference } }));
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?,snapshot_json=?').run(JSON.stringify({ prefixReference: reference('reserved_pa_work_prefixes', f.prefix) }), '"opaque future payload"');
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  for (const originalReference of [f.view.source.participantTotalReferences[0].assessmentReference, f.base.viewReference]) {
    f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?,snapshot_json=?').run('"opaque future source"', JSON.stringify({ originalReference }));
    expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  }
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET source_json=?,snapshot_json=?').run('"opaque future source"', JSON.stringify({ lineage: { gameId: 'game', playId: 1 } }));
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).toThrow(/dispatch/);
  f.db.exec('DELETE FROM pa_dispatch_v1_action_plans');
  f.db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET career_id=?,source_json=?,snapshot_json=?').run('moved-career', JSON.stringify({ member: f.roles[0].member }), '"opaque future payload"');
  expect(() => assertFreshPaDispatchEnrollment(f.db, 'enrollment')).not.toThrow();
  expect(() => assertNoPaDispatchPlayerClaim(f.db, { careerId: 'career-a', playerId: 'away-2' })).toThrow(/dispatch/);
});
it('DO16 a nominal pitcher Person mismatch cannot hide behind an equal career and Player identity', async () => {
  const f = await setup(), original = f.actor.defenderPersons[0];
  vi.spyOn(persons, 'playerPersonLinkEvidenceFromSqlite').mockReturnValue({ readLink: () => ({ ...original, personId: 'different-person' }) });
  expect(() => f.owner.acceptAction('action')).toThrow(/Person|person/);
});
it('DO07 unsupported consumers episodes and rights remain precisely pending and create no prospective work rows', async () => {
  const f = await setup(), action = f.owner.acceptAction('action'), set = f.owner.acceptCalibrationSet(f.calibrations.map(s => s.sourceId));
  const participants = f.roles.map(role => ({ member: role.member, calibrationReferences: set.calibrations.filter((v: any) => v.source.member.playerId === role.member.playerId).map((v: any) => ({ route: v.source.route, calibrationReference: reference('pa_dispatch_v1_execution_calibrations', v) })) }));
  const consumer = { ...f.base, sourceId: 'consumers', capability: 'same_pa_consumer_set_v1', actionReference: reference('pa_dispatch_v1_action_plans', action), participantInputs: participants }; f.accepted.set('consumers', consumer);
  const pending = f.owner.acceptConsumerSet('consumers'); expect(pending.kind).toBe('pending'); expect(pending.prerequisites.filter((p: any) => p.reason === 'unsupported_core_adapter')).toHaveLength(32);
  const dummy = { owner: 'pa_dispatch_v1_consumer_sets', sourceId: 'consumers', sourceHash: hash(consumer), snapshotHash: hash('not-accepted') };
  const episode = { ...f.base, sourceId: 'episode', capability: 'same_pa_first_pitch_episode_v1', actionReference: consumer.actionReference, consumerSetReference: dummy }; f.accepted.set('episode', episode);
  expect(f.owner.acceptEpisode('episode')).toMatchObject({ kind: 'pending', missingAcceptedSourceIds: ['consumers'] });
  f.accepted.set('right', { ...f.base, sourceId: 'right', capability: 'same_pa_first_pitch_right_v1', actionReference: consumer.actionReference, consumerSetReference: dummy,
    prefixReference: reference('reserved_pa_work_prefixes', f.prefix), episodeReference: { owner: 'pa_dispatch_v1_episodes', sourceId: 'episode', sourceHash: hash(episode), snapshotHash: hash('not-accepted') } });
  expect(f.owner.acceptRight('right')).toMatchObject({ kind: 'pending', missingAcceptedSourceIds: ['consumers', 'episode'] });
  for (const table of ['consumer_sets', 'episodes', 'rights', 'consumer_actions', 'pitch_actions', 'pitch_heads', 'consumptions', 'episode_admissions']) expect(f.db.prepare('SELECT count(*) AS n FROM pa_dispatch_v1_' + table).get()!.n).toBe(0);
});
it('DO08 changed Sources nominal owners raw aliases and partial calibration rows reject without repair', async () => {
  const f = await setup(); f.owner.acceptAction('action'); const ids = f.calibrations.map(s => s.sourceId); f.owner.acceptCalibrationSet(ids);
  const alias = { ...f.action, sourceId: 'alias' }; f.accepted.set('alias', alias); expect(() => f.owner.acceptAction('alias')).toThrow(/canonical|alias/);
  f.accepted.set('action', { ...f.action, sourceVersion: 'changed' }); expect(() => f.owner.acceptAction('action')).toThrow(); f.accepted.set('action', f.action);
  f.db.prepare('DELETE FROM pa_dispatch_v1_execution_calibrations WHERE source_id=?').run(ids[0]); const before = rawCensus(f.db); expect(() => f.owner.acceptCalibrationSet(ids)).toThrow(/partial|mixed/); expect(rawCensus(f.db)).toEqual(before);
});
it('DO09 deletion of both older namespaces cannot free original player or pitch claims', async () => {
  const f = await setup(); f.owner.acceptAction('action');
  for (const row of f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'same_pa_*' OR name GLOB 'reserved_pa_*')").all()) f.db.exec('DROP TABLE ' + row.name);
  expect(() => assertNoSamePaPlayerReservation(f.db, { careerId: 'career-a', playerId: 'away-2' })).toThrow(/dispatch/);
  expect(() => f.owner.readAction('action')).toThrow();
});
