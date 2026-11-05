import {expect,it} from 'vitest';
import {createNeutralZoneRecognitionV87} from './ZoneRecognitionV87';
import {planLivePitchTargetV111,resolveLivePitchCommandStdV111,validateLivePitchSituationV111,type LivePitchTargetPlanInputV111} from './LivePitchTargetPlanV111';

const source=():LivePitchTargetPlanInputV111=>({zone:{halfWidth:.2159,lowerY:.55,upperY:1.25},ballRadiusMeters:.0366,
 pitcher:{commandStdMeters:.12},batter:{bats:'R',aimStdMeters:.025,timingStdSeconds:.012,chaseMarginMeters:.12,
  maximumSweetSpotSpeedMps:38,targetSweetSpotSpeedMps:32},
 situation:{balls:0,strikes:0,outs:0,occupiedBases:{first:false,second:false,third:false}},seed:17});
const radius=(p:{x:number;y:number},i:LivePitchTargetPlanInputV111)=>Math.hypot((p.x-(i.zone.centerX??0))/i.zone.halfWidth,
 (p.y-(i.zone.lowerY+i.zone.upperY)/2)/((i.zone.upperY-i.zone.lowerY)/2));
const count=(balls:number,strikes:number):LivePitchTargetPlanInputV111=>{const i=source();return {...i,situation:{...i.situation,balls,strikes}};};

it('keeps the original command-technique formula and arithmetic order exactly',()=>{
 for(const bats of ['R','L'] as const)for(const x of [-.3,-.12,0,.12,.3])for(const y of [.5,.85,1.3])for(const skill of [0,.7,2]){
  const zone=source().zone,position={x,y},commandStdMeters=.137,technicalSkills={low_zone_command:skill,inside_command:skill},
   batterSide=bats==='R'?-1:1,lowZoneTechnique=technicalSkills.low_zone_command??0,
   lowZoneTechniqueActive=lowZoneTechnique>0&&position.y<=zone.lowerY+(zone.upperY-zone.lowerY)/3,
   lowZoneCommandStd=lowZoneTechniqueActive?commandStdMeters/(1+.6*lowZoneTechnique):commandStdMeters,
   insideTechnique=technicalSkills.inside_command??0,t=Math.max(0,Math.min(1,(position.x*batterSide/zone.halfWidth-.45)/.55)),
   insideTargetWeight=insideTechnique>0?t*t*(3-2*t):0,
   effectiveCommandStd=insideTargetWeight>0?lowZoneCommandStd/(1+.6*insideTechnique*insideTargetWeight):lowZoneCommandStd;
  expect(resolveLivePitchCommandStdV111({position,zone,bats,commandStdMeters,technicalSkills})).toEqual({lowZoneTechnique,
   lowZoneTechniqueActive,lowZoneCommandStd,insideTechnique,insideTargetWeight,effectiveCommandStd});
 }
});

it('uses count value to protect a three-ball count while allowing a two-strike chase',()=>{
 const three=count(3,0),two=count(0,2),a=planLivePitchTargetV111(three),b=planLivePitchTargetV111(two);
 expect(a.diagnostics.pStrike).toBeGreaterThan(b.diagnostics.pStrike);
 expect(radius(a.position,three)).toBeLessThan(radius(b.position,two));
});

it('lets precise command attack an edge while imprecise three-ball command moves toward the centre',()=>{
 const i=count(3,0),precise=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:.015}}),
  imprecise=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:.2}});
 expect(radius(precise.position,i)).toBeGreaterThan(.65);
 expect(radius(imprecise.position,i)).toBeLessThan(radius(precise.position,i));
 expect(imprecise.diagnostics.effectiveCommandStd).toBe(.2);
});

it('gives an authored dangerous hitter less of the heart even at three balls',()=>{
 const i=count(3,0),ordinary=planLivePitchTargetV111(i),dangerous=planLivePitchTargetV111({...i,
  batter:{...i.batter,maximumSweetSpotSpeedMps:65,targetSweetSpotSpeedMps:60,aimStdMeters:.004,timingStdSeconds:.002}});
 expect(radius(dangerous.position,i)).toBeGreaterThan(radius(ordinary.position,i));
 expect(dangerous.diagnostics.batterThreat).toBeGreaterThan(ordinary.diagnostics.batterThreat);
});

it.each([.015,.08])('keeps three-ball pitches to a dangerous hitter competitive at command sigma %s',commandStdMeters=>{
 const i={...count(3,0),pitcher:{commandStdMeters}},ordinary=planLivePitchTargetV111(i),
  dangerous=planLivePitchTargetV111({...i,batter:{...i.batter,maximumSweetSpotSpeedMps:65,targetSweetSpotSpeedMps:60,
   aimStdMeters:.004,timingStdSeconds:.002}}),d=dangerous.diagnostics;
 expect(d.pStrike).toBeLessThan(ordinary.diagnostics.pStrike);
 expect(d.pStrike).toBeGreaterThanOrEqual(.4);
 expect(d.pStrike).toBeGreaterThanOrEqual(.45*d.maximumEligibleStrikeProbability);
 expect(d.challengeProbabilityFloor).toBe(.45*d.maximumEligibleStrikeProbability);
 expect(d.normalContestPolicy).toBe('THREE_BALL_RELATIVE_STRIKE_FLOOR');
 expect(d.intentionalWalkDecision).toBe('NOT_IMPLEMENTED_SEPARATE_TACTICAL_DECISION');
 if(commandStdMeters===.015)expect(radius(dangerous.position,i)).toBeLessThan(1.25);
});

it('solves all twelve count states with finite normalized events and a bounded search',()=>{
 for(let balls=0;balls<4;balls++)for(let strikes=0;strikes<3;strikes++){
  const r=planLivePitchTargetV111(count(balls,strikes)),d=r.diagnostics;
  expect(Number.isFinite(d.cost)).toBe(true);expect(d.count).toEqual({balls,strikes});
  expect(d.situation).toEqual(count(balls,strikes).situation);
  expect(d.pStrike+d.pBall).toBeCloseTo(1,12);
  expect(d.events.ball+d.events.strike+d.events.foul+d.events.inPlay).toBeCloseTo(1,12);
  for(const p of Object.values(d.events))expect(p).toBeGreaterThanOrEqual(0);
  expect(d.candidateCount).toBeLessThanOrEqual(104);expect(d.candidateCount).toBeGreaterThan(20);
  expect(d.modelCalibrated).toBe(false);expect(d.futureSourceUsed).toBe(false);
  if(balls===3)expect(d.pStrike).toBeGreaterThanOrEqual(d.challengeProbabilityFloor!);
  else expect(d.challengeProbabilityFloor).toBeNull();
 }
});

it('honours both roles zero-weight exclusions and explicitly falls back if their intersection is empty',()=>{
 const i=source(),profile=createNeutralZoneRecognitionV87(),allowed=3*7+3,
  pitcher={...profile,pitcher:{cells:profile.pitcher!.cells.map((c,index)=>({...c,targetWeight:index===allowed?4:0}))}},
  accepted=planLivePitchTargetV111({...i,pitcher:{...i.pitcher,zoneRecognitionV87:pitcher}});
 expect(accepted.diagnostics.selectedCourseIndex).toBe(allowed);expect(accepted.diagnostics.preferenceFallback).toBe(false);
 const catcher={...profile,catcher:{cells:profile.catcher!.cells.map((c,index)=>({...c,targetWeight:index===allowed+7?4:0}))}},
  fallback=planLivePitchTargetV111({...i,pitcher:{...i.pitcher,zoneRecognitionV87:pitcher},catcher:{zoneRecognitionV87:catcher}});
 expect(fallback.diagnostics.preferenceFallback).toBe(true);expect(Number.isFinite(fallback.diagnostics.cost)).toBe(true);
});

it('sets the contest floor relative to available command and keeps an explicit outside-only role choice',()=>{
 const i=count(3,0),weak=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:.6}});
 expect(weak.diagnostics.challengeProbabilityFloor).toBeLessThan(.45);
 expect(weak.diagnostics.pStrike).toBeGreaterThanOrEqual(weak.diagnostics.challengeProbabilityFloor!);
 const profile=createNeutralZoneRecognitionV87(),outside={...profile,pitcher:{cells:profile.pitcher!.cells.map((c,index)=>({...c,targetWeight:index===0?4:0}))}},
  restricted=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:.015,zoneRecognitionV87:outside}});
 expect(restricted.diagnostics.selectedCourseIndex).toBe(0);
 expect(restricted.diagnostics.preferenceFallback).toBe(false);
 expect(restricted.diagnostics.challengeProbabilityFloor).toBe(.45*restricted.diagnostics.maximumEligibleStrikeProbability);
});

it('anticipates a known pitcher bias without treating catcher recognition as pitch command error',()=>{
 const i=count(3,0),profile=createNeutralZoneRecognitionV87(),
  biased={...profile,pitcher:{cells:profile.pitcher!.cells.map(c=>({...c,biasXM:.13}))}},
  a=planLivePitchTargetV111(i),b=planLivePitchTargetV111({...i,pitcher:{...i.pitcher,zoneRecognitionV87:biased}}),
  catcher={...profile,catcher:{cells:profile.catcher!.cells.map(c=>({...c,biasXM:.13,uncertaintyScale:2}))}},
  c=planLivePitchTargetV111({...i,catcher:{zoneRecognitionV87:catcher}});
 expect(b.position.x).toBeLessThan(a.position.x);expect(b.diagnostics.commandBiasMeters.x).toBe(.13);
 expect(c.diagnostics.commandBiasMeters).toEqual({x:0,y:0});
 expect(c.diagnostics.captureRiskCost).toBeGreaterThan(a.diagnostics.captureRiskCost);
});

it('uses real occupancy and outs for the walk value, including the forced run with loaded bases',()=>{
 const i=count(3,2),empty=planLivePitchTargetV111(i),loaded=planLivePitchTargetV111({...i,
  situation:{...i.situation,occupiedBases:{first:true,second:true,third:true}}}),
  twoOut=planLivePitchTargetV111({...i,situation:{...i.situation,outs:2}});
 expect(loaded.diagnostics.walkCost).toBeGreaterThan(empty.diagnostics.walkCost);
 expect(loaded.diagnostics.walkCost).toBeGreaterThanOrEqual(1);
 expect(twoOut.diagnostics.walkCost).toBeLessThan(empty.diagnostics.walkCost);
});

it('is deterministic and immutable, with only near-optimal three-ball alternatives across seeds',()=>{
 const i=count(3,0),before=JSON.stringify(i),a=planLivePitchTargetV111(i);
 expect(planLivePitchTargetV111(i)).toEqual(a);expect(JSON.stringify(i)).toBe(before);
 expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.position)).toBe(true);
 for(let seed=1;seed<20;seed++){
  const r=planLivePitchTargetV111({...i,seed});
  expect(r.diagnostics.cost-r.diagnostics.minimumCost).toBeLessThanOrEqual(.002000000001);
 }
});

it('handles zero command variance and does not double-count redundant plate vision beside SI judgment',()=>{
 const i=source(),a=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:0},batter:{...i.batter,plateVision:1}}),
  b=planLivePitchTargetV111({...i,pitcher:{commandStdMeters:0},batter:{...i.batter,plateVision:100}});
 expect(a).toEqual(b);expect(Number.isFinite(a.diagnostics.cost)).toBe(true);
});

it('rejects invalid context or distributions without changing caller input',()=>{
 const i=source(),before=JSON.stringify(i);
 expect(()=>planLivePitchTargetV111({...i,situation:{...i.situation,balls:4}})).toThrow(/situation/);
 expect(()=>planLivePitchTargetV111({...i,pitcher:{commandStdMeters:NaN}})).toThrow(/finite/);
 expect(()=>planLivePitchTargetV111({...i,ballRadiusMeters:0})).toThrow(/radius/);
 expect(()=>planLivePitchTargetV111({...i,zone:{...i.zone,upperY:i.zone.lowerY}})).toThrow(/zone/);
 expect(JSON.stringify(i)).toBe(before);
});

it('requires a complete inert situation instead of silently treating unknown bases as empty',()=>{
 const valid=source().situation,before=JSON.stringify(valid),parsed=validateLivePitchSituationV111(valid);
 expect(parsed).toEqual(valid);expect(parsed).not.toBe(valid);expect(Object.isFrozen(parsed.occupiedBases)).toBe(true);
 expect(()=>validateLivePitchSituationV111({...valid,extra:1})).toThrow(/situation/);
 expect(()=>validateLivePitchSituationV111({...valid,occupiedBases:{first:false,second:false}})).toThrow(/occupiedBases/);
 expect(()=>validateLivePitchSituationV111({...valid,occupiedBases:{first:0,second:false,third:false}})).toThrow(/occupiedBases/);
 expect(()=>validateLivePitchSituationV111({...valid,strikes:1.5})).toThrow(/situation/);
 let read=false;
 const accessor={...valid,get occupiedBases(){read=true;return valid.occupiedBases;}};
 expect(()=>validateLivePitchSituationV111(accessor)).toThrow(/inert/);expect(read).toBe(false);
 expect(JSON.stringify(valid)).toBe(before);
});

it('pitchTargetPlanV2: forecasts the MLB hitter by count and draws on cost weights; absent, nothing changes',()=>{
 const plain=planLivePitchTargetV111(source());
 expect(plain.diagnostics).not.toHaveProperty('targetPlanV2');
 const mean=(balls:number,strikes:number,temperature:number)=>{let p=0;for(let seed=0;seed<40;seed++)
  p+=planLivePitchTargetV111({...count(balls,strikes),seed,targetPlanV2:temperature}).diagnostics.pStrike;return p/40;};
 // Two strikes make the hitter chase, so the pitcher leaves the zone more; a hot temperature spreads the choice toward even.
 expect(mean(0,0,.01)).toBeGreaterThan(mean(0,2,.01)+.1);
 expect(mean(3,1,.01)).toBeGreaterThan(mean(0,0,.01));
 const v2=planLivePitchTargetV111({...source(),targetPlanV2:.01}).diagnostics;
 expect(v2.targetPlanV2?.temperature).toBe(.01);
 expect(v2.walkCost).toBeCloseTo(.34*(.69/1.24)/.34,6);
 expect(()=>planLivePitchTargetV111({...source(),targetPlanV2:0})).toThrow(/target plan v2/);
 expect(()=>planLivePitchTargetV111({...source(),targetPlanV2:.6})).toThrow(/target plan v2/);
});

it('pitchTargetPlanV2 zone lean: a positive lean keeps the pitch in the zone more, a negative one out; it needs V2',()=>{
 const mean=(zoneLeanV2:number)=>{let p=0;for(let seed=0;seed<40;seed++)
  p+=planLivePitchTargetV111({...count(1,1),seed,targetPlanV2:.01,zoneLeanV2}).diagnostics.pStrike;return p/40;};
 expect(mean(.05)).toBeGreaterThan(mean(0)+.03);
 expect(mean(-.05)).toBeLessThan(mean(0)-.03);
 expect(()=>planLivePitchTargetV111({...source(),zoneLeanV2:.05})).toThrow(/zone lean/);
});
