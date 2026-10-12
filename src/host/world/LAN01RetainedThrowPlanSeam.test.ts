import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { appendNativePhysicalThrowReception, resumeNativePhysicalThrowReceptionAfterPlan } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { resumeNativeLiveAppealCatch } from './SamePlateAppearanceLiveAppealCatchNative.test-support';
import { completeSamePaPhysicalLifecycleFromCutFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef } from './SamePlateAppearanceCatchCommunicationSource';

const boundary = vi.hoisted(() => ({
  replay: vi.fn(() => { throw new Error('completed owner replayed'); }),
  acquisition: vi.fn(), calibration: vi.fn(), catchOwner: vi.fn(), catchAccept: vi.fn(),
}));
vi.mock('../../core/sim/ball/BattedWorldScheduledFieldAcquisition', () => ({ prepareBattedWorldScheduledFieldAcquisition: boundary.acquisition }));
vi.mock('./SamePlateAppearancePhysicalThrowNative.test-support', () => ({ prepareNativePhysicalThrowCalibration: boundary.calibration }));
vi.mock('./SamePlateAppearancePhysicalThrowScene.test-support', () => ({ physicalThrowSceneFixture: () => ({ values: { declared: 'original-throw-values' } }) }));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite', () => ({ openSqliteSamePlateAppearanceCatchWorkStore: boundary.catchOwner }));
vi.mock('./SamePlateAppearanceLifecycleFixture.test-support', () => ({ prepareSamePaLifecycleFixture: boundary.replay }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ openSqliteBattingPerceptionStore: () => ({ acceptPosture: boundary.replay }) }));
vi.mock('./SqliteSamePlateAppearancePhysicalEpisodeStore', () => ({ openSqliteSamePlateAppearancePhysicalEpisodeStore: () => ({
  acceptAction: boundary.replay, acceptRight: boundary.replay, acceptOperation: boundary.replay,
}) }));

// Bounded owner-call declarations. No mocked value authenticates a retained DB
// or claims that a Native capture, plan, release or catch acceptance executed.
const record = (sourceId: string, values: any = {}) => ({ ...values, source: { sourceId, ...values.source } });
const pin = (sourceId: string) => reference('pa_lifecycle_v1_execution_views', record(sourceId));
const label = 'lan01:appeal-throw';
const throwInputs = (cutOrdinal = 16) => {
  const accepted = new Map<string, any>(), calls: string[] = [];
  const plan = { input: { cursor: { moment: { originTick: 100, elapsedSeconds: 2 } } }, releaseElapsedSeconds: 4 };
  const motion = (carrierPlayerId: string | null) => ({ carrierPlayerId, actors: [{ primitive: { endTick: 200_000 } }] });
  const step = record('lan01:field:field-step', { kind: 'same_pa_physical_field_step_v1', evaluationTick: 2100, field: { motion: motion(null) } });
  const root = record('lan01:field:field-root', { source: { launchReference: reference('pa_physical_v1_launches', record('lan01:swing:launch')) },
    response: { world: { parameters: { ticksPerSecond: 1000 } } }, geometry: { original: true } });
  const field = { root, rootReference: reference('pa_physical_v1_field_roots', root), step, stepReference: reference('pa_physical_v1_field_steps', step) };
  const operation = (ordinal: number, actionResult: any) => {
    const value = record(label + ':' + ordinal, { kind: 'same_pa_physical_field_step_v1', evaluationTick: 2100,
      actionResult, field: { motion: motion('p2') } });
    return { value, operationReference: reference('pa_physical_v1_field_steps', value) };
  };
  const retained = { planned: operation(3, { kind: 'throw_plan_v1', plan }), indicated: operation(2, { kind: 'appeal_indication_v1' }) };
  let viewReference = pin('lan01:occupied:cut' + cutOrdinal + ':view');
  const h = {
    accepted, save: <T extends { sourceId: string }>(source: T) => { calls.push('save:' + source.sourceId); accepted.set(source.sourceId, source); return source; },
    current: () => ({ viewReference, basis: { members: [{ playerId: 'p2' }] } }),
    advance: vi.fn((value: { sourceId: string }) => { calls.push('advance:' + value.sourceId); viewReference = pin('lan01:occupied:cut' + (++cutOrdinal) + ':view'); }),
    physical: { acceptOperation: vi.fn((id: string) => {
      calls.push('accept:' + id); const source = accepted.get(id), action = source.action;
      const actionResult = action?.kind === 'throw_plan_v1' ? { kind: action.kind, plan }
        : action?.kind === 'throw_checkpoint_v1' ? { kind: action.kind, progress: { kind: action.throughElapsedSeconds === 3 ? 'transfer' : 'released' } }
        : action?.kind === 'capture_checkpoint_v1' ? { kind: action.kind, progress: { kind: 'secured' } }
        : action?.kind === 'appeal_contact_v1' ? { kind: action.kind, execution: { kind: 'executed' } } : action ? { kind: action.kind } : null;
      const carrier = action?.kind === 'capture_checkpoint_v1' || action?.kind === 'appeal_contact_v1' ? id === label + ':1' ? 'p2' : 'home-1' : null;
      return { kind: 'same_pa_physical_field_step_v1', source, evaluationTick: source.throughTick, actionResult, field: { motion: motion(carrier) } };
    }) },
  };
  boundary.acquisition.mockReturnValue({ candidateSecureTick: 110_100, fenceElapsedSeconds: 110 });
  boundary.calibration.mockReturnValue({ calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', record(label + ':throw-calibration')) });
  const resume = () => resumeNativePhysicalThrowReceptionAfterPlan(h as never, field as never, label, retained as never);
  return { h, field, retained, resume, accepted, calls, plan };
};

beforeEach(() => {
  boundary.replay.mockClear(); boundary.acquisition.mockReset(); boundary.calibration.mockReset();
  boundary.catchOwner.mockReset().mockReturnValue({ accept: boundary.catchAccept }); boundary.catchAccept.mockReset();
});

it('admits the already-owned plan as cut17 before any new physical writer and continues only ordinals 4 through 8', () => {
  const x = throwInputs(), before = JSON.stringify(x.retained), result = x.resume();
  expect(x.calls[0]).toBe('advance:lan01:appeal-throw:3');
  expect(x.h.advance.mock.calls.map(([value]) => value.sourceId)).toEqual([3, 4, 5, 6, 7, 8].map(n => label + ':' + n));
  expect(x.h.physical.acceptOperation.mock.calls.map(([id]) => id)).toEqual([4, 5, 6, 7, 8].map(n => label + ':' + n));
  expect([...x.accepted.keys()]).toEqual([4, 5, 6, 7, 8].map(n => label + ':' + n));
  const transfer = x.accepted.get(label + ':4'), released = x.accepted.get(label + ':5');
  expect(transfer).toEqual({ sourceId: label + ':4', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: pin('lan01:occupied:cut17:view'), launchReference: x.field.root.source.launchReference,
    previousOperationReference: x.retained.planned.operationReference, previousFieldReference: x.retained.planned.operationReference,
    fieldRootReference: x.field.rootReference, throughTick: 3100,
    action: { kind: 'throw_checkpoint_v1', planReference: x.retained.planned.operationReference, throughElapsedSeconds: 3 } });
  expect(released.action.throughElapsedSeconds).toBe(4); expect(released.throughTick).toBe(4100);
  expect(x.accepted.get(label + ':6').throughTick).toBe(104_100);
  expect(x.accepted.get(label + ':7').action.candidateReference).toEqual(result.reception.operationReference);
  expect(x.accepted.get(label + ':8').action).toEqual({ kind: 'appeal_contact_v1', indicationReference: x.retained.indicated.operationReference,
    throwPlanReference: x.retained.planned.operationReference });
  expect(result.fieldForActions.step).toBe(result.appealed!.value); expect(result.planned).toBe(x.retained.planned);
  expect(boundary.acquisition).toHaveBeenCalledTimes(1); expect(boundary.acquisition.mock.calls[0][0].field).toBe(result.reception.value.field);
  expect(boundary.calibration).not.toHaveBeenCalled(); expect(boundary.catchOwner).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
  expect(JSON.stringify(x.retained)).toBe(before);
});

it('stops at the first cut17 admission failure without saving or accepting a transfer', () => {
  const x = throwInputs(); x.h.advance.mockImplementation(() => { throw new Error('cut17 prefix pending'); });
  expect(x.resume).toThrow('cut17 prefix pending'); expect(x.h.advance.mock.calls).toEqual([[x.retained.planned.operationReference]]);
  expect(x.accepted.size).toBe(0); expect(x.h.physical.acceptOperation).not.toHaveBeenCalled();
  expect(boundary.acquisition).not.toHaveBeenCalled(); expect(boundary.calibration).not.toHaveBeenCalled(); expect(boundary.replay).not.toHaveBeenCalled();
});

it.each([false, true])('keeps the fresh IFN/LAN append path and its optional original appeal (appeal=%s)', appeal => {
  const x = throwInputs(13), onSecured = vi.fn();
  const result = appendNativePhysicalThrowReception(x.h as never, x.field as never, label,
    { onSecured, ...(appeal ? { appealRunnerId: 'away-1' } : {}) });
  const last = appeal ? 8 : 6;
  expect(x.h.physical.acceptOperation.mock.calls.map(([id]) => id)).toEqual(Array.from({ length: last }, (_, n) => label + ':' + (n + 1)));
  expect(x.h.advance.mock.calls.map(([value]) => value.sourceId)).toEqual(Array.from({ length: last }, (_, n) => label + ':' + (n + 1)));
  expect(onSecured.mock.calls).toEqual([[result.secured.value]]);
  expect(boundary.calibration.mock.calls).toEqual([[x.h, 'p2', label, { declared: 'original-throw-values' }]]);
  expect(boundary.acquisition).toHaveBeenCalledTimes(2); expect(Boolean(result.appealed)).toBe(appeal);
  expect(result.planned.value.source.action?.kind).toBe('throw_plan_v1'); expect(boundary.replay).not.toHaveBeenCalled();
});

it('refreshes from the authenticated catch dependencies with only the new sealed communication and work', () => {
  const accepted = new Map<string, any>(), saved: any[] = [], advance = vi.fn();
  const person = { sourceId: 'original-person', sourceVersion: 'fixture-v1', personId: 'real-person', officialId: 'real-official' };
  const assignment = { sourceId: 'original-assignment', sourceVersion: 'fixture-v1', personReference: originalRef(person as never) };
  const action = { sourceId: 'original-action', sourceVersion: 'fixture-v1', assignmentReference: originalRef(assignment as never), judgment: 'caught' };
  const model = { sourceId: 'original-model', sourceVersion: 'fixture-v1', parameters: { declared: 'dropped-original-receivers' } };
  const communication = { sourceId: 'lan01:caught:communication:original', sourceVersion: 'fixture-v1', capability: 'same_pa_explicit_catch_communication_v1',
    actionReference: originalRef(action as never), modelReference: originalRef(model as never), viewReference: pin('lan01:occupied:cut14:view') };
  const work = record('lan01:caught:work:original', { originalInputs: { source: communication, action, assignment, person, model } });
  const original = { work, workReference: reference('pa_catch_v1_work', work) }, before = JSON.stringify(original);
  const enrollmentReference = reference('same_pa_enrollments', record('original-enrollment'));
  const h = { accepted, advance, current: () => ({ viewReference: pin('lan01:occupied:cut23:view'), view: { lineage: { enrollmentReference } } }),
    save: <T extends { sourceId: string }>(source: T) => { saved.push(source); accepted.set(source.sourceId, source); return source; },
    f: { path: '/unused/finite-seam.sqlite', x: { f: { track: <T>(owner: T) => owner } } } };
  const caught = resumeNativeLiveAppealCatch(h as never, original as never, 'lan01:caught');
  expect(saved).toEqual([]); expect(accepted.size).toBe(0); expect(boundary.catchOwner).not.toHaveBeenCalled();
  boundary.catchAccept.mockImplementation((id: string) => {
    const authority = boundary.catchOwner.mock.calls[0][1], source = authority.readAcceptedWork(id);
    const sourceCommunication = authority.readAcceptedCommunication(source.communicationReference.sourceId);
    expect(authority.readAcceptedAction(action.sourceId)).toBe(action); expect(authority.readAcceptedAssignment(assignment.sourceId)).toBe(assignment);
    expect(authority.readAcceptedOfficialPerson(person.sourceId)).toBe(person); expect(authority.readAcceptedReceptionModel(model.sourceId)).toBe(model);
    expect(authority.readAcceptedCommunication(communication.sourceId)).toBe(communication);
    expect(authority.readAcceptedWork(work.source.sourceId)).toBeNull();
    expect(authority.readAcceptedAction('unrelated-action')).toBeNull(); expect(authority.readAcceptedReceptionModel('other-model')).toBeNull();
    return { kind: 'same_pa_catch_work_v1', source, originalInputs: { ...work.originalInputs, source: sourceCommunication },
      communication: { recipients: Array.from({ length: 11 }, () => ({ kind: 'dropped' })) }, operative: { kind: 'retired' } };
  });
  const result = caught.refresh();
  expect(saved).toEqual([
    { ...communication, sourceId: 'lan01:caught:communication:sealed', viewReference: pin('lan01:occupied:cut23:view') },
    { sourceId: 'lan01:caught:work:sealed', sourceVersion: 'fixture-v1', capability: 'same_pa_catch_work_v1', enrollmentReference,
      viewReference: pin('lan01:occupied:cut23:view'), communicationReference: originalRef(saved[0]), priorWorkReference: original.workReference },
  ]);
  expect(boundary.catchAccept.mock.calls).toEqual([['lan01:caught:work:sealed']]);
  expect(advance.mock.calls).toEqual([[result.workReference]]); expect(JSON.stringify(original)).toBe(before);
  expect([...accepted.keys()]).toEqual(['lan01:caught:communication:sealed', 'lan01:caught:work:sealed']); expect(boundary.replay).not.toHaveBeenCalled();
});

it('restores exact cut16 and rejects missing, extra or changed admitted events while preserving earlier seams', () => {
  const second = record('lan01:occupied:second-pitch', { lineage: { participantReferences: [] } });
  const identities = [
    ['pa_take_successor_v1_pitch_actions', 'lan01:occupied:second-pitch'], ['pa_physical_v1_launches', 'lan01:swing:launch'],
    ['pa_physical_v1_cuts', 'lan01:swing:capture-cut'], ['batting_observation_v1_observations', 'lan01:swing:capture'],
    ['pa_physical_v1_cuts', 'lan01:swing:delivery-cut'], ['batting_observation_v1_deliveries', 'lan01:swing:delivery'],
    ['batting_prediction_v1_predictions', 'lan01:swing:forecast'], ['batting_emotion_execution_v1_executions', 'lan01:swing:emotion'],
    ['pa_physical_v1_cuts', 'lan01:swing:decision-cut'], ['pa_physical_v1_commitments', 'lan01:swing:commitment'],
    ['pa_physical_v1_resolutions', 'lan01:swing:resolution'], ['pa_physical_v1_field_roots', 'lan01:field:field-root'],
    ['pa_physical_v1_field_steps', 'lan01:field:field-step'], ['pa_physical_v1_field_steps', 'lan01:appeal-throw:1'],
    ['pa_catch_v1_work', 'lan01:caught:work:original'], ['pa_physical_v1_field_steps', 'lan01:appeal-throw:2'],
  ] as const;
  const events = identities.map(([owner, id], index) => reference(owner, index === 0 ? second : record(id)));
  const prepared = (n: number) => ({ first: second, second, anchor: {}, eventReferences: events.slice(0, n),
    basis: { viewReference: pin('lan01:occupied:cut' + n + ':view'), view: { cut: { physicalOperationReference: events[n - 1] } } } });
  const f = { path: '/unused/finite-prefix.sqlite', acceptedAction: { source: {} }, x: { f: { track: <T>(owner: T) => owner } } };
  const restore = (value: any) => completeSamePaPhysicalLifecycleFromCutFixture(f as never, new Map(), value as never, {}, 'lan01:occupied');
  for (const n of [5, 9, 12, 16]) { const value = prepared(n), restored = restore(value); expect(restored.events).toEqual(value.eventReferences); expect(restored.current()).toBe(value.basis); }
  const exact = prepared(16);
  for (const value of [
    { ...exact, eventReferences: events.slice(0, -1) },
    { ...exact, eventReferences: [...events, reference('pa_physical_v1_field_steps', record(label + ':3'))] },
    { ...exact, eventReferences: events.map((value, index) => index === 14 ? { ...value, sourceId: 'other-caught-work' } : value) },
    { ...exact, eventReferences: events.map((value, index) => index === 0 ? { ...value, snapshotHash: 'changed' } : value) },
    { ...exact, basis: { ...exact.basis, viewReference: pin('lan01:occupied:cut17:view') } },
    { ...exact, basis: { ...exact.basis, view: { cut: { physicalOperationReference: events[13] } } } },
  ]) expect(() => restore(value)).toThrow('exact LAN delivery-cut prefix');
  expect(boundary.replay).not.toHaveBeenCalled(); expect(boundary.calibration).not.toHaveBeenCalled(); expect(boundary.catchOwner).not.toHaveBeenCalled();
});

it('shares the unchanged original append, capture, throw, catch Source and catch assertion bodies', () => {
  const throwSource = readFileSync(new URL('./SamePlateAppearancePhysicalThrowReception.test-support.ts', import.meta.url), 'utf8');
  const catchSource = readFileSync(new URL('./SamePlateAppearanceLiveAppealCatchNative.test-support.ts', import.meta.url), 'utf8');
  const slice = (source: string, start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  const bodies = [
    slice(throwSource, '  const append =', '  const finish ='),
    slice(throwSource, "  if (planned.value.actionResult?.kind !== 'throw_plan_v1')", '  return { planned, transfer,'),
    slice(throwSource, '  const secured = capture()', '  return { secured, calibration,').replaceAll('operations.previous()', 'previous'),
    slice(catchSource, '  const b=h.current()', '  const accept=prepareNativeLiveAppealCatchAcceptance'),
    slice(catchSource, '  const accept=(name:string', '  return accept;'),
  ];
  expect(bodies.map(body => createHash('sha256').update(body).digest('hex'))).toEqual([
    'e8e556eb5db687161add4d2d49ca0afca700ef1e79639ff8dda43d8e06ddb719',
    '192f3ae42ba9340d121ed137051e8579cb4277dc639a3c210d7c31088fd736d3',
    '406b5c5f1b7054d0614f2b01e0883c8eaddcf48930b423fe2ffb7c4fef042307',
    '3839d9e03784ffc66118534e621b114680d48289372ae8e7b3cda91f6274b931',
    'cff49a3144199fe7819a4b7e79aacd9903d4f1bf0e112ad3cfebc990b4906779',
  ]);
});
