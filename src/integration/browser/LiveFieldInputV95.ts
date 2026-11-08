import { liveFielderBodyControlBoundsV105, resolveLiveFielderBodyModelV105, type LiveFielderBodyPoseV105 } from '../../core/sim/fielding/LiveFielderBodyGeometryV105';
import type { Vec3 } from '../../core/model/geometry';
import type { TechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
import type { LiveFieldPlayInputV1, LiveFielderV1, LiveRunnerV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import type { LivePlayerPhysicalV1, LivePositionV1 } from './LiveBaseballMatchV1';
import {liveAthleticControlBoundsV115,resolveLiveAthleticProfileV115} from '../../core/sim/LiveAthleticControlsV115';
import {isLiveCautiousFieldingV117,type LiveTraitProfileV1} from './LiveTraitProfilesV1';
import {validateLiveRandomnessV152,type LiveRandomnessV152} from '../../core/rng/LiveRandomStreamsV152';

export type LiveFieldResolvedPlayerV95 = Readonly<{ playerId: string; physical: LivePlayerPhysicalV1; heightMeters?: number;
  technicalSkills?: TechnicalSkillControlsV75; traitProfile?: LiveTraitProfileV1 }>;
export type LiveFieldInputRequestV95 = Readonly<{
  ball: LiveFieldPlayInputV1['ball']; orientation?: LiveFieldPlayInputV1['orientation'];
  physics: LiveFieldPlayInputV1['physics']; seed?: number; field: LiveFieldPlayInputV1['field'];
  randomnessV152?:LiveRandomnessV152;
  outs: number; maxPlaySeconds?: number; frameSeconds?: number;
  defense: Readonly<Record<LivePositionV1, string>>; placements: Readonly<Record<LivePositionV1, Vec3>>;
  /** Effective physical and technical controls are resolved by the caller once. */
  players: readonly LiveFieldResolvedPlayerV95[];
  batterRunnerId: string; batterPosition: Vec3;
  occupiedBases: Readonly<Record<'first' | 'second' | 'third', string | null>>;
  baserunning: 'conservative' | 'balanced' | 'aggressive';
}>;

/** Inverse of the authored-height mapping for a captured Source frame. A new
 * height-based hip is not itself a legacy placement.y. Old records retain their
 * exact historical placement, including any authored elevation. */
export function restoreLiveFieldAuthoredPlacementV105(source: Readonly<{ position: Vec3;
  bodyPoseV105?: Pick<LiveFielderBodyPoseV105, 'foot'> }>, role: LivePositionV1): Vec3 {
  return { ...source.position, y: source.bodyPoseV105 ? source.bodyPoseV105.foot.y + (role === 'C' ? .85 : .9) : source.position.y };
}

/** Host and investigation share this input mapping. No result, ability tier,
 * trait resolution, roster default or position-dependent ability is added here. */
export function buildLiveFieldPlayInputV95(request: LiveFieldInputRequestV95): LiveFieldPlayInputV1 {
  const randomnessV152=request.randomnessV152===undefined?undefined:validateLiveRandomnessV152(request.randomnessV152,'PLAY');
  const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
  const players = new Map(request.players.map(p => [p.playerId, p]));
  if (players.size !== request.players.length) throw Error('live field input: duplicate resolved player');
  const get = (id: string) => {
    const player = players.get(id);
    if (!player) throw Error('live field input: missing resolved player ' + id);
    if (player.physical.basis !== 'EXPLICIT_AUTHORED_SI_V1') throw Error('live field input: unknown SI basis for ' + id);
    const scale = player.physical.fieldingReactionScaleV98;
    if (scale !== undefined && (!Number.isFinite(scale) || scale < 0 || scale > 4))
      throw Error('live field input: invalid field reaction scale for ' + id);
    return player;
  };
  const adjustment = request.baserunning === 'aggressive' ? -.25 : request.baserunning === 'conservative' ? .25 : 0;
  const runningMargin = (p: LivePlayerPhysicalV1) => Math.max(0, Math.min(3, (p.baserunningSafetyMarginSeconds ?? .35) + adjustment));
  const athletic=(heightMeters:number|undefined,p:LivePlayerPhysicalV1)=>heightMeters===undefined?undefined:resolveLiveAthleticProfileV115({heightMeters,
    accelerationMps2:p.accelerationMps2,reactionSeconds:p.reactionSeconds,gloveSpeedMps:p.gloveSpeedMps,
    controls:Object.fromEntries(Object.keys(liveAthleticControlBoundsV115).filter(k=>p[k as keyof typeof liveAthleticControlBoundsV115]!==undefined).map(k=>[k,p[k as keyof typeof liveAthleticControlBoundsV115]]))});
  const fielders: LiveFielderV1[] = roles.map(role => {
    const playerId = request.defense[role], { physical: p, technicalSkills, heightMeters, traitProfile } = get(playerId),
      bodyModelV105 = heightMeters === undefined ? undefined : resolveLiveFielderBodyModelV105(heightMeters, p.gloveReachMeters, Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k => p[k as keyof typeof liveFielderBodyControlBoundsV105] !== undefined).map(k => [k, p[k as keyof typeof liveFielderBodyControlBoundsV105]]))),
      placement = request.placements[role];
    return { playerId, ...(technicalSkills ? { technicalSkills } : {}), defensivePosition: role,
      ...(p.fieldRelationshipsV99 === undefined ? {} : { fieldRelationshipsV99: p.fieldRelationshipsV99 }),
      ...(bodyModelV105 === undefined ? {} : { bodyModelV105 }),
      ...(heightMeters===undefined?{}:{athleticProfileV115:athletic(heightMeters,p)}),
      // Legacy placement.y is the old hip anchor. Retain only authored elevation.
      position: { ...placement, y: bodyModelV105 === undefined ? placement.y
        : placement.y - (role === 'C' ? .85 : .9) + bodyModelV105.hipHeightMeters }, reactionSeconds: p.reactionSeconds * (p.fieldingReactionScaleV98 ?? 1), topSpeedMps: p.topSpeedMps,
      accelerationMps2: p.accelerationMps2,
      fieldingCognition: { decisionSeconds: p.defensiveDecisionSeconds ?? 0, pursuitCostWeight: p.fieldingPursuitCostWeight ?? 1,
        ...(isLiveCautiousFieldingV117(traitProfile) ? { cautious:true } : {}) },
      gloveSpeedMps: p.gloveSpeedMps, gloveReachMeters: p.gloveReachMeters, gloveRadiusMeters: p.gloveRadiusMeters,
      catchRetention: { ticksPerSecond: request.physics.air.ticksPerSecond, ballMassKg: .145, ballRadiusMeters: .0366,
        pocketRadiusMeters: .14, centerRetentionCapacityJ: p.retentionCapacityJ, captureDissipationPowerW: p.captureDissipationPowerW,
        failedContactRestitution: .2, failedTangentialDamping: .35, failedSpinDamping: .2 },
      transferSeconds: p.transferSeconds, ...(p.transferDelayMaxSecondsV101 === undefined ? {} : { transferDelayMaxSecondsV101: p.transferDelayMaxSecondsV101 }),
      ...(p.throwEffortBuildSecondsV103 === undefined ? {} : { throwEffortBuildSecondsV103: p.throwEffortBuildSecondsV103 }),
      throwSpeedMps: p.throwSpeedMps, throwBackspinRadPerSecond: 120,
      ...(p.throwDirectionStdRadians === undefined ? {} : { throwDirectionStdRadians: p.throwDirectionStdRadians }) };
  });
  const runner = (runnerId: string, initialBase: 0 | 1 | 2 | 3): LiveRunnerV1 => {
    const { physical: p, technicalSkills,heightMeters } = get(runnerId);
    return { runnerId, ...(technicalSkills ? { technicalSkills } : {}), initialBase,
      ...(heightMeters===undefined?{}:{athleticProfileV115:athletic(heightMeters,p)}),
      ...(initialBase === 0 ? { position: { ...request.batterPosition } } : {}),
      topSpeedMps: p.topSpeedMps, accelerationMps2: p.accelerationMps2, reactionSeconds: p.reactionSeconds,
      advanceSafetyMarginSeconds: runningMargin(p), roundingRadiusMeters: p.baserunningTurnRadiusMeters ?? 4.5,
      lateralAccelerationMps2: p.baserunningLateralAccelerationMps2 ?? 1.5 * p.accelerationMps2 };
  };
  const runners = [runner(request.batterRunnerId, 0), ...(['first', 'second', 'third'] as const).flatMap((key, i) => {
    const runnerId = request.occupiedBases[key];
    return runnerId === null ? [] : [runner(runnerId, (i + 1) as 1 | 2 | 3)];
  })];
  return { ball: request.ball, physics: request.physics, field: request.field,defenseDecisionModeV118:'individual',
    ...(request.orientation === undefined ? {} : { orientation: request.orientation }),
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...(randomnessV152===undefined?{}:{randomnessV152}),
    ...(request.frameSeconds === undefined ? {} : { frameSeconds: request.frameSeconds }),
    fielders, runners, outs: request.outs, maxPlaySeconds: request.maxPlaySeconds ?? 45 };
}
