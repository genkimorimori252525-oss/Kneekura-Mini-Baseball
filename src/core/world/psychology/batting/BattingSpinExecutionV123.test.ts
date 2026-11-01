import { expect, it } from 'vitest';
import { fixture, value } from './BattingFixtures.test-support';
import * as api from './BattingCommitment';

function input() {
  const nominalRequest = fixture(), s = nominalRequest.source;
  return { nominalRequest, effectiveValues: { decision: s.decisionModel,
    motor: { motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: s.technicalTimingOffsetTicks,
      maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles } },
    spinContext: { atDay: 17, repertoireSourceRef: { sourceId: 'owned-model-repertoire', sourceVersion: 'v1' },
      intent: { technique: 'BACKSPIN' as const, selectedAtTick: nominalRequest.currentFrame.time.tick },
      techniques: [{ technique: 'BACKSPIN' as const, qualificationRef: { sourceId: 'original-backspin-qualification', sourceVersion: 'v1' },
        acceptedAtDay: 16, repertoireRef: { sourceId: 'owned-model-repertoire', sourceVersion: 'v1' },
        calibration: { sourceId: 'explicit-spin-calibration', sourceVersion: 'v1', status: 'MODEL_VERIFIED' as const },
        motorProfileRefs: [{ profileId: s.profiles[0].profile.profileId, version: s.profiles[0].profile.version }] }] } };
}

it('keeps the original nominal/effective inputs and puts the selected single motor into the actual commitment calculation', () => {
  const i = input(), before = structuredClone(i);
  expect(api.calculateBattingSpinExecutionV123).toBeTypeOf('function');
  const result = value(api.calculateBattingSpinExecutionV123(i));
  expect(result).toMatchObject({ algorithm: 'batting-spin-execution-calculation-v123', status: 'READY',
    commitment: { action: 'SWING', profileId: 'controlled' }, spinMotorPlanV123: { selectedIntent: 'BACKSPIN' } });
  expect(result.nominalRequest).toEqual(i.nominalRequest); expect(result.effectiveValues).toEqual(i.effectiveValues);
  expect(result.commitment!.trajectory).toEqual(result.spinMotorPlanV123!.plan.status === 'READY' ? result.spinMotorPlanV123!.plan.motion.trajectory : null);
  expect(i).toEqual(before);
  const normal = value(api.calculateBattingExecution({ nominalRequest: i.nominalRequest, effectiveValues: i.effectiveValues }));
  const fallback = value(api.calculateBattingSpinExecutionV123({ ...i, spinContext: { ...i.spinContext, techniques: [] } }));
  expect(fallback.commitment).toEqual(normal.commitment);
});

it('validates spin context even for TAKE without generating a motor, extra action or spin', () => {
  const i = structuredClone(input()); i.nominalRequest = { ...i.nominalRequest, source: { ...i.nominalRequest.source, directive: 'TAKE' } };
  const result = value(api.calculateBattingSpinExecutionV123(i));
  expect(result).toMatchObject({ commitment: { action: 'TAKE', trajectory: null }, spinMotorPlanV123: null });
  expect(api.calculateBattingSpinExecutionV123({ ...i, spinContext: { ...i.spinContext, exitSpin: { x: 1, y: 2, z: 3 } } }).ok).toBe(false);
  expect(api.calculateBattingSpinExecutionV123({ ...i, spinContext: { ...i.spinContext,
    intent: { ...i.spinContext.intent, selectedAtTick: i.nominalRequest.currentFrame.time.tick + 1 } } }).ok).toBe(false);
});
