import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';


const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const runnerId = 'second-runner';
function fixture(): LiveFieldPlayInputV1 {
  const tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .5, 0), velocity: v(0, 26, 30), spin: v(-150, 0, 0) } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 8, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId, initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 20,
  };
}

import { reducePlayableMatchV1 } from '../../../integration/browser/PlayableMatchRulesV1';
import { asRuleProfileId } from '../../model/RuleProfileRef';
const played = (input: LiveFieldPlayInputV1, result: ReturnType<typeof simulateLiveFieldPlayV1>) => {
  const r = reducePlayableMatchV1({match:{ruleProfileId:asRuleProfileId('v53-airborne'),inning:1,half:'top',outs:input.outs,
    balls:0,strikes:0,bases:{first:null,second:runnerId,third:null},score:{away:0,home:0},playId:0},batterRunnerId:'batter',event:{kind:'field_play',facts:result.ruleFacts}});
  expect(r.kind).toBe('applied'); if(r.kind!=='applied') throw new Error(r.reason);
  expect(result.finalRunners.filter(r=>r.retired).map(r=>r.runnerId).sort()).toEqual(r.outcomes.map(r=>r.runnerId).sort());
  return r;
};
const mistakenRead = (arm: number): LiveFieldPlayInputV1 => {
  const raw=fixture();
  return {...raw,seed:1,fielders:raw.fielders.map(f=>({...f,throwSpeedMps:arm})),runners:raw.runners.map(r=>r.runnerId===runnerId?
    {...r,reactionSeconds:4,topSpeedMps:10,accelerationMps2:8,advanceSafetyMarginSeconds:0}:r)};
};
it('advances from an observed airborne hit read before the actual first landing, independently of render cadence',()=>{
  const raw=fixture(), input: LiveFieldPlayInputV1={...raw,
    ball:{...raw.ball,ball:{...raw.ball.ball,position:v(0,1,25),velocity:v(0,7,30),spin:v()}},
    fielders:raw.fielders.map(f=>({...f,topSpeedMps:3,accelerationMps2:2,throwSpeedMps:8}))}, result=simulateLiveFieldPlayV1(input);
  const read=result.diagnostics.aiTelemetry.runnerDecisions.find(d=>d.runnerId===runnerId&&d.reason==='airborne_hit_read_advance');
  expect(read).toBeDefined();
  const left=result.ruleFacts.runnerDepartures.find(d=>d.runnerId===runnerId)!;
  expect(left).toBeDefined(); expect(left.tick).toBeLessThan(result.ruleFacts.firstGroundContactTick!);
  expect(result.end.complete).toBe(true); played(input,result);
  const other=simulateLiveFieldPlayV1({...input,frameSeconds:.113});
  expect(other.facts).toEqual(result.facts); expect(other.ruleFacts).toEqual(result.ruleFacts);
});
it('keeps a mistaken read live through reaction and a physical return, retouching passed bags in reverse order',()=>{
  const input=mistakenRead(24), result=simulateLiveFieldPlayV1(input), caught=result.ruleFacts.flyCatch!;
  const left=result.ruleFacts.runnerDepartures.find(d=>d.runnerId===runnerId)!;
  expect(left.tick).toBeLessThan(caught.firstTouchTick);
  const motions=result.diagnostics.aiTelemetry.runnerMotions.filter(m=>m.runnerId===runnerId), reversal=motions.at(-1)!;
  expect(reversal.elapsedSeconds).toBeGreaterThanOrEqual(caught.secureCatchTick/1e6+4-1e-6);
  expect(result.ruleFacts.runnerTouches.filter(t=>t.runnerId===runnerId).map(t=>t.base)).toEqual([3,2]);
  expect(result.finalRunners.find(r=>r.runnerId===runnerId)).toMatchObject({retired:false,scored:false,base:2});
  expect(result.end.tick).toBeGreaterThan(result.ruleFacts.runnerTouches.at(-1)!.tick);
  expect(result.ruleFacts.defensiveAppeals).toEqual([]); played(input,result);
});
it('allows a real throw and original-base appeal to beat a mistaken runner back, without making a force out',()=>{
  const input=mistakenRead(32),result=simulateLiveFieldPlayV1(input),appeal=result.ruleFacts.defensiveAppeals?.[0]!;
  expect(result.end.complete).toBe(true); expect(appeal).toMatchObject({runnerId,base:2,reason:'tag_up_early_departure'});
  expect(result.ruleFacts.runnerDepartures.find(d=>d.runnerId===runnerId)!.tick).toBeLessThan(result.ruleFacts.flyCatch!.firstTouchTick);
  expect(result.ruleFacts.runnerTouches.filter(t=>t.runnerId===runnerId).map(t=>t.base)).toEqual([3]);
  expect(result.ruleFacts.controlledBaseContacts).toContainEqual({kind:'controlled_base_contact',defenderId:appeal.defenderId,base:2,tick:appeal.tick});
  expect(result.facts.some(f=>f.kind==='throw_release'&&f.reason==='appeal_play'&&f.base===2&&f.tick<appeal.tick)).toBe(true);
  expect(played(input,result).outcomes).toContainEqual({runnerId,tick:appeal.tick,classification:'time_play',cause:'tag_up_appeal',defenderId:appeal.defenderId});
});
it('does not punish a motor started before first touch if the runner has not actually left the original bag disk',()=>{
  const raw=fixture(),input: LiveFieldPlayInputV1={...raw,seed:1,runners:raw.runners.map(r=>r.runnerId===runnerId?
    {...r,reactionSeconds:1,advanceSafetyMarginSeconds:0}:r)},result=simulateLiveFieldPlayV1(input),caught=result.ruleFacts.flyCatch!;
  const started=result.diagnostics.aiTelemetry.runnerMotions.find(m=>m.runnerId===runnerId)!,left=result.ruleFacts.runnerDepartures.find(d=>d.runnerId===runnerId)!;
  expect(started.elapsedSeconds).toBeLessThan(caught.firstTouchTick/1e6);
  expect(left.tick).toBeGreaterThan(caught.firstTouchTick); expect(result.ruleFacts.defensiveAppeals).toEqual([]);
  expect(result.finalRunners.find(r=>r.runnerId===runnerId)!.retired).toBe(false); played(input,result);
});
it('uses the same official tick for departure and first-touch legality even when the disk exit is physically 10ns earlier',()=>{
  const raw=fixture(),input: LiveFieldPlayInputV1={...raw,seed:1,runners:raw.runners.map(r=>r.runnerId===runnerId?
    {...r,accelerationMps2:3.343642129248945,reactionSeconds:2,advanceSafetyMarginSeconds:0}:r)},result=simulateLiveFieldPlayV1(input),
    first=result.facts.find(f=>f.kind==='glove_contact')!,left=result.facts.find(f=>f.kind==='runner_base_departure'&&f.runnerId===runnerId)!;
  expect(left.elapsedSeconds).toBeLessThan(first.elapsedSeconds);expect(left.tick).toBe(first.tick);
  expect(result.diagnostics.aiTelemetry.runnerMotions.filter(m=>m.runnerId===runnerId).some(m=>m.throughBases.includes(2))).toBe(false);
  expect(result.finalRunners.find(r=>r.runnerId===runnerId)).toMatchObject({retired:false,retouchRequiredBase:null});
  expect(result.ruleFacts.defensiveAppeals).toEqual([]);played(input,result);
});