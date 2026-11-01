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
  expect(r.kind,JSON.stringify(r)).toBe('applied'); if(r.kind!=='applied') throw new Error(r.reason);
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
it('keeps a mistaken read live through reaction and reverse retouches until return or a physical appeal',()=>{
  // Keep the weak-arm retreat distinct from the stronger 32m/s appeal below.
  // A real appeal can still interrupt this return; never force a final touch.
  const input={...mistakenRead(16),maxPlaySeconds:30}, result=simulateLiveFieldPlayV1(input), caught=result.ruleFacts.flyCatch!;
  const left=result.ruleFacts.runnerDepartures.find(d=>d.runnerId===runnerId)!;
  expect(left.tick).toBeLessThan(caught.firstTouchTick);
  const motions=result.diagnostics.aiTelemetry.runnerMotions.filter(m=>m.runnerId===runnerId),
    reversal=motions.find(m=>m.throughBases.join(',')==='3,2')!;
  expect(reversal).toBeDefined();
  expect(reversal.elapsedSeconds).toBeGreaterThanOrEqual(caught.secureCatchTick/1e6+4-1e-6);
  // V95 can commit third before the catch and then physically revisit it on
  // return. Verify the return leg, rather than discarding that real forward touch.
  const nextMotion=motions.find(m=>m.elapsedSeconds>reversal.elapsedSeconds),
    returnTouches=result.facts.filter(f=>f.kind==='runner_base_touch'&&f.runnerId===runnerId
      &&f.elapsedSeconds>=reversal.elapsedSeconds&&f.elapsedSeconds<(nextMotion?.elapsedSeconds??Infinity));
  // The frozen V117 already has a real appeal before the final return to 2B.
  // A return intent cannot erase that out or fabricate the missing touch.
  expect(returnTouches.length).toBeGreaterThan(0);
  expect(returnTouches.map(t=>t.base)).toEqual([3,2].slice(0,returnTouches.length));
  const forwardThird=result.facts.find(f=>f.kind==='runner_base_touch'&&f.runnerId===runnerId&&f.base===3&&f.elapsedSeconds<reversal.elapsedSeconds)!;
  expect(forwardThird).toBeDefined();
  expect(result.facts.some(f=>f.kind==='runner_base_departure'&&f.runnerId===runnerId&&f.base===3
    &&f.elapsedSeconds>forwardThird.elapsedSeconds&&f.elapsedSeconds<returnTouches[0].elapsedSeconds)).toBe(true);
  for(const touch of [forwardThird,...returnTouches]){
    const bag=touch.base===3?input.field.bases.third:input.field.bases.second;
    expect(Math.hypot(touch.position!.x-bag.x,touch.position!.z-bag.z)).toBeLessThanOrEqual((input.field.baseTouchRadiusMeters??.28)+1e-10);
  }
  if(returnTouches.length===2){
    const returnedFrame=result.frames.find(frame=>frame.elapsedSeconds>=returnTouches[1].elapsedSeconds
      &&frame.elapsedSeconds<(nextMotion?.elapsedSeconds??Infinity))!;
    expect(returnedFrame).toBeDefined();
    expect(returnedFrame.runners.find(r=>r.runnerId===runnerId)).toMatchObject({retired:false,scored:false,currentBase:2});
    expect(result.finalRunners.find(r=>r.runnerId===runnerId)!.retouchRequiredBase).toBeNull();
    expect(result.ruleFacts.defensiveAppeals).toEqual([]);
  }else{
    const appeal=result.ruleFacts.defensiveAppeals?.find(a=>a.runnerId===runnerId);
    expect(appeal).toMatchObject({base:2,reason:'tag_up_early_departure'});
    expect(appeal!.tick).toBeGreaterThan(returnTouches.at(-1)!.tick);
    expect(result.finalRunners.find(r=>r.runnerId===runnerId)!.retired).toBe(true);
  }
  expect(result.end.complete).toBe(true);
  expect(result.end.tick).toBeGreaterThan(result.ruleFacts.runnerTouches.at(-1)!.tick);
  played(input,result);
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
  // Retune only acceleration for V95's observed catch/start clocks. The disk
  // exit is in the first propulsion band: a = 2*pathExit/(catch-start-10ns)^2.
  // Recorded catch 5.5046956441077075, motor start 5.0855572646589575 seconds;
  // the immediately committed [3,4] route exits the .28m disk at path distance
  // .2800419724746921m. Its 1.336m/s exit stays below the unchanged 2m/s band.
  const raw=fixture(),input: LiveFieldPlayInputV1={...raw,seed:1,runners:raw.runners.map(r=>r.runnerId===runnerId?
    {...r,accelerationMps2:3.1881466090884816,reactionSeconds:2,advanceSafetyMarginSeconds:0}:r)},result=simulateLiveFieldPlayV1(input),
    first=result.facts.find(f=>f.kind==='glove_contact')!,left=result.facts.find(f=>f.kind==='runner_base_departure'&&f.runnerId===runnerId)!;
  expect(left.elapsedSeconds).toBeLessThan(first.elapsedSeconds);expect(left.tick).toBe(first.tick);
  expect(first.elapsedSeconds-left.elapsedSeconds).toBeCloseTo(1e-8,12);
  expect(result.diagnostics.aiTelemetry.runnerMotions.filter(m=>m.runnerId===runnerId).some(m=>m.throughBases.includes(2))).toBe(false);
  expect(result.finalRunners.find(r=>r.runnerId===runnerId)).toMatchObject({retired:false,retouchRequiredBase:null});
  expect(result.ruleFacts.defensiveAppeals).toEqual([]);played(input,result);
});
