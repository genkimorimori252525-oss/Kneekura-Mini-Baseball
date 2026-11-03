/* Kneekura Browser Match Slice v23
 * Standalone, deterministic causal PLAYABLE prototype. Not the repository's
 * authoritative Node/SQLite Native Match Core; no Native PASS is claimed.
 * Input (manager choices) -> pitch trajectory -> swing/contact -> batted flight
 * -> fielder movement/custody/throw vs batter-runner -> official score snapshot.
 * Presentation is the unchanged v16 PNG/B1 observer.
 */
(function(){'use strict';
const DT=.055,ROLES=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const PITCHES={
 fastball:{name:'直球',base:149,breakX:0,breakY:0},
 slider:{name:'スライダー',base:137,breakX:.24,breakY:-.04},
 curve:{name:'カーブ',base:121,breakX:.15,breakY:-.25},
 fork:{name:'フォーク',base:137,breakX:0,breakY:-.24},
 change:{name:'チェンジアップ',base:125,breakX:0,breakY:-.08},
 cutter:{name:'カットボール',base:143,breakX:-.10,breakY:0},
 'two-seam':{name:'ツーシーム',base:143,breakX:.13,breakY:-.04}
};
const copy=o=>JSON.parse(JSON.stringify(o));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const rngHash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
function random(seed){let a=rngHash(seed)||1;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return ((t^t>>>14)>>>0)/4294967296};}
function gaussian(rand){return Math.sqrt(-2*Math.log(Math.max(1e-9,rand())))*Math.cos(2*Math.PI*rand())}
const lerp=(a,b,t)=>a+(b-a)*t;
const triplet=(x,y,z)=>[+x.toFixed(5),+y.toFixed(5),+z.toFixed(5)];
// Both corner infielders stand FAIR of the 45° foul lines (|x| <= z),
// with the same 27.432m diamond coordinates used in the field renderer.
const rolePositions={P:[0,18.48],C:[0,-1.9],'1B':[23.3,25.5],'2B':[8,30],'3B':[-23.3,25.5],SS:[-10,30],LF:[-36,69],CF:[0,85],RF:[36,69]};
function legalDefensivePosition(role,requested){
 const p=requested||rolePositions[role];
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new Error('Invalid defender world coordinates: '+role);
 if((role==='1B'||role==='3B')&&p[1]<Math.abs(p[0]))throw new Error('Corner infielder lies outside fair sector: '+role);
 return p;
}

const DEFENDER_MAP={P:'p',C:7,'1B':3,'2B':1,'3B':5,SS:2,LF:4,CF:0,RF:6};
function statsFor(player){
 const v=player?.ratings;
 if(v){return {contact:clamp(.48+v.contact*.006,.4,1.10),power:clamp(.56+v.power*.006,.52,1.19),
   vision:clamp(.50+v.vision*.006,.50,1.1),field:clamp(v.field/100,.03,1),
   catching:clamp((v.catching??v.field)/100,.03,1),
   sprint:clamp(3.8+v.run*.040,3.8,7.8),arm:clamp((v.arm??65)/100,.2,1),
   accuracy:clamp((v.throwingAccuracy??v.field)/100,.03,1),badBallControl:clamp((v.badBallControl??0)/100,0,1)};}
 const r=rngHash(player.id);return {contact:.65+(r%25)*.012,power:.68+((r>>>7)%24)*.011,
 vision:.67+((r>>>13)%24)*.011,field:.69+((r>>>19)%26)*.010,
 catching:.75,sprint:5.8+((r>>>4)%22)*.062,arm:.75,accuracy:.75,badBallControl:0};
} // Ratings are browser-slice player attributes; no league-name bonus or native-core claim.
function recordSkeleton(base){return {version:23,source:'TBD-LAD browser-causal-slice-v23 (NOT repository Node/SQLite Native Core)',cadenceMs:55,ballPresentationCadenceMs:27.5,pitchBallPresentationCadenceMs:27.5/1.2,
  matchId:'local-TBD-LAD-'+base.seed,teams:base.teams,teamNames:base.teamNames,players:base.players,
  rosterProvenance:base.rosterProvenance,defenseMap:base.defenseMap,positions:base.positions,basePositions:base.basePositions,
  plateAppearances:[],pitches:[],records:[],inningStarts:[],totalTicks:0,final:null,
  notes:'User TBD lineup vs verified 2025 LAD lineup. Player-specific prototype rating model; not authoritative Native Core.'};}
function defenderId(rec,team,role){
 if(role==='P')return team+'-p0';
 const index=rec.defenseMap?.[String(team)]?.[role]??DEFENDER_MAP[role];
 return team+'-b'+index;
}
function nearFlight(ball){return Math.hypot(ball[0],ball[2]);}
function foulTerritory(ball){return ball[2]<-.15 || Math.abs(ball[0])>Math.max(0,ball[2])+.6}
function makeFlight(params){
 const {rand,exit,launch,bearing,contact}=params;
 const path=[],v=[Math.sin(bearing)*exit*Math.cos(launch),exit*Math.sin(launch),Math.cos(bearing)*exit*Math.cos(launch)];
 let x=contact[0],y=contact[1],z=contact[2],grounded=false,firstGround=null,homeRun=false,wallDouble=false,wallHit=false,wallContactAt=null;
 for(let i=0;i<360;i++){
  const sp=Math.hypot(...v),drag=.0034*sp;
  v[0]-=v[0]*drag*DT;v[2]-=v[2]*drag*DT;v[1]-=(9.81+v[1]*drag)*DT;
  x+=v[0]*DT;y+=v[1]*DT;z+=v[2]*DT;
  if(y<.037){y=.037;if(!grounded){grounded=true;firstGround=i;v[1]=Math.max(0,-v[1])*.24}else {v[1]=0;v[0]*=.865;v[2]*=.865;}}
  const p=triplet(x,y,z);
  // First simulated flight tick can ALREADY have hit the dirt. Do not
  // arbitrarily force the first sample airborne.
  path.push({p,grounded});
  const d=nearFlight(p),fair=!foulTerritory(p);
  // Physical outfield wall agrees with the renderer's polar fence geometry.
  // A ball hitting the wall IN PLAY is not a ground-rule double.
  const theta=Math.atan2(x,Math.max(.001,z));
  const fence=100+22*Math.cos(2*clamp(theta,-Math.PI/4,Math.PI/4));
  if(fair&&d>=fence){
   if(y>=3.0){homeRun=true;break}
   wallHit=true; if(wallContactAt===null)wallContactAt=i;
   const nx=x/d,nz=z/d,radial=v[0]*nx+v[2]*nz;
   x=nx*(fence-.035);z=nz*(fence-.035);
   p[0]=+x.toFixed(5);p[2]=+z.toFixed(5);
   // Live carom: preserve tangential component, reverse normal momentum.
   v[0]=(v[0]-1.45*radial*nx)*.86;
   v[2]=(v[2]-1.45*radial*nz)*.86;
   v[1]*=.86;
  }
  if(grounded&&Math.hypot(v[0],v[2])<.45)break;
  if(d>170||z < -25)break;
 }
 const first=path[Math.min(path.length-1,Math.max(0,firstGround??path.length-1))]?.p||contact;
 const fair=!foulTerritory(first)&&Math.cos(bearing)>0&&Math.abs(bearing)<Math.PI/4;
 return {path,homeRun,wallDouble,wallHit,wallContactAt,firstGround,first,final:path.at(-1)?.p||contact,fair,exitKmh:+(exit*3.6).toFixed(1),launchDeg:+(launch*180/Math.PI).toFixed(1),bearingDeg:+(bearing*180/Math.PI).toFixed(1)};
}
function fieldSimulation(flight,rec,defTeam,rand){
 const players=rec.players;
 const positions={};for(const r of ROLES)positions[r]=legalDefensivePosition(r,rec.positions?.[r]).slice();
 const traces={};for(const r of ROLES)traces[r]=[[0,positions[r][0],0,positions[r][1]]];
 // Even a projected over-fence flight can be intercepted by a fielder
 // BEFORE the fence; a prediction never suppresses real defensive motion.
 if(!flight.fair)return {traces,field:null,catchAt:null,firstPickupAt:null,dist:nearFlight(flight.final)};
 const landing=flight.first;
 const challengers=ROLES.filter(r=>r!=='C').sort((a,b)=>distance(positions[a], [landing[0],landing[2]])-distance(positions[b],[landing[0],landing[2]])).slice(0,3);
 const speeds={},delays={};for(const r of ROLES){const id=defenderId(rec,defTeam,r),stat=statsFor(players[id]);speeds[r]=(r==='C'?Math.min(4.6,stat.sprint):stat.sprint)*(.95+rand()*.06);delays[r]=(.10+rand()*.23)+(1-stat.field)*.20;}
 let capture=null,ordinaryFlyMiss=null,ordinaryNearMiss=null;
 for(let i=0;i<flight.path.length;i++){
  const ball=flight.path[i].p,elapsed=(i+1)*DT;
  for(const role of ROLES){
   let target=positions[role];
   if(challengers.includes(role)){
    const ahead=flight.path[Math.min(flight.path.length-1,i+9)].p;
    target=(flight.firstGround!==null&&i<flight.firstGround)?[landing[0],landing[2]]:[ahead[0],ahead[2]];
   }else if(role==='1B')target=[19.4,19.4];
   else if(role==='2B')target=[0,38.8];
   else if(role==='SS')target=[-19.4,19.4];
   if(elapsed>delays[role]){
    const dx=target[0]-positions[role][0],dz=target[1]-positions[role][1],d=Math.hypot(dx,dz);
    if(d>.0001){const step=Math.min(d,speeds[role]*DT);positions[role]=[positions[role][0]+step*dx/d,positions[role][1]+step*dz/d]}
   }
   if((i+1)%4===0)traces[role].push([i+39, +positions[role][0].toFixed(3),0,+positions[role][1].toFixed(3)]);
  }
  if(!capture){
   for(const role of challengers){
    const p=positions[role],d=Math.hypot(ball[0]-p[0],ball[2]-p[1]),fly=!flight.path[i].grounded&&(flight.wallContactAt===null||i<flight.wallContactAt);
    const stat=statsFor(players[defenderId(rec,defTeam,role)]);
    const catchReach=(fly?1.57:1.28)*(.55+.45*stat.catching);
    // A physically close fielder without actual secure possession is NOT a
    // fly out. When the ball subsequently lands, an ordinary-effort missed
    // fly may be scored an E rather than retroactively awarding the catch.
    if(fly&&flight.firstGround!=null&&i>=flight.firstGround-2&&
       d<1.52&&ball[1]>=.43&&ball[1]<=2.15){
      if(!ordinaryNearMiss||d<ordinaryNearMiss.distance)
       ordinaryNearMiss={role,frame:i,distance:d,ball:[...ball]};
    }
    if(d<=catchReach&&ball[1]>=(fly?.43:0)&&ball[1]<=(fly?2.55:1.1)){
     capture={role,time:(i+1)*DT,frame:i,pos:[p[0],p[1]],ball:[...ball],fly};break;
    }
   }
  }
  if(!capture&&flight.firstGround===i&&ordinaryNearMiss&&flight.wallContactAt===null){
    ordinaryFlyMiss={...ordinaryNearMiss,groundFrame:i,
      ordinaryEffort:true,scorerBasis:'fielder-under-airborne-ball-before-ground'};
  }
  if(capture){
   // Record the exact fielder position at the same tick as the captured ball.
   const captureSample=[39+capture.frame,+capture.pos[0].toFixed(3),0,+capture.pos[1].toFixed(3)];
   const history=traces[capture.role];
   if(history.at(-1)[0]===captureSample[0])history[history.length-1]=captureSample;
   else history.push(captureSample);
   break;
  }
 }
 return {traces,field:capture,catchAt:capture?.fly?capture:null,
   firstPickupAt:capture,ordinaryFlyMiss,dist:nearFlight(capture?.ball??flight.final)};
}

// Threat-based fielding intent. This is a simplified browser-slice planning
// decision (the official Native Core is not yet connected). Do not infer
// situationalAwareness from fielding catches: only explicit knowledge matters.
const BASE_THROW_POINTS={1:[19.397,19.397],2:[0,38.795],3:[-19.397,19.397],4:[0,0]};
function planDefensiveThrow(rec,pa,secured,outcome,battingBases=1,field=null){
 if(!secured || secured.fly && outcome==='FO' || outcome==='HR')return null;
 const defensiveTeam=1-rec.players[pa.batter].team;
 const fielder=rec.players[defenderId(rec,defensiveTeam,secured.role)];
 const abilities=statsFor(fielder);
 const awareness=clamp((fielder.ratings?.situationalAwareness??70)/100,.05,1);
 const throwSpeed=26+abilities.arm*12;
 const releaseAt=secured.time+.20+(1-awareness)*.14;
 const arrival=(base)=>releaseAt+distance(secured.pos,BASE_THROW_POINTS[base])/throwSpeed+.13;
  const recRole=(base)=>base===1?'1B':base===2?'2B':base===3?'3B':'C';
  const readiness=(base)=>{
    const role=recRole(base),trace=field?.traces?.[role]?.at(-1);
    const point=trace?[trace[1],trace[3]]:BASE_THROW_POINTS[base];
    return secured.time+distance(point,BASE_THROW_POINTS[base])/
      statsFor(rec.players[defenderId(rec,defensiveTeam,role)]).sprint;
  };
  const actualControl=(base)=>Math.max(arrival(base),readiness(base))+.08;
 const prior=pa.before.bases;
 const leadSpeed=(base)=>statsFor(rec.players[prior[base]]).sprint;
 let base,reason,threat=null,leadEta=null,canHoldLead=false;
 if(outcome==='GO'){
   base=1;reason='attainable-batter-runner-force';
   if(prior[0]&&!prior[1]&&!prior[2]&&pa.before.outs<2){
    const lead=statsFor(rec.players[prior[0]]);
    const target2=BASE_THROW_POINTS[2],recv=field?.traces?.['2B']?.at(-1);
    const pos=recv?[recv[1],recv[3]]:target2;
    const ready=secured.time+distance(pos,target2)/statsFor(rec.players[defenderId(rec,defensiveTeam,'2B')]).sprint;
    const secArrival=Math.max(arrival(2),ready)+.08;
    if(secArrival+.08<baseArrivalSec(LEAD_RUNNER_START,1,lead.sprint)){
     base=2;reason='physically-attainable-lead-runner-force';threat=2;canHoldLead=true;
    }
   }
 }else if(prior[2]){
   // Third-base runner must LEGALLY TOUCH home; compare with actual plate
   // receiver ownership rather than optimistic release time or arbitrary slack.
   leadEta=baseArrivalSec(LEAD_RUNNER_START,1,leadSpeed(2));
   canHoldLead=actualControl(4)+.08<leadEta;
   base=canHoldLead?4:2;
   threat=4;reason=canHoldLead?'hold-runner-at-third-or-force-home':'cutoff-hold-trailing-runner';
 }else if(prior[1]){
   // R2 could try to score on outfield contact; otherwise protect R3.
   const earlyScore=secured.time>4.6||pa.before.outs===2||battingBases>1;
   leadEta=baseArrivalSec(LEAD_RUNNER_START,2,leadSpeed(1));
   if(earlyScore){
     threat=4;canHoldLead=actualControl(4)+.08<leadEta;
     base=canHoldLead?4:2;
     reason=canHoldLead?'hold-runner-at-third':'cutoff-prevent-trailing-advance';
   }else{base=3;threat=3;reason='protect-third-from-runner-on-second'}
 }else if(prior[0]){
   const lead=rec.players[prior[0]];
   const speed=statsFor(lead).sprint;
   const farEnough=Math.hypot(secured.pos[0],secured.pos[1])>52;
   const advanceThreat=farEnough && secured.time>=2.5 && speed>=5.3;
   if(advanceThreat){
     leadEta=baseArrivalSec(LEAD_RUNNER_START,2,speed);
     threat=3;canHoldLead=actualControl(3)+.08<leadEta;
     base=canHoldLead?3:2;
     reason=canHoldLead?'deny-first-to-third':'cutoff-hold-trailing-batter';
   }else{base=2;reason='hold-lead-at-second';threat=2;}
 }else{base=2;reason='deny-batter-extra-base'}
 // On a legitimate groundout the existing first-base force is the actual play.
 // On a safely reached hit, there is never an automatic throw to first.
 const eta=arrival(base);
 const receiver=recRole(base);
 const receiverReadySec=readiness(base);
 const baseControlSec=Math.max(eta,receiverReadySec)+.08;
 return {destinationBase:base,point:[...BASE_THROW_POINTS[base]],arrivalSec:+eta.toFixed(4),
   releaseSec:+releaseAt.toFixed(4),receiver,receiverReadySec:+receiverReadySec.toFixed(4),
   baseControlSec:+baseControlSec.toFixed(4),
   threatBase:threat,runnerArrivalSec:leadEta===null?null:+leadEta.toFixed(4),
   canHoldLead,reason,fieldingIQSource:fielder.ratings?.situationalAwareness==null?'neutral-default':'player-explicit',
   sourceRole:secured.role};
}

function interpolateBase(a,b,u){const A=baseCoords[a]||baseCoords[0],B=baseCoords[b]||baseCoords[0];return [lerp(A[0],B[0],u),lerp(A[1],B[1],u)]}
const baseCoords={0:[0,0],1:[19.397,19.397],2:[0,38.795],3:[-19.397,19.397],4:[0,0]};
function stepTicksFor(sprint){return Math.max(38,Math.round(27.432/sprint/DT));}
const CONTACT_LOCAL=39, BATTER_BASE_START=62, LEAD_RUNNER_START=41;
function baseArrivalSec(startTick,baseCount,sprint){
 return (startTick-CONTACT_LOCAL+stepTicksFor(sprint)*baseCount)*DT;
}
function baseArrivalTick(startTick,baseCount,sprint){
 return startTick+stepTicksFor(sprint)*baseCount;
}
function runningTrack(startBase,targetBase,startTick,sprint){
 const way=[[0,...baseCoords[startBase]]],stepTicks=stepTicksFor(sprint);
 way.push([startTick,...baseCoords[startBase]]);
 let t=startTick;
 for(let b=startBase+1;b<=targetBase;b++){t+=stepTicks;way.push([t,...baseCoords[b===4?4:b]])}
 return way.map(([tt,x,z])=>[tt,+x.toFixed(3),0,+z.toFixed(3)]);
}
function buildActors(rec,pa,p,flight,field,outcome,targets){
 // Observation metadata only: this capture was already resolved by fieldSimulation.
 // No predicted arrival/catch time is promoted to secure possession.
 p.presentationEvidence=Object.freeze({fairKnownLocal:flight?.fair?(field?.field&&field.field.frame<(flight.firstGround??flight.path.length)?(!foulTerritory(field.field.ball)?39+field.field.frame:null):39+(flight.firstGround??flight.path.length-1)):null,capture:field?.field?Object.freeze({...field.field,
   pos:[...field.field.pos],ball:[...field.field.ball]}):null});
 const def=1-rec.players[pa.batter].team,bat=rec.players[pa.batter],startCount=p.motion.length,actors=[];
 for(const role of ROLES){
  const player=defenderId(rec,def,role);
  const pos=legalDefensivePosition(role,rec.positions?.[role]),init=[[0,pos[0],0,pos[1]]],more=field?.traces?.[role]||[];
  const track=[...init,...more.filter(x=>x[0]>0&&x[0]<startCount)];
  if(p.throwPlan?.receiver===role&&field?.field){
   const posTo=p.throwPlan.point,readyTick=Math.min(startCount-1,CONTACT_LOCAL+Math.ceil(p.throwPlan.receiverReadySec/DT));
   const last=track.at(-1);
   if(last[0]<readyTick)track.push([readyTick,posTo[0],0,posTo[1]]);
  }
  const last=track.at(-1);
  if(last[0]<startCount-1)track.push([startCount-1,last[1],last[2],last[3]]);
  actors.push({id:role,player,role,track,runAfter:null,hideAfter:null});
 }
 const batStart=bat.hand==='R'?-.97:.97;
 let batterTrack=[[0,batStart,0,.72]],runAfter=null;
 // The batter must finish their full follow-through before their first running step.
 // A borderline foul prompts a provisional run, but the runner stops when the ball is ruled foul.
 const provisionalFoul=!!flight&&!flight.fair&&Math.abs(flight.bearingDeg)>=28&&Math.abs(flight.bearingDeg)<=65;
 if(((flight&&(flight.fair||provisionalFoul))&&!['FO','SF'].includes(outcome))||outcome==='BB'){
  runAfter=55;
  // A walk awards first base immediately but the real batter must visibly
  // depart home plate and touch first before the camera advances. Jogging
  // pace is distinct from a full sprint; the same pace drives scene timing.
  const sprint=outcome==='BB'?Math.min(3.2,statsFor(bat).sprint):statsFor(bat).sprint;
  const nominal=runningTrack(0,targets.batterBase||1,BATTER_BASE_START,sprint);
  batterTrack=[[0,batStart,0,.72],[54,batStart,0,.72],[55,batStart,0,.72],
    [BATTER_BASE_START,0,0,0],...nominal.slice(2)];
  if((outcome==='FO'||outcome==='SF')&&field?.catchAt){
   const stop=39+field.catchAt.frame;
   const before=batterTrack.filter(k=>k[0]<stop);
   const seg=batterTrack.findIndex(k=>k[0]>=stop);
   const a=seg<=0?batterTrack[0]:batterTrack[seg-1],b=seg<0?batterTrack.at(-1):batterTrack[seg];
   const u=a[0]===b[0]?0:clamp((stop-a[0])/(b[0]-a[0]),0,1);
   const at=[stop,lerp(a[1],b[1],u),0,lerp(a[3],b[3],u)];
   batterTrack=[...before,at];
   // Never leave a batter voluntarily running after an airborne flyout.
   if(stop<55)runAfter=null;
  }
  if(provisionalFoul){
   const stop=Math.min(84,Math.max(63,39+(flight.firstGround??40)));
   const settleAt=(t)=>{
    const end=batterTrack.findIndex(k=>k[0]>=t);
    if(end<0)return batterTrack.at(-1);
    const b=batterTrack[end],a=batterTrack[Math.max(0,end-1)],u=b[0]===a[0]?0:Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0])));
    return [t,a[1]+(b[1]-a[1])*u,0,a[3]+(b[3]-a[3])*u];
   };
   batterTrack=[...batterTrack.filter(k=>k[0]<stop),settleAt(stop)];
  }
 }
 // If the batter was forced OUT at first, that outcome is a separate timed
 // base-control event. Never pretend the runner touched first before the ball.
 actors.push({id:'BAT',role:'batter',player:pa.batter,track:batterTrack,runAfter,hideAfter:null});
 for(let b=0;b<3;b++){
  const id=pa.before.bases[b];if(!id)continue;
  const target=targets.old?.[b]||b+1;
  if(targets.forcedRunnerOut===b+1){
   const cp=baseCoords[b+1],dest=baseCoords[b+2];
   const outLocal=CONTACT_LOCAL+Math.ceil((p.throwPlan?.baseControlSec??0)/DT);
   // The forced runner is approaching the bag but must not appear past it.
   const whole=runningTrack(b+1,b+2,LEAD_RUNNER_START,statsFor(rec.players[id]).sprint);
   const arriveLocal=baseArrivalTick(LEAD_RUNNER_START,1,statsFor(rec.players[id]).sprint);
   const frac=clamp((outLocal-LEAD_RUNNER_START)/(arriveLocal-LEAD_RUNNER_START),0,.985);
   const stop=[outLocal,+lerp(cp[0],dest[0],frac).toFixed(3),0,+lerp(cp[1],dest[1],frac).toFixed(3)];
   actors.push({id:'RUN'+(b+1),role:'runner',player:id,track:[whole[0],whole[1],stop],hideAfter:outLocal+5});
  }else if(target===b+1){ // runner holds and legally retouches after airborne catch
    const cp=baseCoords[b+1];
    if((outcome==='FO'||outcome==='SF')&&field?.catchAt&&39+field.catchAt.frame>47){
     const catchTick=39+field.catchAt.frame;
     const half=Math.min(50,Math.round((41+catchTick)/2));
     const next=baseCoords[Math.min(4,b+2)];
     const approach=[half,+(cp[0]+(next[0]-cp[0])*.09).toFixed(3),0,
       +(cp[1]+(next[1]-cp[1])*.09).toFixed(3)];
     actors.push({id:'RUN'+(b+1),role:'runner',player:id,
       track:[[0,cp[0],0,cp[1]],[41,cp[0],0,cp[1]],approach,
              [Math.max(half+1,catchTick),cp[0],0,cp[1]]],hideAfter:null});
    }else actors.push({id:'RUN'+(b+1),role:'runner',player:id,
      track:[[0,cp[0],0,cp[1]],[startCount-1,cp[0],0,cp[1]]],hideAfter:null});
  }else{
    const runFrom=outcome==='SF'&&b===2&&targets.tagUpStartLocal!=null?
      targets.tagUpStartLocal:LEAD_RUNNER_START;
    actors.push({id:'RUN'+(b+1),role:'runner',player:id,
      track:runningTrack(b+1,target,runFrom,statsFor(rec.players[id]).sprint),hideAfter:null});
  }
 }
 return actors;
}
class BrowserMatch{
 constructor(base,settings={}){
  this.seed=settings.seed||'baseball';this.rand=random(this.seed);this.base=base;this.innings=clamp(Number(settings.innings)||9,3,9);
  this.managedTeam=settings.managedTeam===1?1:0;
  this.rec=recordSkeleton({...base,seed:this.seed});this.inning=1;this.half=0;this.outs=0;this.balls=0;this.strikes=0;this.bases=[null,null,null];this.score=[0,0];this.hits=[0,0];this.errors=[0,0];this.line=[Array(9).fill(null),Array(9).fill(null)];this.line[0][0]=0;this.battingIndex=[0,0];this.pitchCount=[0,0];this.lastPitcher=[null,null];this.currentPa=null;this.finished=false;this.log=[];this.eventCounter=0;
 }
 currentHitter(){return this.half+'-b'+(this.battingIndex[this.half]%9)}
 currentPitcher(){const team=1-this.half;return team+'-p0'}
 snapshot(){return {inning:this.inning,half:this.half,outs:this.outs,bases:[...this.bases],score:[...this.score],hits:[...this.hits],errors:[...this.errors],line:this.line.map(a=>[...a])}}
 startPa(){
  if(this.currentPa)return this.currentPa;
  const idx=this.rec.plateAppearances.length,id=this.rec.matchId+'/pa-'+(idx+1);
  const pa={id,index:idx,start:this.rec.totalTicks,batter:this.currentHitter(),pitcher:this.currentPitcher(),before:this.snapshot(),after:null,outcome:null,runs:0,pitches:[],end:null};
  this.rec.plateAppearances.push(pa);this.currentPa=pa;
  const key=this.inning+'-'+this.half;
  if(!this.rec.inningStarts.some(i=>i.inning===this.inning&&i.half===this.half))this.rec.inningStarts.push({inning:this.inning,half:this.half,tick:this.rec.totalTicks});
  return pa;
 }
 calculatePitch(choice={}){
  if(this.finished)throw new Error('試合は終了しています');
  if(this.rec.pitches.length>1500)throw new Error('投球回数が安全上限を超えました');
  const pa=this.startPa(),def=1-this.half,player=this.rec.players[pa.batter],batter=statsFor(player),rand=this.rand;
  const batChoice=this.half===this.managedTeam?(choice.batting||'balanced'):'balanced';
  const pitchChoice=def===this.managedTeam?(choice.pitchType||'auto'):'auto';
  const pitchTarget=def===this.managedTeam?(choice.location||'auto'):'auto';
  const cycle=['fastball','slider','fork','fastball','curve','cutter','change','two-seam'];
  const pitcher=this.rec.players[pa.pitcher];
  const allowed=Object.keys(pitcher.arsenal||{}).filter(k=>PITCHES[k]);
  const options=allowed.length?allowed:cycle;
  const kind=allowed.includes(pitchChoice)?pitchChoice:options[Math.floor(rand()*options.length)];
  const spec=PITCHES[kind];
  const fatigue=Math.max(0,this.pitchCount[def]-75)*.040;
  const nominal=pitcher.arsenal?.[kind]??spec.base;
  const speed=clamp(Math.round(nominal+(rand()-.5)*7-fatigue),90,pitcher.maxSpeedKmh??158);
  const height=player.height,low=height*.27,high=height*.535;
  const control=clamp((pitcher.control??68)/100,0,1);
  // Pitch TARGET is a strategic decision, independent from the pitcher's
  // command execution. A poorly calling catcher cannot magically erase elite
  // release repeatability. Both a catcher proposal and a pitcher correction
  // are recorded BEFORE the real pitch is resolved.
  const catchingPlayer=this.rec.players[defenderId(this.rec,def,'C')];
  const catcherGameCalling=Number.isFinite(catchingPlayer?.ratings?.gameCalling)?
    clamp(catchingPlayer.ratings.gameCalling,0,100):null;
  // The real LAD catcher has no sourced game-calling rating in this fixture:
  // neutral choice until the user's roster/film evaluation supplies evidence.
  const caller=catcherGameCalling===null?50:catcherGameCalling;
  const hitterOutsideSign=player.hand==='R'?-1:1;
  const mustChallenge=this.balls>=3;
  const pitcherHasEliteCommand=control>=.90;
  const offeredOutside=rand()<(caller>=70?.65:.5);
  const calledSide=offeredOutside?'outside':'inside';
  const calledVertical=rand()<.54?'low':'high';
  // Borderline-but-strike-side four corners, not an arbitrary random zone
  // scatter or perpetual high-middle fastball. Normal pitch results still
  // depend on physical error, actual batter choice, and umpire location.
  const cornerX=mustChallenge?.152:this.balls===2?.208:.236;
  const cornerMargin=mustChallenge?.11:this.balls===2?.065:.043;
  const proposedX=hitterOutsideSign*(calledSide==='outside'?cornerX:-cornerX);
  const proposedY=calledVertical==='low'?low+cornerMargin:high-cornerMargin;
  // Chasing a pitch just off the plate can be meaningful with two strikes;
  // with three balls, even an inexperienced caller should not prescribe an
  // automatic walk every pitch. Elite pitchers reject overtly risky proposals
  // in hitter-friendly counts; a rookie may accept them more often.
  const aggressiveChase=this.strikes>=2&&this.balls<2&&rand()<.14;
  const poorLateNibble=caller<25&&this.balls===2&&this.strikes>=1&&rand()<.22;
  const catcherSuggestedChase=pitchTarget==='auto'&&(aggressiveChase||poorLateNibble);
  const pitcherVetoed=catcherSuggestedChase && (mustChallenge||
    (poorLateNibble&&pitcherHasEliteCommand));
  const executeChase=catcherSuggestedChase&&!pitcherVetoed;
  let aimX=proposedX,aimY=proposedY;
  let targetDescription=(calledSide==='outside'?'outside':'inside')+'-'+calledVertical;
  if(executeChase){aimX=hitterOutsideSign*(calledSide==='outside'?.282:-.282);
    targetDescription='chase-'+targetDescription;}
  // Explicit human manager orders are evaluated at pitch issue, NEVER
  // retroactive to a previously released pitch.
  if(pitchTarget==='outside'){aimX=hitterOutsideSign*.232;targetDescription='manager-outside';}
  if(pitchTarget==='inside'){aimX=-hitterOutsideSign*.232;targetDescription='manager-inside';}
  if(pitchTarget==='low'){aimY=low+.045;targetDescription='manager-low';}
  if(pitchTarget==='zone'){
    aimX=hitterOutsideSign*(calledSide==='outside'?.168:-.168);
    aimY=calledVertical==='low'?low+.095:high-.095;
    targetDescription='manager-safe-zone-corner';
  }
  // The count / pitch type / catcher lead influence aim and intent, whereas
  // control only limits the observed deviation from that declared location.
  const catcherProposal={fielderId:catchingPlayer?.id??null,gameCallingRating:catcherGameCalling,
    side:calledSide,height:calledVertical,chaseSuggested:catcherSuggestedChase};
  // Execution scatter shrinks with actual pitcher's command. Intent location
  // remains distinct from realized location in the immutable physics receipt.
  const x=clamp(aimX+gaussian(rand)*(.115-.070*control),-.75,.75);
  const y=clamp(aimY+gaussian(rand)*(.165-.097*control),.18,1.42);
  const zone=(Math.abs(x)<=.2159+.037&&y>=low-.037&&y<=high+.037);
  const pitchExecution={commandRating:pitcher.control??68,intended:{x:aimX,y:aimY},
    realized:{x,y},deviationMetres:Math.hypot(x-aimX,y-aimY),zone,
    approach:pitchTarget,targetDescription,catcherProposal,pitcherVetoed,
    deliberateZoneAim:!executeChase,intendedStrikeSide:Math.abs(aimX)<.2529&&aimY>low-.037&&aimY<high+.037,
    issueBalls:this.balls,issueStrikes:this.strikes};
  let swingProbability=zone?.78:.25;
  if(batChoice==='take')swingProbability=zone?.05:.01;
  if(batChoice==='contact')swingProbability=zone?.89:.33;
  if(batChoice==='power')swingProbability=zone?.80:.44;
  if(batChoice==='bunt')swingProbability=zone?.85:.25;
  if(this.strikes===2&&zone)swingProbability=Math.max(swingProbability,.91);
  if(this.balls===3&&!zone)swingProbability*=.38;
  const swing=rand()<swingProbability;
  const bbefore=[this.balls,this.strikes];
  let physical=null,flight=null,field=null,terminal=false,result='',category='strike',outcome=null,sacrificeFly=null,advance={batterBase:1,old:{}};
  if(swing){
   const skill=batter.contact*(batChoice==='contact'?1.16:batChoice==='power'?.82:batChoice==='bunt'?1.24:1);
   // Bad-ball skill: preserve intended bat path under constrained reachable out-of-zone posture.
   // It never alters swing choice or directly buffs hit/HR outcome odds.
   const outOfZone=(!zone && Math.abs(x)<.61);
   const postureDemand=outOfZone?clamp((Math.abs(x)-.2159)*1.25+Math.max(0,low-y,y-high),0,1):0;
   const pathPreservation=clamp(1-postureDemand*batter.badBallControl*.76,.24,1);
   const timingError=gaussian(rand)*(.074/skill)*pathPreservation+(spec.breakY<-.12?-.012:0);
   const heightError=gaussian(rand)*(.11/skill)*pathPreservation;
   const barrel={x:x+timingError*2.5,y:y+heightError,z:.12+Math.abs(timingError)*.3};
   const gap=Math.hypot(timingError*2.5,heightError,Math.abs(timingError)*.26);
   // Swept bat capsule collision at plate-crossing: finite bat radius + ball radius.
   const contacted=gap<(batChoice==='bunt'?.20:.17) && Math.abs(x)<.61;
   physical={pitchLocation:{x:+x.toFixed(4),y:+y.toFixed(4)},swingTimingError:+timingError.toFixed(4),sweptGap:gap,contactRadius:batChoice==='bunt'?.20:.17,contacted,
   batPathPreservation:{outOfZone,postureDemand:+postureDemand.toFixed(4),retained:+pathPreservation.toFixed(4),skill:batter.badBallControl}};
   if(!contacted){this.strikes++;result='空振り';category='strike';}
   else{
    const angle=batChoice==='bunt'?(rand()-.5)*.32:gaussian(rand)*(.37+(batChoice==='power'?.13:0))+timingError*2.5;
    const launch=batChoice==='bunt'?(-5+rand()*17)*Math.PI/180:clamp(13+gaussian(rand)*23+(batChoice==='power'?11:batChoice==='contact'?-3:0),-22,60)*Math.PI/180;
    const batSpeed=batChoice==='bunt'?6:(batChoice==='power'?27:batChoice==='contact'?19:23)*batter.power*(.92+rand()*.17);
    const exit=clamp(batSpeed*1.11+(speed/3.6)*.29,batChoice==='bunt'?8:14,49);
    flight=makeFlight({rand,exit,launch,bearing:angle,contact:[x,y,.12]});
    // This is a PREDICTED ungated trajectory only until a fielder actually
    // controls the ball. The authoritative ground event must be established
    // after fieldSimulation, never from an unmaterialized future frame.
    physical={...physical,exitKmh:flight.exitKmh,launchDeg:flight.launchDeg,bearingDeg:flight.bearingDeg,
      projectedGroundTick:flight.firstGround,firstGroundTick:null,firstGroundLocation:null};
    if(!flight.fair){
     if(batChoice==='bunt'&&this.strikes===2){this.strikes=3;result='スリーバント失敗';outcome='K';category='out';}
     else{this.strikes=Math.min(2,this.strikes+1);result='ファウル';category='strike'}
    }else{
     field=fieldSimulation(flight,this.rec,def,rand);
     const catcher=field.catchAt,secured=field.firstPickupAt;
     if(physical){
       const touchedGround=flight.firstGround!=null &&
         (!secured || flight.firstGround<=secured.frame);
       physical.firstGroundTick=touchedGround?flight.firstGround:null;
       physical.firstGroundLocation=touchedGround?flight.first:null;
     }
     let groundOut=false,throwEta=null;
     const runnerEta=baseArrivalSec(BATTER_BASE_START,1,batter.sprint);
     if(secured&&!secured.fly){
      const firstForce=planDefensiveThrow(this.rec,pa,secured,'GO',1,field);
      throwEta=firstForce.baseControlSec;
      groundOut=firstForce.destinationBase===2?true:throwEta+.08<runnerEta;
     }
     physical={...physical,fielding:secured?{role:secured.role,securedAt:+secured.time.toFixed(3),fly:secured.fly,throwToFirstAt:throwEta==null?null:+throwEta.toFixed(3),batterFirstAt:+runnerEta.toFixed(3)}:null};
     if(flight.homeRun&&!secured){result='ホームラン';outcome='HR';category='hit';advance.batterBase=4;}
     else if(catcher){
      result='フライアウト';outcome='FO';category='out';
      if(pa.before.outs<2&&pa.before.bases[2]){
       const r3=this.rec.players[pa.before.bases[2]],runner=statsFor(r3);
       const securingFielder=this.rec.players[defenderId(this.rec,def,catcher.role)];
       const arm=statsFor(securingFielder);
       const tagAt=catcher.time+.20;
       const arriveHome=tagAt+27.432/runner.sprint;
       const release=catcher.time+.86+(1-arm.accuracy)*.18;
       const distHome=Math.hypot(catcher.pos[0],catcher.pos[1]);
       const throwAt=release+distHome/(26+12*arm.arm)+.23;
       if(field.dist>55&&arriveHome+.17<throwAt){
        sacrificeFly={runnerId:pa.before.bases[2],tagAtSec:tagAt,
           catchAtSec:catcher.time,runnerHomeAtSec:arriveHome,
           throwHomeAtSec:throwAt,releaseSec:release,caughtBy:catcher.role};
        outcome='SF';result='犠牲フライ';
       }
      }
     }
     else if(field.ordinaryFlyMiss){result='失策（捕球できず）';outcome='E';category='in-play';advance.batterBase=1;}
     else if(groundOut){result='ゴロアウト';outcome='GO';category='out';}
     // A live ball merely CAROMING off the fence is not an awarded double.
     // Ground-rule doubles require an actual out-of-play boundary event;
     // the v21 stadium prototype has no such event yet.
     else{
      const delay=secured?secured.time:8.5,depth=field.dist;
      const bases=delay>8.3&&depth>109?3:delay>4.9&&depth>72?2:1;
      advance.batterBase=bases;
      outcome=bases+'B';result=bases===1?'ヒット':bases===2?'ツーベース':'スリーベース';category='hit';
     }
    }
   }
  }else{
   if(zone){this.strikes++;result='見逃し';category='strike';}
   else{this.balls++;result='ボール';category='ball';}
  }
  // Official decision happens only after the physical/swing/pitch evidence is computed.
  physical={...(physical||{}),pitchExecution};
  if(this.strikes>=3){terminal=true;outcome='K';result=result==='スリーバント失敗'?result:'三振';category='out'}
  if(this.balls>=4){terminal=true;outcome='BB';result='四球';category='ball'}
  if(outcome&&['HR','FO','GO','1B','2B','3B','K','E','SF'].includes(outcome))terminal=true;
  // Compute an observed throw choice before any official result is applied.
  const secured=field?.firstPickupAt??null;
  let throwPlan=flight?.fair && secured && !['FO','HR','SF'].includes(outcome)?
    planDefensiveThrow(this.rec,pa,secured,outcome,advance.batterBase,field):null;
  if(sacrificeFly){
   throwPlan={destinationBase:4,point:[0,0],arrivalSec:sacrificeFly.throwHomeAtSec,
     releaseSec:sacrificeFly.releaseSec,receiver:'C',
     receiverReadySec:sacrificeFly.catchAtSec,
     baseControlSec:sacrificeFly.throwHomeAtSec+.08,reason:'tag-up-home-defense',
     threatBase:4,runnerArrivalSec:sacrificeFly.runnerHomeAtSec,
     canHoldLead:false,fieldingIQSource:'physically-timed-sac-fly',sourceRole:secured.role};
  }
  let forcedRunnerOut=null,preventedAdvance=null;
  if((outcome==='2B'||outcome==='3B')&&throwPlan?.destinationBase===2){
   const batterSecond=baseArrivalSec(BATTER_BASE_START,2,batter.sprint);
   // A competent runner holds at first when the defense will plainly own
   // second base before the batter can reach it. An unearned double is invalid.
   if(throwPlan.baseControlSec+.14<batterSecond){
    preventedAdvance={targetBase:2,controlledAtSec:throwPlan.baseControlSec,runnerAtSec:batterSecond};
    outcome='1B';result='ヒット';advance.batterBase=1;
    throwPlan=planDefensiveThrow(this.rec,pa,secured,outcome,1,field);
   }
  }
  if(outcome==='GO'&&throwPlan?.destinationBase===2&&pa.before.bases[0]&&
    !pa.before.bases[1]&&!pa.before.bases[2]){
    forcedRunnerOut=1;outcome='FC';result='二塁フォースアウト';category='out';
  }
  if(outcome==='1B'&&throwPlan?.destinationBase===4&&throwPlan.canHoldLead &&
     pa.before.bases.every(Boolean)){
    // Bases loaded: the third-base runner is FORCED home. If the plate is
    // secured earlier, that runner is out and the batter reaches first (FC).
    const leadSpeed=statsFor(this.rec.players[pa.before.bases[2]]).sprint;
    const runnerHome=baseArrivalSec(LEAD_RUNNER_START,1,leadSpeed);
    if(throwPlan.baseControlSec+.08<runnerHome){
      forcedRunnerOut=3;outcome='FC';result='本塁フォースアウト';category='out';
    }
  }
  if(outcome==='1B'&&throwPlan?.destinationBase===2&&pa.before.bases[0] &&
    !pa.before.bases[1]&&!pa.before.bases[2] && secured && !secured.fly){
    const firstRunner=statsFor(this.rec.players[pa.before.bases[0]]);
    const leadSecond=baseArrivalSec(LEAD_RUNNER_START,1,firstRunner.sprint);
    if(throwPlan.baseControlSec+.08<leadSecond){
     // Actual second-base force play: the preceding runner is OUT, the
     // batter occupies first safely; record fielder's choice, NOT a hit.
     forcedRunnerOut=1;outcome='FC';result='二塁フォースアウト';category='out';
    }
  }
  if(physical?.fielding){physical.fielding.throwPlan=throwPlan;
    if(throwPlan?.destinationBase!==1)physical.fielding.throwToFirstAt=null;}
  if(physical){physical.outOfPlay=outcome==='HR'?{
      reason:'over-fence-home-run',frame:flight?.path.length?flight.path.length-1:null,
      position:flight?.final??null}:null;
    physical.wallEvent={contactAt:flight?.wallContactAt!=null &&
    (!secured||flight.wallContactAt<=secured.frame)?flight.wallContactAt:null,
    deadBall:false,groundRuleDouble:false};
    physical.outcomeEvidence={sacrificeFly,ordinaryFlyMiss:field?.ordinaryFlyMiss??null,flyingCatch:field?.catchAt?.fly??false,
      securedFly:secured?.fly??false,securedAtSec:secured?.time??null,
      forcedRunnerOut,preventedAdvance};}
  let prev=this.snapshot(),runs=0;
  if(terminal){
   const beforeScore=this.score[this.half];
   if(outcome==='BB')this.awardWalk(pa.batter);
   else if(['K','FO','GO'].includes(outcome))this.outs++;
   else if(outcome==='SF'){
    this.outs++;
    this.bases[2]=null;
    this.addRuns(1);
   }
   else if(outcome==='FC'){
    this.outs++;
    if(forcedRunnerOut===3){
      const previous=pa.before.bases;
      this.bases=[pa.batter,previous[0],previous[1]];
    }else this.bases=[pa.batter,null,null];
   }
   else if(outcome==='E'){
    // Ordinary-effort failure: batter reaches; credit a defensive error but
    // NO hit. The physical runner advancement still follows normal traces.
    this.applyHit(pa.batter,advance.batterBase,field,throwPlan);
    this.hits[this.half]--;
    this.errors[def]++;
   }
   else if(['HR','1B','2B','3B'].includes(outcome))this.applyHit(pa.batter,advance.batterBase,field,throwPlan);
   runs=this.score[this.half]-beforeScore;
   if(runs)result+='　+'+runs+'点';
   pa.outcome=outcome;pa.runs=runs;
  }
  if(outcome==='1B'&&secured&&!secured.fly)result=result.replace('ヒット','ヒット（着地後の回収）');
  const after=this.snapshot(),paEndForView=terminal?copy(after):null;
  if(!terminal)pa.after=null;else{pa.after=paEndForView;pa.end=null}
  const index=this.rec.pitches.length,start=this.rec.totalTicks,number=pa.pitches.length+1;
  const id=pa.id+'/pitch-'+number;
  const targets={batterBase:advance.batterBase,old:{},forcedRunnerOut,tagUpStartLocal:sacrificeFly?39+Math.ceil(sacrificeFly.tagAtSec/DT):null};
  if(terminal&&['HR','1B','2B','3B','BB','FC','E','SF'].includes(outcome)){
   const old=pa.before.bases;
   for(let j=0;j<3;j++)if(old[j]){const afterBase=after.bases.indexOf(old[j]);targets.old[j]=afterBase>=0?afterBase+1:4}
  }
  const visual=this.makeMotion({pa,kind,x,y,swing,flight,field,throwPlan,terminal,after,physical,outcome,targets});
  const physicalPlayEnd=visual.length-1;
  const inningRetired=terminal&&pa.before.outs===2&&['K','GO','FO','FC'].includes(outcome);
  const freezeFrames=terminal?Math.ceil(1000/55):0;
  const benchFrames=inningRetired?Math.ceil(2750/55):0;
  if(freezeFrames||benchFrames){
   const last=visual.at(-1);
   for(let i=0;i<freezeFrames+benchFrames;i++)visual.push(copy(last));
  }
  const freezeStartLocal=freezeFrames?physicalPlayEnd+1:null;
  const benchWalkStartLocal=inningRetired?physicalPlayEnd+1+freezeFrames:null;
  const resultLocal=flight&&flight.fair?(
      outcome==='FO'&&field?.catchAt?Math.min(physicalPlayEnd,39+field.catchAt.frame+2):
      outcome==='FC'&&throwPlan?Math.min(physicalPlayEnd,39+Math.ceil(throwPlan.baseControlSec/DT)):
      outcome==='GO'&&throwPlan?Math.min(physicalPlayEnd,39+Math.ceil(throwPlan.baseControlSec/DT)):
      outcome==='SF'&&sacrificeFly?Math.min(physicalPlayEnd,
        39+Math.ceil(sacrificeFly.runnerHomeAtSec/DT)):
      physicalPlayEnd-12):
    flight?Math.min(physicalPlayEnd,39+Math.max(12,Math.min(68,flight.firstGround??36))):39;
  const end=start+visual.length-1,confirm=start+resultLocal,locationKind=swing&&physical?.contacted?'contact':'plate-crossing';
  const officialAt=start+(outcome==='BB'?Math.max(39,physicalPlayEnd-12):resultLocal);
  const pitch={id,index,pa:pa.index,number,start,end,confirm,resultAt:confirm,officialAt,committedInput:{...choice},type:spec.name,kind,speed,breakVector:{x:spec.breakX,y:spec.breakY,z:0},location:{x,y,z:locationKind==='contact'?.12:0},locationKind,before:bbefore,after:[this.balls,this.strikes],result,category,fair:!!flight?.fair,foul:!!flight&&!flight.fair,provisionalRun:!!flight&&!flight.fair&&Math.abs(flight.bearingDeg)>=28&&Math.abs(flight.bearingDeg)<=65,contactLocal:flight?39:null,catchLocal:!flight?43:null,followThroughEndLocal:54,runStartLocal:55,
   outcome,sacrificeFly,forcedRunnerOut,preventedAdvance,throwPlan,freezeStartLocal,benchWalkStartLocal,physicalPlayEnd,inningRetired,flightEndLocal:flight?Math.min(visual.length-1,39+flight.path.length):null,swing,terminal,trajectory:y<low?'down':y>high?'up':'level',motion:visual,actors:null,physics:physical};
  pitch.actors=buildActors(this.rec,pa,pitch,flight,field,outcome,targets);
  if(inningRetired){
   // A realistic 2.75-second departure demonstrates walking TOWARD the dugout;
   // defenders in deep CF cannot physically travel 100m in 2.75 seconds.
   for(const actor of pitch.actors){
    const walkStart=pitch.benchWalkStartLocal,walkEnd=pitch.motion.length-1;
    const current=actor.track.at(-1);
    const before=actor.track.filter(x=>x[0]<=walkStart);
    const startPoint=before.at(-1)||current;
    const team=this.rec.players[actor.player]?.team??this.half;
    const dugout=[team===1?34:-34,-12];
    const dx=dugout[0]-startPoint[1],dz=dugout[1]-startPoint[3],len=Math.hypot(dx,dz)||1;
    const motionMetres=Math.min(len,1.55*(walkEnd-walkStart)*DT);
    const target=[walkEnd,+(startPoint[1]+dx/len*motionMetres).toFixed(3),0,
       +(startPoint[3]+dz/len*motionMetres).toFixed(3)];
    actor.track=[...before.filter(x=>x[0]<walkStart),
      [walkStart,startPoint[1],0,startPoint[3]],target];
    actor.benchWalkStartLocal=walkStart;
    actor.hideAfter=null;
   }
  }
  if(terminal){pa.end=end;this.currentPa=null;this.battingIndex[this.half]++;this.balls=0;this.strikes=0;this.applyHalfChange();}
  pa.pitches.push(index);this.rec.pitches.push(pitch);this.rec.records.push({plateAppearanceId:pa.id,pitchId:id,number,revision:0,availableAtMicros:confirm*55000,status:'confirmed',location:{kind:locationKind,position:{x,y,z:locationKind==='contact'?.12:0}},pitchType:spec.name,pitchKind:kind,breakVector:pitch.breakVector,speedKmh:speed,resultLabel:result,category,count:{balls:terminal?0:pitch.after[0],strikes:terminal?0:pitch.after[1]},terminal});
  this.pitchCount[def]++;this.rec.totalTicks=end+1;
  this.log.push({pitch:id,inning:prev.inning,half:prev.half,outsBefore:prev.outs,before:bbefore,after:pitch.after,result,outcome,score:[...after.score],physics:physical});
  if(this.finished)this.rec.final=this.snapshot();
  return pitch;
 }
 awardWalk(id){
  const [a,b,c]=this.bases;
  if(a&&b&&c)this.addRuns(1);
  this.bases=[id,a||b? a : null,b&&a?b:c&&a&&b?c:null];
  // Non-forced occupied bases retain original identities.
  if(!a){this.bases=[id,b,c]}
  else if(!b){this.bases=[id,a,c]}
  else{this.bases=[id,a,b]}
 }
 addRuns(n){this.score[this.half]+=n;this.line[this.half][this.inning-1]=(this.line[this.half][this.inning-1]||0)+n}
 applyHit(id,bases,field,throwPlan=null){
  this.hits[this.half]++;
  if(bases===4){this.addRuns(1+this.bases.filter(Boolean).length);this.bases=[null,null,null];return}
  const prior=[...this.bases],result=[null,null,null];result[bases-1]=id;
  // Advance all runners in ascending prior base order without overtaking.
  for(let k=2;k>=0;k--){const occupant=prior[k];if(!occupant)continue;
   let target=k+bases+1;
   if(bases===1){
    // On an outfield single, runners from second generally reach third; from third score.
    if(k===1){
      const scoringChance=field?.field?.time>4.6||this.outs===2;
      target=scoringChance&&!(throwPlan?.threatBase===4&&throwPlan.canHoldLead)?4:3;
    }
    else if(k===2 && throwPlan?.threatBase===4 && throwPlan.canHoldLead){
      // A third-base runner is not rewarded with a run merely because the
      // fielder has already secured the plate; holding is a real alternative
      // unless the full-base force has been recorded as FC at home.
      target=3;
    }
    else if(k===0){
      // A genuinely deep/delayed pickup can invite first-to-third, but an
      // attainable third-base throw can hold the lead runner at second.
      const runnerSpeed=statsFor(this.rec.players[occupant]).sprint;
      const tempting=field?.firstPickupAt?.time>=2.5 && field.dist>52 && runnerSpeed>=5.3;
      target=tempting && throwPlan?.threatBase===3 && !throwPlan.canHoldLead?3:2;
      if(target===3&&result[2])target=2;
    }
   }
   if(target>=4){this.addRuns(1);continue}
   if(target<=3 && result[target-1]){
     let fallback=target-1;
     while(fallback>k+1 && result[fallback-1])fallback--;
     if(fallback>=k+1 && !result[fallback-1])target=fallback;
     else if(target===3 && !result[1])target=2;
     else target=4;
   }
   if(target>=4)this.addRuns(1);else result[target-1]=occupant;
  }
  this.bases=result;
 }
 applyHalfChange(){
  if(this.inning>=this.innings&&this.half===1&&this.score[1]>this.score[0]){this.finished=true;return}
  if(this.outs<3)return;
  if(this.half===0){
   if(this.inning>=this.innings&&this.score[1]>this.score[0]){this.finished=true;return}
   this.half=1;
  }else{
   if(this.inning>=this.innings&&this.score[0]!==this.score[1]){this.finished=true;return}
   if(this.inning>=(this.innings===9?12:this.innings+3)){this.finished=true;return}
   this.inning++;this.half=0;
  }
  this.outs=0;this.bases=[null,null,null];this.balls=0;this.strikes=0;
  if(this.inning>this.line[0].length){this.line[0].push(null);this.line[1].push(null)}
  this.line[this.half][this.inning-1]=0;
 }
 makeMotion({pa,kind,x,y,swing,flight,field,throwPlan,physical,outcome,targets}){
  const pitcher=this.rec.players[pa.pitcher],batter=this.rec.players[pa.batter];
  const poseKey=batter.hand+'/'+pitcher.hand+'/'+pitcher.form+'/'+(swing?1:0);
  const variants=this.base.animationTemplates;
  let pose=variants[poseKey]||variants[batter.hand+'/'+pitcher.hand+'/over/'+(swing?1:0)]||Object.values(variants)[0];
  const catchFrame=field?.field?.frame;
  const throwTarget=throwPlan?[throwPlan.point[0],1.28,throwPlan.point[1]]:null;
  const catchPos=field?.field?field.field.pos:null;
  const holdTicks=throwPlan&&field?.field?Math.max(1,Math.ceil((throwPlan.releaseSec-field.field.time)/DT)):5;
  const throwTicks=catchPos&&throwTarget?Math.max(1,Math.ceil((throwPlan.arrivalSec-throwPlan.releaseSec)/DT)):0;
  const playFrames=field?.field?(field.field.frame+1+holdTicks+throwTicks):flight?.path.length||0;
  // The game MUST continue displaying until every live runner reaches their
  // official target, without skipping a future base-touch frame.
  const runnerFrames=[];
  if((flight?.fair&&!['FO','SF'].includes(outcome))||outcome==='BB'||outcome==='SF'){
   const sprint=outcome==='BB'?Math.min(3.2,statsFor(batter).sprint):statsFor(batter).sprint;
   if(outcome!=='SF')runnerFrames.push(baseArrivalTick(BATTER_BASE_START,targets?.batterBase||1,sprint));
   const oldBases=pa.before.bases;
   for(let i=0;i<3;i++)if(oldBases[i]){
    const target=targets.old?.[i]??(i+1);
    const segments=targets.forcedRunnerOut===i+1?1:Math.max(0,target-i-1);
    if(segments)runnerFrames.push(baseArrivalTick(outcome==='SF'&&i===2&&targets?.tagUpStartLocal!=null?targets.tagUpStartLocal:LEAD_RUNNER_START,segments,statsFor(this.rec.players[oldBases[i]]).sprint));
   }
  }
  if(throwPlan)runnerFrames.push(CONTACT_LOCAL+Math.ceil(throwPlan.baseControlSec/DT));
  const n=flight?(flight.fair?Math.max(90,39+playFrames+14,...runnerFrames.map(f=>f+13)):
     39+Math.min(91,Math.max(38,flight.path.length+8))):
     outcome==='BB'?Math.max(72,...runnerFrames.map(f=>f+13)):72;
  const out=[];
  const x0=pitcher.hand==='R'?-.54:.54;
  for(let i=0;i<n;i++){
   const f=pose[Math.min(i,pose.length-1)];
   let ball=null;
   if(i>=28&&i<39){
    const t=clamp((i-28)/10,0,1);
    ball=triplet(lerp(x0,x,t)+Math.sin(t*Math.PI)*PITCHES[kind].breakX*.10,lerp(1.86,y,t)+Math.sin(Math.PI*t)*.11,lerp(16.95,0,t));
   }else if(flight&&i>=39){
    const ix=i-39;
    if(field?.field&&ix>field.field.frame){
     const f=field.field,time=ix-f.frame;
     if(time<=holdTicks||!throwTicks){
      // Ground-ball pickup stays visibly on the dirt before glove transfer.
      const pickupY=f.fly?f.ball[1]:Math.max(.037,Math.min(.15,f.ball[1]));
      const u=holdTicks?clamp((time-1)/holdTicks,0,1):1;
      ball=[f.pos[0],lerp(pickupY,1.15,u),f.pos[1]];
     }
     else if(time<=holdTicks+throwTicks){
      const u=(time-holdTicks)/throwTicks;
      ball=triplet(lerp(f.pos[0],throwTarget[0],u),lerp(1.15,throwTarget[1],u)+.8*Math.sin(Math.PI*u),lerp(f.pos[1],throwTarget[2],u));
     }else{ball=throwTarget?[...throwTarget]:[f.pos[0],1.15,f.pos[1]]}
    }else if(ix<flight.path.length){ball=[...flight.path[ix].p]}
    else if(ix<n-39){ball=[...flight.final]}
   }else if(!flight&&i>=39){
     // The unhit pitch crosses the plate and travels BEHIND it to the
     // catcher's actual receiving point, then remains secure in the mitt.
     const u=clamp((i-38)/5,0,1);
     const atMitt=Math.max(.35,Math.min(1.35,y+(y-1.86)*(1.90/16.95)));
     ball=triplet(x,lerp(y,atMitt,u),-1.90*u);
   }
   const orient=[...f[0]],bat=[...f[1]];
   out.push([ball,orient,bat,f[2],f[3]]);
  }
  return out;
 }
 autoplay(count=1,choice={}){let result=null;for(let i=0;i<count&&!this.finished;i++)result=this.calculatePitch(choice);return result}
 finishAll(choice={}){let n=0;while(!this.finished&&n<1600){this.calculatePitch(choice);n++}return {finished:this.finished,pitches:n,score:[...this.score],innings:this.inning,reason:!this.finished?'safety-limit':null}}
}
window.KneekuraBrowserMatch=Object.freeze({version:23,planDefensiveThrow,makeEngine:(base,opts)=>new BrowserMatch(base,opts),pitchTypes:PITCHES,createRecording:recordSkeleton});
})();
