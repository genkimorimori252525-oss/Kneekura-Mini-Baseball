import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { quantizeEventTick } from '../ExactEventTime';
import { createLiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { sampleRunnerRoute } from '../running/RunnerRoute';
import { decideLiveRunnerAdvanceV1, type LiveRunnerAdvanceInputV1 } from './LiveRunnerAdvancePolicyV1';
import type { TechnicalSkillControlsV75 } from '../TechnicalSkillControlsV75';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const norm = (p: { x: number; y: number; z: number }) => Math.hypot(p.x,p.y,p.z);
const liveFieldFixture = (): LiveFieldPlayInputV1 => {
  const tps = 1e6, originTick = 100000, elapsedSeconds = .123456789;
  return { ball: { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, tps),
    position: v(0, 2, 8), velocity: v(0, 1, 5), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 2, maxPlaySeconds: 30 };
};

const ground = (): LiveFieldPlayInputV1 => { const source=liveFieldFixture();return {...source,outs:0,
  ball:{...source.ball,ball:{...source.ball.ball,position:v(0,.2,0),velocity:v(1,-1,5)}},
  runners:[{...source.runners[0],topSpeedMps:3}]}; };
const withSkills = (input: LiveFieldPlayInputV1, technicalSkills: TechnicalSkillControlsV75): LiveFieldPlayInputV1 => ({...input,
  fielders:input.fielders.map(f=>({...f,technicalSkills})),runners:input.runners.map(r=>({...r,technicalSkills}))});

it.each(['fly','ground'] as const)('keeps %s events, frames and diagnostics exactly unchanged for all zero controls',kind=>{
  const source=kind==='fly'?liveFieldFixture():ground(),before=structuredClone(source),old=simulateLiveFieldPlayV1(source),
    zero=simulateLiveFieldPlayV1(withSkills(source,{baserunning:0,advanced_fielding:0,bat_to_run_transition:0,slow_ball_charge:0}));
  expect(zero).toEqual(old);expect(source).toEqual(before);
});

it('uses rounding route selection while preserving straight motion and every physical speed bound',()=>{
  const source={position:{x:0,z:0},bases:[{base:1,position:{x:27.432,z:0}},{base:2,position:{x:27.432,z:27.432}}],
    topSpeedMps:8,accelerationMps2:5,roundingRadiusMeters:4.5,lateralAccelerationMps2:7.5},
    old=createLiveRunnerMotionV1(source)!,good=createLiveRunnerMotionV1({...source,technicalSkills:{baserunning:2}})!,
    poor=createLiveRunnerMotionV1({...source,technicalSkills:{baserunning:-2}})!;
  expect(JSON.stringify(createLiveRunnerMotionV1({...source,technicalSkills:{baserunning:0}}))).toBe(JSON.stringify(old));
  expect(good.durationSeconds).toBeLessThan(old.durationSeconds);expect(poor.durationSeconds).toBeGreaterThan(old.durationSeconds);
  expect(good.route).not.toEqual(old.route);
  const straight={...source,bases:source.bases.slice(0,1)},a=createLiveRunnerMotionV1(straight)!,b=createLiveRunnerMotionV1({...straight,technicalSkills:{baserunning:2}})!;
  expect(b.route).toEqual(a.route);expect(b.speedSegments).toEqual(a.speedSegments);
  for(let t=0;t<good.durationSeconds;t+=.01){const sample=good.sampleAtElapsedSeconds(t),part=good.route.segments[sampleRunnerRoute(good.route,sample.distanceMeters).segmentIndex];
    expect(sample.speedMps).toBeLessThanOrEqual(8+1e-9);if(part.kind==='arc')expect(sample.speedMps**2/part.radiusMeters).toBeLessThanOrEqual(7.5+1e-8);}
  for(const segment of good.speedSegments)expect(Math.abs(segment.accelerationMps2)).toBeLessThanOrEqual(5);
});

it('shortens only the batter initial departure, preserving baserunner recognition and run speed',()=>{
  const source:LiveRunnerAdvanceInputV1={nowSeconds:.15,playStartedAtSeconds:0,currentBase:0,distanceToNextBaseMeters:27.432,targetOccupied:false,
    runner:{topSpeedMps:8,accelerationMps2:5,reactionSeconds:.2},forced:false,firstGroundContactElapsedSeconds:null,firstFielderTouchElapsedSeconds:null,defenderControlSeconds:10},
    old=decideLiveRunnerAdvanceV1(source),skill={...source,runner:{...source.runner,technicalSkills:{bat_to_run_transition:2}}},changed=decideLiveRunnerAdvanceV1(skill);
  expect(old.advance).toBe(false);expect(changed.advance).toBe(true);expect(changed.readyAtElapsedSeconds).toBeCloseTo(.14,12);
  expect(changed.runnerTravelSeconds).toBe(old.runnerTravelSeconds);
  const runner={...source,currentBase:1 as const,firstGroundContactElapsedSeconds:0};
  expect(decideLiveRunnerAdvanceV1({...runner,runner:skill.runner})).toEqual(decideLiveRunnerAdvanceV1(runner));
  const result=simulateLiveFieldPlayV1(withSkills(ground(),{bat_to_run_transition:2})),baseline=simulateLiveFieldPlayV1(ground());
  expect(result.diagnostics.aiTelemetry.runnerMotions[0].elapsedSeconds).toBeLessThan(baseline.diagnostics.aiTelemetry.runnerMotions[0].elapsedSeconds);
});

it('uses actual capture posture and one shortened transfer without exceeding physical hand speed',()=>{
  const source=ground(),before=structuredClone(source),old=simulateLiveFieldPlayV1(source),changed=simulateLiveFieldPlayV1(withSkills(source,{advanced_fielding:2})),
    a=old.diagnostics.aiTelemetry.contactDiagnostics.find(c=>c.retention)!,b=changed.diagnostics.aiTelemetry.contactDiagnostics.find(c=>c.retention)!;
  expect(b.elapsedSeconds).toBe(a.elapsedSeconds);expect(b.retention!.bodyStability).toBeGreaterThan(a.retention!.bodyStability);
  const oldThrow=old.facts.find(f=>f.kind==='throw_release')!,newThrow=changed.facts.find(f=>f.kind==='throw_release')!;
  expect(newThrow).toBeDefined();expect(newThrow.elapsedSeconds).toBeLessThan(oldThrow.elapsedSeconds);
  const secured=changed.facts.filter(f=>f.kind==='catch_secured'&&f.playerId===newThrow.playerId&&f.elapsedSeconds<newThrow.elapsedSeconds).at(-1)!;
  expect(newThrow.elapsedSeconds-secured.elapsedSeconds).toBeGreaterThanOrEqual(.25*.84-1e-9);
  expect(changed.diagnostics.handPreparationProofs.length).toBeGreaterThan(0);
  for(const proof of changed.diagnostics.handPreparationProofs){const f=source.fielders.find(f=>f.playerId===proof.playerId)!;
    expect(proof.diagnostics.derivativeControlSpeedBoundMps).toBeLessThanOrEqual(f.gloveSpeedMps);
    expect(proof.diagnostics.controlPointReachBoundMeters).toBeLessThanOrEqual(f.gloveReachMeters);}
  expect(source).toEqual(before);
});

it('changes real approach movement only after observing a slow grounded ball and leaves a fly exact',()=>{
  const source=ground(),old=simulateLiveFieldPlayV1(source),changed=simulateLiveFieldPlayV1(withSkills(source,{slow_ball_charge:2}));
  expect(changed.frames.map(f=>f.fielders)).not.toEqual(old.frames.map(f=>f.fielders));
  const firstGround=changed.facts.find(f=>f.kind==='ground_contact')!.elapsedSeconds,
    before=changed.frames.filter(f=>f.elapsedSeconds<=firstGround);
  expect(before).toEqual(old.frames.filter(f=>f.elapsedSeconds<=firstGround));
  for(const frame of changed.frames)for(const f of frame.fielders)expect(norm(f.velocity)).toBeLessThanOrEqual(source.fielders.find(s=>s.playerId===f.playerId)!.topSpeedMps+1e-8);
  const fly=liveFieldFixture();expect(simulateLiveFieldPlayV1(withSkills(fly,{slow_ball_charge:2}))).toEqual(simulateLiveFieldPlayV1(fly));
});

it('rejects invalid technique sources on both actor populations without partial mutation',()=>{
  for(const technicalSkills of [{baserunning:2.01},{advanced_fielding:-1},{bat_to_run_transition:NaN},{slow_ball_charge:Infinity},{unknown:1}]){
    for(const actor of ['fielders','runners'] as const){const source=structuredClone(ground()),before=structuredClone(source),
      invalid={...source,[actor]:source[actor].map(f=>({...f,technicalSkills}))};
      expect(()=>simulateLiveFieldPlayV1(invalid)).toThrow();expect(source).toEqual(before);}
  }
});
