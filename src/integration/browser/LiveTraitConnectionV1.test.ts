import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveLiveContextHitStrengthV1, validateTechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
import { DELIVERY_SECONDS, decidePickoffV1, decideStealV1, leadMetersV1, resolvePickoffV1, resolveStealV1 } from './LiveBaseRunningV1';
import { createLiveEmotionTrackerV1, type LiveEmotionEventV1 } from './LiveEmotionV1';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { planLivePitchTargetV111, resolveLivePitchCommandStdV111, shapeLiveCommandMissV1, type LivePitchTargetPlanInputV111 } from './LivePitchTargetPlanV111';
import { getLiveTraitCatalogConnectedV1, liveEmotionResponseFromTraitsV1, liveEmotionTrailingResponseFromTraitsV1, resolveLiveBatterSituationV1, resolveLiveConnectedTraitsV1,
  resolveLivePitcherSituationV1, resolveLivePhysicalTraitFieldsV1, resolveLiveTechnicalTraitsV75, validateLiveTraitProfileV1, type LiveTraitProfileV1, type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';
import { getLiveTraitCatalogV77, migrateLiveTraitRosterV77, projectLiveTraitProfilesV77, resolveLiveExecutionPhysicalV77, setLiveTraitProfileV77 } from './LiveTraitRuntimeV77';

const roster: LiveTraitRosterInputV1 = JSON.parse(readFileSync('docs/demos/live-game-roster-v62.json', 'utf8'));
const playerId = roster.entries[0].playerId;
const profile = (...selections: readonly (readonly [string, string | null, number?])[]): LiveTraitProfileV1 => ({ version: 'live_trait_profile_v2',
  selections: selections.map(([familyId, stateId, effectScale]) => ({ familyId, stateId, source: { effectScale: effectScale ?? 1 } })) });
const connectedIds = () => getLiveTraitCatalogConnectedV1().slice(getLiveTraitCatalogV77().length);
const batter = { timingStdSeconds: .01, aimStdMeters: .02, zoneJudgmentStdMeters: .025, technicalTimingOffsetSeconds: 0, attackAngleDegrees: 12 };
const at = (over = {}) => ({ balls: 1, strikes: 1, pitcherThrows: 'R' as const, batting: 'balanced', ...over });

describe('catalog and saved data', () => {
  it('keeps the V77 catalog exact and adds only families with a route', () => {
    expect(getLiveTraitCatalogV77()).toHaveLength(18);
    expect(connectedIds()).toHaveLength(34);
    const ids = getLiveTraitCatalogConnectedV1().map(row => row.familyId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const off of ['season_condition_tendency', 'recovery', 'injury_resistance', 'runner_on_base_negative_conflict', 'preclosure_pressure', 'fastball_quality']) expect(ids).not.toContain(off);
    expect(getLiveTraitCatalogConnectedV1().find(row => row.familyId === 'breaking_ball_quality')?.availability).toBe('UNAVAILABLE');
  });
  it('loads old v1 and v2 profiles unchanged', () => {
    const v1: LiveTraitProfileV1 = { version: 'live_trait_profile_v1', selections: [{ familyId: 'bad_ball_hitting', stateId: 'LEARNED', source: { badBallControl: .94 } }] },
      v2: LiveTraitProfileV1 = { version: 'live_trait_profile_v2', selections: [{ familyId: 'bunting', stateId: 'MASTERED', source: { effectScale: 1 } },
        { familyId: 'breaking_ball_quality', stateId: 'KIRE_CIRCLE', source: { recipeVersion: 'kire_release_recipe_v177' } }] };
    expect(validateLiveTraitProfileV1(v1, { badBallControl: .94 })).toEqual(v1);
    expect(validateLiveTraitProfileV1(v2, {})).toEqual(v2);
    expect(resolveLiveTechnicalTraitsV75(v2)).toEqual({ bunting: 1 });
    expect(resolveLiveConnectedTraitsV1(v1)).toEqual({});
  });
  it('refuses a connected family in a v1 profile, an unknown state, and an out-of-range scale', () => {
    expect(() => validateLiveTraitProfileV1({ ...profile(['stealing', 'A']), version: 'live_trait_profile_v1' }, {})).toThrow();
    expect(() => validateLiveTraitProfileV1(profile(['stealing', 'S']), {})).toThrow();
    expect(() => validateLiveTraitProfileV1(profile(['stealing', 'A', 3]), {})).toThrow();
  });
  it('returns the same physical object for a player without connected traits', () => {
    const physical = { ...batter, commandStdMeters: .16, badBallControl: .5 };
    expect(resolveLiveBatterSituationV1(physical, undefined, at({ strikes: 2 }))).toBe(physical);
    expect(resolveLiveBatterSituationV1(physical, profile(['bunting', 'LEARNED']), at({ strikes: 2 }))).toBe(physical);
    expect(resolveLivePitcherSituationV1(physical, undefined, { strikes: 2, runnersOn: 3 })).toBe(physical);
    expect(resolveLiveExecutionPhysicalV77(physical, undefined)).toBe(physical);
    expect(liveEmotionResponseFromTraitsV1(undefined)).toEqual({});
    expect(resolveLiveTechnicalTraitsV75(undefined)).toBeUndefined();
  });
  it('saves every connected state without touching base SI, and OFF leaves no selection', () => {
    const base = migrateLiveTraitRosterV77({ roster }).roster, physical = JSON.stringify(base.entries[0].physical);
    for (const definition of connectedIds()) for (const state of definition.states) {
      const next = setLiveTraitProfileV77({ roster: base, playerId, familyId: definition.familyId, stateId: state.stateId }).roster;
      expect(JSON.stringify(next.entries[0].physical)).toBe(physical);
      expect(applyLivePhysicalRosterV1({ players: [{ playerId, name: 'x', heightMeters: 1.8, bats: 'R' }], roster: { ...next, entries: [next.entries[0]] } }).players).toHaveLength(1);
      const off = setLiveTraitProfileV77({ roster: next, playerId, familyId: definition.familyId, stateId: null }).roster;
      expect(off.entries[0].traitProfile?.selections.some(s => s.familyId === definition.familyId)).toBe(false);
      expect(projectLiveTraitProfilesV77({ roster: next, playerId }).traits.find(t => t.familyId === definition.familyId)?.stateId).toBe(state.stateId);
    }
  });
  it('names no result, exit quantity or body limit among its outputs', () => {
    const everything = profile(...connectedIds().map(d => [d.familyId, d.states.at(-1)!.stateId] as const));
    const keys = [...Object.keys(resolveLivePhysicalTraitFieldsV1(everything)),
      ...Object.keys(resolveLiveBatterSituationV1(batter, everything, at({ strikes: 2, batting: 'power', pitcherThrows: 'L' }))),
      ...Object.keys(resolveLivePitcherSituationV1({ commandStdMeters: .16 }, everything, { strikes: 2, runnersOn: 1 }))];
    for (const key of keys) expect(key).not.toMatch(/exit|hit|homer|out|average|topSpeed|acceleration|maximumSweetSpot|releaseSpeed|throwSpeed/i);
    expect(validateTechnicalSkillControlsV75(resolveLiveTechnicalTraitsV75(everything))).toBeTruthy();
  });
});

describe('emotion route', () => {
  const pressure = ['pitch_pressure', 'setback_recovery', 'anger_response', 'bat_pressure'] as const;
  it('orders the pressure family by state, with D neutral', () => {
    const stability = (stateId: string) => liveEmotionResponseFromTraitsV1(profile(['pitch_pressure', stateId])).stability ?? .5;
    const order = ['RED_EXTREME', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'GOLD'].map(stability);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
    expect(liveEmotionResponseFromTraitsV1(profile(['pitch_pressure', 'D']))).toEqual({});
    expect(liveEmotionResponseFromTraitsV1(profile(['pitch_pressure', 'GOLD', 0]))).toEqual({});
  });
  it('never enters a second channel beside the Appraisal', () => {
    const physical = { ...batter, commandStdMeters: .16, badBallControl: .5 };
    for (const id of pressure) {
      const state = getLiveTraitCatalogConnectedV1().find(d => d.familyId === id)!.states.at(-1)!.stateId, p = profile([id, state]);
      expect(resolveLiveExecutionPhysicalV77(physical, p)).toBe(physical);
      expect(resolveLiveTechnicalTraitsV75(p)).toBeUndefined();
      expect(resolveLiveBatterSituationV1(physical, p, at({ strikes: 2 }))).toBe(physical);
      expect(resolveLivePitcherSituationV1(physical, p, { strikes: 2, runnersOn: 3 })).toBe(physical);
    }
  });
  it('keeps every axis inside the Appraisal range at the largest scale', () => {
    const response = liveEmotionResponseFromTraitsV1(profile(['pitch_pressure', 'RED_EXTREME', 2], ['setback_recovery', 'G', 2], ['bat_pressure', 'G', 2], ['anger_response', 'ACTIVE', 2]));
    for (const value of Object.values(response)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
  });
  it('makes the gate open sooner for ノミの心臓 than for 強心臓 in the same failing spot', () => {
    const policy = { version: 'live_emotion_policy_v1', sourceId: 'test' } as const,
      event = (tick: number): LiveEmotionEventV1 => ({ tick, batterId: 'p', pitcherId: 'x', outcome: 'hit', inning: 9, regulationInnings: 9, outs: 2, runnersOn: 2, scoringPosition: true, runDifference: 0 }),
      run = (stateId: string) => {
        const t = createLiveEmotionTrackerV1({ matchId: 'm', policy, players: [{ playerId: 'x', clubId: 'B', response: liveEmotionResponseFromTraitsV1(profile(['pitch_pressure', stateId])) }, { playerId: 'p', clubId: 'A' }] });
        for (let i = 1; i <= 8; i++) { t.observe(event(i)); if (t.influence('x')) return i; }
        return 9;
      };
    expect(run('RED_EXTREME')).toBeLessThan(run('GOLD'));
    expect(run('RED_EXTREME')).toBeLessThanOrEqual(run('D'));
  });
  it('holds 逆境○ apart so it can apply only while trailing', () => {
    const p = profile(['trailing_motivation', 'MASTERED']);
    expect(liveEmotionResponseFromTraitsV1(p)).toEqual({});
    expect(liveEmotionTrailingResponseFromTraitsV1(p).competitiveness).toBeGreaterThan(.5);
  });
});

describe('technical route', () => {
  const swing = { bats: 'R' as const, perceivedX: 0, zoneHalfWidth: .22, pitchType: 'fastball' };
  it('acts only inside its own condition', () => {
    expect(resolveLiveContextHitStrengthV1(undefined, swing)).toBe(0);
    expect(resolveLiveContextHitStrengthV1({ inside_zone_hitting: 1 }, { ...swing, perceivedX: -.2 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ inside_zone_hitting: 1 }, { ...swing, perceivedX: .2 })).toBe(0);
    expect(resolveLiveContextHitStrengthV1({ outside_zone_hitting: 1 }, { ...swing, perceivedX: .2 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ outside_zone_hitting: 1 }, { ...swing, bats: 'L', perceivedX: -.2 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ fastball_recognition: .5 }, swing)).toBe(.5);
    expect(resolveLiveContextHitStrengthV1({ fastball_recognition: .5 }, { ...swing, pitchType: 'slider' })).toBe(0);
    expect(resolveLiveContextHitStrengthV1({ breaking_ball_recognition: .5 }, { ...swing, pitchType: 'slider' })).toBe(.5);
    expect(resolveLiveContextHitStrengthV1({ pull_side_transfer: 1 }, { ...swing, pullAngleDegrees: 25 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ pull_side_transfer: 1 }, { ...swing, pullAngleDegrees: -25 })).toBe(0);
    expect(resolveLiveContextHitStrengthV1({ opposite_field_technique: 1 }, { ...swing, pullAngleDegrees: -25 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ multi_direction_contact: 1 }, { ...swing, pullAngleDegrees: -25 })).toBe(1);
    expect(resolveLiveContextHitStrengthV1({ multi_direction_contact: 1 }, { ...swing, pullAngleDegrees: 0 })).toBe(0);
  });
  it('resolves into controls that the pitch and field validators accept', () => {
    expect(resolveLiveTechnicalTraitsV75(profile(['pitch_platoon_left', 'G'], ['early_count_approach', 'BALL_FIRST'], ['dangerous_miss', 'DANGEROUS'], ['bunting', 'MASTERED'])))
      .toEqual({ pitch_platoon_left: -1, early_count_approach: -1, dangerous_miss: -1, bunting: 1 });
    expect(() => validateTechnicalSkillControlsV75({ inside_zone_hitting: -1 })).toThrow();
    expect(() => validateTechnicalSkillControlsV75({ madeUp: 1 })).toThrow();
  });
  const zone = { halfWidth: .22, lowerY: .5, upperY: 1.1 };
  const std = (over: Record<string, unknown>, bats: 'R' | 'L' = 'L', x = 0) => resolveLivePitchCommandStdV111({ position: { x, y: .8 }, zone, bats, commandStdMeters: .16, ...over }).effectiveCommandStd;
  it('applies the left-batter grade to left batters only, in both directions', () => {
    expect(std({})).toBe(.16);
    expect(std({ technicalSkills: { pitch_platoon_left: .8 } })).toBeLessThan(.16);
    expect(std({ technicalSkills: { pitch_platoon_left: -1 } })).toBeGreaterThan(.16);
    expect(std({ technicalSkills: { pitch_platoon_left: 1 } }, 'R')).toBe(.16);
  });
  it('applies クロスファイヤー only across the plate from the throwing arm', () => {
    const technicalSkills = { diagonal_command: 1 };
    expect(std({ technicalSkills, throws: 'R' }, 'R', .2)).toBeLessThan(.16);
    expect(std({ technicalSkills, throws: 'R' }, 'R', -.2)).toBe(.16);
    expect(std({ technicalSkills, throws: 'L' }, 'R', -.2)).toBeLessThan(.16);
    expect(std({ technicalSkills }, 'R', .2)).toBe(.16);
  });
  it('moves only a large miss, in the stated direction', () => {
    const shape = (error: { x: number; y: number }, technicalSkills: Record<string, number>) => shapeLiveCommandMissV1(error, { target: { x: .3, y: .8 }, zone, commandStdMeters: .1, throws: 'R', technicalSkills });
    const small = { x: .05, y: 0 }, large = { x: .2, y: 0 };
    expect(shape(small, { dangerous_miss: -1 })).toBe(small);
    expect(shapeLiveCommandMissV1(large, { target: { x: .3, y: .8 }, zone, commandStdMeters: .1 })).toBe(large);
    expect(shape(large, { dangerous_miss: -1 }).x).toBeLessThan(large.x);
    expect(shape(large, { dangerous_miss: 1 }).x).toBeGreaterThan(large.x);
    const slip = shape(large, { release_miss_pattern: 1 });
    expect(slip.y).toBeGreaterThan(0);
    expect(slip.x).toBeLessThan(large.x);
  });
  const plan = (skills: Record<string, number> | undefined, seed: number, balls = 0, strikes = 0) => planLivePitchTargetV111({
    zone, ballRadiusMeters: .036, seed, situation: { balls, strikes, outs: 0, occupiedBases: { first: false, second: false, third: false } },
    pitcher: { commandStdMeters: .12, ...(skills ? { technicalSkills: skills } : {}) },
    batter: { bats: 'R', aimStdMeters: .02, timingStdSeconds: .01, chaseMarginMeters: .12, maximumSweetSpotSpeedMps: 40, targetSweetSpotSpeedMps: 38 } } as LivePitchTargetPlanInputV111);
  const meanStrike = (skills: Record<string, number> | undefined, balls = 0, strikes = 0) => Array.from({ length: 40 }, (_, i) => plan(skills, i + 1, balls, strikes).diagnostics.pStrike).reduce((a, b) => a + b) / 40;
  it('changes where the plan aims, and only in the counts it names', () => {
    expect(meanStrike({ early_count_approach: 1 })).toBeGreaterThan(meanStrike(undefined));
    expect(meanStrike({ early_count_approach: -1 })).toBeLessThan(meanStrike(undefined));
    expect(plan({ early_count_approach: 1 }, 5, 2, 2).position).toEqual(plan(undefined, 5, 2, 2).position);
    expect(plan({ walk_prone_approach: 1 }, 5).diagnostics.walkCost).toBeLessThan(plan(undefined, 5).diagnostics.walkCost);
    expect(plan({ pitch_strong_batter_response: 1 }, 5).diagnostics.minimumCost).toBeGreaterThan(plan(undefined, 5).diagnostics.minimumCost);
  });
});

describe('running route', () => {
  const match = (bases: Record<string, string | null>) => ({ balls: 0, bases: { first: null, second: null, third: null, ...bases } });
  const attempts = (instruction: 'balanced' | 'aggressive' | 'conservative', preference?: number, skill?: number) => Array.from({ length: 800 }, (_, i) => decideStealV1({ seed: 7, pitchOrdinal: i + 1, match: match({ first: 'r' }),
    topSpeedOf: () => 8.4, instruction, ...(preference === undefined && skill === undefined ? {} : { runnerOf: () => ({ ...(preference === undefined ? {} : { stealPreferenceV1: preference }), ...(skill === undefined ? {} : { stealSkillV1: skill }) }) }) })).filter(Boolean).length;
  it('lets the green preference move the decision, and a manager instruction replace it', () => {
    expect(attempts('balanced', 1)).toBeGreaterThan(attempts('balanced'));
    expect(attempts('balanced', -1)).toBeLessThan(attempts('balanced'));
    expect(attempts('aggressive', -1)).toBe(attempts('aggressive'));
    expect(attempts('conservative', 1)).toBe(attempts('conservative'));
    expect(attempts('balanced', 0)).toBe(attempts('balanced'));
  });
  it('gives 盗塁 a lead and a start, and leaves the body alone', () => {
    expect(leadMetersV1({ topSpeedMps: 8.4 }, 'balanced')).toBe(leadMetersV1(8.4, 'balanced'));
    expect(leadMetersV1({ topSpeedMps: 8.4, stealSkillV1: 1 }, 'balanced')).toBeGreaterThan(leadMetersV1(8.4, 'balanced'));
    expect(leadMetersV1({ topSpeedMps: 8.4, stealSkillV1: -1 }, 'balanced')).toBeLessThan(leadMetersV1(8.4, 'balanced'));
    expect(attempts('balanced', undefined, 1)).toBeGreaterThan(attempts('balanced'));
    const race = (extra: object) => resolveStealV1({ seed: 3, pitchOrdinal: 4, from: { x: 19, y: 0, z: 19 }, to: { x: 0, y: 0, z: 38 }, catcher: { x: 0, y: 0, z: -1 }, catchSeconds: .5,
      runner: { topSpeedMps: 8.4, accelerationMps2: 5.8, reactionSeconds: .2 }, transferSeconds: .7, throwSpeedMps: 36, ...extra });
    const plain = race({}), skilled = race({ runner: { topSpeedMps: 8.4, accelerationMps2: 5.8, reactionSeconds: .2, stealSkillV1: 1 } });
    expect(skilled.runnerSeconds).toBeLessThan(plain.runnerSeconds);
    expect(skilled.arrivalSeconds).toBe(plain.arrivalSeconds);
    expect(race({ deliverySeconds: DELIVERY_SECONDS }).runnerSeconds).toBe(plain.runnerSeconds);
    expect(race({ deliverySeconds: DELIVERY_SECONDS / 1.8 }).runnerSeconds).toBeGreaterThan(plain.runnerSeconds);
  });
  it('keeps クイック strictly ordered and inside the stated limits', () => {
    const delivery = (stateId: string, scale = 1) => resolveLivePhysicalTraitFieldsV1(profile(['quick_delivery', stateId, scale])).deliverySecondsV1 ?? DELIVERY_SECONDS;
    const order = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'GOLD'].map(id => delivery(id));
    expect(order).toEqual([...order].sort((a, b) => b - a));
    expect(new Set(order).size).toBe(8);
    expect(delivery('G')).toBeCloseTo(DELIVERY_SECONDS * 1.8);
    expect(delivery('A')).toBeCloseTo(DELIVERY_SECONDS / 1.8);
    expect(delivery('GOLD')).toBeCloseTo(DELIVERY_SECONDS / 2.5);
    expect(delivery('G', 2)).toBeCloseTo(DELIVERY_SECONDS * 1.8);
    expect(delivery('A', 2)).toBeCloseTo(DELIVERY_SECONDS / 1.8);
    expect(delivery('GOLD', 2)).toBeCloseTo(DELIVERY_SECONDS / 2.5);
  });
  it('exposes running values on the resolved physical object, not on saved SI', () => {
    const physical = { ...batter, badBallControl: .5 }, resolved = resolveLiveExecutionPhysicalV77(physical, profile(['stealing', 'GOLD'], ['steal_aggression', 'CAUTIOUS'], ['pitch_velocity_consistency', 'STABLE'], ['runner_threat_attention', 'MASTERED'], ['pickoff_technique', 'LEARNED']));
    expect(resolved).toMatchObject({ stealSkillV1: 1, stealPreferenceV1: -1, velocitySpreadScaleV1: .5, runnerThreatV1: 1, pickoffTechniqueV1: 1 });
    expect(physical).toEqual({ ...batter, badBallControl: .5 });
  });
  it('makes かく乱 a matter of attention: the pitcher looks over more, and the race is untouched', () => {
    const throws = (runnerThreat?: number) => Array.from({ length: 1500 }, (_, i) => decidePickoffV1({ seed: 11, pitchOrdinal: i + 1, match: match({ first: 'r' }), leadMeters: 3, ...(runnerThreat === undefined ? {} : { runnerThreat }) })).filter(Boolean).length;
    expect(throws(1)).toBeGreaterThan(throws());
    expect(throws(0)).toBe(throws());
    const move = (pitcherTechnique: number) => resolvePickoffV1({ seed: 1, pitchOrdinal: 1, lead: { x: 16, y: 0, z: 19 }, base: { x: 19, y: 0, z: 19 }, pitcher: { x: 0, y: 0, z: 18 }, pitcherTechnique, throwSpeedMps: 36,
      runner: { topSpeedMps: 8, reactionSeconds: .2 }, receiverGloveSpeedMps: 12 }).moveSeconds;
    expect(move(1)).toBeLessThan(move(0));
  });
});

describe('situation route', () => {
  it('acts in the count it names and leaves the stored object alone', () => {
    const first = profile(['first_pitch_execution', 'MASTERED']);
    expect(resolveLiveBatterSituationV1(batter, first, at({ balls: 0, strikes: 0 })).timingStdSeconds).toBeLessThan(batter.timingStdSeconds);
    expect(resolveLiveBatterSituationV1(batter, first, at())).toBe(batter);
    for (const [id, state, key] of [['two_strike_adjustment', 'LEARNED', 'timingStdSeconds'], ['two_strike_narrow_options', 'MASTERED', 'aimStdMeters'], ['cut_contact', 'LEARNED', 'aimStdMeters']] as const) {
      expect(resolveLiveBatterSituationV1(batter, profile([id, state]), at({ strikes: 2 }))[key]).toBeLessThan(batter[key]);
      expect(resolveLiveBatterSituationV1(batter, profile([id, state]), at())).toBe(batter);
    }
    expect(resolveLiveBatterSituationV1(batter, profile(['cut_contact', 'LEARNED']), at({ strikes: 2 })).technicalTimingOffsetSeconds).toBeGreaterThan(0);
    const red = resolveLiveBatterSituationV1(batter, profile(['two_strike_weakness', 'RED_EXTREME']), at({ strikes: 2 }));
    expect(red.timingStdSeconds).toBeGreaterThan(batter.timingStdSeconds);
    expect(red.zoneJudgmentStdMeters).toBeGreaterThan(batter.zoneJudgmentStdMeters);
    expect(batter.timingStdSeconds).toBe(.01);
  });
  it('shapes the power swing only when the swing is a power swing', () => {
    const power = profile(['power_swing_generation', 'MASTERED']);
    expect(resolveLiveBatterSituationV1(batter, power, at({ batting: 'power' })).attackAngleDegrees).toBeGreaterThan(batter.attackAngleDegrees);
    expect(resolveLiveBatterSituationV1(batter, power, at({ batting: 'contact' }))).toBe(batter);
  });
  it('reads left-handed pitchers better or worse by grade, and right-handed pitchers the same', () => {
    expect(resolveLiveBatterSituationV1(batter, profile(['bat_platoon_left', 'GOLD']), at({ pitcherThrows: 'L' })).zoneJudgmentStdMeters).toBeLessThan(batter.zoneJudgmentStdMeters);
    expect(resolveLiveBatterSituationV1(batter, profile(['bat_platoon_left', 'G']), at({ pitcherThrows: 'L' })).zoneJudgmentStdMeters).toBeGreaterThan(batter.zoneJudgmentStdMeters);
    expect(resolveLiveBatterSituationV1(batter, profile(['bat_platoon_left', 'GOLD']), at())).toBe(batter);
  });
  it('steadies the pitcher only with two strikes or with runners on', () => {
    const physical = { commandStdMeters: .16 }, put = profile(['pitch_putaway_execution', 'MASTERED']), runners = profile(['runner_on_base_stability', 'LEARNED']);
    expect(resolveLivePitcherSituationV1(physical, put, { strikes: 2, runnersOn: 0 }).commandStdMeters).toBeLessThan(.16);
    expect(resolveLivePitcherSituationV1(physical, put, { strikes: 1, runnersOn: 3 })).toBe(physical);
    expect(resolveLivePitcherSituationV1(physical, runners, { strikes: 0, runnersOn: 1 }).commandStdMeters).toBeLessThan(.16);
    expect(resolveLivePitcherSituationV1(physical, runners, { strikes: 2, runnersOn: 0 })).toBe(physical);
  });
});
