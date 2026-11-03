import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { expect, it, vi } from 'vitest';
import type { LiveMeasuredClipV1, LivePitchInputV1 } from './LivePitchV1';
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 } from './LiveDirectionMotorV153';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 } from './LiveBatterObservationV151';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { AUTHORED_PLAY_RANDOMNESS_V152 } from '../../core/rng/LiveRandomStreamsV152';
import * as planner from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import { compareMeasuredTrajectoriesV69 } from './MeasuredTrajectoryComparisonWorkbenchV69';

type PlannerInput = Parameters<typeof planner.planObservedDirectionRegistrationV153>[0];
type PlannerDiagnostics = ReturnType<typeof planner.planObservedDirectionRegistrationV153>['diagnostics'];
type FailureDiagnostics = Readonly<{
  version:'live_direction_motor_failure_v154';decisionTick:number;clipId:string;sourceSha256:string;
  planningContactTimeSeconds:number;limits:Readonly<{ maximumSweetSpotSpeedMps:number|null }>;
  rates:readonly Readonly<{ rate:number;input:PlannerInput;diagnostics:PlannerDiagnostics }>[];
}>;
function expectFrozenInert(value:unknown):void {
  expect(typeof value).not.toBe('function');
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    expect(Object.hasOwn(descriptor, 'value')).toBe(true);expectFrozenInert(descriptor.value);
  }
}

it('preserves the fixed public four-level comparison and diagnoses its actual failed level without selecting a replacement', () => {
  // This is the previous-turn public fixed case, never a searched seed/form or personal JSON.
  const clip = (JSON.parse(readFileSync('docs/demos/measured-bat-motions.json', 'utf8')).clips as LiveMeasuredClipV1[])
    .find(candidate => candidate.id === 'obp-190_7')!;
  expect(clip.side).toBe('R');
  const input:LivePitchInputV1 = { originTick:1_000_000, seed:31, randomnessV152:AUTHORED_PLAY_RANDOMNESS_V152,
    batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151, batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,
    battingDirectionRequestV149:{ version:'batting_direction_request_v149', sourceId:'v154-public-fixed-diagnostic', mode:'CENTER' },
    batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', clipId:clip.id,
      timingStdSeconds:0, aimStdMeters:0, maximumSweetSpotSpeedMps:50, targetSweetSpotSpeedMps:30, motorLatencySeconds:.04,
      swingDecision:{ approach:'SWING', threshold:0, aggressionWeight:1 } },
    pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0 }, batting:'balanced', pitchType:'fastball', location:'inside',
    measuredClips:[clip], physics:LIVE_MATCH_PHYSICS_V1 }, before = structuredClone(input),
    seen:FailureDiagnostics['rates'][number][] = [], original = planner.planObservedDirectionRegistrationV153,
    spy = vi.spyOn(planner, 'planObservedDirectionRegistrationV153').mockImplementation(raw => {
      const result = original(raw);seen.push({ rate:raw.reference.playbackRate, input:raw, diagnostics:result.diagnostics });return result;
    });
  let caught:unknown;
  // Exactly one original comparison group. No seed/level search or replay.
  // The spy forwards every pure call unchanged, including preceding successful levels.
  try { compareMeasuredTrajectoriesV69({ pitch:input, afterContactSeconds:.1 }); }
  catch (error) { caught = error; }
  finally { spy.mockRestore(); }

  expect(input).toStrictEqual(before);expect(Object.isFrozen(input)).toBe(false);expect(Object.isFrozen(clip)).toBe(false);
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe('live pitch: 有限候補で実行可能な準備・回復を確認できません。準備・回復の時間を延ばすか、姿勢の移動量を小さくしてください。全速度での不可能判定ではありません。');
  const failure = (caught as Error & { directionMotorDiagnosticsV154:FailureDiagnostics }).directionMotorDiagnosticsV154;
  expect(failure).toBeDefined();
  expect(Object.getOwnPropertyDescriptor(caught, 'directionMotorDiagnosticsV154')).toMatchObject({
    writable:false, configurable:false, enumerable:false, value:failure,
  });
  expect(failure).toMatchObject({ version:'live_direction_motor_failure_v154', decisionTick:1_140_000,
    clipId:clip.id, sourceSha256:clip.source.sha256, limits:{ maximumSweetSpotSpeedMps:50 } });
  expect(Number.isFinite(failure.planningContactTimeSeconds)).toBe(true);
  expect(failure.planningContactTimeSeconds).toBeGreaterThan(.14);
  const failedLevel = failure.rates[0].input.reference.impactTrajectory!.level,
    relevantCalls = seen.filter(call => failure.rates.some(row => isDeepStrictEqual(row.input, call.input)));
  // Identified from the original group's actual sidecar, not inferred from a group rejection.
  expect(failedLevel).toBe(4);
  expect(relevantCalls.length).toBeGreaterThan(0);expect(failure.rates).toStrictEqual(relevantCalls);expectFrozenInert(failure);
  let certifiedCandidates = 0;
  for (const row of failure.rates) {
    expect(Number.isFinite(row.rate)).toBe(true);expect(row.rate).toBeGreaterThan(0);
    expect(Object.keys(row.input).sort()).toEqual(['reference', 'contactSourceTick', 'prediction', 'desiredFieldAngleDegrees', 'batPhysical', 'ballPhysical', 'limits'].sort());
    expect(Object.keys(row.input.prediction).sort()).toEqual(['anchorTick', 'availableTick', 'position', 'velocity', 'acceleration'].sort());
    expect(row.input.prediction.availableTick).toBe(failure.decisionTick);
    expect(row.input.reference.provenance).toEqual({ clipId:clip.id, sourceSha256:clip.source.sha256 });
    expect(row.input.reference.impactTrajectory!.level).toBe(failedLevel);
    expect(row.input.limits!.maximumSweetSpotSpeedMps).toBe(50);
    expect(row.diagnostics.status).not.toBe('PLANNED');
    expect(row.diagnostics.modelAssumptions).toMatchObject({ errorsApplied:false, actualWorldUsed:false, opponentPrivateStateUsed:false });
    for (const candidate of row.diagnostics.candidates) if (candidate.certificates) {
      certifiedCandidates++;
      const intervals = candidate.certificates.intervalCertificatesV154!;
      expect(intervals).toBeDefined();
      expect(Object.keys(intervals).sort()).toEqual(['measuredArc', 'preparation', 'recovery']);
      expect(intervals.preparation.throughTick).toBe(intervals.measuredArc.fromTick);
      expect(intervals.measuredArc.throughTick).toBe(intervals.recovery.fromTick);
      for (const interval of Object.values(intervals)) {
        expect(Number.isFinite(interval.fromTick) && Number.isFinite(interval.throughTick)).toBe(true);
        expect(interval.throughTick).toBeGreaterThan(interval.fromTick);
        expect(Number.isFinite(interval.minimumQuaternionNorm)).toBe(true);expect(interval.minimumQuaternionNorm).toBeGreaterThan(0);
        for (const pose of [interval.startPose, interval.endPose]) {
          expect(Object.values(pose.grip).every(Number.isFinite)).toBe(true);
          expect(Object.values(pose.orientation).every(Number.isFinite)).toBe(true);
        }
        for (const key of ['maximumGripSpeedMps', 'maximumAngularSpeedRadPerSecond', 'maximumSweetSpotSpeedMps',
          'maximumGripAccelerationMps2', 'maximumAngularAccelerationRadPerSecond2', 'maximumSweetSpotAccelerationMps2'] as const) {
          expect(Number.isFinite(interval[key])).toBe(true);expect(interval[key]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  }
  expect(certifiedCandidates).toBeGreaterThan(0);
  expect(input).toStrictEqual(before);
}, 30_000);
