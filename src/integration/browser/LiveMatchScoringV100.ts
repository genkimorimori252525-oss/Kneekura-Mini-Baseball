import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';

export type LocalErrorKindV100='fielding'|'throwing'|'receiving'|'missed_base'|'missed_tag';
export type LocalScoringCandidateV100={id:string;tick:number;fielderId:string;kind:LocalErrorKindV100;targetRunnerId?:string;targetBase?:number};
/** A bounded local recordkeeper input, never a Native scorer admission. */
export type LocalScoringEvidenceV100={playId:number;batterRunnerId:string;endedAtTick:number;ended:boolean;classification:string;outsBefore:number;bunt:boolean;
 initialBases:Record<string,number>;touches:{runnerId:string;base:number;tick:number}[];
 outs:{runnerId:string;tick:number;classification:string}[];scoredRunnerIds:string[];
 firstChoice:{tick:number;runnerId:string;ordinaryFirstOutPossible:boolean|null;completedInfielderPlay?:boolean}|null;candidates:LocalScoringCandidateV100[];
 ordinary:{available:boolean;unavailableReason?:string;outTicks?:Record<string,number>;outRunnerIds:string[];furthestBases:Record<string,number>;flyCaught:boolean;scoredRunnerIds:string[]}};
export type LocalScoringV100=Readonly<{version:'local_match_scoring_v100';policyId:'LOCAL_MATCH_SCORING_V100';nativeAdmission:false;
 atTick:number;status:'confirmed'|'pending'|'in_progress';classification:string;ab:number|null;hits:0|1|null;hitBases:0|1|2|3|4|null;homeRuns:0|1|null;
 errors:readonly Readonly<LocalScoringCandidateV100&{reason:'lost_out'|'extra_advance'|'extended_plate_appearance';runnerIds:readonly string[]}>[];
 errorsComplete:boolean;pendingReasons:readonly string[];
 evidence:LocalScoringEvidenceV100}>;
const kinds=['fielding','throwing','receiving','missed_base','missed_tag'];
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=160&&v.trim()===v;
const tick=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function validateEvidence(e:LocalScoringEvidenceV100){
 const fail=()=>{throw Error('ローカル記録の根拠・時刻・選手IDが不正です');};
 if(!e||!tick(e.playId)||!text(e.batterRunnerId)||!tick(e.endedAtTick)||typeof e.ended!=='boolean'||typeof e.bunt!=='boolean'
  ||!text(e.classification)||!Number.isInteger(e.outsBefore)||e.outsBefore<0||e.outsBefore>2
  ||!e.initialBases||Object.entries(e.initialBases).some(([id,n])=>!text(id)||!Number.isInteger(n)||n<0||n>3)
  ||e.initialBases[e.batterRunnerId]!==0||Object.keys(e.initialBases).length>4)fail();
 for(const rows of [e.touches,e.outs,e.candidates])if(!Array.isArray(rows)||rows.length>512||rows.some(r=>!r||!tick(r.tick)||r.tick>e.endedAtTick))fail();
 if(e.touches.some(r=>!text(r.runnerId)||!Object.hasOwn(e.initialBases,r.runnerId)||!Number.isInteger(r.base)||r.base<1||r.base>4)
  ||e.outs.some(r=>!text(r.runnerId)||!Object.hasOwn(e.initialBases,r.runnerId)||!text(r.classification))
  ||e.candidates.some(r=>!text(r.id)||!text(r.fielderId)||!kinds.includes(r.kind)
   ||r.targetRunnerId!==undefined&&!Object.hasOwn(e.initialBases,r.targetRunnerId)
   ||r.targetBase!==undefined&&(!Number.isInteger(r.targetBase)||r.targetBase<1||r.targetBase>4))||new Set(e.candidates.map(c=>c.id)).size!==e.candidates.length)fail();
 if(!e.ordinary||typeof e.ordinary.available!=='boolean'||typeof e.ordinary.flyCaught!=='boolean'
  ||!Array.isArray(e.ordinary.outRunnerIds)||e.ordinary.outRunnerIds.some(id=>!Object.hasOwn(e.initialBases,id))
  ||!e.ordinary.furthestBases||Object.entries(e.ordinary.furthestBases).some(([id,n])=>!Object.hasOwn(e.initialBases,id)||!Number.isInteger(n)||n<0||n>4)
  ||e.ordinary.outTicks!==undefined&&Object.entries(e.ordinary.outTicks).some(([id,n])=>!e.ordinary.outRunnerIds.includes(id)||!tick(n))
  ||![e.scoredRunnerIds,e.ordinary.scoredRunnerIds].every(rows=>Array.isArray(rows)&&rows.length<=4&&rows.every(id=>Object.hasOwn(e.initialBases,id))))fail();
 if(e.firstChoice&&(!tick(e.firstChoice.tick)||e.firstChoice.tick>e.endedAtTick||!Object.hasOwn(e.initialBases,e.firstChoice.runnerId)
  ||e.firstChoice.runnerId===e.batterRunnerId||![true,false,null].includes(e.firstChoice.ordinaryFirstOutPossible)))fail();
}
export function classifyLocalScoringV100(raw:LocalScoringEvidenceV100):LocalScoringV100{
 const e=cloneInert(raw);validateEvidence(e);
 const touches=e.touches.slice().sort((a,b)=>a.tick-b.tick),first=touches.find(t=>t.runnerId===e.batterRunnerId&&t.base===1),
  actualOut=new Set(e.outs.map(o=>o.runnerId)),candidates=e.candidates.slice().sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id)),
  errors:LocalScoringV100['errors'][number][]=[],lostOutAlready=new Set<string>(),unprovenLostOuts=new Set<string>(),pendingReasons:string[]=[];
 let attributionUnknown=false;
 if(candidates.length&&!e.ordinary.available)pendingReasons.push('ordinary_effort_comparison_unavailable');
 if(e.ordinary.available)for(let i=0;i<candidates.length;i++){
  const c=candidates[i],until=candidates[i+1]?.tick??e.endedAtTick+1,
   recoveredForce=(c.kind==='fielding'||c.kind==='receiving')&&e.outs.some(o=>o.tick>c.tick&&o.tick<until&&['force','batter_runner_before_first'].includes(o.classification)),
   doublePlayThrow=c.kind==='throwing'&&e.outs.some(o=>o.tick<c.tick),
   extended=!e.ended&&e.classification==='foul'&&e.ordinary.flyCaught&&c.kind==='fielding',
   lost=e.ordinary.outRunnerIds.filter(id=>{
    if(doublePlayThrow||actualOut.has(id)||lostOutAlready.has(id)||id===e.batterRunnerId&&first&&c.tick>first.tick)return false;
    if(c.targetRunnerId&&c.targetRunnerId!==id)return false;
    const referenceOut=e.ordinary.outTicks?.[id];
    if(referenceOut!==undefined){if(referenceOut<c.tick){attributionUnknown=true;unprovenLostOuts.add(id);return false;}return i===candidates.length-1||referenceOut<until;}
    if(candidates.length>1){attributionUnknown=true;unprovenLostOuts.add(id);return false;}return true;
   }),
   extra=[...new Set(touches.filter(t=>!unprovenLostOuts.has(t.runnerId)&&t.tick>c.tick&&t.tick<until&&t.base>Math.max(e.ordinary.furthestBases[t.runnerId]??e.initialBases[t.runnerId],
    doublePlayThrow&&t.runnerId===(c.targetRunnerId??e.batterRunnerId)?c.targetBase??1:0)).map(t=>t.runnerId))];
  if(recoveredForce)continue;
  if(extended||lost.length||extra.length){const runnerIds=extended?[e.batterRunnerId]:lost.length?lost:extra;lost.forEach(id=>lostOutAlready.add(id));
   errors.push({...c,reason:extended?'extended_plate_appearance':lost.length?'lost_out':'extra_advance',runnerIds});}
 }
 if(attributionUnknown)pendingReasons.push('lost_out_error_attribution_unavailable');
 let status:LocalScoringV100['status']=e.ended?'confirmed':'in_progress',classification='plate_appearance_continues',ab:number|null=null,hits:0|1|null=null,hitBases:LocalScoringV100['hitBases']=null,homeRuns:0|1|null=null;
 const known=(kind:string,a:number,h:0|1,b:0|1|2|3|4=0)=>{classification=kind;ab=a;hits=h;hitBases=b;homeRuns=b===4?1:0;},
  pending=(reason:string)=>{status='pending';classification='unresolved';pendingReasons.push(reason);};
 if(e.ended){
  if(['walk','hit_by_pitch'].includes(e.classification))known(e.classification,0,0);
  else if(e.classification==='strikeout')known('strikeout',1,0);
  else if(e.classification==='home_run') {
   if(errors.some(c=>c.reason==='lost_out'&&c.tick<=(first?.tick??Infinity)))known('reached_on_error',1,0);
   else known('home_run',1,1,4);
  }
  else if(['fly_out','foul_out'].includes(e.classification))known(e.classification==='fly_out'&&e.outsBefore<2&&e.scoredRunnerIds.some(id=>id!==e.batterRunnerId)?'sacrifice_fly':e.classification,
   e.classification==='fly_out'&&e.outsBefore<2&&e.scoredRunnerIds.some(id=>id!==e.batterRunnerId)?0:1,0);
  else if(e.classification==='ground_rule_double'&&!errors.some(c=>c.tick<=(first?.tick??Infinity)))known('base_hit',1,1,2);
  else if(e.classification!=='live_ball')pending('unsupported_terminal_classification');
  else if(e.outs.some(o=>o.runnerId===e.batterRunnerId&&(!first||o.tick<=first.tick))) {
   const advanced=Object.keys(e.initialBases).some(id=>id!==e.batterRunnerId&&touches.some(t=>t.runnerId===id&&t.base>e.initialBases[id]));
   known(e.bunt&&e.outsBefore<2&&advanced?'sacrifice_bunt':'ground_out',e.bunt&&e.outsBefore<2&&advanced?0:1,0);
  }else if(e.outs.some(o=>o.runnerId!==e.batterRunnerId&&o.classification==='force')||e.firstChoice?.completedInfielderPlay)known('fielders_choice',1,0);
  else if(errors.some(c=>c.tick<=(first?.tick??Infinity)&&c.reason==='lost_out')){
   const sacrificeBunt=e.bunt&&e.outsBefore<2&&Object.keys(e.initialBases).some(id=>id!==e.batterRunnerId&&(e.ordinary.furthestBases[id]??e.initialBases[id])>e.initialBases[id]),
    sacrificeFly=!e.bunt&&e.outsBefore<2&&e.ordinary.flyCaught&&e.scoredRunnerIds.some(id=>id!==e.batterRunnerId&&e.ordinary.scoredRunnerIds.includes(id));
   known(sacrificeBunt?'sacrifice_bunt_error':sacrificeFly?'sacrifice_fly_error':'reached_on_error',sacrificeBunt||sacrificeFly?0:1,0);
  }
  else if(candidates.some(c=>c.tick<=(first?.tick??Infinity))&&(!e.ordinary.available||attributionUnknown))pending('hit_error_judgment_unavailable');
  else if(e.firstChoice&&(!first||e.firstChoice.tick<first.tick)&&e.firstChoice.ordinaryFirstOutPossible!==false){
   if(e.firstChoice.ordinaryFirstOutPossible===null)pending('first_base_alternative_unavailable');else known('fielders_choice',1,0);
  }else if(first){
   const errorAt=errors[0]?.tick??Infinity,choiceAt=e.firstChoice?.tick??Infinity,
    earned=Math.max(1,...touches.filter(t=>t.runnerId===e.batterRunnerId&&t.tick<Math.min(errorAt,choiceAt)).map(t=>t.base));
   known('base_hit',1,1,Math.min(3,earned) as 1|2|3);
  }else pending('batter_reaching_or_retirement_evidence_missing');
 }
 return freeze({version:'local_match_scoring_v100',policyId:'LOCAL_MATCH_SCORING_V100',nativeAdmission:false,atTick:e.endedAtTick,
  status,classification,ab,hits,hitBases,homeRuns,errors,errorsComplete:(!candidates.length||e.ordinary.available)&&!attributionUnknown,pendingReasons,evidence:e});
}
export function validateLocalScoringV100(raw:unknown):asserts raw is LocalScoringV100{
 const s=cloneInert(raw) as LocalScoringV100;
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
 if(!s||s.version!=='local_match_scoring_v100'||JSON.stringify(canonical(classifyLocalScoringV100(s.evidence)))!==JSON.stringify(canonical(s)))throw Error('安打・失策記録と根拠が一致しません');
}
