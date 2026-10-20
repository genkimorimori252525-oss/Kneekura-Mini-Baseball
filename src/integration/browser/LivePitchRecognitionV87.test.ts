import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {simulateLivePitchV1,type LivePitchInputV1,type LiveMeasuredClipV1} from './LivePitchV1';
import {createNeutralZoneRecognitionV87,type ZoneRecognitionRoleV87} from './ZoneRecognitionV87';
import {createNeutralBatterCourseProfileV87,expandBatterCourseProfileV87ToV79} from './BatterCourseProfileV87';
import {buildPitcherWorkbenchInputV77} from './PitcherWorkbenchV77';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const source=():LivePitchInputV1=>({originTick:1234567,seed:7,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R'},pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:clips,batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
const edited=(role:ZoneRecognitionRoleV87,biasXM:number)=>{const neutral=createNeutralZoneRecognitionV87();return {...neutral,[role]:{cells:neutral[role]!.cells.map(cell=>({...cell,biasXM,uncertaintyScale:0}))}};};
it('always records three causal role observations and keeps explicit neutral execution identical',()=>{
 const input=source(),baseline=simulateLivePitchV1(input),neutral=createNeutralZoneRecognitionV87(),actual=simulateLivePitchV1({...input,batter:{...input.batter,zoneRecognitionV87:neutral},pitcher:{...input.pitcher,zoneRecognitionV87:neutral}});
 expect(actual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);expect(actual.frames).toEqual(baseline.frames);expect(actual.contact).toEqual(baseline.contact);
 const roles=baseline.diagnostics.courseRecognitionV87;expect(roles.batter.role).toBe('batter');expect(roles.pitcher.role).toBe('pitcher');expect(roles.catcher.role).toBe('catcher');
 expect(roles.pitcher.planeZ).toBe(.15);expect(roles.catcher.planeZ).toBe(-.85);
 for(const role of Object.values(roles))expect(role.sourceTick).toBeLessThanOrEqual(role.observationTick);
});
it('uses the edited batter estimate for swing aim without changing the incoming Source',()=>{
 const input=source(),baseline=simulateLivePitchV1(input),actual=simulateLivePitchV1({...input,batter:{...input.batter,zoneRecognitionV87:edited('batter',.12)}});
 expect(actual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);
 expect(actual.diagnostics.courseRecognitionV87.batter.errorMeters.x).toBe(.12);
 expect(actual.diagnostics.aimErrorMeters.x).toBeCloseTo(0,14);expect(actual.diagnostics.aimErrorMeters.y).toBeCloseTo(0,14);
 expect(actual.diagnostics.referenceContactSweetSpotVelocity).toEqual(baseline.diagnostics.referenceContactSweetSpotVelocity);
 expect(actual.frames).not.toEqual(baseline.frames);
});
it('separates pitcher request from execution and catcher perception from actual flight',()=>{
 const input=source(),baseline=simulateLivePitchV1(input),pitcher=simulateLivePitchV1({...input,pitcher:{...input.pitcher,zoneRecognitionV87:edited('pitcher',.08)}});
 expect(pitcher.diagnostics.courseRecognitionV87.pitcher.requestedPosition).toEqual(baseline.diagnostics.courseRecognitionV87.pitcher.requestedPosition);
 expect(pitcher.diagnostics.sourceDescriptor).not.toEqual(baseline.diagnostics.sourceDescriptor);
 const catcher=simulateLivePitchV1({...input,catcher:{gloveSpeedMps:7,gloveReachMeters:.95,gloveRadiusMeters:.14,retentionCapacityJ:350,captureDissipationPowerW:10000,pocketRadiusMeters:.18,zoneRecognitionV87:edited('catcher',.2)}});
 expect(catcher.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);expect(catcher.diagnostics.courseRecognitionV87.catcher.errorMeters.x).toBe(.2);
 expect(catcher.diagnostics.courseRecognitionV87.catcher.captureTarget).not.toEqual(baseline.diagnostics.courseRecognitionV87.catcher.captureTarget);
});
it('applies role target weights only to automatic allowed targets and retains manual manager locations',()=>{
 const input=source(),neutral=createNeutralZoneRecognitionV87(),profile={...neutral,pitcher:{cells:neutral.pitcher!.cells.map((cell,index)=>({...cell,targetWeight:index%7===3?4:.1}))}},
  baseline=simulateLivePitchV1(input),manual=simulateLivePitchV1({...input,pitcher:{...input.pitcher,zoneRecognitionV87:profile}});
 expect(manual.diagnostics.sourceDescriptor).toEqual(baseline.diagnostics.sourceDescriptor);expect(manual.diagnostics.courseRecognitionV87.pitcher.reason).toBe('manual_or_manager_location_retained');
 const automatic=simulateLivePitchV1({...input,location:'auto',pitcher:{...input.pitcher,zoneRecognitionV87:profile}}),record=automatic.diagnostics.courseRecognitionV87.pitcher;
 expect(record.reason).toBe('explicit_role_target_weights');expect(record.selectedCourseId).not.toBeNull();
 if(record.selectedLocation==='zone'){const id=record.selectedCourseId!;expect(Math.floor(id/10)).toBeGreaterThanOrEqual(3);expect(Math.floor(id/10)).toBeLessThanOrEqual(7);expect(id%10).toBeGreaterThanOrEqual(1);expect(id%10).toBeLessThanOrEqual(5);}
});
it('keeps forced take/swing commands effective when target preference is zero',()=>{
 const input=source(),neutral=createNeutralZoneRecognitionV87(),profile={...neutral,batter:{cells:neutral.batter!.cells.map(cell=>({...cell,targetWeight:0}))}},
  taken=simulateLivePitchV1({...input,batting:'take',batter:{...input.batter,zoneRecognitionV87:profile}}),
  swung=simulateLivePitchV1({...input,batter:{...input.batter,zoneRecognitionV87:profile,swingDecision:{approach:'SWING',threshold:.5,aggressionWeight:.5}}});
 expect(taken.diagnostics.swingOffered).toBe(false);expect(swung.diagnostics.swingOffered).toBe(true);
});
it('uses explicit thirteen-region author profiles through the shared legacy execution projection',()=>{
 const input=source(),profile={...createNeutralBatterCourseProfileV87(),referenceAverages:Array(13).fill(.33)},
  modern=simulateLivePitchV1({...input,batter:{...input.batter,batterCourseProfileV87:profile}}),
  expanded=simulateLivePitchV1({...input,batter:{...input.batter,batterCourseProfileV79:expandBatterCourseProfileV87ToV79(profile)}});
 expect(modern.frames).toEqual(expanded.frames);expect(modern.contact).toEqual(expanded.contact);expect(modern.diagnostics.courseV79).toEqual(expanded.diagnostics.courseV79);
});
it('carries only present optional catcher recognition fields through the shared ordinary-pitch builder',()=>{
 const profile=edited('catcher',.1),players=['p','b','c'].map(playerId=>({playerId,name:playerId,heightMeters:1.8,bats:'R' as const,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,...(playerId==='c'?{zoneRecognitionV87:profile,defensiveDecisionSeconds:.2}:{})}})),
  built=buildPitcherWorkbenchInputV77({players,pitcherId:'p',batterId:'b',catcherId:'c',measuredClips:clips,seed:7,pitchType:'fastball',location:'zone'});
 expect(built.catcher!.zoneRecognitionV87).toEqual(profile);expect(built.catcher!.defensiveDecisionSeconds).toBe(.2);
 expect(simulateLivePitchV1(built).diagnostics.courseRecognitionV87.catcher.edited).toBe(true);
});
