import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SeedRoot} from '../../core/rng/SeedRoot';
import {validateTechnicalSkillControlsV75,type TechnicalSkillControlsV75} from '../../core/sim/TechnicalSkillControlsV75';
import {classifyBatterCourseV79,type BatterCourseZoneV79} from './BatterCourseProfileV79';
import {classifyPublicCourseV87,validateBatterCourseProfileV87,type BatterCourseProfileV87} from './BatterCourseProfileV87';
import {validateZoneRecognitionV87,type ZoneRecognitionV87} from './ZoneRecognitionV87';

export type LivePitchSituationV111=Readonly<{balls:number;strikes:number;outs:number;
 occupiedBases:Readonly<{first:boolean;second:boolean;third:boolean}>}>;
type Position=Readonly<{x:number;y:number}>;
type CommandInput=Readonly<{position:Position;zone:BatterCourseZoneV79;bats:'R'|'L';commandStdMeters:number;technicalSkills?:TechnicalSkillControlsV75;throws?:'R'|'L'}>;
export type LivePitchTargetPlanInputV111=Readonly<{
 zone:BatterCourseZoneV79;ballRadiusMeters:number;seed:number;situation:LivePitchSituationV111;
 /** The manager's pitch order. The plan still reads the count, but only inside this part of the plate. */
 preferredLocationV1?:'zone'|'inside'|'outside'|'low'|'high';
 /** pitchTargetPlanV2: the choice temperature in runs. Given, the forecast is the MLB hitter's (swing by count, contact, fouls
  * and run value by region) and a spot is drawn with weight exp(-(cost - best) / temperature) instead of evenly among near ties. */
 targetPlanV2?:number;
 /** The pitch about to be thrown: V2 then forecasts by its family (fastballs, breaking balls, offspeed). */
 pitchTypeV2?:string;
 pitcher:Readonly<{commandStdMeters:number;technicalSkills?:TechnicalSkillControlsV75;zoneRecognitionV87?:ZoneRecognitionV87;throws?:'R'|'L'}>;
 catcher?:Readonly<{zoneRecognitionV87?:ZoneRecognitionV87}>;
 batter:Readonly<{bats:'R'|'L';heightMeters?:number;maximumSweetSpotSpeedMps?:number;targetSweetSpotSpeedMps?:number;
  aimStdMeters:number;timingStdSeconds:number;chaseMarginMeters:number;plateVision?:number;zoneJudgmentStdMeters?:number;badBallControl?:number;
  swingDecision?:Readonly<{approach:'AUTO'|'TAKE'|'SWING';threshold:number;aggressionWeight:number}>;
  batterCourseProfileV87?:BatterCourseProfileV87;technicalSkills?:TechnicalSkillControlsV75}>;
}>;
type Events=Readonly<{ball:number;strike:number;foul:number;inPlay:number}>;
type Candidate={position:Position;location:'zone'|'inside'|'outside'|'low'|'high';courseIndex:number;
 weight:number;pStrike:number;pHeart:number;events:Events;contactCost:number;captureRiskCost:number;
 preferenceCost:number;commandBiasMeters:Position;effectiveCommandStd:number;
 v2?:readonly Readonly<{events:Events;contactCost:number}>[]};
// pitchTargetPlanV2's hitter: MLB 2024 by count, region and pitch family (Statcast, every pitch), with the bands past 12 cm
// shaped by one day of pitches (2024-06-01) and scaled to the season. Regions: heart (the middle 48% box), edge (the rest of
// the zone widened by the ball), then bands past that widened zone out to 6, 12, 20, 30 and 45 cm and beyond: hitters swing
// less, and miss more, the farther a ball is. Swing rows: the 12 counts, 0-0 0-1 0-2 1-0 ... 3-2. Runs are wOBA on contact
// / 1.24 above an out (past 12 cm the all-pitch value with hit batters taken out); a walk is 0.69 / 1.24.
const V2_BANDS=[.06,.12,.20,.30,.45],V2_FAR=[.218,.218,.218,.218],
 V2_HITTER={
  ALL:{swing:[[.553,.429,.229,.229,.132,.060,.026,0],[.856,.716,.436,.436,.224,.128,.080,0],[.947,.846,.587,.587,.321,.195,.071,.018],[.725,.564,.313,.313,.184,.084,.036,0],[.883,.749,.458,.458,.243,.138,.086,0],[.957,.867,.623,.623,.390,.238,.087,.022],[.702,.539,.293,.293,.157,.071,.031,0],[.890,.746,.449,.449,.252,.144,.090,0],[.963,.874,.624,.624,.418,.255,.093,.024],[.160,.127,.051,.051,.018,.008,.004,0],[.854,.680,.374,.374,.183,.104,.065,0],[.966,.862,.606,.606,.422,.257,.094,.024]],
   contact:[.874,.809,.647,.647,.461,.207,.081,0],foul:[.464,.501,.569,.569,.639,.639,.639,.639],runs:[.349,.302,.250,.250,...V2_FAR]},
  FB:{swing:[[.589,.441,.210,.210,.087,.040,.017,0],[.865,.702,.384,.384,.151,.086,.054,0],[.938,.825,.526,.526,.234,.143,.052,.013],[.768,.573,.282,.282,.133,.061,.026,0],[.893,.742,.412,.412,.170,.097,.061,0],[.954,.840,.557,.557,.275,.167,.061,.016],[.743,.560,.276,.276,.113,.051,.022,0],[.908,.754,.407,.407,.178,.101,.063,0],[.963,.855,.565,.565,.315,.192,.070,.018],[.163,.126,.047,.047,.014,.007,.003,0],[.884,.701,.363,.363,.124,.070,.044,0],[.969,.858,.564,.564,.320,.195,.071,.018]],
   contact:[.874,.824,.716,.716,.691,.310,.122,0],foul:[.481,.525,.612,.612,.704,.704,.704,.704],runs:[.347,.304,.257,.257,...V2_FAR]},
  BR:{swing:[[.465,.376,.240,.240,.188,.085,.036,0],[.819,.700,.470,.470,.295,.168,.105,0],[.955,.868,.632,.632,.366,.223,.082,.021],[.603,.498,.335,.335,.252,.115,.049,0],[.851,.724,.484,.484,.319,.182,.114,0],[.954,.892,.663,.663,.453,.276,.101,.026],[.525,.425,.305,.305,.222,.101,.043,0],[.832,.696,.481,.481,.346,.197,.123,0],[.965,.893,.669,.669,.486,.296,.108,.028],[.069,.146,.117,.117,.034,.015,.007,0],[.694,.561,.355,.355,.397,.226,.141,0],[.957,.860,.656,.656,.525,.320,.117,.030]],
   contact:[.884,.795,.559,.559,.302,.135,.053,0],foul:[.435,.476,.547,.547,.622,.622,.622,.622],runs:[.344,.303,.254,.254,...V2_FAR]},
  OFF:{swing:[[.591,.529,.326,.326,.164,.075,.032,0],[.912,.800,.524,.524,.236,.135,.084,0],[.979,.882,.659,.659,.367,.224,.082,.021],[.747,.650,.391,.391,.205,.093,.040,0],[.909,.818,.537,.537,.251,.143,.089,0],[.985,.914,.711,.711,.447,.272,.099,.025],[.681,.604,.375,.375,.245,.111,.048,0],[.909,.806,.552,.552,.286,.163,.102,0],[.958,.914,.704,.704,.460,.280,.102,.026],[.167,.149,.088,.088,.096,.044,.019,0],[.785,.685,.500,.500,.208,.118,.074,0],[.969,.897,.704,.704,.531,.324,.118,.030]],
   contact:[.848,.768,.620,.620,.518,.232,.091,0],foul:[.420,.437,.480,.480,.547,.547,.547,.547],runs:[.375,.290,.230,.230,...V2_FAR]},
 },
 V2_FAMILY:Readonly<Record<string,'FB'|'BR'|'OFF'>>={fastball:'FB',sinker:'FB',cutter:'FB',slider:'BR',sweeper:'BR',curve:'BR',
  knuckle_curve:'BR',slurve:'BR',slow_curve:'BR',changeup:'OFF',splitter:'OFF',forkball:'OFF',screwball:'OFF',knuckleball:'OFF',eephus:'OFF'},
 V2_WALK_SCALE=(.69/1.24)/.34;
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
  techniqueCommandStd=insideTargetWeight>0?lowZoneCommandStd/(1+.6*insideTechnique*insideTargetWeight):lowZoneCommandStd,
  // Both act only on the command error of that condition. Omitted skills leave the value exact.
  platoon=input.bats==='L'?technicalSkills?.pitch_platoon_left??0:0,
  diagonal=(technicalSkills?.diagonal_command??0)*(input.throws===undefined?0:techniqueBlend((target.x*(input.throws==='L'?-1:1)/zone.halfWidth-.2)/.6)),
  connectedScale=platoon===0&&diagonal===0?1:(platoon<0?1-.6*platoon:1/(1+.6*platoon))/(1+.6*diagonal),
  effectiveCommandStd=connectedScale===1?techniqueCommandStd:techniqueCommandStd*connectedScale;
 return {lowZoneTechnique,lowZoneTechniqueActive,lowZoneCommandStd,insideTechnique,insideTargetWeight,effectiveCommandStd};
}
function techniqueBlend(u:number){const t=clamp(u,0,1);return t*t*(3-2*t);}
/** A large miss leans in a known direction: 一発 toward the middle, 逃げ球 away from it,
 * 抜け球 up and to the arm side. No draw is added, so every later sample stays in place. */
export function shapeLiveCommandMissV1(error:Position,input:Readonly<{target:Position;zone:BatterCourseZoneV79;commandStdMeters:number;throws?:'R'|'L';technicalSkills?:TechnicalSkillControlsV75}>):Position{
 const danger=input.technicalSkills?.dangerous_miss??0,release=input.technicalSkills?.release_miss_pattern??0;
 if(danger===0&&release===0||input.commandStdMeters<=0)return error;
 const std=input.commandStdMeters,miss=techniqueBlend((Math.hypot(error.x,error.y)/std-1.25)/.75);
 if(miss===0)return error;
 const toX=(input.zone.centerX??0)-input.target.x,toY=(input.zone.lowerY+input.zone.upperY)/2-input.target.y,length=Math.hypot(toX,toY)||1,
  lean=-danger*miss*std*.75,side=input.throws==='L'?1:-1,slip=release*miss*std*.5;
 return {x:error.x+toX/length*lean+side*slip,y:error.y+toY/length*lean+slip};
}

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
 assert(input.targetPlanV2===undefined||bounded(input.targetPlanV2,.0005,.5),'invalid target plan v2 temperature');
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
  // 四球: nibbling is a choice about how much a walk is feared, never a worse command.
  walkProne=pitcher.technicalSkills?.walk_prone_approach??0,earlyApproach=pitcher.technicalSkills?.early_count_approach??0,
  walkCost=(forcedRun+(.34+.13*Number(occupied.first)+.08*Number(occupied.second)+.04*Number(occupied.third))*(1-.20*situation.outs))*(walkProne===0?1:1/(1+.5*walkProne)),
  precision=1/(1+batter.aimStdMeters*20+batter.timingStdSeconds*30),
  motorSpeed=batter.targetSweetSpotSpeedMps??batter.maximumSweetSpotSpeedMps??32,
  batterThreat=clamp((motorSpeed/34)**2*(.7+.6*precision),.05,6),
  // 対強打者: more care in choosing where to throw to a hitter who can really hurt; the pitch itself is unchanged.
  strongBatterCare=1+.25*(pitcher.technicalSkills?.pitch_strong_batter_response??0)*clamp(batterThreat-1,0,1),
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
   {effectiveCommandStd}=resolveLivePitchCommandStdV111({position,zone,bats:batter.bats,commandStdMeters:pitcher.commandStdMeters,technicalSkills:pitcher.technicalSkills,throws:pitcher.throws}),
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
   contactCost=(contactH*.34+contactE*.25+contactC*.12)*damage*(1-foulShare)*strongBatterCare,
   // The same hitter's own lean (threshold, aggression, judgment, precision) scales the MLB rates; TAKE and SWING stay fixed.
   v2=input.targetPlanV2===undefined?undefined:(()=>{
    const within=[pStrike,...V2_BANDS.map(m=>Math.max(pStrike,rectangle(mean,std,cx-zone.halfWidth-r-m,
      cx+zone.halfWidth+r+m,zone.lowerY-r-m,zone.upperY+r+m))),1],
     share=[pHeart,pStrike-pHeart,...within.slice(1).map((p,i)=>Math.max(0,p-within[i]))],
     fixed=batter.swingDecision?.approach==='TAKE'?0:batter.swingDecision?.approach==='SWING'?1:null,
     scale=share.map((_,i)=>i<2?zoneSwing/.80:chaseSwing/.3325),contactScale=heartContact/.859;
    const hitter=V2_HITTER[V2_FAMILY[input.pitchTypeV2??'']??'ALL'];
    return hitter.swing.map(row=>{
     let whiff=0,called=0,ball=0,foul=0,inPlay=0,runs=0;
     share.forEach((q,i)=>{const s=fixed??clamp(row[i]*scale[i],0,.98),hit=q*s*clamp(hitter.contact[i]*contactScale,0,.98);
      whiff+=q*s-hit;if(i<2)called+=q*(1-s);else ball+=q*(1-s);foul+=hit*hitter.foul[i];inPlay+=hit*(1-hitter.foul[i]);runs+=hit*(1-hitter.foul[i])*hitter.runs[i];});
     return {events:{ball,strike:whiff+called,foul,inPlay},contactCost:runs*damage*strongBatterCare};
    });
   })(),
   captureRiskCost=Math.min(.12,.012*(Math.hypot(cc.biasXM,cc.biasYM)/.15)**2+.004*Math.max(0,cc.uncertaintyScale-1)),
   batterSide=batter.bats==='R'?-1:1,
   location=y<zone.lowerY?'low':y>zone.upperY?'high':x<cx-zone.halfWidth||x>cx+zone.halfWidth
    ?((x-cx)*batterSide>0?'inside':'outside'):'zone';
  candidates.push({position,location,courseIndex,weight:pc.targetWeight*cc.targetWeight,pStrike,pHeart,
   events:{ball:Math.max(0,ball),strike:Math.max(0,strike),foul:contact*foulShare,inPlay:contact*(1-foulShare)},
   contactCost,captureRiskCost,preferenceCost:0,commandBiasMeters:{x:pc.biasXM,y:pc.biasYM},effectiveCommandStd,...(v2?{v2}:{})});
 };
 addCandidate(cx,cy);
 for(const radius of [.25,.5,.75,.98,1.16])for(let angle=0;angle<8;angle++)
  addCandidate(cx+zone.halfWidth*radius*Math.cos(angle*Math.PI/4),cy+halfHeight*radius*Math.sin(angle*Math.PI/4));
 for(let column=0;column<9;column++)for(let row=0;row<7;row++)
  addCandidate(cx-zone.halfWidth+(column-1.5)*zone.halfWidth*2/5,zone.lowerY+(row-.5)*(zone.upperY-zone.lowerY)/5);
 const orderSide=batter.bats==='R'?-1:1,inOrder=(c:Candidate)=>{const {x,y}=c.position,dx=x-cx,dy=y-cy;
  switch(input.preferredLocationV1){
   case 'low':return dy<-halfHeight*.3&&dy>=-halfHeight*1.1&&Math.abs(dx)<=zone.halfWidth;
   case 'high':return dy>halfHeight*.3&&dy<=halfHeight*1.1&&Math.abs(dx)<=zone.halfWidth;
   case 'inside':return dx*orderSide>zone.halfWidth*.3&&dx*orderSide<=zone.halfWidth*1.1&&Math.abs(dy)<=halfHeight;
   case 'outside':return dx*orderSide<-zone.halfWidth*.3&&dx*orderSide>=-zone.halfWidth*1.1&&Math.abs(dy)<=halfHeight;
   case 'zone':return Math.abs(dx)<=zone.halfWidth*.6&&Math.abs(dy)<=halfHeight*.6;
   default:return true;}
 },ordered=candidates.filter(inOrder),preferenceFallback=ordered.every(c=>c.weight===0),eligible=ordered.filter(c=>preferenceFallback||c.weight>0),
  maximumWeight=Math.max(...eligible.map(c=>c.weight)),maximumEligibleStrikeProbability=Math.max(...eligible.map(c=>c.pStrike)),
  challengeProbabilityFloor=.45*maximumEligibleStrikeProbability;
 for(const c of eligible)c.preferenceCost=preferenceFallback?0:Math.min(.10,.008*Math.log(maximumWeight/c.weight));
 const temperature=input.targetPlanV2,planWalkCost=temperature===undefined?walkCost:walkCost*V2_WALK_SCALE,
  values=Array.from({length:4},()=>[0,0,0]),costs=(balls:number,strikes:number)=>eligible.map(c=>{
  // Ordinary auto pitching does not decide an intentional walk. Keep every
  // three-ball DP state within a feasible contest set, relative to this
  // pitcher's actual forecast and the authored role-weight exclusions.
  if(balls===3&&c.pStrike<challengeProbabilityFloor)return Infinity;
  const v2=c.v2?.[balls*3+strikes],events=v2?.events??c.events,
   nextBall=balls===3?planWalkCost:values[balls+1][strikes],nextStrike=strikes===2?0:values[balls][strikes+1],
   selfLoop=strikes===2?events.foul:0;
  // ボール先行/ストライク先行: a preference over the first pitches only; an explicit location skips this plan.
  const approach=earlyApproach!==0&&balls+strikes<=1?earlyApproach*.06*(1-c.pStrike):0;
  return ((v2?.contactCost??c.contactCost)+c.captureRiskCost+c.preferenceCost+.001+approach+events.ball*nextBall
   +(events.strike+(strikes<2?events.foul:0))*nextStrike)/(1-selfLoop);
 });
 // Every nonterminal transition increases balls or strikes; only a two-strike
 // foul loops. Divide out that loop rather than running unbounded iteration.
 for(let balls=3;balls>=0;balls--)for(let strikes=2;strikes>=0;strikes--)values[balls][strikes]=Math.min(...costs(balls,strikes));
 const currentCosts=costs(situation.balls,situation.strikes),minimumCost=Math.min(...currentCosts),
  tolerance=situation.balls===3?.002:.006,near=eligible.map((c,index)=>({c,index,cost:currentCosts[index]})).filter(c=>c.cost<=minimumCost+tolerance),
  rng=new SeedRoot(input.seed).streamRng(0,'pitch','target-plan-v111'),
  // V2 draws the one same number, on weights falling with the cost above the best; a three-ball spot below the floor weighs nothing.
  softWeights=temperature===undefined?null:currentCosts.map(cost=>Number.isFinite(cost)?Math.exp(-(cost-minimumCost)/temperature):0),
  selected=softWeights?(()=>{const total=softWeights.reduce((a,b)=>a+b,0);let u=rng.nextFloat()*total,index=softWeights.findIndex(w=>(u-=w)<0);
   if(index<0)index=softWeights.length-1-[...softWeights].reverse().findIndex(w=>w>0);return {c:eligible[index],index,cost:currentCosts[index]};})()
   :near[Math.min(near.length-1,Math.floor(rng.nextFloat()*near.length))],c=selected.c,
  groupV2=c.v2?.[situation.balls*3+situation.strikes];
 return freeze({position:c.position,location:c.location,diagnostics:{
  version:'live_pitch_target_plan_v111' as const,model:'UNCALIBRATED_GAUSSIAN_COUNT_COST_DP' as const,modelCalibrated:false as const,futureSourceUsed:false as const,
  situation,count:{balls:situation.balls,strikes:situation.strikes},cost:selected.cost,minimumCost,walkCost:planWalkCost,batterThreat,
  pStrike:c.pStrike,pBall:1-c.pStrike,pHeart:c.pHeart,events:groupV2?.events??c.events,contactCost:groupV2?.contactCost??c.contactCost,captureRiskCost:c.captureRiskCost,
  ...(softWeights?{targetPlanV2:{temperature,effectiveChoices:softWeights.reduce((a,b)=>a+b,0)**2/softWeights.reduce((a,b)=>a+b*b,0)}}:{}),
  candidateCount:candidates.length,eligibleCandidateCount:eligible.length,selectedCourseIndex:c.courseIndex,
  commandBiasMeters:c.commandBiasMeters,effectiveCommandStd:c.effectiveCommandStd,preferenceFallback,
  maximumEligibleStrikeProbability,challengeProbabilityFloor:situation.balls===3?challengeProbabilityFloor:null,
  normalContestPolicy:'THREE_BALL_RELATIVE_STRIKE_FLOOR' as const,intentionalWalkDecision:'NOT_IMPLEMENTED_SEPARATE_TACTICAL_DECISION' as const,
  nearOptimalCount:near.length,tieTolerance:tolerance,stream:'target-plan-v111',
  reason:preferenceFallback?'all_role_weights_zero_fallback':near.length>1?'near_optimal_count_cost':'minimum_count_cost',
  probabilityBasis:'GAUSSIAN_2D_RECTANGLES_NOT_OFFICIAL_STRIKE_PROBABILITY' as const,
 }});
}
