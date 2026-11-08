import { expect, it } from 'vitest';
import { buildLiveFieldPlayInputV95, restoreLiveFieldAuthoredPlacementV105, type LiveFieldInputRequestV95 } from './LiveFieldInputV95';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_BASES_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';

const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const request = (): LiveFieldInputRequestV95 => ({
  ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: { x: 0, y: .4, z: .3 },
    velocity: { x: 15, y: -1, z: 28 }, spin: { x: 0, y: 0, z: 0 } } },
  physics: LIVE_MATCH_PHYSICS_V1, seed: 987,
  field: { bases: LIVE_MATCH_BASES_V1, fenceRadiusMeters: 110, fenceHeightMeters: 3 },
  outs: 1, defense: Object.fromEntries(roles.map(role => [role, `def-${role}`])) as LiveFieldInputRequestV95['defense'],
  placements: Object.fromEntries(roles.map((role, i) => [role, { x: i, y: .9, z: 20 + i }])) as LiveFieldInputRequestV95['placements'],
  players: [...roles.map(role => ({ playerId: `def-${role}`, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    throwSpeedMps: 31, defensiveDecisionSeconds: .04, throwDirectionStdRadians: .011 }, technicalSkills: { advanced_fielding: .7 } })),
  ...['batter', 'at-second'].map(playerId => ({ playerId, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    baserunningSafetyMarginSeconds: .4, baserunningTurnRadiusMeters: 3.2, baserunningLateralAccelerationMps2: 7 } }))],
  batterRunnerId: 'batter', batterPosition: { x: -.85, y: 0, z: -.2 },
  occupiedBases: { first: null, second: 'at-second', third: null }, baserunning: 'balanced',
});

it('connects normal play and practice to individual decisions without changing authored capabilities',()=>{
 const source=request(),input=buildLiveFieldPlayInputV95(source);
 expect(input.defenseDecisionModeV118).toBe('individual');
 expect(input.recordDecisionTraceV118).toBeUndefined();
 expect(input.fielders[0].throwSpeedMps).toBe(source.players[0].physical.throwSpeedMps);
});

it('carries explicit cautious ownership independently of its effective individual pursuit cost',()=>{
 const source=request(),profile={version:'live_trait_profile_v2' as const,selections:[{familyId:'fielding_aggression',stateId:'CAUTIOUS',source:{effectScale:1}}]},
  withTrait={...source,players:source.players.map(p=>({...p,traitProfile:profile}))},
  input=buildLiveFieldPlayInputV95(withTrait);
 expect(input.fielders.every(f=>f.fieldingCognition?.cautious===true)).toBe(true);
 expect(input.fielders[0].fieldingCognition?.pursuitCostWeight).toBe(1);
 const zero=buildLiveFieldPlayInputV95({...source,players:source.players.map(p=>({...p,traitProfile:{...profile,selections:[{...profile.selections[0],source:{effectScale:0}}]}}))});
 expect(zero.fielders.every(f=>f.fieldingCognition?.cautious===undefined)).toBe(true);
 expect(source.players[0].physical).toEqual(withTrait.players[0].physical);
});

it('shares the Host SI mapping while preserving already resolved traits and the actual batter position', () => {
  const source = request(), before = JSON.stringify(source), input = buildLiveFieldPlayInputV95(source);
  expect(input.fielders).toHaveLength(9); expect(input.runners).toHaveLength(2);
  expect(input.fielders.map(f => f.defensivePosition)).toEqual(roles);
  expect(input.fielders[0]).toMatchObject({ playerId: 'def-P', position: source.placements.P,
    reactionSeconds: .18, fieldingCognition: { decisionSeconds: .04, pursuitCostWeight: 1 },
    technicalSkills: { advanced_fielding: .7 }, throwSpeedMps: 31, transferSeconds: .46, throwDirectionStdRadians: .011,
    catchRetention: { ticksPerSecond: 1_000_000, ballMassKg: .145, ballRadiusMeters: .0366,
      pocketRadiusMeters: .14, failedContactRestitution: .2, failedTangentialDamping: .35, failedSpinDamping: .2 } });
  expect(input.runners[0]).toMatchObject({ runnerId: 'batter', initialBase: 0, position: source.batterPosition,
    advanceSafetyMarginSeconds: .4, roundingRadiusMeters: 3.2, lateralAccelerationMps2: 7 });
  expect(input.runners[1]).toMatchObject({ runnerId: 'at-second', initialBase: 2 });
  expect(input.runners[1].position).toBeUndefined();
  expect(input).toMatchObject({ ball: source.ball, physics: source.physics, field: source.field, seed: 987, outs: 1, maxPlaySeconds: 45 });
  expect(JSON.stringify(source)).toBe(before);
});

it('uses the same bounded manager margin for all runners and retains unset optional controls', () => {
  const source = request(), aggressive = buildLiveFieldPlayInputV95({ ...source, baserunning: 'aggressive' }),
    conservative = buildLiveFieldPlayInputV95({ ...source, baserunning: 'conservative' });
  expect(aggressive.runners.every(r => Math.abs(r.advanceSafetyMarginSeconds! - .15) < 1e-10)).toBe(true);
  expect(conservative.runners.every(r => Math.abs(r.advanceSafetyMarginSeconds! - .65) < 1e-10)).toBe(true);
  const defaults = buildLiveFieldPlayInputV95({ ...source, players: source.players.map(p => ({ playerId: p.playerId,
    physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 })) });
  expect(defaults.fielders[0].technicalSkills).toBeUndefined();
  expect(defaults.fielders[0].throwDirectionStdRadians).toBeUndefined();
  expect(defaults.runners[0]).toMatchObject({ advanceSafetyMarginSeconds: .35, roundingRadiusMeters: 4.5,
    lateralAccelerationMps2: 1.5 * 5.2 });
});

it('fails at an incomplete shared input instead of silently filling in a different fixture player', () => {
  const source = request();
  expect(() => buildLiveFieldPlayInputV95({ ...source, players: source.players.filter(p => p.playerId !== 'def-RF') })).toThrow(/def-RF/);
  expect(() => buildLiveFieldPlayInputV95({ ...source, occupiedBases: { ...source.occupiedBases, first: 'missing' } })).toThrow(/missing/);
});

it('applies V98 reaction scaling once to fielders only, retaining runner reaction and all other ability inputs', () => {
  const original = request(), baseline = buildLiveFieldPlayInputV95(original),
    changed = { ...original, players: original.players.map(player => ({ ...player,
      physical: { ...player.physical, fieldingReactionScaleV98: .8 } })) },
    fast = buildLiveFieldPlayInputV95(changed);
  expect(fast.runners).toEqual(baseline.runners);
  for (let i = 0; i < fast.fielders.length; i++) {
    expect(fast.fielders[i].reactionSeconds).toBe(baseline.fielders[i].reactionSeconds * .8);
    expect({ ...fast.fielders[i], reactionSeconds: baseline.fielders[i].reactionSeconds }).toEqual(baseline.fielders[i]);
  }
  for (const scale of [0, 1, 4]) {
    const result = buildLiveFieldPlayInputV95({ ...original, players: original.players.map(p => ({ ...p,
      physical: { ...p.physical, fieldingReactionScaleV98: scale } })) });
    expect(result.fielders[0].reactionSeconds).toBe(original.players[0].physical.reactionSeconds * scale);
  }
  for (const scale of [-.01, 4.01, NaN, Infinity]) expect(() => buildLiveFieldPlayInputV95({ ...original,
    players: original.players.map(p => ({ ...p, physical: { ...p.physical, fieldingReactionScaleV98: scale } })) })).toThrow(/field.*reaction|reaction.*scale/i);
});

it('passes V103 charge authoring once to every defender while keeping runner and other physical inputs independent', () => {
  const source = request(), baseline = buildLiveFieldPlayInputV95(source);
  for (const charge of [0, .6, 5]) {
    const input = buildLiveFieldPlayInputV95({ ...source, players: source.players.map(p => ({ ...p,
      physical: { ...p.physical, throwEffortBuildSecondsV103: charge } })) });
    expect(input.runners).toEqual(baseline.runners);
    for (let i = 0; i < input.fielders.length; i++) {
      expect(input.fielders[i].throwEffortBuildSecondsV103).toBe(charge);
      expect({ ...input.fielders[i], throwEffortBuildSecondsV103: baseline.fielders[i].throwEffortBuildSecondsV103 }).toEqual(baseline.fielders[i]);
    }
  }
});


it('V105 resolves height-linked field bodies once, retaining authored floor offsets and legacy model-less input', () => {
  const raw = request(), before = JSON.stringify(raw), withBodies = { ...raw,
    placements: { ...raw.placements, C: { ...raw.placements.C, y: .95 }, RF: { ...raw.placements.RF, y: 1.1 } },
    players: raw.players.map(p => ({ ...p, heightMeters: 2 })) }, mapped = buildLiveFieldPlayInputV95(withBodies);
  expect(mapped.fielders[0].bodyModelV105).toMatchObject({ heightMeters: 2, hipHeightMeters: 1.06, shoulderHeightMeters: 1.636, eyeHeightMeters: 1.84 });
  expect(mapped.fielders[0].bodyModelV105!.armReachMeters).toBeCloseTo(.982);
  expect(mapped.fielders.find(f => f.defensivePosition === 'C')!.position.y).toBeCloseTo(1.16);
  expect(mapped.fielders.find(f => f.defensivePosition === 'RF')!.position.y).toBeCloseTo(1.26);
  // Stature now supplies optional athletic motion too; the authored running SI
  // underneath is unchanged and model-less legacy requests remain model-less.
  expect(mapped.runners.map(({athleticProfileV115:_,...r})=>r)).toEqual(buildLiveFieldPlayInputV95(raw).runners);
  expect(mapped.runners.every(r=>r.athleticProfileV115?.heightMeters===2)).toBe(true);
  expect(buildLiveFieldPlayInputV95(raw).fielders.every(f => f.bodyModelV105 === undefined)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
  const explicit = buildLiveFieldPlayInputV95({ ...withBodies, players: withBodies.players.map(p => ({ ...p,
    physical: { ...p.physical, gloveReachMeters: 2.7, fieldArmReachMetersV105: .7 } })) });
  expect(explicit.fielders.every(f => f.bodyModelV105?.armReachMeters === .7)).toBe(true);
  expect(explicit.fielders.every(f => f.gloveReachMeters === 2.7)).toBe(true);
});


it('V105 restores authored placements from Source feet without applying stature twice, including legacy records', () => {
  const position = { x: 3, y: 1.26, z: 20 }, source = { position, bodyPoseV105: { foot: { x: 3, y: .2, z: 20 } } };
  expect(restoreLiveFieldAuthoredPlacementV105(source, 'RF')).toEqual({ ...position, y: 1.1 });
  expect(restoreLiveFieldAuthoredPlacementV105(source, 'C').y).toBeCloseTo(1.05);
  expect(restoreLiveFieldAuthoredPlacementV105({ position }, 'RF')).toEqual(position);
  expect(source.position.y).toBe(1.26); expect(source.bodyPoseV105.foot.y).toBe(.2);
});
