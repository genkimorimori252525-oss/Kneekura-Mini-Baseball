import {expect,it} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
const v=(x=0,y=0,z=0)=>({x,y,z});
const fixture=(buildSeconds=.6,capacity=34):LiveFieldPlayInputV1=>({
 ball:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:v(0,.2,0),velocity:v(1,-1,5),spin:v()}},
 physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
  ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
   material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}},
 field:{bases:{home:v(),first:v(19.39,0,19.39),second:v(0,0,38.78),third:v(-19.39,0,19.39)},fenceRadiusMeters:110,fenceHeightMeters:2},
 fielders:[v(0,1,10),v(0,1,-2),v(20,1,20),v(-20,1,20),v(12,1,35),v(-12,1,35),v(-35,1,65),v(0,1,75),v(35,1,65)]
  .map((position,i)=>({playerId:'f'+i,position,reactionSeconds:.08,topSpeedMps:7,accelerationMps2:6,gloveSpeedMps:8,gloveReachMeters:1.3,gloveRadiusMeters:.1,
   transferSeconds:.25,throwEffortBuildSecondsV103:buildSeconds,throwSpeedMps:capacity,catchRetention:{ticksPerSecond:1e6,ballMassKg:.145,ballRadiusMeters:.0366,
    pocketRadiusMeters:.3,centerRetentionCapacityJ:150,captureDissipationPowerW:3000,failedContactRestitution:.2,failedTangentialDamping:.4,failedSpinDamping:.2}})),
 runners:[{runnerId:'batter',initialBase:0,topSpeedMps:3,accelerationMps2:3,reactionSeconds:.1}],outs:0,maxPlaySeconds:18,seed:101
});
it('waits for both issued charge and real hand readiness without changing the first capture',()=>{
 const input=fixture(),before=JSON.stringify(input),r=simulateLiveFieldPlayV1(input),quick=simulateLiveFieldPlayV1(fixture(0));
 const rows=r.diagnostics.throwEffortCommandsV103;expect(rows.length).toBeGreaterThan(0);
 expect(r.facts.find(f=>f.kind==='catch_secured')).toEqual(quick.facts.find(f=>f.kind==='catch_secured'));
 const releases=r.facts.filter(f=>f.kind==='throw_release');expect(releases.length).toBeGreaterThan(0);
 for(const release of releases){const command=rows.filter(c=>c.playerId===release.playerId&&c.from<=release.elapsedSeconds).at(-1)!;
  expect(release.elapsedSeconds+1e-9).toBeGreaterThanOrEqual(command.readyAt);
  expect(release.elapsedSeconds+1e-9).toBeGreaterThanOrEqual(r.diagnostics.handPreparationProofs.filter(p=>p.playerId===release.playerId&&p.from<=release.elapsedSeconds).at(-1)!.through);
  expect(command.effort).toBeGreaterThan(0);expect(command.effort).toBeLessThanOrEqual(1);expect(command.commandSpeedMps).toBeLessThanOrEqual(command.capacitySpeedMps);
 }
 expect(releases[0].elapsedSeconds).toBeGreaterThan(quick.facts.find(f=>f.kind==='throw_release')!.elapsedSeconds);
 expect(JSON.stringify(input)).toBe(before);
});
it('uses a tiny effort for raw arm999 capacity while issuing finite ordinary-speed throws',()=>{
 const r=simulateLiveFieldPlayV1(fixture(.6,400000)),commands=r.diagnostics.throwEffortCommandsV103;
 expect(commands.length).toBeGreaterThan(0);expect(commands.some(c=>c.effort<.000001&&c.capacitySpeedMps===400000)).toBe(true);
 expect(r.facts.some(f=>f.kind==='throw_release')).toBe(true);
 for(const command of commands){expect(command.commandSpeedMps).toBeGreaterThan(0);expect(command.commandSpeedMps).toBeLessThanOrEqual(120);}
 for(const frame of r.frames)expect(Object.values(frame.ball.velocity).every(Number.isFinite)).toBe(true);
});
it('keeps command/release/official facts identical at a different display cadence',()=>{
 const input=fixture(),a=simulateLiveFieldPlayV1(input),b=simulateLiveFieldPlayV1({...input,frameSeconds:.1});
 expect(a.facts).toEqual(b.facts);expect(a.ruleFacts).toEqual(b.ruleFacts);expect(a.diagnostics.throwEffortCommandsV103).toEqual(b.diagnostics.throwEffortCommandsV103);
 expect(a.frames.length).not.toBe(b.frames.length);
});
it('validates the new per-player build duration instead of silently clipping it',()=>{
 expect(()=>simulateLiveFieldPlayV1(fixture(-1))).toThrow();expect(()=>simulateLiveFieldPlayV1(fixture(5.01))).toThrow();
});
it('accepts old fielder packets with missing build duration and uses the common default',()=>{
 const input=fixture(),legacy={...input,fielders:input.fielders.map(f=>{const {throwEffortBuildSecondsV103,...old}=f;return old;})};
 const actual=simulateLiveFieldPlayV1(legacy),explicit=simulateLiveFieldPlayV1(input);
 expect(actual.diagnostics.throwEffortCommandsV103.length).toBeGreaterThan(0);expect(actual.facts).toEqual(explicit.facts);
 expect(actual.diagnostics.throwEffortCommandsV103).toEqual(explicit.diagnostics.throwEffortCommandsV103);
});
