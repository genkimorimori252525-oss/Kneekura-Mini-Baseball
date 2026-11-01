import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SeedRoot} from '../../core/rng/SeedRoot';
import {validateTechnicalSkillControlsV75,type TechnicalSkillControlsV75} from '../../core/sim/TechnicalSkillControlsV75';
import {classifyBatterCourseV79,type BatterCourseZoneV79} from './BatterCourseProfileV79';
import {classifyPublicCourseV87,validateBatterCourseProfileV87,type BatterCourseProfileV87} from './BatterCourseProfileV87';
import {validateZoneRecognitionV87,type ZoneRecognitionV87} from './ZoneRecognitionV87';

export type LivePitchSituationV111=Readonly<{balls:number;strikes:number;outs:number;
 occupiedBases:Readonly<{first:boolean;second:boolean;third:boolean}>}>;
type Position=Readonly<{x:number;y:number}>;
type CommandInput=Readonly<{position:Position;zone:BatterCourseZoneV79;bats:'R'|'L';commandStdMeters:number;technicalSkills?:TechnicalSkillControlsV75}>;
export type LivePitchTargetPlanInputV111=Readonly<{
 zone:BatterCourseZoneV79;ballRadiusMeters:number;seed:number;situation:LivePitchSituationV111;
 pitcher:Readonly<{commandStdMeters:number;technicalSkills?:TechnicalSkillControlsV75;zoneRecognitionV87?:ZoneRecognitionV87}>;
 catcher?:Readonly<{zoneRecognitionV87?:ZoneRecognitionV87}>;
 batter:Readonly<{bats:'R'|'L';heightMeters?:number;maximumSweetSpotSpeedMps?:number;targetSweetSpotSpeedMps?:number;
  aimStdMeters:number;timingStdSeconds:number;chaseMarginMeters:number;plateVision?:number;zoneJudgmentStdMeters?:number;badBallControl?:number;
  swingDecision?:Readonly<{approach:'AUTO'|'TAKE'|'SWING';threshold:number;aggressionWeight:number}>;
  batterCourseProfileV87?:BatterCourseProfileV87;technicalSkills?:TechnicalSkillControlsV75}>;
}>;
type Events=Readonly<{ball:number;strike:number;foul:number;inPlay:number}>;
type Candidate={position:Position;location:'zone'|'inside'|'outside'|'low'|'high';courseIndex:number;
 weight:number;pStrike:number;pHeart:number;events:Events;contactCost:number;captureRiskCost:number;
 preferenceCost:number;commandBiasMeters:Position;effectiveCommandStd:number};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const bounded=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
function assert(v:unknown,message:string):asserts v{if(!v)throw Error('pitch target v111: '+message);}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const exactKeys=(v:unknown,keys:readonly string[])=>v&&typeof v==='object'&&!Array.isArray(v)
 &&Object.keys(v).sort().join('|')===[...keys].sort().join('|');

export function validateLivePitchSituationV111(raw:unknown):LivePitchSituationV111{
 let value:unknown;
 try{value=cloneInert(raw);}catch{throw Error('pitch target v111: situation must contain plain inert data');}
 assert(exactKeys(value,['balls','strikes','outs','occupiedBases']),'invalid situation fields');
 const s=value as LivePitchSituationV111;
 assert(Number.isSafeInteger(s.balls)&&bounded(s.balls,0,3)&&Number.isSafeInteger(s.strikes)&&bounded(s.strikes,0,2)
  &&Number.isSafeInteger(s.outs)&&bounded(s.outs,0,2),'invalid situation count or outs');
 assert(exactKeys(s.occupiedBases,['first','second','third'])&&Object.values(s.occupiedBases).every(v=>typeof v==='boolean'),'invalid situation occupiedBases');
 return freeze(s);
}

/** Shared with actual release execution. Keep the original V77 arithmetic order. */
export function resolveLivePitchCommandStdV111(input:CommandInput){
 const {position:target,zone,commandStdMeters,technicalSkills}=input,batterSide=input.bats==='R'?-1:1,
  lowZoneTechnique=technicalSkills?.low_zone_command??0,
  lowZoneTechniqueActive=lowZoneTechnique>0&&target.y<=zone.lowerY+(zone.upperY-zone.lowerY)/3,
  lowZoneCommandStd=lowZoneTechniqueActive?commandStdMeters/(1+.6*lowZoneTechnique):commandStdMeters,
  insideTechnique=technicalSkills?.inside_command??0,
  insideTargetWeight=insideTechnique>0?techniqueBlend((target.x*batterSide/zone.halfWidth-.45)/.55):0,
  effectiveCommandStd=insideTargetWeight>0?lowZoneCommandStd/(1+.6*insideTechnique*insideTargetWeight):lowZoneCommandStd;
 return {lowZoneTechnique,lowZoneTechniqueActive,lowZoneCommandStd,insideTechnique,insideTargetWeight,effectiveCommandStd};
}
function techniqueBlend(u:number){const t=clamp(u,0,1);return t*t*(3-2*t);}

/** Normal CDF approximation (absolute error < 8e-8). This models uncertainty,
 * and never samples the actual later command error or changes the live Source. */
function normalCdf(z:number):number{
 if(z<=-10)return 0;if(z>=10)return 1;
 const t=1/(1+.2316419*Math.abs(z)),tail=.3989422804014327*Math.exp(-z*z/2)*t
  *(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return z>=0?1-tail:tail;
}
function intervalProbability(lo:number,hi:number,mean:number,std:number){
 return std===0?(mean>=lo&&mean<=hi?1:0):clamp(normalCdf((hi-mean)/std)-normalCdf((lo-mean)/std),0,1);
}
function rectangle(mean:Position,std:number,left:number,right:number,bottom:number,top:number){
 return intervalProbability(left,right,mean.x,std)*intervalProbability(bottom,top,mean.y,std);
}
const neutral={biasXM:0,biasYM:0,uncertaintyScale:1,targetWeight:1};

/** Bounded, uncalibrated tactical forecast in relative run-cost units. Contact,
 * takes and misses below are expectations, never rolls or official outcomes.
 * The radius-expanded rectangle is a 2-D policy approximation; actual 3-D
 * plate contact, pitch physics and catcher retention remain authoritative. */
export function planLivePitchTargetV111(raw:LivePitchTargetPlanInputV111){
 const input=cloneInert(raw),{zone,pitcher,batter}=input,situation=validateLivePitchSituationV111(input.situation),
  cx=zone.centerX??0,cy=(zone.lowerY+zone.upperY)/2,halfHeight=(zone.upperY-zone.lowerY)/2;
 assert(Number.isFinite(cx)&&bounded(zone.halfWidth,.01,1)&&Number.isFinite(zone.lowerY)&&Number.isFinite(zone.upperY)
  &&zone.upperY>zone.lowerY,'invalid zone');
 assert(bounded(input.ballRadiusMeters,.001,.15),'invalid ball radius');
 assert(Number.isSafeInteger(input.seed)&&bounded(input.seed,0,0xffffffff),'invalid seed');
 assert(bounded(pitcher.commandStdMeters,0,.6),'invalid command standard deviation');
 assert(['R','L'].includes(batter.bats)&&bounded(batter.aimStdMeters,0,.35)&&bounded(batter.timingStdSeconds,0,.08)
  &&bounded(batter.chaseMarginMeters,0,.6),'invalid batter raw controls');
 for(const [key,lo,hi]of [['maximumSweetSpotSpeedMps',.1,90],['targetSweetSpotSpeedMps',.1,90],['zoneJudgmentStdMeters',0,.6],
  ['badBallControl',0,1],['heightMeters',1.1,2.5],['plateVision',1,100]]as const)
  assert(batter[key]===undefined||bounded(batter[key],lo,hi),'invalid batter '+key);
 if(batter.swingDecision)assert(['AUTO','TAKE','SWING'].includes(batter.swingDecision.approach)&&bounded(batter.swingDecision.threshold,0,1)
  &&bounded(batter.swingDecision.aggressionWeight,0,1),'invalid batter swing decision');
 if(pitcher.technicalSkills)validateTechnicalSkillControlsV75(pitcher.technicalSkills);
 if(batter.technicalSkills)validateTechnicalSkillControlsV75(batter.technicalSkills);
 if(pitcher.zoneRecognitionV87)validateZoneRecognitionV87(pitcher.zoneRecognitionV87);
 if(input.catcher?.zoneRecognitionV87)validateZoneRecognitionV87(input.catcher.zoneRecognitionV87);
 const course=batter.batterCourseProfileV87===undefined?undefined:validateBatterCourseProfileV87(batter.batterCourseProfileV87),
  occupied=situation.occupiedBases,runnerCost=.10*Number(occupied.first)+.16*Number(occupied.second)+.20*Number(occupied.third),
  forcedRun=Number(occupied.first&&occupied.second&&occupied.third),
  walkCost=forcedRun+(.34+.13*Number(occupied.first)+.08*Number(occupied.second)+.04*Number(occupied.third))*(1-.20*situation.outs),
  precision=1/(1+batter.aimStdMeters*20+batter.timingStdSeconds*30),
  motorSpeed=batter.targetSweetSpotSpeedMps??batter.maximumSweetSpotSpeedMps??32,
  batterThreat=clamp((motorSpeed/34)**2*(.7+.6*precision),.05,6),
  threshold=batter.swingDecision?.threshold??.5,aggression=batter.swingDecision?.aggressionWeight??.5,
  zoneSwing=batter.swingDecision?.approach==='TAKE'?0:batter.swingDecision?.approach==='SWING'?1:clamp(.80+(.5-threshold)*.3+(aggression-.5)*.2,.3,.98),
  chaseSwing=batter.swingDecision?.approach==='TAKE'?0:batter.swingDecision?.approach==='SWING'?1:clamp(.32+(.5-threshold)*.5+(aggression-.5)*.3+(batter.zoneJudgmentStdMeters??0)*.5,.05,.9),
  heartContact=clamp(.76+.18*precision,.5,.96),edgeContact=heartContact*.74,
  chaseContact=heartContact*(.24+.25*(batter.badBallControl??.5)),foulShare=.28,
  candidates:Candidate[]=[];
 const addCandidate=(x:number,y:number)=>{
  if(candidates.some(c=>Math.abs(c.position.x-x)<1e-12&&Math.abs(c.position.y-y)<1e-12))return;
  const position={x,y},classification=classifyBatterCourseV79({position,zone});
  if(classification.courseIndex===null)return;
  const courseIndex=classification.courseIndex,pc=pitcher.zoneRecognitionV87?.pitcher?.cells[courseIndex]??neutral,
   cc=input.catcher?.zoneRecognitionV87?.catcher?.cells[courseIndex]??neutral,
   {effectiveCommandStd}=resolveLivePitchCommandStdV111({position,zone,bats:batter.bats,commandStdMeters:pitcher.commandStdMeters,technicalSkills:pitcher.technicalSkills}),
   std=effectiveCommandStd*pc.uncertaintyScale,mean={x:x+pc.biasXM,y:y+pc.biasYM},r=input.ballRadiusMeters,
   pStrike=rectangle(mean,std,cx-zone.halfWidth-r,cx+zone.halfWidth+r,zone.lowerY-r,zone.upperY+r),
   pHeart=Math.min(pStrike,rectangle(mean,std,cx-zone.halfWidth*.48,cx+zone.halfWidth*.48,cy-halfHeight*.48,cy+halfHeight*.48)),
   pChase=clamp(rectangle(mean,std,cx-zone.halfWidth-batter.chaseMarginMeters,cx+zone.halfWidth+batter.chaseMarginMeters,
    zone.lowerY-batter.chaseMarginMeters,zone.upperY+batter.chaseMarginMeters)-pStrike,0,1-pStrike),
   outsideSwing=batter.swingDecision?.approach==='SWING'?1-pStrike:pChase*chaseSwing,
   contactH=pHeart*zoneSwing*heartContact,contactE=(pStrike-pHeart)*zoneSwing*edgeContact,contactC=outsideSwing*chaseContact,
   contact=contactH+contactE+contactC,ball=1-pStrike-outsideSwing,strike=1-ball-contact,
   publicCourse=classifyPublicCourseV87({position,zone}),
   // Reuse the authored motor-consistency mapping as a forecast modifier;
   // referenceAverages are not treated as measured hit probabilities.
   consistency=course?1/clamp(1-1.25*(course.referenceAverages[publicCourse.courseIndex]-.25)*course.effectScale,.75,1.25):1,
   verticalTechnique=y<cy?(batter.technicalSkills?.low_zone_hitting??0):(batter.technicalSkills?.high_zone_hitting??0),
   damage=batterThreat*consistency*(1+.06*verticalTechnique)*(1+runnerCost)*(1-.10*situation.outs),
   contactCost=(contactH*.34+contactE*.25+contactC*.12)*damage*(1-foulShare),
   captureRiskCost=Math.min(.12,.012*(Math.hypot(cc.biasXM,cc.biasYM)/.15)**2+.004*Math.max(0,cc.uncertaintyScale-1)),
   batterSide=batter.bats==='R'?-1:1,
   location=y<zone.lowerY?'low':y>zone.upperY?'high':x<cx-zone.halfWidth||x>cx+zone.halfWidth
    ?((x-cx)*batterSide>0?'inside':'outside'):'zone';
  candidates.push({position,location,courseIndex,weight:pc.targetWeight*cc.targetWeight,pStrike,pHeart,
   events:{ball:Math.max(0,ball),strike:Math.max(0,strike),foul:contact*foulShare,inPlay:contact*(1-foulShare)},
   contactCost,captureRiskCost,preferenceCost:0,commandBiasMeters:{x:pc.biasXM,y:pc.biasYM},effectiveCommandStd});
 };
 addCandidate(cx,cy);
 for(const radius of [.25,.5,.75,.98,1.16])for(let angle=0;angle<8;angle++)
  addCandidate(cx+zone.halfWidth*radius*Math.cos(angle*Math.PI/4),cy+halfHeight*radius*Math.sin(angle*Math.PI/4));
 for(let column=0;column<9;column++)for(let row=0;row<7;row++)
  addCandidate(cx-zone.halfWidth+(column-1.5)*zone.halfWidth*2/5,zone.lowerY+(row-.5)*(zone.upperY-zone.lowerY)/5);
 const preferenceFallback=candidates.every(c=>c.weight===0),eligible=candidates.filter(c=>preferenceFallback||c.weight>0),
  maximumWeight=Math.max(...eligible.map(c=>c.weight)),maximumEligibleStrikeProbability=Math.max(...eligible.map(c=>c.pStrike)),
  challengeProbabilityFloor=.45*maximumEligibleStrikeProbability;
 for(const c of eligible)c.preferenceCost=preferenceFallback?0:Math.min(.10,.008*Math.log(maximumWeight/c.weight));
 const values=Array.from({length:4},()=>[0,0,0]),costs=(balls:number,strikes:number)=>eligible.map(c=>{
  // Ordinary auto pitching does not decide an intentional walk. Keep every
  // three-ball DP state within a feasible contest set, relative to this
  // pitcher's actual forecast and the authored role-weight exclusions.
  if(balls===3&&c.pStrike<challengeProbabilityFloor)return Infinity;
  const nextBall=balls===3?walkCost:values[balls+1][strikes],nextStrike=strikes===2?0:values[balls][strikes+1],
   selfLoop=strikes===2?c.events.foul:0;
  return (c.contactCost+c.captureRiskCost+c.preferenceCost+.001+c.events.ball*nextBall
   +(c.events.strike+(strikes<2?c.events.foul:0))*nextStrike)/(1-selfLoop);
 });
 // Every nonterminal transition increases balls or strikes; only a two-strike
 // foul loops. Divide out that loop rather than running unbounded iteration.
 for(let balls=3;balls>=0;balls--)for(let strikes=2;strikes>=0;strikes--)values[balls][strikes]=Math.min(...costs(balls,strikes));
 const currentCosts=costs(situation.balls,situation.strikes),minimumCost=Math.min(...currentCosts),
  tolerance=situation.balls===3?.002:.006,near=eligible.map((c,index)=>({c,index,cost:currentCosts[index]})).filter(c=>c.cost<=minimumCost+tolerance),
  rng=new SeedRoot(input.seed).streamRng(0,'pitch','target-plan-v111'),selected=near[Math.min(near.length-1,Math.floor(rng.nextFloat()*near.length))],c=selected.c;
 return freeze({position:c.position,location:c.location,diagnostics:{
  version:'live_pitch_target_plan_v111' as const,model:'UNCALIBRATED_GAUSSIAN_COUNT_COST_DP' as const,modelCalibrated:false as const,futureSourceUsed:false as const,
  situation,count:{balls:situation.balls,strikes:situation.strikes},cost:selected.cost,minimumCost,walkCost,batterThreat,
  pStrike:c.pStrike,pBall:1-c.pStrike,pHeart:c.pHeart,events:c.events,contactCost:c.contactCost,captureRiskCost:c.captureRiskCost,
  candidateCount:candidates.length,eligibleCandidateCount:eligible.length,selectedCourseIndex:c.courseIndex,
  commandBiasMeters:c.commandBiasMeters,effectiveCommandStd:c.effectiveCommandStd,preferenceFallback,
  maximumEligibleStrikeProbability,challengeProbabilityFloor:situation.balls===3?challengeProbabilityFloor:null,
  normalContestPolicy:'THREE_BALL_RELATIVE_STRIKE_FLOOR' as const,intentionalWalkDecision:'NOT_IMPLEMENTED_SEPARATE_TACTICAL_DECISION' as const,
  nearOptimalCount:near.length,tieTolerance:tolerance,stream:'target-plan-v111',
  reason:preferenceFallback?'all_role_weights_zero_fallback':near.length>1?'near_optimal_count_cost':'minimum_count_cost',
  probabilityBasis:'GAUSSIAN_2D_RECTANGLES_NOT_OFFICIAL_STRIKE_PROBABILITY' as const,
 }});
}
