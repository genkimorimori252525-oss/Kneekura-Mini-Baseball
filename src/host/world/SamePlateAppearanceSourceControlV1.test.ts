import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, expect, it, vi } from 'vitest';
import { sourceHostMotorFixture, type SourceHostMotorFixtureModels } from './SamePlateAppearanceSourceMotorFieldV1.test-support';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaSourceControlV1, samePaControlReviewTickV1 } from './SamePlateAppearanceSourceControlV1';
import { assertSamePaFieldBallPhysicsStep, SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION as CONTROL,
  SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION as ACQUISITION,
  SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR } from './SamePlateAppearanceBallPhysics';
import { samePaPhysicalFieldActionInput, type SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
const mocked = vi.hoisted((): SourceHostMotorFixtureModels => ({ models: new Map(), calibrations: new Map(), posture: null }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readSamePaLifecycleCalibrationFromSqlite: (_db: unknown, ref: { sourceId: string }) => mocked.calibrations.get(ref.sourceId),
  readCurrentSamePaLifecycleCalibrationFromSqlite: (_db: unknown, ref: { sourceId: string }) => mocked.calibrations.get(ref.sourceId) }));
vi.mock('./SqlitePlayerLocomotionModelStore', () => ({ playerLocomotionModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.models.get(id) }) }));
vi.mock('./SqlitePlayerObservationModelStore', () => ({ playerObservationModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.models.get(id) }) }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ readBattingPerceptionFromSqlite: () => mocked.posture }));
beforeEach(() => { mocked.models.clear(); mocked.calibrations.clear(); mocked.posture = null; });

// Mocked owner/model reads, real rated movement, Source collision and replay.
// These tests do not prove actual Native admission or measured abilities.
const fixture = (catchAfterInteger = false) => {
  const h = sourceHostMotorFixture(mocked, catchAfterInteger, { continuous: true });
  const selections = h.request.selections.map(s => {
    const selected = h.history.find(f => f.source.sourceId === s.decisionReference.sourceId)!;
    if (selected.kind !== 'same_pa_physical_field_step_v1' || selected.actionResult?.kind !== 'defender_actor_selection_v1') throw new Error('original actor required');
    const observationId = selected.actionResult.observationReference.sourceId;
    const observation = h.history.find(f => f.source.sourceId === observationId)!;
    if (observation.kind !== 'same_pa_physical_field_step_v1' || observation.source.action?.kind !== 'defender_observation_v1') throw new Error('original observation required');
    return { ...s, observationCalibrationReference: observation.source.action.calibrationReference };
  });
  const request: Extract<SamePaPhysicalFieldAction, { kind: 'defender_control_v1' }> = { kind: 'defender_control_v1', selections };
  const run = (throughTick = h.at.tick + 6000, version = CONTROL) => {
    const source = h.source(version, request, throughTick);
    return { source, result: deriveSamePaPhysicalFieldAction({} as DatabaseSync, source, h.root, h.history.at(-1)!, h.action, h.basis, h.history, false) };
  };
  return { ...h, request, run };
};

it('derives nine plans from original models/decisions and executes beyond a single control step', () => {
  const h = fixture(), original = h.history.at(-1)!.field.motion.cursor!, { result } = h.run();
  samePaPhysicalFieldActionInput(h.request);
  expect(result.actionResult.kind).toBe('defender_control_v1');
  if (result.actionResult.kind !== 'defender_control_v1') throw new Error('control required');
  expect(result.actionResult.plans).toHaveLength(9);
  expect(result.actionResult.motors.every(m => m.coverageEndTick === h.at.tick + 2000)).toBe(true);
  expect(result.evaluationTick).toBe(h.at.tick + 6000);
  expect(result.actionResult.plans.map(p => p.decisionSourceId)).toEqual(h.request.selections.map(s => s.decisionReference.sourceId));
  expect(result.field.motion.actors).toHaveLength(50);
  expect(result.field.motion.carrierPlayerId).toBeNull();
  expect(result.field.motion.cursor?.sourceCurve?.initial).toEqual(original.sourceCurve?.initial);
  const cursor = result.field.motion.cursor!;
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(cursor.moment.elapsedSeconds, cursor.sourceSide).moment);
}, 30000);

it('replays stored control checkpoints and matches an uninterrupted span without issuing the team again', () => {
  const h = fixture(), { source, result } = h.run();
  h.append(source, result);
  const next = h.source(CONTROL, undefined, h.at.tick + 10000), prior = h.history.at(-1)!;
  const replay = deriveSamePaPhysicalFieldStep(next, h.root, prior, prior.evaluationTick, true, h.history);
  // Independent fresh reconstruction of the same original Source history.
  const again = deriveSamePaSourceControlV1({ source: next, root: h.root, previous: prior, history: h.history });
  expect(replay.field).toEqual(again.field); expect(replay.ballSolverEvidence).toEqual(again.ballSolverEvidence);
  const direct = fixture();
  expect(replay.field).toEqual(direct.run(direct.at.tick + 10000).result.field);
  expect(replay.evaluationTick).toBe(h.at.tick + 10000);
  expect(replay.field.motion.actors.find(a => a.playerId === 'p1' && a.primitive.role === 'body')!.primitive.startVelocity.x).not.toBe(0);
}, 30000);

it('enforces the original observation deadline and rejects old version, subset, changed model and lineage', () => {
  const h = fixture();
  expect(() => h.run(h.at.tick + 81000)).toThrow('observation deadline');
  expect(() => h.run(h.at.tick + 6000, MOTOR)).toThrow('explicit Source version');
  expect(() => samePaPhysicalFieldActionInput({ ...h.request, selections: h.request.selections.slice(1) })).toThrow();
  const model = mocked.models.get('p1obsModel');
  mocked.models.set('p1obsModel', { ...model, fieldingModel: { ...model.fieldingModel,
    source: { ...model.fieldingModel.source, ratings: { ...model.fieldingModel.source.ratings, armStrength: .1 } } } });
  expect(() => h.run()).toThrow();
  mocked.models.set('p1obsModel', model);
  mocked.calibrations.get('p1obsCal').lineage = { playId: 999 };
  expect(() => h.run()).toThrow();
}, 30000);

it('rejects stored plan or reference mutation rather than restoring a caller cursor or plan', () => {
  const h = fixture(), { source, result } = h.run();
  h.append(source, result);
  const prior = structuredClone(h.history.at(-1)!), history = [...h.history.slice(0, -1), prior];
  if (prior.kind !== 'same_pa_physical_field_step_v1' || prior.actionResult?.kind !== 'defender_control_v1') throw new Error('control required');
  const changed = structuredClone(prior.actionResult);
  (changed.plans[0] as { decisionSourceId: string }).decisionSourceId = 'forged';
  Object.assign(prior, { actionResult: changed });
  expect(() => deriveSamePaSourceControlV1({ source: h.source(CONTROL, undefined, h.at.tick + 10000), root: h.root, previous: prior, history })).toThrow();
}, 30000);

it('stops at actual moving-glove contact and keeps finite control coverage without granting custody', () => {
  const h = fixture(true), { result } = h.run(h.at.tick + 80000);
  expect(result.field.motion.response.kind).toBe('capture_candidate'); expect(result.field.motion.cursor).toBeNull();
  expect(result.field.motion.carrierPlayerId).toBeNull();
  const world = result.field.motion.world;
  if (world.kind !== 'boundary') throw new Error('physical contact required');
  expect(world.contacts[0].kind).toBe('actor');
  expect(Math.min(...result.field.motion.actors.map(a => a.primitive.endTick)) - result.evaluationTick).toBeLessThanOrEqual(2000);
  // Acquisition needs the versioned held-motion renewal consumer; the old
  // MOTOR-only acquisition path must not claim this candidate as its own.
  expect(() => assertSamePaFieldBallPhysicsStep({ sourceVersion: ACQUISITION, action: { kind: 'capture_checkpoint_v1' } }, h.root.source,
    { sourceVersion: CONTROL }, false)).toThrow();
}, 30000);

it('derives attended/peripheral deadlines from actual sample times and rejects clock mismatches', () => {
  const h = fixture(), observation = h.history.find(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'defender_observation_v1');
  if (observation?.kind !== 'same_pa_physical_field_step_v1' || observation.actionResult?.kind !== 'defender_observation_v1') throw new Error('observation required');
  const value = observation.actionResult, c = mocked.calibrations.get('p1obsCal').source.response.values;
  expect(samePaControlReviewTickV1(value, c, h.at.tick, h.at.tick + 100000, 1e6)).toBe(h.at.tick + 80000);
  expect(samePaControlReviewTickV1({ ...value, samplingRequest: { ...value.samplingRequest,
    view: { ...value.samplingRequest.view, attentionTarget: { kind: 'player', playerId: 'other' } } } }, c, h.at.tick, h.at.tick + 200000, 1e6)).toBe(h.at.tick + 160000);
  expect(samePaControlReviewTickV1({ ...value, receipt: { ...value.receipt,
    results: [{ target: { kind: 'ball' }, status: 'not_detected' }] } }, c, h.at.tick, h.at.tick + 100000, 1e6)).toBe(h.at.tick + 100000);
  expect(() => samePaControlReviewTickV1(value, c, h.at.tick + 80000, h.at.tick + 100000, 1e6)).toThrow('already due');
  expect(() => samePaControlReviewTickV1(value, c, h.at.tick, h.at.tick + 100000, 1000)).toThrow('clock');
}, 30000);
