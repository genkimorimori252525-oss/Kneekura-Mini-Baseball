import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
export type AimDirectionV122='PULL'|'CENTER'|'OPPOSITE';
export type BatterApproachV122=Readonly<{version:'batter_approach_v122';sourceId:string;priorReliance:number;directionCommitment:number;twoStrikeCommitmentDelta:number;
 preferredWhenCommitted:Readonly<{pull:number;center:number;opposite:number}>;targetPullAnglesDegrees:Readonly<{pull:number;center:number;opposite:number}>}>;
type Prediction=Readonly<{x:number;y:number;arrivalAfterReleaseSeconds:number}>;
type Hypothesis=Readonly<{familyId:string;regionId:string;probability:number;prediction:Prediction}>;
export type BatterBeliefV122=Readonly<{version:'batter_belief_v122';sourceId:string;observerPlayerId:string;pitcherId:string;capturedAtTick:number;
 observedThroughTick:number;confidence:number;evidenceRefs:readonly string[];candidates:readonly Hypothesis[]}>;
export type BatterEvidenceV122=Readonly<{evidenceId:string;observerPlayerId:string;pitcherId:string;observedTick:number;availableTick:number;
 familyId:string;regionId:string;prediction:Prediction;reliability:number}>;
const fields=(v:unknown,n:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
const unit=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1,tick=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const text=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=200;
const prediction=(p:Prediction)=>fields(p,['x','y','arrivalAfterReleaseSeconds'])&&[p.x,p.y,p.arrivalAfterReleaseSeconds].every(Number.isFinite)
 &&Math.abs(p.x)<=3&&p.y>=0&&p.y<=4&&p.arrivalAfterReleaseSeconds>0&&p.arrivalAfterReleaseSeconds<=2.5;
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function fail():never{throw Error('打者の予測・方向設定が不正です。確率の合計、観測時刻、対象選手を確認してください。');}
export function validateBatterApproachV122(raw:unknown):BatterApproachV122{
 const p=cloneInert(raw) as BatterApproachV122;
 if(!fields(p,['version','sourceId','priorReliance','directionCommitment','twoStrikeCommitmentDelta','preferredWhenCommitted','targetPullAnglesDegrees'])
  ||p.version!=='batter_approach_v122'||!text(p.sourceId)||![p.priorReliance,p.directionCommitment].every(unit)||!Number.isFinite(p.twoStrikeCommitmentDelta)||Math.abs(p.twoStrikeCommitmentDelta)>1
  ||!fields(p.preferredWhenCommitted,['pull','center','opposite'])||!Object.values(p.preferredWhenCommitted).every(unit)
  ||Math.abs(Object.values(p.preferredWhenCommitted).reduce((a,b)=>a+b,0)-1)>1e-12
  ||!fields(p.targetPullAnglesDegrees,['pull','center','opposite'])||!Object.values(p.targetPullAnglesDegrees).every(n=>Number.isFinite(n)&&Math.abs(n)<=80))fail();
 return freeze(p);
}
/** The caller supplies this player's delivered knowledge. No opponent call,
 * repertoire, actual pitch identity, seed or future trajectory is accepted. */
export function freezeBatterBeliefV122(raw:unknown,scope:Readonly<{observerPlayerId:string;pitcherId:string;capturedAtTick:number}>):BatterBeliefV122{
 const b=cloneInert(raw) as BatterBeliefV122;
 if(!fields(b,['version','sourceId','observerPlayerId','pitcherId','capturedAtTick','observedThroughTick','confidence','evidenceRefs','candidates'])
  ||b.version!=='batter_belief_v122'||![b.sourceId,b.observerPlayerId,b.pitcherId].every(text)||!tick(scope.capturedAtTick)
  ||b.observerPlayerId!==scope.observerPlayerId||b.pitcherId!==scope.pitcherId||!tick(b.capturedAtTick)||b.capturedAtTick>scope.capturedAtTick
  ||!tick(b.observedThroughTick)||b.observedThroughTick>b.capturedAtTick||!unit(b.confidence)||!Array.isArray(b.evidenceRefs)||!b.evidenceRefs.every(text)
  ||new Set(b.evidenceRefs).size!==b.evidenceRefs.length||!Array.isArray(b.candidates)||b.candidates.length<1||b.candidates.length>512)fail();
 const keys=new Set<string>();let sum=0;
 for(const h of b.candidates){if(!fields(h,['familyId','regionId','probability','prediction'])||![h.familyId,h.regionId].every(text)||!unit(h.probability)||!prediction(h.prediction))fail();
  const key=JSON.stringify([h.familyId,h.regionId]);if(keys.has(key))fail();keys.add(key);sum+=h.probability;}
 if(Math.abs(sum-1)>1e-12)fail();
 return freeze({...b,capturedAtTick:scope.capturedAtTick});
}
export function resolveBatterIntentV122(input:Readonly<{profile:BatterApproachV122;belief?:BatterBeliefV122;selectedAtTick:number;strikes:number;bats:'R'|'L';
 beliefDraw:number;commitmentDraw:number;directionDraw:number}>){
 const p=validateBatterApproachV122(input.profile),belief=input.belief===undefined?undefined:freezeBatterBeliefV122(input.belief,
  {observerPlayerId:input.belief.observerPlayerId,pitcherId:input.belief.pitcherId,capturedAtTick:input.selectedAtTick});
 if(!tick(input.selectedAtTick)||!Number.isInteger(input.strikes)||input.strikes<0||input.strikes>2||!['R','L'].includes(input.bats)
  ||![input.beliefDraw,input.commitmentDraw,input.directionDraw].every(v=>unit(v)&&v<1)||input.belief&&input.belief.capturedAtTick!==input.selectedAtTick)fail();
 const commitment=Math.max(0,Math.min(1,p.directionCommitment+(input.strikes===2?p.twoStrikeCommitmentDelta:0))),
  aimed=input.commitmentDraw<commitment,weights=p.preferredWhenCommitted;
 let aim:AimDirectionV122|null=null,pullAngleDegrees:number|null=null;
 if(aimed){const choices=[['PULL',weights.pull],['CENTER',weights.center],['OPPOSITE',weights.opposite]] as const,
   target=input.directionDraw*(weights.pull+weights.center+weights.opposite);let cumulative=0;
  aim=choices.filter(([,w])=>w>0).at(-1)![0];for(const [candidate,w]of choices){cumulative+=w;if(w>0&&target<cumulative){aim=candidate;break;}}
  pullAngleDegrees=p.targetPullAnglesDegrees[({PULL:'pull',CENTER:'center',OPPOSITE:'opposite'} as const)[aim]];}
 let hypothesis:Hypothesis|null=null;
 if(belief){let cumulative=0;for(const h of belief.candidates){cumulative+=h.probability;if(input.beliefDraw<cumulative){hypothesis=h;break;}}
  if(!hypothesis)hypothesis=belief.candidates.filter(h=>h.probability>0).at(-1)!;}
 return freeze({sourceId:p.sourceId,selectedAtTick:input.selectedAtTick,direction:{kind:aimed?'AIMED' as const:'REACTIVE' as const,aim,pullAngleDegrees,
  fieldAngleDegrees:pullAngleDegrees===null?null:-pullAngleDegrees*(input.bats==='R'?1:-1)},selectedJointHypothesis:hypothesis,
  preparedPrediction:hypothesis?.prediction??null,priorWeight:belief?p.priorReliance*belief.confidence:0,
  postContactResultOverride:false as const});
}
/** Evidence has already been classified by the observer's producer. This is
 * not a classifier reading the real PitchCall, nor a calibrated forgetting
 * law. Learning weight/reliability are explicit Source policy inputs. */
export function assimilateBatterEvidenceV122(raw:BatterBeliefV122,rawEvidence:BatterEvidenceV122,policy:Readonly<{atTick:number;learningWeight:number}>):BatterBeliefV122{
 const b=freezeBatterBeliefV122(raw,{observerPlayerId:raw.observerPlayerId,pitcherId:raw.pitcherId,capturedAtTick:policy.atTick}),e=validateBatterEvidenceV122(rawEvidence);
 if(e.observerPlayerId!==b.observerPlayerId||e.pitcherId!==b.pitcherId||e.availableTick>policy.atTick||!unit(policy.learningWeight)||b.evidenceRefs.includes(e.evidenceId))fail();
 const w=policy.learningWeight*e.reliability,match=(h:Hypothesis)=>h.familyId===e.familyId&&h.regionId===e.regionId,
  candidates=b.candidates.map(h=>{const old=h.probability*(1-w),probability=old+(match(h)?w:0);
   return {...h,probability,prediction:match(h)&&probability>0?{x:(old*h.prediction.x+w*e.prediction.x)/probability,
    y:(old*h.prediction.y+w*e.prediction.y)/probability,arrivalAfterReleaseSeconds:(old*h.prediction.arrivalAfterReleaseSeconds+w*e.prediction.arrivalAfterReleaseSeconds)/probability}:h.prediction};});
 if(!candidates.some(match))candidates.push({familyId:e.familyId,regionId:e.regionId,probability:w,prediction:e.prediction});
 return freezeBatterBeliefV122({...b,observedThroughTick:Math.max(b.observedThroughTick,e.observedTick),confidence:(1-w)*b.confidence+w*e.reliability,
  candidates,evidenceRefs:[...b.evidenceRefs,e.evidenceId]},{observerPlayerId:b.observerPlayerId,pitcherId:b.pitcherId,capturedAtTick:policy.atTick});
}
export function validateBatterEvidenceV122(raw:BatterEvidenceV122):BatterEvidenceV122{
 const e=cloneInert(raw);
 if(!fields(e,['evidenceId','observerPlayerId','pitcherId','observedTick','availableTick','familyId','regionId','prediction','reliability'])
  ||![e.evidenceId,e.familyId,e.regionId,e.observerPlayerId,e.pitcherId].every(text)
  ||!tick(e.observedTick)||!tick(e.availableTick)||e.observedTick>e.availableTick||!prediction(e.prediction)||!unit(e.reliability))fail();
 return freeze(e);
}
