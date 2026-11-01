import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import {resolveLiveAthleticProfileV115} from '../LiveAthleticControlsV115';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
const v=(x=0,y=0,z=0)=>({x,y,z});
function fixture(kind:'jump'|'dive'):LiveFieldPlayInputV1{
 const body=resolveLiveFielderBodyModelV105(1.8,1.35),profile=resolveLiveAthleticProfileV115({heightMeters:1.8,accelerationMps2:6,reactionSeconds:0,gloveSpeedMps:12});
 return{ball:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:kind==='jump'?v(0,2.8,6):v(0,.7,7),velocity:kind==='jump'?v(0,0,20):v(0,0,12),spin:v()}},
 physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}},
 field:{bases:{home:v(),first:v(19.39,0,19.39),second:v(0,0,38.78),third:v(-19.39,0,19.39)},fenceRadiusMeters:110,fenceHeightMeters:2},
 fielders:Array.from({length:9},(_,i)=>({playerId:'f'+i,position:i===0?v(0,body.hipHeightMeters,11):v(i%2?35:-35,body.hipHeightMeters,35+i*6),
 reactionSeconds:0,topSpeedMps:7,accelerationMps2:6,gloveSpeedMps:12,gloveReachMeters:1.35,gloveRadiusMeters:.1,
 transferSeconds:.25,throwSpeedMps:32,bodyModelV105:body,...(i===0?{athleticProfileV115:profile}:{}),
 catchRetention:{ticksPerSecond:1e6,ballMassKg:.145,ballRadiusMeters:.0366,pocketRadiusMeters:.3,centerRetentionCapacityJ:150,captureDissipationPowerW:3000,failedContactRestitution:.2,failedTangentialDamping:.4,failedSpinDamping:.2}})),
 runners:[{runnerId:'b',initialBase:0,topSpeedMps:8,accelerationMps2:5,reactionSeconds:.1}],outs:2,maxPlaySeconds:4};
}
it('issues an observed jump and exposes the same raised eye/hip/arm in Source, independent of frame cadence',()=>{
 const input=fixture('jump'),a=simulateLiveFieldPlayV1(input),b=simulateLiveFieldPlayV1({...input,frameSeconds:.1});
 if(process.env.FIELDING_DIAG_REPORT==='1')console.log('ATHLETIC',JSON.stringify({end:a.end,decisions:a.diagnostics.athleticDecisionsV115,detail:a.diagnostics.unresolvedDetail,moves:a.diagnostics.aiTelemetry.roleTransitions.slice(0,3)}));
 expect(a.frames.some(f=>f.fielders[0].athleticV115?.kind==='jump')).toBe(true);
 expect(a.end.complete).toBe(true);
 expect(a.ruleFacts.flyCatch!.secureCatchTick).toBeGreaterThanOrEqual(Math.ceil(a.diagnostics.athleticDecisionsV115[0].throughSeconds*1e6));
 expect(a.facts).toEqual(b.facts);expect(a.ruleFacts).toEqual(b.ruleFacts);
 for(const frame of a.frames){const f=frame.fielders[0],p=f.bodyPoseV105!;expect(p.reachMarginMeters).toBeGreaterThanOrEqual(-1e-7);}
 const active=a.frames.filter(f=>f.fielders[0].athleticV115?.kind==='jump');
 expect(Math.max(...active.map(f=>f.fielders[0].bodyPoseV105!.eye.y))).toBeGreaterThan(1.8*.92+.1);
});
it('can commit a low diving interception and cannot release a throw before its physical recovery',()=>{
 const result=simulateLiveFieldPlayV1({...fixture('dive'),outs:0,maxPlaySeconds:5}),frames=result.frames.filter(f=>f.fielders[0].athleticV115?.kind==='dive');
 if(process.env.FIELDING_DIAG_REPORT==='1')console.log('DIVE',JSON.stringify({end:result.end,detail:result.diagnostics.unresolvedDetail,actions:result.diagnostics.athleticDecisionsV115,facts:result.facts.filter(f=>['catch_secured','glove_contact','throw_release'].includes(f.kind))}));
 expect(result.diagnostics.unresolvedDetail).toBeNull();
 expect(frames.length).toBeGreaterThan(0);
 const through=frames[0].fielders[0].athleticV115!.throughSeconds;
 for(const release of result.facts.filter(f=>f.kind==='throw_release'&&f.playerId==='f0'))expect(release.elapsedSeconds).toBeGreaterThanOrEqual(through);
 expect(frames.some(f=>f.fielders[0].bodyPoseV105!.head.y<1)).toBe(true);
});
it('preserves individual jump settings and real retention instead of awarding an action catch',()=>{
 const input=fixture('jump'),noJump={...input,fielders:input.fielders.map((f,i)=>i?f:{...f,athleticProfileV115:{...f.athleticProfileV115!,jumpHeightMeters:0}})},
  weak={...input,fielders:input.fielders.map(f=>({...f,catchRetention:{...f.catchRetention,centerRetentionCapacityJ:.0001}}))},
  a=simulateLiveFieldPlayV1(noJump),b=simulateLiveFieldPlayV1(weak);
 expect(a.diagnostics.athleticDecisionsV115.some(x=>x.kind==='jump')).toBe(false);
 expect(b.diagnostics.athleticDecisionsV115.some(x=>x.kind==='jump')).toBe(true);
 expect(b.ruleFacts.flyCatch).toBeNull();expect(b.facts.some(f=>f.kind==='glove_contact')).toBe(true);
});
it('does not manufacture a force out from an airborne hip projected over first base before landing control',()=>{
 const raw=fixture('jump'),result=simulateLiveFieldPlayV1({...raw,field:{...raw.field,bases:{...raw.field.bases,first:v(0,0,11)}}});
 expect(result.diagnostics.athleticDecisionsV115[0].kind).toBe('jump');
 expect(result.ruleFacts.controlledBaseContacts).toEqual([]);
 expect(result.ruleFacts.flyCatch).not.toBeNull();
 expect(result.ruleFacts.flyCatch!.secureCatchTick).toBeGreaterThanOrEqual(Math.ceil(result.diagnostics.athleticDecisionsV115[0].throughSeconds*1e6));
 expect(result.end.reason).toBe('third_out');
});
it('finishes an already committed fielder action after a different defender makes the third out',()=>{
 const raw=fixture('jump'),body=resolveLiveFielderBodyModelV105(2.5,1.35,{fieldArmReachMetersV105:.2,fieldShoulderHeightRatioV105:.88}),
  result=simulateLiveFieldPlayV1({...raw,fielders:raw.fielders.map((f,i)=>i===0?{...f,gloveSpeedMps:.1}:i===1?{...f,position:v(0,body.hipHeightMeters,13.5),bodyModelV105:body,gloveSpeedMps:12,topSpeedMps:.1,accelerationMps2:.1}:f)}),
  recovery=result.recoveryFramesV115??[];
 if(process.env.FIELDING_DIAG_REPORT==='1')console.log('FIELDER_RECOVERY',JSON.stringify({end:result.end,catch:result.ruleFacts.flyCatch,actions:result.diagnostics.athleticDecisionsV115,recovery:recovery.length,facts:result.facts.filter(f=>f.kind==='catch_secured')}));
 expect(result.end.reason).toBe('third_out');expect(result.ruleFacts.flyCatch?.fielderId).toBe('f1');
 expect(result.frames.at(-1)!.fielders[0].athleticV115).toBeDefined();expect(recovery.length).toBeGreaterThan(0);
 expect(recovery[0].tick).toBeGreaterThan(result.end.tick);
 for(const f of recovery)expect(f.recoveryV115).toEqual({kind:'athletic_action_recovery',officialEndTick:result.end.tick,readOnly:true});
 expect(recovery.at(-1)!.fielders[0].athleticV115?.phase).toBe('ready');
 expect(recovery.at(-1)!.fielders[0].bodyPoseV105!.foot.y).toBeCloseTo(0,10);
 expect(result.facts.every(f=>f.tick<=result.end.tick)).toBe(true);
});
it('requires a new physical reception after a held diving ball is lost on the landing impulse',()=>{
 const raw=fixture('dive'),body=resolveLiveFielderBodyModelV105(2.5,1.35),profile=resolveLiveAthleticProfileV115({heightMeters:2.5,accelerationMps2:6,reactionSeconds:0,gloveSpeedMps:12}),
  result=simulateLiveFieldPlayV1({...raw,maxPlaySeconds:4,ball:{...raw.ball,ball:{...raw.ball.ball,position:v(0,1.2,1.5),velocity:v(0,0,5)}},
    fielders:raw.fielders.map((f,i)=>i===0?{...f,position:v(0,body.hipHeightMeters,-1),velocity:v(0,0,7),bodyModelV105:body,athleticProfileV115:profile,catchRetention:{...f.catchRetention,centerRetentionCapacityJ:1.3}}:f)});
 if(process.env.FIELDING_DIAG_REPORT==='1')console.log('LANDING_DROP',JSON.stringify({end:result.end,actions:result.diagnostics.athleticDecisionsV115,facts:result.facts.filter(f=>['catch_secured','glove_contact'].includes(f.kind)),detail:result.diagnostics.unresolvedDetail}));
 const drop=result.facts.find(f=>f.reason==='landing_retention_failed')!,recatch=result.facts.find(f=>f.kind==='catch_secured'&&f.tick>drop?.tick);
 expect(drop).toBeDefined();expect(result.facts.some(f=>f.kind==='catch_secured'&&f.tick<drop.tick)).toBe(true);
 expect(result.facts.some(f=>f.kind==='glove_contact'&&f.tick>drop.tick)).toBe(true);expect(recatch).toBeDefined();
 expect(result.ruleFacts.firstGroundContactTick).toBeNull();
 expect(result.ruleFacts.flyCatch!.secureCatchTick).toBeGreaterThanOrEqual(recatch!.tick);
});
it('keeps a committed dive inside every support band when the runner-speed band changes mid-takeoff',()=>{
 const raw=JSON.parse(readFileSync(new URL('../../../../docs/verification/releases/v115/latency-pitch240-1/field-input.json',import.meta.url),'utf8')) as LiveFieldPlayInputV1,
  before=JSON.stringify(raw),result=simulateLiveFieldPlayV1(raw);
 if(process.env.FIELDING_DIAG_REPORT==='1')console.log('BAND_REGRESSION',JSON.stringify({end:result.end,detail:result.diagnostics.unresolvedDetail,actions:result.diagnostics.athleticDecisionsV115}));
 expect(result.diagnostics.athleticDecisionsV115.some(a=>a.playerId==='0-b8'&&a.kind==='dive')).toBe(true);
 expect(result.end.complete).toBe(true);expect(result.diagnostics.unresolvedDetail).toBeNull();
 for(const frame of result.frames)for(const f of frame.fielders)if(f.bodyPoseV105)expect(f.bodyPoseV105.reachMarginMeters).toBeGreaterThanOrEqual(-1e-7);
 expect(JSON.stringify(raw)).toBe(before);
});
