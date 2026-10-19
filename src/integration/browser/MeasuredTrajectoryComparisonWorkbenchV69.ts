import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../../core/sim/ball/SourceFreeBallKernel';
import type { FreeBaseballSample } from '../../core/sim/ball/FreeBaseballTrajectory';
import type { Vec3 } from '../../core/model/geometry';
import { DEFAULT_IMPACT_TRAJECTORY_V1, validateImpactTrajectorySettingsV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { IDENTITY_QUATERNION, multiplyQuaternions, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';

export type MeasuredTrajectoryComparisonInputV69 = Readonly<{
  /** The selected player's already projected physical values, actual pitcher /
   * catcher, and one explicit measured clip. Trait preferences are resolved by
   * the same Host command rules before calling this experiment. */
  pitch: LivePitchInputV1;
  afterContactSeconds?: number;
}>;
export type MeasuredTrajectoryFlightFrameV69 = Readonly<{
  tick: number; elapsedSeconds: number; position: Vec3; velocity: Vec3; spin: Vec3;
  orientation: Quaternion; phase: FreeBaseballSample['phase']; visible: true;
}>;
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('measured trajectory comparison: ' + message);
}
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

/** Four actual LivePitch executions. Only the local trajectory level changes.
 * No pitch is redrawn, hit guaranteed, contact clock aligned, or exit state
 * assigned after collision. After contact this observes the same continuous
 * Aero/ground Source kernel as the ordinary field, without fielders or walls;
 * a first landing side is geometric information, not an official hit/foul/HR. */
export function compareMeasuredTrajectoriesV69(raw: MeasuredTrajectoryComparisonInputV69) {
  const input = cloneInert(raw);
  assert(input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).every(k => ['pitch', 'afterContactSeconds'].includes(k)) && Object.hasOwn(input, 'pitch'), 'unsupported comparison fields');
  const fixedInput = input.pitch, duration = input.afterContactSeconds ?? 8;
  assert(Number.isFinite(duration) && duration >= .1 && duration <= 30, 'after-contact observation must be .1 to 30 seconds');
  assert(fixedInput && Array.isArray(fixedInput.measuredClips) && fixedInput.measuredClips.length === 1
    && typeof fixedInput.batter?.clipId === 'string' && fixedInput.batter.clipId.length > 0, 'one explicit measured clip is required');
  const clip = fixedInput.measuredClips[0];
  assert(clip.id === fixedInput.batter.clipId && clip.side === fixedInput.batter.bats, 'measured clip identity or batting side differs');
  const settings = validateImpactTrajectorySettingsV1(fixedInput.batter.impactTrajectory ?? DEFAULT_IMPACT_TRAJECTORY_V1),
    cases = ([1, 2, 3, 4] as const).map(level => {
      const pitch = simulateLivePitchV1({ ...fixedInput, batter: { ...fixedInput.batter, impactTrajectory: { ...settings, level } } });
      const contact = pitch.contact, moment = pitch.contactMoment;
      let flightDescriptor: SourceFreeBallDescriptorV2 | null = null;
      let flightFrames: MeasuredTrajectoryFlightFrameV69[] = [];
      let firstGroundContact: Readonly<{ tick: number; elapsedSeconds: number; position: Vec3 }> | null = null;
      let firstGroundSide: 'FAIR_SIDE' | 'FOUL_SIDE' | 'FOUL_LINE' | null = null;
      let sampleFlightAtPitchElapsedSeconds: (seconds: number) => MeasuredTrajectoryFlightFrameV69 | null = seconds => {
        assert(Number.isFinite(seconds) && seconds >= 0, 'invalid pitch elapsed observation time'); return null;
      };
      if (contact && moment) {
        const outgoing = { ...moment, ball: { ...moment.ball, velocity: contact.exitVelocity, spin: contact.exitSpin } },
          through = moment.elapsedSeconds + duration,
          kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2', initial: outgoing,
            throughElapsedSeconds: through, profile: fixedInput.physics }), orientationBasis = pitch.contactOrientation ?? IDENTITY_QUATERNION;
        flightDescriptor = kernel.descriptor;
        sampleFlightAtPitchElapsedSeconds = seconds => {
          assert(Number.isFinite(seconds) && seconds >= 0, 'invalid pitch elapsed observation time');
          if (seconds < moment.elapsedSeconds || seconds > through) return null;
          const sample = kernel.evaluateAt(seconds), ball = sample.moment.ball;
          return freeze({ tick: ball.tick, elapsedSeconds: sample.moment.elapsedSeconds, position: ball.position,
            velocity: ball.velocity, spin: ball.spin, orientation: multiplyQuaternions(sample.orientation, orientationBasis), phase: sample.phase, visible: true as const });
        };
        // These are observations only; the actual continuous Source is exposed
        // separately for zoom/seek, and is never interpolated from these frames.
        const times = new Set<number>([moment.elapsedSeconds, through]);
        for (let i = 1; i * .02 < duration; i++) times.add(moment.elapsedSeconds + i * .02);
        const landing = kernel.boundaries.find(b => b.kind === 'ground');
        if (landing) {
          const ball = kernel.evaluateAt(landing.elapsedSeconds, 'incoming').moment.ball;
          firstGroundContact = { tick: ball.tick, elapsedSeconds: landing.elapsedSeconds, position: ball.position };
          const lineX = Math.abs(ball.position.x);
          firstGroundSide = ball.position.z === lineX ? 'FOUL_LINE' : ball.position.z > lineX ? 'FAIR_SIDE' : 'FOUL_SIDE';
          times.add(landing.elapsedSeconds);
        }
        flightFrames = [...times].sort((a, b) => a - b).map(t => sampleFlightAtPitchElapsedSeconds(t)!);
      }
      const exitSpeedMps = contact ? norm(contact.exitVelocity) : null;
      return { level, pitch, flightDescriptor, flightFrames, sampleFlightAtPitchElapsedSeconds,
        metrics: { exitSpeedMps, launchAngleDegrees: contact ? Math.atan2(contact.exitVelocity.y, Math.hypot(contact.exitVelocity.x, contact.exitVelocity.z)) * 180 / Math.PI : null,
          spinRpm: contact ? norm(contact.exitSpin) * 60 / (2 * Math.PI) : null,
          carryMeters: firstGroundContact && contact ? Math.hypot(firstGroundContact.position.x - contact.ballCenter.x, firstGroundContact.position.z - contact.ballCenter.z) : null,
          firstGroundContact, firstGroundSide } };
    });
  const first = cases[0].pitch.diagnostics;
  for (const row of cases) {
    const d = row.pitch.diagnostics;
    for (const key of ['sourceDescriptor', 'timingErrorSeconds', 'aimErrorMeters', 'sweetSpotT', 'zoneJudgment', 'measuredClipId', 'obpSourceSha256'] as const)
      assert(JSON.stringify(d[key]) === JSON.stringify(first[key]), 'trajectory levels changed fixed input: ' + key);
  }
  return freeze({ version: 69 as const, authority: 'SHARED_LIVE_PITCH_TRAJECTORY_COMPARISON' as const, nativeAdmission: false as const,
    officialResult: null, fixedInput, afterContactSeconds: duration, cases,
    invariants: { variedField: 'pitch.batter.impactTrajectory.level' as const, seed: fixedInput.seed, originTick: fixedInput.originTick,
      sourceDescriptorEqual: true as const, timingErrorEqual: true as const, aimErrorEqual: true as const, sweetSpotTEqual: true as const,
      zoneJudgmentEqual: true as const, measuredClipEqual: true as const, impactClocksRealigned: false as const,
      fieldersAndWallsApplied: false as const, ballExitStateOverridden: false as const } });
}
