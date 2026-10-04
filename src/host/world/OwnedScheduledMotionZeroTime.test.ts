import { expect, it } from 'vitest';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';

it('owns explicit zero-spin pitch physics before acceptance', () => {
  const x = Reflect.apply(battedBallFlightFixture, null, [undefined, true, true, true, undefined,
    { spin: { x: 0, y: 0, z: 0 } }]) as ReturnType<typeof battedBallFlightFixture>;
  try {
    expect(x.physical.source.request.delivery.physics.spin).toEqual({ x: 0, y: 0, z: 0 });
    expect(x.physical.result.pitch.resolution.timeline.events.at(-1)?.kind).toBe('BatBallContact');
    const saved = x.flights.accept(x.input.sourceId);
    expect(saved.flight.initialBall.spin).toEqual({ x: 0, y: 0, z: 0 });
  } finally { x.f.close(); }
});

import { ownedZeroTimeChainFixture } from './OwnedScheduledMotionZeroTime.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';

it.each([false, true])('retains zero-energy same-time capture, release and response with ground overlap=%s', groundOverlap => {
  const x = ownedZeroTimeChainFixture(groundOverlap);
  try {
    expect(x.baseField.response.touch.worldContact.result.kind).toBe('airborne');
    expect((x.prefix().executions.at(-1)?.execution.field ?? x.baseField.field).motion.response.kind).toBe('capture_candidate');
    const planned = x.accept('zero-capture-plan', { kind: 'owned_acquisition_plan_v1', knownWork: x.knownWork });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const plan = planned.execution.plan;
    expect(plan.initialEnergyJ).toBe(0);
    expect(plan.contactMoment.elapsedSeconds).toBe(x.contactElapsedSeconds);
    expect(plan.secureElapsedSeconds).toBe(plan.contactMoment.elapsedSeconds);
    expect(plan.fenceElapsedSeconds).toBe(plan.contactMoment.elapsedSeconds);
    const initialized = x.step('zero-capture-init', planned.source.sourceId, plan.contactMoment.elapsedSeconds);
    if (initialized.execution.kind !== 'owned_motion_v2' || initialized.execution.operation?.kind !== 'acquisition') throw new Error('fixture');
    expect(initialized.execution.operation.progress.kind).toBe('secured');
    const before = x.accept('zero-secured-observer', { kind: 'whole_play_history' }), beforeBytes = JSON.stringify(before);
    const model = installSyntheticObservation(x, plan.acquirerPlayerId, before.source.sourceId, undefined, undefined, source => ({ ...source,
      transferParameters: { minimumTransferDelayTicks: 0, maximumTransferDelayTicks: 0, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 20, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } })).observationModel.fieldingModel;
    const throwing = x.accept('zero-throw-plan', { kind: 'owned_throw_plan_v1', modelSourceId: model.source.sourceId,
      receiverPlayerId: x.receiverPlayerId, knownWork: x.knownWork });
    const released = x.step('zero-throw-release', throwing.source.sourceId, plan.contactMoment.elapsedSeconds);
    if (released.execution.kind !== 'owned_motion_v2' || released.execution.operation?.kind !== 'throw'
      || released.execution.operation.progress.kind !== 'released') throw new Error('fixture');
    const progress = released.execution.operation.progress;
    if (groundOverlap) {
      expect(progress.field.motion.world.kind).toBe('boundary');
      if (progress.field.motion.world.kind !== 'boundary') throw new Error('fixture');
      expect(progress.field.motion.world.contacts.some(c => c.kind === 'ground')).toBe(true);
      expect(progress.field.motion.response.kind).toBe('ground');
      expect(progress.field.motion.cursor!.moment.ball.velocity).not.toEqual(progress.releaseCursor.moment.ball.velocity);
    }
    expect(progress.releaseCursor.moment.ball.velocity).not.toEqual(plan.contactMoment.ball.velocity);
    expect(progress.field.motion.cursor).not.toBeNull();
    const physical = battedWorldFieldPhysicalPrefix(x.prefix()), history = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(physical.field.evidence.contacts.at(-1)?.moment).toEqual(plan.contactMoment);
    if (groundOverlap) expect(physical.field.evidence.contacts.at(-1)?.contacts).toEqual([
      { kind: 'actor', playerId: plan.acquirerPlayerId, role: 'glove' }, { kind: 'ground' } ]);
    expect(physical.controlWindows).toEqual([0, 1].map(() => ({ playerId: plan.acquirerPlayerId,
      startElapsedSeconds: plan.contactMoment.elapsedSeconds, endElapsedSeconds: plan.contactMoment.elapsedSeconds, endInclusive: false })));
    expect(history.physicalSteps.at(-1)).toMatchObject({ operation: { progress: { releaseCursor: progress.releaseCursor } } });
    expect(history.frames.at(-1)!.occurrences.map(o => o.phase)).toEqual(expect.arrayContaining([
      'world_boundary', 'acquisition_constraint_started', 'acquisition_dissipation_complete', 'acquisition_confirmed', 'throw_release' ]));
    expect(actualBattedWorldObservationMoment(history)).toEqual(progress.field.motion.cursor!.moment); expect(history.end.kind).toBe('unestablished');
    expect(JSON.stringify(x.executions.read(before.source.sourceId))).toBe(beforeBytes);
  } finally { x.f.close(); }
});
