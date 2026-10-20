import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createSourceFreeBallKernel, type SourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { resolveHeightRatioStrikeZoneRegion } from '../../core/sim/pitching/RulebookStrikeZone';
import { IDENTITY_QUATERNION } from '../../core/sim/pitching/BaseballOrientation';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1, type LivePlayerV1 } from './LiveBaseballMatchV1';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { resolveLiveTechnicalTraitsV75, resolveLiveTraitPreferencesV54 } from './LiveTraitProfilesV1';
import { resolveLiveExecutionPhysicalV77 } from './LiveTraitRuntimeV77';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error('pitcher workbench: ' + message); }
const freeze = <T>(value: T): T => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export type PitcherWorkbenchBuildInputV77 = Readonly<{ players: readonly LivePlayerV1[]; roster?: LivePhysicalRosterInputV1;
  pitcherId: string; batterId: string; catcherId: string; measuredClips: readonly LiveMeasuredClipV1[];
  seed: number; originTick?: number; pitchType: string; pitchId?: string; location: string }>;
/** The same authoring projection, one runtime trait owner and catcher controls as Host. */
export function buildPitcherWorkbenchInputV77(raw: PitcherWorkbenchBuildInputV77): LivePitchInputV1 {
  // The measured library is bounded by the caller's selected clips, not a second model.
  const input = cloneInert(raw);
  assert(Object.keys(input).every(k => ['players','roster','pitcherId','batterId','catcherId','measuredClips','seed','originTick','pitchType','pitchId','location'].includes(k)), 'unknown construction fields');
  assert(['pitcherId','batterId','catcherId'].every(k => typeof input[k as 'pitcherId'] === 'string' && input[k as 'pitcherId'].length > 0)
    && Number.isSafeInteger(input.seed) && input.seed >= 0 && input.seed <= 0xffffffff
    && (input.originTick === undefined || Number.isSafeInteger(input.originTick) && input.originTick >= 0), 'invalid construction identity or clock');
  const players = input.roster ? applyLivePhysicalRosterV1({ players: input.players, roster: input.roster }).players : input.players,
    pitcher = players.find(p => p.playerId === input.pitcherId), batter = players.find(p => p.playerId === input.batterId), catcher = players.find(p => p.playerId === input.catcherId);
  assert(pitcher && batter && catcher, 'pitcher, batter and catcher are required');
  const physical = (p: LivePlayerV1) => resolveLiveExecutionPhysicalV77(p.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, p.traitProfile),
    pp = physical(pitcher), bp = physical(batter), cp = physical(catcher), bt = resolveLiveTechnicalTraitsV75(batter.traitProfile), pt = resolveLiveTechnicalTraitsV75(pitcher.traitProfile),
    clips = input.measuredClips.filter(c => c.side === batter.bats && (bp.clipId === undefined ? c.defaultSelection !== false : c.id === bp.clipId));
  assert(clips.length > 0, 'actual batting-side measured clip required');
  return freeze({ originTick: input.originTick ?? 1_000_000, seed: input.seed,
    batter: { ...bp, heightMeters: batter.heightMeters, bats: batter.bats, ...(bt ? { technicalSkills: bt } : {}) },
    pitcher: { ...pp, heightMeters: pitcher.heightMeters, moundPosition: LIVE_MATCH_MOUND_SURFACE_V1,
      ...(pitcher.throws === undefined ? {} : { throws: pitcher.throws }), ...(pt ? { technicalSkills: pt } : {}),
      pitchApproach: resolveLiveTraitPreferencesV54(pitcher.traitProfile).pitchApproach },
    catcher: { gloveSpeedMps: cp.gloveSpeedMps, gloveReachMeters: cp.gloveReachMeters, gloveRadiusMeters: cp.gloveRadiusMeters,
      retentionCapacityJ: cp.retentionCapacityJ, captureDissipationPowerW: cp.captureDissipationPowerW, pocketRadiusMeters: .14, ...(cp.defensiveDecisionSeconds===undefined?{}:{defensiveDecisionSeconds:cp.defensiveDecisionSeconds}),
      ...(cp.zoneRecognitionV87===undefined?{}:{zoneRecognitionV87:cp.zoneRecognitionV87}) },
    measuredClips: clips, batting: 'take', pitchType: input.pitchType, ...(input.pitchId === undefined ? {} : { pitchId: input.pitchId }), location: input.location, physics: LIVE_MATCH_PHYSICS_V1 });
}
function planeTime(kernel: SourceFreeBallKernel, plane: number): number | null {
  for (const cell of kernel.cells) {
    const from = kernel.evaluateAt(cell.fromElapsedSeconds).moment.ball.position.z, through = kernel.evaluateAt(cell.throughElapsedSeconds).moment.ball.position.z;
    if (from < plane || through > plane) continue;
    let lo = cell.fromElapsedSeconds, hi = cell.throughElapsedSeconds;
    for (let n = 0; n < 60 && hi - lo > 1e-12; n++) {
      const mid = (lo + hi) / 2; if (kernel.evaluateAt(mid).moment.ball.position.z <= plane) hi = mid; else lo = mid;
    }
    return hi;
  }
  return null;
}
export function simulatePitcherWorkbenchV77(raw: Readonly<{ pitch: LivePitchInputV1; context?: Readonly<{ pitcherId: string; batterId: string }> }>) {
  const packet = cloneInert(raw);
  assert(packet && Object.keys(packet).every(k => ['pitch', 'context'].includes(k)) && packet.pitch, 'pitch input required');
  if (packet.context !== undefined) assert(packet.context && typeof packet.context === 'object' && !Array.isArray(packet.context)
    && Object.keys(packet.context).length === 2 && Object.keys(packet.context).every(k => ['pitcherId','batterId'].includes(k))
    && [packet.context.pitcherId,packet.context.batterId].every(id => typeof id === 'string' && id.length > 0 && id.length <= 200), 'invalid observation context');
  const input: LivePitchInputV1 = { ...packet.pitch, batting: 'take' }, pitch = simulateLivePitchV1(input),
    descriptor = pitch.diagnostics.sourceDescriptor, kernel = createSourceFreeBallKernel(descriptor), fixedInitial = descriptor.initial.ball,
    baselineInitial = { ...fixedInitial, spin: { x: 0, y: 0, z: 0 } }, baselineDescriptor = { ...descriptor, initial: { ...descriptor.initial, ball: baselineInitial } },
    baseline = createSourceFreeBallKernel(baselineDescriptor), seconds = planeTime(kernel, .15);
  assert(seconds !== null, 'actual Source did not reach the plate plane');
  const actual = kernel.evaluateAt(seconds).moment.ball, baselineSeconds = planeTime(baseline, .15);
  let baselinePosition = baselineSeconds === null ? null : baseline.evaluateAt(baselineSeconds).moment.ball.position;
  // A hypothetical no-spin path can pass below the field before reaching home.
  // In that case report the air-only counterfactual explicitly, never move the real ball.
  if (baselinePosition === null) {
    let lo = 0, hi = descriptor.throughElapsedSeconds;
    assert(sampleAerodynamicPitchStateAtElapsedSeconds(baselineInitial, hi, descriptor.profile.air, descriptor.materialOrientationAtStart).position.z <= .15, 'counterfactual did not reach plate plane');
    for (let n = 0; n < 60 && hi - lo > 1e-12; n++) {
      const mid = (lo + hi) / 2; if (sampleAerodynamicPitchStateAtElapsedSeconds(baselineInitial, mid, descriptor.profile.air, descriptor.materialOrientationAtStart).position.z <= .15) hi = mid; else lo = mid;
    }
    baselinePosition = sampleAerodynamicPitchStateAtElapsedSeconds(baselineInitial, hi, descriptor.profile.air, descriptor.materialOrientationAtStart).position;
  }
  const metrics = { strikeZone: resolveHeightRatioStrikeZoneRegion({ plateCenterX: 0, playerPhysicalProfile: { heightMeters: input.batter.heightMeters } }), platePosition: actual.position, baselinePlatePosition: baselinePosition, flightSeconds: seconds,
    speedKmh: Math.hypot(actual.velocity.x, actual.velocity.y, actual.velocity.z) * 3.6, releaseSpeedKmh: pitch.speedKmh,
    spinRpm: Math.hypot(fixedInitial.spin.x, fixedInitial.spin.y, fixedInitial.spin.z) * 60 / (2 * Math.PI),
    horizontalBreakCm: (actual.position.x - baselinePosition.x) * 100, verticalBreakCm: (actual.position.y - baselinePosition.y) * 100,
    baselineGroundIgnored: baselineSeconds === null, measurementPlaneZ: .15,
    movementBasis: 'SAME_INITIAL_POSITION_AND_VELOCITY_ZERO_SPIN_SAME_PLATE_PLANE' as const };
  const sampleAtPitchElapsedSeconds = (at: number) => {
    assert(Number.isFinite(at) && at >= 0, 'nonnegative observation seconds required');
    if (at > descriptor.throughElapsedSeconds) return null;
    const observation = kernel.evaluateAt(at), ball = observation.moment.ball;
    return freeze({ ...ball, elapsedSeconds: at, orientation: observation.materialOrientation ?? observation.orientation, phase: observation.phase });
  };
  const sampleBaselineAtPitchElapsedSeconds = (at: number) => {
    assert(Number.isFinite(at) && at >= 0, 'nonnegative baseline observation seconds required');
    if (at > descriptor.throughElapsedSeconds) return null;
    if (baselineSeconds === null) return freeze({ ...sampleAerodynamicPitchStateAtElapsedSeconds(baselineInitial, at, descriptor.profile.air, descriptor.materialOrientationAtStart),
      elapsedSeconds: at, orientation: descriptor.materialOrientationAtStart ?? IDENTITY_QUATERNION, phase: 'airborne' as const, counterfactualGroundIgnored: true });
    const observation = baseline.evaluateAt(at);
    return freeze({ ...observation.moment.ball, elapsedSeconds: at, orientation: observation.materialOrientation ?? observation.orientation, phase: observation.phase, counterfactualGroundIgnored: false });
  };
  return freeze({ version: 77 as const, authority: 'SHARED_LIVE_PITCHER_WORKBENCH' as const, nativeAdmission: false as const,
    officialResult: null, input, pitch, context: packet.context ?? null, fixedInitial, baselineInitial, baselineDescriptor, metrics, sampleAtPitchElapsedSeconds, sampleBaselineAtPitchElapsedSeconds });
}
