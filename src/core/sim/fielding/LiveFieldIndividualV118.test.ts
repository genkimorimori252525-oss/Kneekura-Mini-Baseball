import {expect,it} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
const v=(x=0,y=0,z=0)=>({x,y,z});
export const individualFieldFixtureV118=():LiveFieldPlayInputV1=>({
  ball:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:v(8,.2,26),velocity:v(7,-.3,9),spin:v()}},
  physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
      material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}},
  field:{bases:{home:v(),first:v(19.39,0,19.39),second:v(0,0,38.78),third:v(-19.39,0,19.39)},fenceRadiusMeters:110,fenceHeightMeters:2},
  fielders:[v(0,1,12),v(0,1,-2),v(19,1,20),v(-19,1,20),v(12,1,35),v(-12,1,35),v(-35,1,65),v(0,1,75),v(35,1,65)].map((position,i)=>({
    playerId:'defender-'+i,position,defensivePosition:(['P','C','1B','3B','2B','SS','LF','CF','RF'] as const)[i],
    reactionSeconds:.08,topSpeedMps:7,accelerationMps2:6,gloveSpeedMps:8,gloveReachMeters:1.3,gloveRadiusMeters:.1,transferSeconds:.25,throwSpeedMps:32,
    catchRetention:{ticksPerSecond:1e6,ballMassKg:.145,ballRadiusMeters:.0366,pocketRadiusMeters:.3,centerRetentionCapacityJ:150,captureDissipationPowerW:3000,
      failedContactRestitution:.2,failedTangentialDamping:.4,failedSpinDamping:.2}})),
  runners:[{runnerId:'batter',initialBase:0,topSpeedMps:8,accelerationMps2:5,reactionSeconds:.1}],outs:0,maxPlaySeconds:.4,seed:719});

it('records all nine decision owners without altering legacy physical outcomes or random commands',()=>{
  const input=individualFieldFixtureV118(),plain=simulateLiveFieldPlayV1(input),traced=simulateLiveFieldPlayV1({...input,recordDecisionTraceV118:true});
  expect(traced.diagnostics.aiTelemetry.decisionTraceV118).toBeDefined();
  const trace=traced.diagnostics.aiTelemetry.decisionTraceV118!;
  expect(new Set(trace.entries.filter(e=>e.stage==='decision').map(e=>(e.evidence as {playerId:string}).playerId))).toEqual(new Set(input.fielders.map(f=>f.playerId)));
  for(const key of ['frames','facts','ruleFacts','end','finalRunners'] as const)expect(traced[key]).toEqual(plain[key]);
  expect(traced.diagnostics.throwDirectionCommands).toEqual(plain.diagnostics.throwDirectionCommands);
});

it('makes individual decisions from delayed information and produces repeatable real motor commands',()=>{
  const input={...individualFieldFixtureV118(),defenseDecisionModeV118:'individual' as const,recordDecisionTraceV118:true as const},a=simulateLiveFieldPlayV1(input),b=simulateLiveFieldPlayV1(input);
  expect(a.diagnostics.aiTelemetry.decisionTraceV118).toBeDefined();
  expect(a).toEqual(b);
  const decisions=a.diagnostics.aiTelemetry.decisionTraceV118!.entries.filter(e=>e.stage==='decision');
  expect(decisions.length).toBeGreaterThanOrEqual(9);
  expect(decisions.every(e=>(e.evidence as {basis:string}).basis==='individual_perception')).toBe(true);
  expect(a.frames.some(frame=>frame.fielders.some(f=>f.intent==='intercept'&&Math.hypot(f.velocity.x,f.velocity.z)>.01))).toBe(true);
});

it('keeps shadow calculation and individual render cadence out of physical event ownership',()=>{
 const input=individualFieldFixtureV118(),old=simulateLiveFieldPlayV1(input),shadow=simulateLiveFieldPlayV1({...input,defenseDecisionModeV118:'shadow',recordDecisionTraceV118:true});
 for(const key of ['frames','facts','ruleFacts','end','finalRunners'] as const)expect(shadow[key]).toEqual(old[key]);
 const a=simulateLiveFieldPlayV1({...input,defenseDecisionModeV118:'individual'}),b=simulateLiveFieldPlayV1({...input,defenseDecisionModeV118:'individual',frameSeconds:.02});
 for(const key of ['facts','ruleFacts','end','finalRunners'] as const)expect(a[key]).toEqual(b[key]);
 expect(a.frames.length).not.toBe(b.frames.length);
 expect(a.diagnostics.aiTelemetry.individualDecisionsV118).toHaveLength(9);
 expect(a.diagnostics.aiTelemetry.communicationV118!.entries).toBeLessThanOrEqual(256);
 const traced=simulateLiveFieldPlayV1({...input,defenseDecisionModeV118:'individual',recordDecisionTraceV118:true});
 for(const key of ['frames','facts','ruleFacts','end','finalRunners'] as const)expect(traced[key]).toEqual(a[key]);
 expect(traced.diagnostics.throwDirectionCommands).toEqual(a.diagnostics.throwDirectionCommands);
});
