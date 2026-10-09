import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaExecutedPitchFromSqlite, readSamePaPreparedActionFromSqlite,
  readSamePaExecutionCalibrationFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { openSqliteSamePlateAppearanceTakeSuccessorStore } from './SqliteSamePlateAppearanceTakeSuccessorStore';
import { samePaTakeTables } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { prepareSamePaSceneBodies } from './SamePlateAppearanceSceneBodies.test-support';
import { prepareSamePaNonemptyFixture } from './SamePlateAppearanceNonemptyFixture.test-support';
import { openSqliteSamePlateAppearanceContinuationStore } from './SqliteSamePlateAppearanceContinuationStore';
import { readCurrentSamePaContinuationViewFromSqlite, readHistoricalSamePaContinuationViewFromSqlite, readSamePaContinuationCalibrationFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { samePaContinuationSchema } from './SamePlateAppearanceContinuationStorage';
import { assertNoSamePaPlayerReservation } from './SamePlateAppearanceReservationGuard';
import { samePaPitchConsumerSourceInput } from './SamePlateAppearanceDispatchExecution';

/** Integrated production Native scenario. No mocked actor/model proof, route
 * registry override, transformed module or genuine database participates. The
 * only interception is a precisely attributed SQLite transaction fault below. */
let f: ReturnType<typeof directNativeDispatchFixture>;
let sources: Map<string, unknown>, physicalId: string;
const actualTables = ['pa_dispatch_v1_consumer_actions', 'pa_dispatch_v1_pitch_actions', 'pa_dispatch_v1_pitch_heads',
  'pa_dispatch_v1_consumptions', 'pa_dispatch_v1_episode_admissions'];
const owners: { close(): void }[] = [];
const open = () => {
  const owner = openSqliteSamePlateAppearanceDispatchStore(f.path, { readAcceptedConsumerSet: id => sources.get(id),
    readAcceptedEpisode: id => sources.get(id), readAcceptedRight: id => sources.get(id), readAcceptedPhysicalPitch: id => sources.get(id) });
  owners.push(owner); return owner;
};
beforeAll(() => {
  f = directNativeDispatchFixture(); sources = new Map();
  const s = f.acceptedAction.source, base = { sourceVersion: 'fixture-only-v1', enrollmentReference: s.enrollmentReference,
    viewReference: s.viewReference, firstPhysicalPitchSourceId: s.firstPhysicalPitchSourceId };
  const actionReference = reference('pa_dispatch_v1_action_plans', f.acceptedAction), owner = open();
  const participantInputs = deriveSamePaDispatchRoles(f.actor, f.view).map(role => ({ member: role.member,
    calibrationReferences: f.acceptedCalibrations.calibrations.filter(v => v.source.member.playerId === role.member.playerId)
      .map(v => ({ route: v.source.route, calibrationReference: reference('pa_dispatch_v1_execution_calibrations', v) })) }));
  sources.set('native-consumers', { ...base, sourceId: 'native-consumers', capability: 'same_pa_consumer_set_v1', actionReference, participantInputs });
  const consumers = owner.acceptConsumerSet('native-consumers');
  if (consumers.kind !== 'consumer_set_prepared') throw new Error('integrated real adapter readiness is not complete');
  const consumerSetReference = reference('pa_dispatch_v1_consumer_sets', consumers);
  sources.set('native-episode', { ...base, sourceId: 'native-episode', capability: 'same_pa_first_pitch_episode_v1', actionReference, consumerSetReference });
  const episode = owner.acceptEpisode('native-episode'); if (episode.kind !== 'prospective_episode_prepared') throw new Error('integrated episode pending');
  sources.set('native-right', { ...base, sourceId: 'native-right', capability: 'same_pa_first_pitch_right_v1', actionReference, consumerSetReference,
    episodeReference: reference('pa_dispatch_v1_episodes', episode), prefixReference: f.view.source.prefixReference });
  const right = owner.acceptRight('native-right'); if (right.kind !== 'immutable_right_prepared') throw new Error('integrated right pending');
  physicalId = s.firstPhysicalPitchSourceId;
  sources.set(physicalId, { sourceId: physicalId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_pitch_v1',
    actionReference, rightReference: reference('pa_dispatch_v1_rights', right) });
}, 120_000);
beforeEach(() => {
  // Reset only this in-process synthetic scenario's additive rows, children
  // before roots. Genuine databases and protected original rows are not inputs.
  for (const row of f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'pa_take_successor_v1_*' OR name GLOB 'batting_observation_v1_*' OR name GLOB 'batting_prediction_v1_*' OR name GLOB 'batting_score_v1_*')").all()) {
    f.db.exec('DELETE FROM \"' + String(row.name).replaceAll('\"', '\"\"') + '\"');
  }
  for (const table of Object.keys(samePaContinuationSchema).reverse()) if (f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) f.db.exec('DELETE FROM ' + table);
  for (const table of [...actualTables].reverse()) f.db.exec('DELETE FROM ' + table); });
afterEach(() => { vi.restoreAllMocks(); owners.splice(0).forEach(o => o.close()); });
afterAll(() => f?.close());
const readonly = <T>(body: () => T) => {
  f.db.exec('BEGIN; PRAGMA query_only=1');
  try { return body(); } finally { f.db.exec('PRAGMA query_only=0; ROLLBACK'); }
};
const count = () => actualTables.map(t => Number(f.db.prepare('SELECT count(*) AS n FROM ' + t).get()!.n));
const nativePrototype = () => (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync.prototype;

it('AX01 declared TAKE appends exactly five owned rows and replays unchanged after reopening', () => {
  const before = rawCensus(f.db), schema = schemaCensus(f.db), owner = open(), pitch = owner.acceptPhysicalPitch(physicalId);
  expect(pitch.kind).toBe('same_pa_first_pitch_executed_v1'); if (pitch.kind === 'pending') throw new Error('unexpected pending');
  expect(count()).toEqual([1, 1, 1, 1, 1]); expect(pitch.consumerReferences).toHaveLength(1);
  expect(pitch.result.trajectory.start.velocity.z).toBeCloseTo(-27);
  expect(pitch.frame.reservedActualState.revision).toBe(1); expect(pitch.frame.projectedExecutionState.revision).toBe(2);
  expect(rawCensus(f.db).filter(r => !actualTables.includes(String(r.table)))).toEqual(before.filter(r => !actualTables.includes(String(r.table))));
  expect(schemaCensus(f.db)).toEqual(schema); expect(f.x.f.workload.readHead('career-a', 'p2')!.revision).toBe(1);
  const after = rawCensus(f.db); expect(owner.acceptPhysicalPitch(physicalId)).toEqual(pitch); owner.close();
  expect(open().readPhysicalPitch(physicalId)).toEqual(pitch); expect(rawCensus(f.db)).toEqual(after);
  const evidence = readonly(() => readSamePaExecutedPitchFromSqlite(f.db, reference('pa_dispatch_v1_pitch_actions', pitch)));
  expect(evidence.pitch).toEqual(pitch); expect(evidence.action).toEqual(f.acceptedAction);
  expect(evidence.consumer.calculation).toEqual(pitch.result);
  expect(evidence.consumer.source.originalInputReferences.actionReference).toEqual(f.request.actionReference);
  expect(() => assertFreshPaDispatchEnrollment(f.db, f.view.lineage.enrollmentReference.sourceId)).toThrow();
});
it('AX02 accepted action and calibration readers authenticate exact saved originals without fresh admission', () => {
  const before = rawCensus(f.db);
  expect(() => readSamePaPreparedActionFromSqlite(f.db, f.request.actionReference)).toThrow(/query-only/);
  readonly(() => {
    expect(readSamePaPreparedActionFromSqlite(f.db, f.request.actionReference)).toEqual(f.acceptedAction);
    expect(readSamePaExecutionCalibrationFromSqlite(f.db, f.request.calibrationReference)).toEqual(f.pitchCalibration);
    expect(() => readSamePaExecutionCalibrationFromSqlite(f.db, { ...f.request.calibrationReference, snapshotHash: hash('changed') })).toThrow();
  });
  expect(rawCensus(f.db)).toEqual(before);
});
it('AX03 consumer Source rejects foreign original-owner refs and future result fields', () => {
  const pitch = open().acceptPhysicalPitch(physicalId); if (pitch.kind === 'pending') throw new Error('unexpected pending');
  const evidence = readonly(() => readSamePaExecutedPitchFromSqlite(f.db, reference('pa_dispatch_v1_pitch_actions', pitch))), source = evidence.consumer.source;
  expect(samePaPitchConsumerSourceInput(source)).toEqual(source);
  expect(() => samePaPitchConsumerSourceInput({ ...source, physicalSourceReference: { ...source.physicalSourceReference, snapshotHash: hash('future') } })).toThrow();
  expect(() => samePaPitchConsumerSourceInput({ ...source, originalInputReferences: { ...source.originalInputReferences,
    actionReference: { ...source.originalInputReferences.actionReference, owner: 'physical_pitch_actions' } } })).toThrow();
});
it('AX04 missing any committed companion rejects replay and never repairs the retained rows', () => {
  const owner = open(); owner.acceptPhysicalPitch(physicalId);
  for (const table of actualTables) {
    const rows = f.db.prepare('SELECT * FROM ' + table).all(); f.db.exec('DELETE FROM ' + table);
    const before = rawCensus(f.db);
    expect(() => owner.readPhysicalPitch(physicalId)).toThrow(); expect(() => owner.acceptPhysicalPitch(physicalId)).toThrow(); expect(rawCensus(f.db)).toEqual(before);
    for (const row of rows) f.db.prepare('INSERT INTO ' + table + ' VALUES(' + Object.keys(row).map(() => '?').join(',') + ')').run(...Object.values(row));
  }
});
it('AX05 each owned INSERT failure rolls back its whole prefix and a fresh retry succeeds', () => {
  const proto = nativePrototype(), original = proto.prepare;
  for (const table of actualTables) {
    const before = rawCensus(f.db); let hit = false;
    const spy = vi.spyOn(proto, 'prepare').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
      const statement = original.call(this, sql);
      if (sql.startsWith('INSERT INTO main.' + table + ' ')) statement.run = (() => { hit = true; throw new Error('injected owned row failure'); }) as typeof statement.run;
      return statement;
    });
    expect(() => open().acceptPhysicalPitch(physicalId)).toThrow(/injected/); spy.mockRestore();
    expect(hit).toBe(true); expect(rawCensus(f.db)).toEqual(before);
  }
  expect(open().acceptPhysicalPitch(physicalId).kind).toBe('same_pa_first_pitch_executed_v1'); expect(count()).toEqual([1, 1, 1, 1, 1]);
});
it('AX06 forced commit after an INSERT retains that durable prefix and retires without false rollback or repair', () => {
  const proto = nativePrototype(), original = proto.prepare; let hit = false;
  const owner = open(), spy = vi.spyOn(proto, 'prepare').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    const statement = original.call(this, sql);
    if (sql.startsWith('INSERT INTO main.pa_dispatch_v1_pitch_actions ')) {
      const run = statement.run.bind(statement), db = this;
      statement.run = ((...args: Parameters<typeof statement.run>) => { const result = run(...args); db.exec('COMMIT'); hit = true; return result; }) as typeof statement.run;
    }
    return statement;
  });
  expect(() => owner.acceptPhysicalPitch(physicalId)).toThrow(/retired/); spy.mockRestore(); expect(hit).toBe(true);
  expect(count()).toEqual([1, 1, 0, 0, 0]); expect(() => owner.readPhysicalPitch(physicalId)).toThrow(/retired|closed/);
  const before = rawCensus(f.db); expect(() => open().acceptPhysicalPitch(physicalId)).toThrow(); expect(rawCensus(f.db)).toEqual(before);
});

it('AX07 nonempty physical cut and ten explicit TOTALs project once from the original reservation and bind new32 responses', () => {
  const pitch = open().acceptPhysicalPitch(physicalId); if (pitch.kind === 'pending') throw new Error('unexpected pending');
  const before = rawCensus(f.db), accepted = new Map<string, unknown>();
  const continuation = openSqliteSamePlateAppearanceContinuationStore(f.path, { readAcceptedPrefix: id => accepted.get(id), readAcceptedTotal: id => accepted.get(id),
    readAcceptedView: id => accepted.get(id), readAcceptedCalibration: id => accepted.get(id) });
  try {
    const prefixSource = { sourceId: 'native-nonempty-prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_completed_take_prefix_v1',
      enrollmentReference: pitch.lineage.enrollmentReference, originalViewReference: pitch.viewReference,
      pitchReference: reference('pa_dispatch_v1_pitch_actions', pitch), operationReferences: [] };
    accepted.set(prefixSource.sourceId, prefixSource); const prefix = continuation.acceptPrefix(prefixSource.sourceId);
    if (prefix.kind === 'pending') throw new Error('unexpected pending prefix');
    expect(prefix.endpoint.crossing).toEqual(pitch.result.resolution.physical.kind === 'taken' ? pitch.result.resolution.physical.result.crossing : null);
    const prefixReference = reference('pa_continuation_v1_work_prefixes', prefix);
    // Existing explicit synthetic effortUnits=2, separately accepted for each
    // participant and bound to the exact completed-work prefix. No estimator.
    const totals = prefix.lineage.participantReferences.map(p => ({ sourceId: 'native-nonempty-total:' + p.playerId, sourceVersion: 'fixture-only-v1',
      capability: 'same_pa_nonempty_cumulative_total_v1', enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantReference: p, effortUnits: 2,
      provenance: { assessmentSourceId: 'native-nonempty-assessment:' + p.playerId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-fixture-total-2', calibrationVersion: 'fixture-only-v1' } }));
    totals.forEach(s => accepted.set(s.sourceId, s)); const totalSet = continuation.acceptTotalSet(totals.map(s => s.sourceId));
    if (totalSet.kind !== 'nonempty_total_set') throw new Error('unexpected pending TOTAL set');
    const viewSource = { sourceId: 'native-nonempty-view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_nonempty_cumulative_view_v1',
      enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantTotalReferences: totalSet.participantTotalReferences };
    accepted.set(viewSource.sourceId, viewSource); const view = continuation.acceptView(viewSource.sourceId); if (view.kind === 'pending') throw new Error('unexpected pending view');
    const viewReference = reference('pa_continuation_v1_execution_views', view), basis = readonly(() => readCurrentSamePaContinuationViewFromSqlite(f.db, viewReference));
    expect(basis.actor).toEqual(f.actor); expect(basis.members).toHaveLength(10);
    const pitcher = view.participants.find(p => p.playerId === f.pitchCalibration.source.member.playerId)!;
    expect(pitcher.reservedState.fatigue).toBeCloseTo(0.2); expect(pitcher.projectedState.fatigue).toBeCloseTo(0.4);
    expect(pitcher.reservedState.revision).toBe(1); expect(pitcher.projectedState.revision).toBe(2);
    const calibrations = f.acceptedCalibrations.calibrations.map(c => ({ ...c.source, sourceId: 'nonempty:' + c.source.sourceId,
      capability: 'same_pa_nonempty_execution_calibration_v1', viewReference, member: basis.members.find(m => m.playerId === c.source.member.playerId)!,
      provenance: { ...c.source.provenance, assessmentSourceId: 'nonempty:' + c.source.provenance.assessmentSourceId } }));
    calibrations.forEach(s => accepted.set(s.sourceId, s)); const calibrationSet = continuation.acceptCalibrationSet(calibrations.map(s => s.sourceId));
    if (calibrationSet.kind !== 'nonempty_calibration_set') throw new Error('unexpected pending calibration set');
    const calibration = calibrationSet.calibrations.find(c => c.source.route === 'pitch_delivery')!;
    expect(readonly(() => readSamePaContinuationCalibrationFromSqlite(f.db, reference('pa_continuation_v1_execution_calibrations', calibration)))).toEqual(calibration);
    expect(readonly(() => readHistoricalSamePaContinuationViewFromSqlite(f.db, viewReference)).view).toEqual(view);
    expect(continuation.acceptPrefix(prefixSource.sourceId)).toEqual(prefix); expect(continuation.acceptView(viewSource.sourceId)).toEqual(view);
    expect(() => assertNoSamePaPlayerReservation(f.db, { careerId: pitch.lineage.careerId, playerId: f.actor.binding.playerId })).toThrow();
    expect(rawCensus(f.db).filter(r => !String(r.table).startsWith('pa_continuation_v1_'))).toEqual(before.filter(r => !String(r.table).startsWith('pa_continuation_v1_')));
    expect(f.x.f.workload.readHead('career-a', 'p2')!.revision).toBe(1);
    const row = f.db.prepare('SELECT * FROM pa_continuation_v1_total_assessments WHERE source_id=?').get(totals[0].sourceId)!;
    f.db.prepare('DELETE FROM pa_continuation_v1_total_assessments WHERE source_id=?').run(totals[0].sourceId);
    const missing = rawCensus(f.db); expect(() => continuation.acceptTotalSet(totals.map(s => s.sourceId))).toThrow(/missing|partial|repair/); expect(rawCensus(f.db)).toEqual(missing);
    f.db.prepare('INSERT INTO pa_continuation_v1_total_assessments VALUES(' + Object.keys(row).map(() => '?').join(',') + ')').run(...Object.values(row));
  } finally { continuation.close(); }
});
it('AX08 lost COMMIT acknowledgement preserves all five durable rows and reopen authenticates the full result', () => {
  const proto = nativePrototype(), original = proto.exec, owner = open(); let committed = false;
  const spy = vi.spyOn(proto, 'exec').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    const complete = sql === 'COMMIT' && !committed
      && this.prepare('SELECT count(*) AS n FROM pa_dispatch_v1_episode_admissions').get()!.n === 1;
    const result = original.call(this, sql);
    if (complete) { committed = true; throw new Error('injected lost COMMIT acknowledgement'); }
    return result;
  });
  expect(() => owner.acceptPhysicalPitch(physicalId)).toThrow(/retired/); spy.mockRestore();
  expect(committed).toBe(true); expect(count()).toEqual([1, 1, 1, 1, 1]);
  const before = rawCensus(f.db), reopened = open(), pitch = reopened.readPhysicalPitch(physicalId);
  expect(pitch?.kind).toBe('same_pa_first_pitch_executed_v1'); expect(reopened.acceptPhysicalPitch(physicalId)).toEqual(pitch);
  expect(rawCensus(f.db)).toEqual(before);
});

it('AX09 real retained-body setup admits one second TAKE from the current cumulative view and preserves the PA/count lineage', () => {
  const first = open().acceptPhysicalPitch(physicalId); if (first.kind === 'pending') throw new Error('unexpected pending first pitch');
  const efforts = Object.fromEntries(first.lineage.participantReferences.map(p => [p.playerId, 2]));
  const current = prepareSamePaNonemptyFixture(f, first, 'native-next', efforts, []), sceneBodyReferences = prepareSamePaSceneBodies(f);
  const accepted = new Map<string, unknown>(), next = openSqliteSamePlateAppearanceTakeSuccessorStore(f.path, {
    readAcceptedAction: id => accepted.get(id), readAcceptedSetup: id => accepted.get(id), readAcceptedPhysicalPitch: id => accepted.get(id) }); owners.push(next);
  const readyAtUs = Math.max(first.result.resolution.timeline.lastEventTick, first.result.delivery.timeline.followThroughEndUs, current.view.evaluationTick);
  const original = f.acceptedAction.source, actionSource = { sourceId: 'native-next-action', sourceVersion: 'fixture-only-v1', capability: 'same_pa_next_take_action_v1',
    viewReference: current.viewReference, previousPitchReference: reference('pa_dispatch_v1_pitch_actions', first),
    nominalPitch: { ...original.nominalPitch, delivery: { ...original.nominalPitch.delivery, readyAtUs } }, timingReference: original.timingReference,
    releaseReference: original.releaseReference, pitchResponseReference: original.pitchResponseReference, batterModelReference: original.batterModelReference };
  accepted.set(actionSource.sourceId, actionSource); const action = next.acceptAction(actionSource.sourceId); if (action.kind === 'pending') throw new Error('unexpected pending next action');
  const actionReference = reference('pa_take_successor_v1_action_plans', action), nextPhysicalPitchSourceId = 'native-second-pitch';
  // Explicit fixture posture measurements repeat only the published numerical
  // declaration; no protected stance Source/receipt is copied or accepted.
  const postureSource = { sourceId: 'native-next-posture', sourceVersion: 'fixture-only-v1', capability: 'owned_next_take_batting_posture_v1',
    viewReference: current.viewReference, member: current.basis.members.find(m => m.playerId === f.actor.binding.playerId)!, actionReference,
    nextPhysicalPitchSourceId, modelReference: action.source.batterModelReference, sceneBodyReferences,
    geometry: { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: action.bodyCut.completedAtTick, validUntilTick: readyAtUs + 20_000_000,
      ticksPerSecond: 1_000_000, handedness: 'R', centerOfMass: { x: -0.78, y: 1, z: -0.16 }, eyePosition: { x: -0.78, y: 1.6, z: -0.16 },
      observerForward: { x: 0, y: 0, z: 1 }, attention: { target: { kind: 'ball' }, focusedSinceTick: action.bodyCut.completedAtTick },
      bodyReadyTick: readyAtUs, latestMotorStartTick: readyAtUs, plateZ: action.source.nominalPitch.batter.plateZ, strikeZone: action.source.nominalPitch.batter.strikeZone },
    provenance: { assessmentSourceId: 'native-next-posture-assessment', assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-stationary-body-fixture', calibrationVersion: 'fixture-only-v1' } };
  accepted.set(postureSource.sourceId, postureSource);
  const perception = openSqliteBattingPerceptionStore(f.path, { readAcceptedPosture: id => accepted.get(id) }); owners.push(perception);
  const posture = perception.acceptPosture(postureSource.sourceId); if (posture.kind !== 'batting_invocation_posture') throw new Error('unexpected pending next posture');
  const participantInputs = current.basis.members.map(member => ({ member, calibrationReferences: current.calibrationSet.calibrations
    .filter(c => c.source.member.playerId === member.playerId).map(c => ({ route: c.source.route, calibrationReference: reference('pa_continuation_v1_execution_calibrations', c) })) }));
  const setupSource = { sourceId: 'native-next-setup', sourceVersion: 'fixture-only-v1', capability: 'same_pa_retained_take_setup_v1', actionReference,
    postureReference: reference('batting_observation_v1_postures', posture), nextPhysicalPitchSourceId, participantInputs };
  accepted.set(setupSource.sourceId, setupSource); const setup = next.acceptSetup(setupSource.sourceId); if (setup.kind === 'pending') throw new Error('unexpected pending next right');
  accepted.set(nextPhysicalPitchSourceId, { sourceId: nextPhysicalPitchSourceId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_successor_take_pitch_v1',
    actionReference, setupReference: reference('pa_take_successor_v1_setups', setup) });
  const before = rawCensus(f.db), proto = nativePrototype(), prepare = proto.prepare; let fault = false;
  const spy = vi.spyOn(proto, 'prepare').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    const statement = prepare.call(this, sql); if (sql.startsWith('INSERT INTO main.' + samePaTakeTables.head + ' ')) statement.run = (() => {
      fault = true; throw new Error('injected successor head failure'); }) as typeof statement.run; return statement;
  });
  expect(() => next.acceptPhysicalPitch(nextPhysicalPitchSourceId)).toThrow(/injected successor head failure/); spy.mockRestore(); expect(fault).toBe(true); expect(rawCensus(f.db)).toEqual(before);
  const second = next.acceptPhysicalPitch(nextPhysicalPitchSourceId); if (second.kind === 'pending') throw new Error('unexpected pending second pitch');
  expect(second.progressRevision).toBe(2); expect(second.beforeTimeline).toEqual(first.result.resolution.timeline);
  expect(second.result.resolution.timeline.playId).toBe(first.result.resolution.timeline.playId); expect(second.originalActor).toEqual(first.originalActor);
  expect(second.frame.bodyCut.originalWorld).toEqual(f.actor.world); expect(second.frame.bodyCut.originalWorld.tick).toBe(f.actor.world.tick);
  expect(second.result.trajectory.start.velocity.z).toBeCloseTo(-24); expect(second.frame.projectedExecutionState.fatigue).toBeCloseTo(0.4);
  expect(f.x.f.workload.readHead('career-a', 'p2')!.revision).toBe(1); expect(open().readPhysicalPitch(physicalId)).toEqual(first);
  expect(() => readonly(() => readCurrentSamePaContinuationViewFromSqlite(f.db, current.viewReference))).toThrow(/stale/);
  expect(readonly(() => readHistoricalSamePaContinuationViewFromSqlite(f.db, current.viewReference)).view).toEqual(current.view);
  const saved = rawCensus(f.db), offline = openSqliteSamePlateAppearanceTakeSuccessorStore(f.path); owners.push(offline);
  expect(offline.readPhysicalPitch(nextPhysicalPitchSourceId)).toEqual(second); expect(offline.acceptPhysicalPitch(nextPhysicalPitchSourceId)).toEqual(second); expect(rawCensus(f.db)).toEqual(saved);
});
