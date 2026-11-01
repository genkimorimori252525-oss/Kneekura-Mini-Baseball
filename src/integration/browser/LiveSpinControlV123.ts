import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SPIN_TECHNIQUES_V123,type SpinTechniqueV123} from '../../core/world/traits/SpinTechniqueV123';

export type LiveSpinTechniqueV123=Readonly<{technique:SpinTechniqueV123;sourceId:string;sourceEffectIdentity:string;
 learnedStatus:'PRACTICING'|'CONSOLIDATED';calibration:Readonly<{sourceId:string;sourceVersion:string;status:'MODEL_VERIFIED'|'UNVERIFIED'}>;
 clip:Readonly<{id:string;sourceSha256:string;bats:'R'|'L'}>;
 motion:Readonly<{attackAngleDegrees:number;pullAngleDeltaDegrees:number;contactOffsetMeters:Readonly<{pull:number;up:number;depth:number}>}>;
 conditions:Readonly<{minimumInsideNormalized:number;maximumInsideNormalized:number;minimumHeightNormalized:number;maximumHeightNormalized:number;minimumAvailableSeconds:number}>}>;
export type LiveSpinControlV123=Readonly<{version:'live_spin_control_v123';boundary:'LOCAL_AUTHORING_ONLY';sourceId:string;sourceVersion:string;
 preferredIntent:SpinTechniqueV123|'NO_SPIN_TARGET';techniques:readonly LiveSpinTechniqueV123[]}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=200;
const bounded=(v:number,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const tick=(v:number)=>Number.isSafeInteger(v)&&v>=0;
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

/** Explicit editor input. This does not authenticate learning, scientific
 * measurements or a Native technique Source. No default player receives it. */
export function validateLiveSpinControlV123(raw:unknown):LiveSpinControlV123{
 const p=cloneInert(raw) as LiveSpinControlV123;
 if(!fields(p,['version','boundary','sourceId','sourceVersion','preferredIntent','techniques'])||p.version!=='live_spin_control_v123'
  ||p.boundary!=='LOCAL_AUTHORING_ONLY'||![p.sourceId,p.sourceVersion].every(id)
  ||p.preferredIntent!=='NO_SPIN_TARGET'&&!SPIN_TECHNIQUES_V123.includes(p.preferredIntent)||!Array.isArray(p.techniques)||p.techniques.length>4)
  throw Error('打球回転の設定が不正です。メーカー用の形式と、4種類以内の技術を指定してください。');
 const kinds=new Set<string>();
 for(const t of p.techniques){
  if(!fields(t,['technique','sourceId','sourceEffectIdentity','learnedStatus','calibration','clip','motion','conditions'])
   ||!SPIN_TECHNIQUES_V123.includes(t.technique)||kinds.has(t.technique)||![t.sourceId,t.sourceEffectIdentity].every(id)
   ||!['PRACTICING','CONSOLIDATED'].includes(t.learnedStatus)
   ||!fields(t.calibration,['sourceId','sourceVersion','status'])||![t.calibration.sourceId,t.calibration.sourceVersion].every(id)
   ||!['MODEL_VERIFIED','UNVERIFIED'].includes(t.calibration.status)||!fields(t.clip,['id','sourceSha256','bats'])||!id(t.clip.id)
   ||typeof t.clip.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(t.clip.sourceSha256)||!['R','L'].includes(t.clip.bats)
   ||!fields(t.motion,['attackAngleDegrees','pullAngleDeltaDegrees','contactOffsetMeters'])||!bounded(t.motion.attackAngleDegrees,-30,30)
   ||!bounded(t.motion.pullAngleDeltaDegrees,-45,45)||!fields(t.motion.contactOffsetMeters,['pull','up','depth'])
   ||!bounded(t.motion.contactOffsetMeters.pull,-.2,.2)||!bounded(t.motion.contactOffsetMeters.up,-.2,.2)||!bounded(t.motion.contactOffsetMeters.depth,-.5,.5)
   ||!fields(t.conditions,['minimumInsideNormalized','maximumInsideNormalized','minimumHeightNormalized','maximumHeightNormalized','minimumAvailableSeconds'])
   ||!bounded(t.conditions.minimumInsideNormalized,-3,3)||!bounded(t.conditions.maximumInsideNormalized,t.conditions.minimumInsideNormalized,3)
   ||!bounded(t.conditions.minimumHeightNormalized,-3,3)||!bounded(t.conditions.maximumHeightNormalized,t.conditions.minimumHeightNormalized,3)
   ||!bounded(t.conditions.minimumAvailableSeconds,0,2))throw Error('打球回転の技術設定を確認してください。軌道・左右・適用コース・打点と角度の範囲が必要です。');
  kinds.add(t.technique);
 }
 return freeze(p);
}
export type LiveSpinIntentInputV123=Readonly<{profile:LiveSpinControlV123;bats:'R'|'L';clip:Readonly<{id:string;sourceSha256:string}>;
 observation:Readonly<{observedTick:number;availableTick:number;decisionTick:number}>;perceivedPosition:Readonly<{x:number;y:number}>;
 zone:Readonly<{centerX:number;halfWidth:number;lowerY:number;upperY:number}>;timeUntilContactSeconds:number;swingOffered:boolean;
 battingMode:'balanced'|'contact'|'power'|'take'|'bunt'}>;
function localMastery(p:LiveSpinControlV123){
 const uses=new Map<string,number>(),keys=(t:LiveSpinTechniqueV123)=>['source:'+t.sourceId,'effect:'+t.sourceEffectIdentity];
 for(const t of p.techniques)for(const key of keys(t))uses.set(key,(uses.get(key)??0)+1);
 const qualified=p.techniques.filter(t=>t.learnedStatus==='CONSOLIDATED'&&t.calibration.status==='MODEL_VERIFIED'&&keys(t).every(key=>uses.get(key)===1)),
  masteredTechniqueSet=SPIN_TECHNIQUES_V123.filter(kind=>qualified.some(t=>t.technique===kind)),
  effectiveStateId=masteredTechniqueSet.length===0?'NONE':masteredTechniqueSet.length===1?'BLUE_'+masteredTechniqueSet[0]:'GOLD';
 return {qualified,masteredTechniqueSet,effectiveStateId};
}
export function projectLiveSpinMasteryV123(raw:unknown){
 const {masteredTechniqueSet,effectiveStateId}=localMastery(validateLiveSpinControlV123(raw));
 return freeze({boundary:'LOCAL_AUTHORING_ONLY' as const,nativeAdmission:false as const,masteredTechniqueSet,effectiveStateId});
}

/** Choose only an already qualified original motion. This is a repertoire
 * lookup before motor planning, not a search over future contact outcomes. */
export function findLiveSpinMotionClipV124<T extends Readonly<{id:string;side:'R'|'L';source:Readonly<{sha256:string}>}>>(
 profile:LiveSpinControlV123,bats:'R'|'L',clips:readonly T[]):T|null{
 const p=validateLiveSpinControlV123(profile),t=localMastery(p).qualified.find(t=>t.technique===p.preferredIntent);
 return t&&t.clip.bats===bats?clips.find(c=>c.id===t.clip.id&&c.side===bats&&c.source.sha256===t.clip.sourceSha256)??null:null;
}

/** Preserve the ordinary selection pool plus at most one qualified motion.
 * The 673-trial archive is not expanded into each pitch's inert input. */
export function liveSpinRepertoireClipsV124<T extends Readonly<{id:string;side:'R'|'L';source:Readonly<{sha256:string}>;defaultSelection?:boolean}>>(
 batter:Readonly<{bats:'R'|'L';clipId?:string;spinControlV123?:LiveSpinControlV123}>,clips:readonly T[]):readonly T[]{
 const learned=batter.spinControlV123?findLiveSpinMotionClipV124(batter.spinControlV123,batter.bats,clips):null;
 return clips.filter(c=>c.side===batter.bats&&((batter.clipId?c.id===batter.clipId:c.defaultSelection!==false)||c===learned));
}

/** A single specific intent from delivered perception. Actual ball state,
 * exitSpin, outcome and Native flags are absent from this contract. */
export function selectLiveSpinIntentV123(raw:LiveSpinIntentInputV123){
 const i=cloneInert(raw),p=validateLiveSpinControlV123(i.profile),o=i.observation,z=i.zone;
 if(!fields(i,['profile','bats','clip','observation','perceivedPosition','zone','timeUntilContactSeconds','swingOffered','battingMode'])
  ||!['R','L'].includes(i.bats)||!fields(i.clip,['id','sourceSha256'])||!id(i.clip.id)||!/^[a-f0-9]{64}$/.test(i.clip.sourceSha256)
  ||!fields(o,['observedTick','availableTick','decisionTick'])||![o.observedTick,o.availableTick,o.decisionTick].every(tick)
  ||o.observedTick>o.availableTick||o.availableTick>o.decisionTick||!fields(i.perceivedPosition,['x','y'])||!Object.values(i.perceivedPosition).every(Number.isFinite)
  ||!fields(z,['centerX','halfWidth','lowerY','upperY'])||!Object.values(z).every(Number.isFinite)||z.halfWidth<=0||z.upperY<=z.lowerY
  ||!bounded(i.timeUntilContactSeconds,0,10)||typeof i.swingOffered!=='boolean'||!['balanced','contact','power','take','bunt'].includes(i.battingMode))
  throw Error('打球回転の判断に、利用可能な本人の予測を指定してください。');
 const {qualified,masteredTechniqueSet,effectiveStateId}=localMastery(p),
  base={version:'live_spin_intent_v123' as const,boundary:'LOCAL_AUTHORING_ONLY' as const,nativeAdmission:false as const,
   selectedAtTick:o.decisionTick,requestedIntent:p.preferredIntent,masteredTechniqueSet,effectiveStateId};
 type Reason='APPLIED'|'NONE_REQUESTED'|'UNMASTERED_TECHNIQUE'|'NO_SWING'|'BUNT_SEPARATE_MOTOR'|'SOURCE_DOMAIN_MISMATCH'|'OUTSIDE_CALIBRATED_COURSE'|'INSUFFICIENT_MOTOR_TIME';
 const result=(reason:Reason,t:LiveSpinTechniqueV123|null=null)=>freeze({...base,selectedIntent:t?.technique??'NO_SPIN_TARGET',reason,
  techniqueSourceRef:t?{sourceId:t.sourceId,sourceVersion:p.sourceVersion}:null,motion:t?.motion??null});
 if(p.preferredIntent==='NO_SPIN_TARGET')return result('NONE_REQUESTED');
 const t=qualified.find(t=>t.technique===p.preferredIntent);if(!t)return result('UNMASTERED_TECHNIQUE');
 if(!i.swingOffered||i.battingMode==='take')return result('NO_SWING');
 if(i.battingMode==='bunt')return result('BUNT_SEPARATE_MOTOR');
 if(t.clip.bats!==i.bats||t.clip.id!==i.clip.id||t.clip.sourceSha256!==i.clip.sourceSha256)return result('SOURCE_DOMAIN_MISMATCH');
 const inside=-(i.perceivedPosition.x-z.centerX)/z.halfWidth*(i.bats==='R'?1:-1),height=(i.perceivedPosition.y-z.lowerY)/(z.upperY-z.lowerY),c=t.conditions;
 if(inside<c.minimumInsideNormalized||inside>c.maximumInsideNormalized||height<c.minimumHeightNormalized||height>c.maximumHeightNormalized)return result('OUTSIDE_CALIBRATED_COURSE');
 if(i.timeUntilContactSeconds<c.minimumAvailableSeconds)return result('INSUFFICIENT_MOTOR_TIME');
 return result('APPLIED',t);
}
export type LiveSpinIntentV123=ReturnType<typeof selectLiveSpinIntentV123>;
