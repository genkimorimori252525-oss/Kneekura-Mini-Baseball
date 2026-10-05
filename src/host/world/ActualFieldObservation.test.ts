import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { actualFieldObservationFixture } from './ActualFieldObservationFixtures.test-support';
import { sampleActualFieldObservation, type AcceptedActualFieldObservation } from './ActualFieldObservation';
import type { DurablePlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

let x: ReturnType<typeof actualFieldObservationFixture>;
beforeAll(() => { x = actualFieldObservationFixture(); });
afterAll(() => x?.f.close());
const prefix = () => ({ baseField: x.baseField, fields: [x.baseField], executions: [x.acquired] });
const perfectModel = (): DurablePlayerObservationModel => ({ ...x.observationModel, source: { ...x.observationModel.source,
  calibration: { ...x.observationModel.source.calibration, errorParameters: { minimumDetectionQuality: 0,
    minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } } });
const actorState = (playerId: string) => {
  const actor = x.baseField.field.motion.actors.find((value) => value.playerId === playerId && value.primitive.role === 'body')!;
  const p = actor.primitive, at = x.capture.moment;
  const dt = (at.originTick - p.startTick) / p.ticksPerSecond + at.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
  return { position: { x: p.startCenter.x + p.startVelocity.x * dt + 0.5 * p.acceleration.x * dt * dt,
    y: p.startCenter.y + p.startVelocity.y * dt + 0.5 * p.acceleration.y * dt * dt,
    z: p.startCenter.z + p.startVelocity.z * dt + 0.5 * p.acceleration.z * dt * dt },
  velocity: { x: p.startVelocity.x + p.acceleration.x * dt, y: p.startVelocity.y + p.acceleration.y * dt, z: p.startVelocity.z + p.acceleration.z * dt } };
};

it('projects the real physical prefix once per observation and revalidates the next operation', () => {
  const expected = sampleActualFieldObservation(x.observationSource, prefix(), x.observationModel, null);
  const calls = vi.spyOn(physical, 'battedWorldFieldPhysicalPrefix');
  try {
    const first = sampleActualFieldObservation(x.observationSource, prefix(), x.observationModel, null);
    expect(JSON.stringify(first)).toBe(JSON.stringify(expected));
    // Captured from unchanged 75ff32a production during the failing regression.
    expect(actorHash(first)).toBe('7af56365ccf15fd7b61fb0b4e94d16000fa5216ecab465fc2e74c9e2fb7e911e');
    expect(calls).toHaveBeenCalledTimes(1);
    const second = sampleActualFieldObservation(x.observationSource, prefix(), x.observationModel, null);
    expect(JSON.stringify(second)).toBe(JSON.stringify(expected));
    expect(calls).toHaveBeenCalledTimes(2);
  } finally { calls.mockRestore(); }
});

it('uses exact body-primitive motion and independently keyed noisy streams without exposing truth', () => {
  const first = sampleActualFieldObservation(x.observationSource, prefix(), x.observationModel, null);
  const root = new SeedRoot(x.response.touch.worldContact.flight.physicalPitch.frame.matchSeed);
  for (let i = 0; i < 50; i++) root.streamRng(0, 'fielding', String(i)).nextFloat();
  const replay = sampleActualFieldObservation({ ...x.observationSource, sourceId: 'unrelated-request-id' }, prefix(), x.observationModel, null);
  expect(replay).toEqual(first);
  const exact = sampleActualFieldObservation(x.observationSource, prefix(), perfectModel(), null);
  expect(exact.samples.ball!.sample.estimate).toEqual({ position: x.capture.moment.ball.position, velocity: x.capture.moment.ball.velocity });
  for (const sample of exact.samples.players) {
    const truth = actorState(sample.playerId);
    expect(sample.sample.estimate).toEqual({ position: { x: truth.position.x, z: truth.position.z }, velocity: { x: truth.velocity.x, z: truth.velocity.z } });
  }
  expect(exact.viewGeometry).toMatchObject({ eyeAnchor: 'body_primitive_center', offsetAxes: 'world', playerTargetAnchor: 'body_primitive_center' });
});

it('keeps unresolved current ball state unknown instead of sampling incoming contact truth', () => {
  expect(x.baseField.field.motion.cursor).toBeNull();
  const receipt = sampleActualFieldObservation({ ...x.observationSource, executionSourceId: null }, { ...prefix(), executions: [] }, x.observationModel, null);
  expect(receipt.results[0]).toEqual({ target: { kind: 'ball' }, status: 'physical_state_unavailable' });
  expect(receipt.samples.ball).toBeNull();
  expect(receipt.perceived.ball).toBeNull();
});

it('makes actual primitive occlusion and outside-FOV mandatory nondetection even at a zero detection threshold', () => {
  const observer = actorState(x.actor.binding.playerId).position, blocker = actorState(x.receiver.playerId).position;
  const target = x.capture.moment.ball.position;
  const eye = { x: 2 * blocker.x - target.x, y: 2 * blocker.y - target.y, z: 2 * blocker.z - target.z };
  const blocked: AcceptedActualFieldObservation = { ...x.observationSource, view: { ...x.observationSource.view,
    bodyRelativeEyeOffset: { x: eye.x - observer.x, y: eye.y - observer.y, z: eye.z - observer.z },
    forward: { x: target.x - eye.x, y: target.y - eye.y, z: target.z - eye.z } } };
  const hidden = sampleActualFieldObservation(blocked, prefix(), perfectModel(), null);
  expect(hidden.results[0].status).toBe('not_detected'); expect(hidden.perceived.ball).toBeNull();
  const enclosedEye = { ...blocked, view: { ...blocked.view,
    bodyRelativeEyeOffset: { x: blocker.x - observer.x, y: blocker.y - observer.y, z: blocker.z - observer.z },
    forward: { x: target.x - blocker.x, y: target.y - blocker.y, z: target.z - blocker.z } } };
  expect(sampleActualFieldObservation(enclosedEye, prefix(), perfectModel(), null).results[0].status).toBe('not_detected');
  const normalEye = { x: observer.x, y: observer.y + 3, z: observer.z };
  const lookingAway = { ...x.observationSource, view: { ...x.observationSource.view,
    forward: { x: normalEye.x - target.x, y: normalEye.y - target.y, z: normalEye.z - target.z } } };
  const narrow = perfectModel();
  const outside = sampleActualFieldObservation(lookingAway, prefix(), { ...narrow, source: { ...narrow.source,
    calibration: { ...narrow.source.calibration, geometryParameters: { ...narrow.source.calibration.geometryParameters,
      fullQualityHalfAngleRadians: Math.PI / 6, maxVisibleHalfAngleRadians: Math.PI / 2 } } } }, null);
  expect(outside.results[0].status).toBe('not_detected'); expect(outside.perceived.ball).toBeNull();
});

it('rejects eye-anchor changes and derives attention provenance without claiming continuous visibility', () => {
  const first = sampleActualFieldObservation(x.observationSource, prefix(), x.observationModel, null);
  const previous = { source: x.observationSource, receipt: first };
  for (const view of [{ ...x.observationSource.view, poseVersion: 'new-pose' },
    { ...x.observationSource.view, bodyRelativeEyeOffset: { x: 0, y: 4, z: 0 } }]) {
    expect(() => sampleActualFieldObservation({ ...x.observationSource, view }, prefix(), x.observationModel, previous)).toThrow(/baseline/);
  }
  expect(first.temporalPolicy).toBe('instantaneous_capture_tick_refresh_and_memory');
  expect(first.focusStartedAt).toEqual(first.at);
});

it('fails closed when finite accepted error estimates overflow during later memory prediction', async () => {
  const { createPlayerObservationCalibration } = await import('../../core/sim/perception/PlayerObservationCalibration');
  const model = { ...x.observationModel, source: { ...x.observationModel.source,
    calibration: createPlayerObservationCalibration({ ...x.observationModel.source.calibration,
      refreshPolicy: { attendedIntervalTicks: Number.MAX_SAFE_INTEGER, peripheralIntervalTicks: Number.MAX_SAFE_INTEGER },
      errorParameters: { minimumDetectionQuality: 0.1, minimumPositionErrorMeters: Number.MAX_VALUE,
        maximumPositionErrorMeters: Number.MAX_VALUE, minimumVelocityErrorMps: Number.MAX_VALUE, maximumVelocityErrorMps: Number.MAX_VALUE } }) } };
  const first = sampleActualFieldObservation(x.observationSource, prefix(), model, null);
  expect(Object.values(first.samples.ball!.sample.estimate.position).every(Number.isFinite)).toBe(true);
  expect(Object.values(first.samples.ball!.sample.estimate.velocity).every(Number.isFinite)).toBe(true);
  const source = { ...x.source, sourceId: 'actual-memory-overflow-motion', action: { kind: 'motion' as const,
    availableAtTick: x.capture.secureTick, throughTick: x.capture.secureTick + 100 * model.source.calibration.memoryDecayParameters.ticksPerSecond,
    commands: x.fieldSource.commands } };
  x.sources.set(source.sourceId, source); const moved = x.executions.accept(source.sourceId);
  expect(() => sampleActualFieldObservation({ ...x.observationSource, sourceId: 'actual-memory-overflow', executionSourceId: source.sourceId },
    { ...prefix(), executions: [x.acquired, moved] }, model, { source: x.observationSource, receipt: first })).toThrow(/finite/);
});
