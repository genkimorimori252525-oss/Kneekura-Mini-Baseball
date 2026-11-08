import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { AUTHORED_OBSERVED_DIRECTION_MOTOR_V153 as motorPolicy } from './LiveDirectionMotorV153';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151 as observationPolicy } from './LiveBatterObservationV151';
import { createLiveBaseballMatchWorkerV116, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { AUTHORED_MATCH_RANDOMNESS_V152 as matchPolicy, AUTHORED_PLAY_RANDOMNESS_V152 as playPolicy } from '../../core/rng/LiveRandomStreamsV152';
import { appendBatterObservedEvidenceV151, createBatterObservedEvidenceV151, createEmptyBatterObservedMemoryV151 } from '../../core/decision/batting/BatterObservedMemoryV151';
import type { BattingDirectionRequestV149 } from '../../core/decision/batting/BattingDirectionRequestV149';
import { DEFAULT_IMPACT_TRAJECTORY_V1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';

// Public measured catalog only. Personal JSON artifacts are never loaded by this suite.
const clips = JSON.parse(readFileSync('docs/demos/measured-bat-motions.json', 'utf8')).clips;
const request = (mode:BattingDirectionRequestV149['mode']):BattingDirectionRequestV149 => ({
  version:'batting_direction_request_v149', sourceId:'v153-integration-test', mode,
});
type MotorInput = LivePitchInputV1 & Readonly<{ batterDirectionMotorV153:typeof motorPolicy }>;
function fixture(mode:BattingDirectionRequestV149['mode'] = 'CENTER'):MotorInput {
  return { originTick:1_000_000, seed:31, randomnessV152:playPolicy,
    batterObservationV151:observationPolicy, batterDirectionMotorV153:motorPolicy, battingDirectionRequestV149:request(mode),
    batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'R', maximumSweetSpotSpeedMps:50,
      targetSweetSpotSpeedMps:30, motorLatencySeconds:.04, zoneJudgmentStdMeters:.02,
      swingDecision:{ approach:'SWING', threshold:0, aggressionWeight:1 },
      swingPolicyV121:{ version:'swing_policy_v121', sourceId:'SYNTHETIC_V153_POLICY', effort:.8, compactness:.3,
        controlPriority:.5, effortVariation:.1, twoStrikeEffortDelta:-.2, twoStrikeCompactnessDelta:.4,
        maximumClockAccelerationPerSecond:40 } },
    pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:.06, minimumSpinRatio:.8 }, measuredClips:clips,
    batting:'balanced', pitchType:'fastball', location:'zone', physics:LIVE_MATCH_PHYSICS_V1 };
}
type Result = ReturnType<typeof simulateLivePitchV1>;
const motor = (result:Result) => result.diagnostics.directionMotorV153!;
const errors = (result:Result) => ({ timing:result.diagnostics.timingErrorSeconds, aim:result.diagnostics.aimErrorMeters,
  sweetSpot:result.diagnostics.sweetSpotT });
/** Keep signed zero, non-finite values, undefined, property order and all nested fields. */
function exactDigest(value:unknown):string {
  const hash = createHash('sha256');
  function visit(item:unknown):void {
    if (item === null || typeof item !== 'object') {
      if (['function', 'symbol', 'bigint'].includes(typeof item)) throw Error('non-record test value');
      hash.update(JSON.stringify([typeof item, typeof item === 'number' ? Object.is(item, -0) ? '-0' : String(item) : item]));return;
    }
    hash.update(Array.isArray(item) ? '[' : '{');
    for (const [key, child] of Object.entries(item)) { hash.update(JSON.stringify(key));visit(child); }
    hash.update(Array.isArray(item) ? ']' : '}');
  }
  visit(value);return hash.digest('hex');
}

it('retains the exact previous whole record when the direction motor policy is omitted', () => {
  const { batterDirectionMotorV153:_motor, ...legacy } = fixture(), before = structuredClone(legacy), result = simulateLivePitchV1(legacy);
  const { sampleBatAtTick, ...record } = result,
    fullData = { record, sampledBat:result.frames.map(frame => [frame.tick, sampleBatAtTick(frame.tick)]) };
  expect(exactDigest(fullData)).toBe('29d1b1a25fc9251535ab9bcd830da307985feff58132c2869039dce68aca71be');
  expect(Object.hasOwn(result.diagnostics, 'directionMotorV153')).toBe(false);expect(legacy).toEqual(before);
});

it('keeps the complete nominal direction plan identical while execution-only roots change actual errors and bat motion', () => {
  const input = fixture(), before = structuredClone(input), first = simulateLivePitchV1(input);
  expect(motor(first)?.status).toBe('PLANNED');expect(motor(first).nominalPlan).not.toBeNull();
  for (const seed of [0, 12345, 0xffffffff]) {
    const changed = simulateLivePitchV1({ ...input, randomnessV152:{ ...playPolicy, overrides:{ batterExecution:seed } } });
    expect(motor(changed).nominalPlan).toStrictEqual(motor(first).nominalPlan);
    expect(errors(changed)).not.toEqual(errors(first));expect(changed.frames.map(frame => frame.bat)).not.toEqual(first.frames.map(frame => frame.bat));
    expect(changed.diagnostics.sourceDescriptor).toEqual(first.diagnostics.sourceDescriptor);
    expect(changed.diagnostics.measuredClipId).toBe(first.diagnostics.measuredClipId);
    expect(changed.diagnostics.battingDirectionV149).toEqual(first.diagnostics.battingDirectionV149);
    expect(changed.diagnostics.batterObservationV151!.rawForecast).toEqual(first.diagnostics.batterObservationV151!.rawForecast);
  }
  expect(input).toEqual(before);
}, 30_000);

it('holds one fixed pre-decision pose regardless of later direction and execution draws', () => {
  let fixedPose:ReturnType<Result['sampleBatAtTick']> | undefined;
  for (const mode of ['CENTER', 'PULL', 'OPPOSITE'] as const) for (const seed of [0, 12345, 0xffffffff]) {
    const input = fixture(mode), result = simulateLivePitchV1({ ...input,
      randomnessV152:{ ...playPolicy, overrides:{ batterExecution:seed } } });
    expect(motor(result)?.status).toBe('PLANNED');
    const decisionTick = result.diagnostics.batterObservationV151!.decisionTick;
    for (const tick of [input.originTick, input.originTick + 20_000, input.originTick + 80_000, decisionTick - 1, decisionTick]) {
      const pose = result.sampleBatAtTick(tick);expect(pose).not.toBeNull();
      if (fixedPose === undefined) fixedPose = pose;
      expect(pose).toStrictEqual(fixedPose);
    }
  }
}, 30_000);

it('changes nominal movement for CENTER, PULL and OPPOSITE while reactive AUTO remains distinct from CENTER', () => {
  const center = simulateLivePitchV1(fixture('CENTER')), pull = simulateLivePitchV1(fixture('PULL')),
    opposite = simulateLivePitchV1(fixture('OPPOSITE')), reactive = simulateLivePitchV1(fixture('AUTO'));
  for (const result of [center, pull, opposite]) {
    expect(motor(result)?.status).toBe('PLANNED');expect(motor(result).nominalPlan).not.toBeNull();
    expect(result.diagnostics.batterObservationV151!.rawForecast).toEqual(center.diagnostics.batterObservationV151!.rawForecast);
    expect(errors(result)).toEqual(errors(center));
  }
  expect(motor(pull).nominalPlan).not.toEqual(motor(center).nominalPlan);
  expect(motor(opposite).nominalPlan).not.toEqual(motor(center).nominalPlan);
  expect(motor(pull).nominalPlan).not.toEqual(motor(opposite).nominalPlan);
  expect(pull.frames.map(frame => frame.bat)).not.toEqual(center.frames.map(frame => frame.bat));
  expect(opposite.frames.map(frame => frame.bat)).not.toEqual(center.frames.map(frame => frame.bat));
  expect(reactive.diagnostics.battingDirectionV149!.direction).toMatchObject({ kind:'REACTIVE', aim:null, pullAngleDegrees:null });
  expect(motor(reactive)).toMatchObject({ status:'PLANNED', nominalPlan:{version:'observed_reactive_registration_v161',nominalIntent:'REACTIVE',
    nominalFieldAngleDegrees:null,residualDegrees:null} });
  expect(reactive.frames.map(frame => frame.bat)).not.toEqual(center.frames.map(frame => frame.bat));
}, 30_000);

it('does not construct a direction motor plan from an undelivered position placeholder', () => {
  const result = simulateLivePitchV1({ ...fixture(), batterObservationV151:{ ...observationPolicy, deliveryLatencyTicks:300_000 } });
  expect(result.diagnostics.batterObservationV151!.rawForecast.status).toBe('NO_DELIVERED_OBSERVATIONS');
  expect(motor(result)).toMatchObject({ status:'NOT_APPLIED', nominalPlan:null, reason:'NO_SWING' });
  expect(result.diagnostics.swingOffered).toBe(false);
});

it('does not obtain a true velocity from a prior-only forecast with no current delivered observations', () => {
  const source = simulateLivePitchV1(fixture('AUTO')), forecast = source.diagnostics.batterObservationV151!.rawForecast,
    evidence = createBatterObservedEvidenceV151({ evidenceId:'past-only', observerPlayerId:'b', pitcherId:'p', pitchOrdinal:1,
      forecast, regionId:null })!,
    memory = appendBatterObservedEvidenceV151(createEmptyBatterObservedMemoryV151({ observerPlayerId:'b', pitcherId:'p' }),
      evidence, observationPolicy.memoryPolicy, forecast.cutoffTick),
    result = simulateLivePitchV1({ ...fixture(), originTick:3_000_000,
      batterObservedMemoryV151:{ memory, observerPlayerId:'b', pitcherId:'p' },
      batterObservationV151:{ ...observationPolicy, deliveryLatencyTicks:300_000 } });
  expect(result.diagnostics.batterObservationV151!.rawForecast.status).toBe('NO_DELIVERED_OBSERVATIONS');
  expect(result.diagnostics.batterObservationV151!.preparedRecall).not.toBeNull();
  expect(result.diagnostics.batterObservationV151!.effectivePriorWeight).toBe(1);
  expect(motor(result)).toMatchObject({ status:'NOT_APPLIED', nominalPlan:null, reason:'NO_OBSERVED_VELOCITY' });
});

it('leaves TAKE and BUNT with their existing control owners', () => {
  for (const batting of ['take', 'bunt'] as const) {
    const input = { ...fixture(), batting }, result = simulateLivePitchV1(input),
      { batterDirectionMotorV153:_motor, ...legacy } = input;
    expect(motor(result)).toMatchObject({ status:'NOT_APPLIED', nominalPlan:null, reason:batting === 'take' ? 'NO_SWING' : 'BUNT_MOTOR' });
    expect(result.frames).toEqual(simulateLivePitchV1(legacy).frames);
  }
});

it('requires the explicit V151 observer rather than using the legacy private-state predictor', () => {
  const { batterObservationV151:_observer, ...input } = fixture();
  expect(() => simulateLivePitchV1(input)).toThrow(/observation|observer|v151/i);
  expect(() => createLiveBaseballMatchWorkerV116({ ...liveMatchFixture(2468), batterDirectionMotorV153:motorPolicy }))
    .toThrow(/observation|observer|v151/i);
});

it('preserves the motor policy through Host/practice preview, accepted capture and serialized restart', () => {
  const base = liveMatchFixture(2468), config = { ...base, randomnessV152:matchPolicy,
    batterObservationV151:observationPolicy, batterDirectionMotorV153:motorPolicy,
    players:base.players.map(player => ({ ...player, physical:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
      maximumSweetSpotSpeedMps:50, targetSweetSpotSpeedMps:30,
      swingDecision:{ approach:'SWING' as const, threshold:0, aggressionWeight:1 } } })) },
    host = createLiveBaseballMatchWorkerV116(config), practice = createLiveBattingPracticeV150(config),
    take = { managedTeam:0 as const, batting:'take' as const, pitchType:'auto', location:'auto' };
  expect(practice.issuePitch({ batting:'take' })).toEqual(host.issuePitch(take));
  const before = practice.capture(), requestV150 = { batting:'balanced' as const, battingDirectionRequestV149:request('PULL') },
    one = practice.preview(requestV150), two = practice.preview(requestV150),
    resumed = createLiveBaseballMatchWorkerV116(config, structuredClone(host.captureContinuationV116()));
  expect(practice.capture()).toEqual(before);expect(one.record).toEqual(two.record);
  const diagnostic = two.record.play.diagnostics as Result['diagnostics'];
  expect(diagnostic.directionMotorV153?.status).toBe('PLANNED');
  expect(two.record).toEqual(host.issuePitch({ ...take, ...requestV150 }));
  expect(practice.accept(two)).toEqual(resumed.issuePitch({ ...take, ...requestV150 }));
  expect(practice.capture().continuation).toEqual(host.captureContinuationV116());
  expect(practice.capture().configuration.batterDirectionMotorV153).toEqual(motorPolicy);
  const restoredPractice = createLiveBattingPracticeV150(config, structuredClone(practice.capture()));
  expect(restoredPractice.issuePitch({ batting:'take' })).toEqual(practice.issuePitch({ batting:'take' }));
}, 60_000);

it('binds continuation to the exact explicit motor policy and rejects introduction, removal and mutation', () => {
  const legacy = { ...liveMatchFixture(2468), batterObservationV151:observationPolicy },
    config = { ...legacy, batterDirectionMotorV153:motorPolicy }, host = createLiveBaseballMatchWorkerV116(config),
    saved = host.captureContinuationV116(), legacySaved = createLiveBaseballMatchWorkerV116(legacy).captureContinuationV116();
  expect(() => createLiveBaseballMatchWorkerV116({ ...config, batterDirectionMotorV153:{ ...motorPolicy, sourceId:'different' } }, saved))
    .toThrow(/direction|motor/i);
  expect(() => createLiveBaseballMatchWorkerV116(legacy, saved)).toThrow(/direction|motor/i);
  expect(() => createLiveBaseballMatchWorkerV116(config, legacySaved)).toThrow(/direction|motor/i);
  expect(host.captureContinuationV116()).toEqual(saved);
});

it.each([1, 3, 4] as const)('retains the public left clip local impact window at level %s inside the finite motor gate', level => {
  const clip = (clips as LiveMeasuredClipV1[]).find(candidate => candidate.id === 'obp-51_3')!;
  expect(clip.side).toBe('L');
  const before = structuredClone(clip), input:MotorInput = { originTick:1_000_000, seed:31,
    randomnessV152:playPolicy, batterObservationV151:observationPolicy, batterDirectionMotorV153:motorPolicy,
    battingDirectionRequestV149:request('CENTER'),
    batter:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters:1.8, bats:'L', clipId:clip.id,
      timingStdSeconds:0, aimStdMeters:0, maximumSweetSpotSpeedMps:50, targetSweetSpotSpeedMps:30, motorLatencySeconds:.04,
      swingDecision:{ approach:'SWING', threshold:0, aggressionWeight:1 }, impactTrajectory:{ ...DEFAULT_IMPACT_TRAJECTORY_V1, level } },
    pitcher:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters:0 }, batting:'balanced', pitchType:'fastball', location:'inside',
    measuredClips:[clip], physics:LIVE_MATCH_PHYSICS_V1 };
  let result:Result;
  try { result = simulateLivePitchV1(input); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    // A finite preparation/body search may reject this form. A missing measured
    // impact boundary is a contract error, and is deliberately not accepted.
    expect(error.message).toContain('有限候補で実行可能な準備・回復を確認できません');
    expect(clip).toStrictEqual(before);return;
  }
  expect(result.clipId).toBe(clip.id);
  expect(result.diagnostics.impactTrajectory).toMatchObject({ ...DEFAULT_IMPACT_TRAJECTORY_V1, level,
    model:'COMPACT_C2_RIGID_CONTACT_PIVOT', launchAngleOrSpinOverridden:false });
  expect(result.diagnostics.batPlaybackV88!.sourceFirstTick).toBeLessThanOrEqual(clip.contactTimeSeconds * 1e6 - DEFAULT_IMPACT_TRAJECTORY_V1.beforeSeconds * 1e6);
  expect(clip).toStrictEqual(before);
}, 30_000);

