import {cloneInert} from '../../adjudication/OfficialWindowPolicy';

// Foundation only; not exported to Match or connected to a Native registry.
// Human scope 2026-10-26: automatic recognition/naming belongs to pennant.
// See docs/verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json.

export type SignatureEvidenceRefV125=Readonly<{owner:string;sourceId:string;sourceVersion:string;sourceHash:string;snapshotHash:string}>;
export type NamedSignatureDefinitionV125=Readonly<{
 version:'named_signature_definition_v125';signatureId:string;careerId:string;originPlayerId:string;recognitionAtDay:number;
 definitionVersion:string;displayNameAtRecognition:string;
 coveredSources:readonly Readonly<{sourceEffectIdentity:string;sourceRef:SignatureEvidenceRefV125}>[];
 coveredTraitFamilyIds:readonly string[];evidenceDigestRef:SignatureEvidenceRefV125;statusAtRecognition:'ACTIVE_PLAYER'|'RETIRED_PLAYER';
}>;
export type SignatureAliasV125=Readonly<{careerId:string;signatureId:string;aliasId:string;atDay:number;sequence:number;displayName:string;sourceRef:SignatureEvidenceRefV125}>;
export type SignatureDisplayTraitV125=Readonly<{traitId:string;familyId:string;stateId:string;lifecycleClass:string;label:string;
 sourceEffectIdentity:string;sourceRef:SignatureEvidenceRefV125}>;
export type SignatureDisplayInputV125=Readonly<{
 scope:Readonly<{careerId:string;playerId:string;asOfDay:number}>;
 /** Fixed, owner-authenticated versions. No eligibility is inferred here. */
 definitions:readonly NamedSignatureDefinitionV125[];aliases:readonly SignatureAliasV125[];traits:readonly SignatureDisplayTraitV125[];
}>;
const fields=(value:unknown,keys:readonly string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=200&&value.trim()===value;
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const reference=(v:SignatureEvidenceRefV125)=>fields(v,['owner','sourceId','sourceVersion','sourceHash','snapshotHash'])
 &&[v.owner,v.sourceId,v.sourceVersion].every(id)&&[v.sourceHash,v.snapshotHash].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s));
const refKey=(r:SignatureEvidenceRefV125)=>JSON.stringify([r.owner,r.sourceId,r.sourceVersion,r.sourceHash,r.snapshotHash]);
const signatureKey=(v:Readonly<{careerId:string;signatureId:string}>)=>JSON.stringify([v.careerId,v.signatureId]);
const effectKey=(v:Readonly<{sourceEffectIdentity:string;sourceRef:SignatureEvidenceRefV125}>)=>JSON.stringify([v.sourceEffectIdentity,refKey(v.sourceRef)]);
const order=(a:string,b:string)=>a<b?-1:a>b?1:0;
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

export function validateNamedSignatureDefinitionV125(raw:unknown):NamedSignatureDefinitionV125{
 const d=cloneInert(raw) as NamedSignatureDefinitionV125;
 if(!fields(d,['version','signatureId','careerId','originPlayerId','recognitionAtDay','definitionVersion','displayNameAtRecognition','coveredSources','coveredTraitFamilyIds','evidenceDigestRef','statusAtRecognition'])
  ||d.version!=='named_signature_definition_v125'||![d.signatureId,d.careerId,d.originPlayerId,d.definitionVersion,d.displayNameAtRecognition].every(id)
  ||!integer(d.recognitionAtDay)||!['ACTIVE_PLAYER','RETIRED_PLAYER'].includes(d.statusAtRecognition)||!reference(d.evidenceDigestRef)
  ||!Array.isArray(d.coveredTraitFamilyIds)||!d.coveredTraitFamilyIds.length||!d.coveredTraitFamilyIds.every(id)
  ||new Set(d.coveredTraitFamilyIds).size!==d.coveredTraitFamilyIds.length||!Array.isArray(d.coveredSources)||d.coveredSources.length<2
  ||d.coveredSources.some(s=>!fields(s,['sourceEffectIdentity','sourceRef'])||!id(s.sourceEffectIdentity)||!reference(s.sourceRef))
  ||new Set(d.coveredSources.map(s=>s.sourceEffectIdentity)).size!==d.coveredSources.length
  ||new Set(d.coveredSources.map(s=>refKey(s.sourceRef))).size!==d.coveredSources.length)throw Error('invalid frozen signature definition');
 return freeze(d);
}

/** Presentation only. Host authenticates recognition, frozen versions and
 * original Source pins first. This cannot recognize a player, grant a skill,
 * copy a founder's ability or produce a Match execution input. */
export function projectSignatureDisplayV125(raw:SignatureDisplayInputV125){
 const i=cloneInert(raw),s=i.scope;
 if(!fields(i,['scope','definitions','aliases','traits'])||!fields(s,['careerId','playerId','asOfDay'])||![s.careerId,s.playerId].every(id)||!integer(s.asOfDay)
  ||!Array.isArray(i.definitions)||!Array.isArray(i.aliases)||!Array.isArray(i.traits))throw Error('invalid signature display scope');
 const definitions=i.definitions.map(validateNamedSignatureDefinitionV125),definitionsById=new Map(definitions.map(d=>[signatureKey(d),d]));
 if(definitionsById.size!==definitions.length)throw Error('one fixed version per signature is required');
 const aliases=new Set<string>(),aliasTimes=new Set<string>();
 for(const a of i.aliases){
  if(!fields(a,['careerId','signatureId','aliasId','atDay','sequence','displayName','sourceRef'])||![a.careerId,a.signatureId,a.aliasId,a.displayName].every(id)
   ||!integer(a.atDay)||!integer(a.sequence)||!reference(a.sourceRef))throw Error('invalid signature alias');
  const d=definitionsById.get(signatureKey(a)),key=JSON.stringify([a.careerId,a.aliasId]),time=JSON.stringify([signatureKey(a),a.atDay,a.sequence]);
  if(!d||a.atDay<d.recognitionAtDay||aliases.has(key)||aliasTimes.has(time))throw Error('signature alias origin or event order differs');
  aliases.add(key);aliasTimes.add(time);
 }
 const ids=new Set<string>();
 for(const t of i.traits){if(!fields(t,['traitId','familyId','stateId','lifecycleClass','label','sourceEffectIdentity','sourceRef'])
  ||![t.traitId,t.familyId,t.stateId,t.lifecycleClass,t.label,t.sourceEffectIdentity].every(id)||!reference(t.sourceRef)||ids.has(t.traitId))throw Error('invalid original signature display trait');ids.add(t.traitId);}
 const used=new Set<string>(),groups=[];
 for(const d of definitions.filter(d=>d.careerId===s.careerId&&d.originPlayerId===s.playerId&&d.recognitionAtDay<=s.asOfDay)
  .sort((a,b)=>a.recognitionAtDay-b.recognitionAtDay||order(a.signatureId,b.signatureId))){
  const eligible=i.traits.filter(t=>d.coveredTraitFamilyIds.includes(t.familyId)&&d.coveredSources.some(c=>effectKey(c)===effectKey(t))),
   complete=d.coveredSources.every(c=>eligible.some(t=>effectKey(c)===effectKey(t))),
   components=complete?eligible.filter(t=>!used.has(t.traitId)):[];
  for(const t of components)used.add(t.traitId);
  const alias=i.aliases.filter(a=>signatureKey(a)===signatureKey(d)&&a.atDay<=s.asOfDay)
   .sort((a,b)=>b.atDay-a.atDay||b.sequence-a.sequence)[0];
  groups.push({signatureId:d.signatureId,originPlayerId:d.originPlayerId,displayName:alias?.displayName??d.displayNameAtRecognition,
   definition:d,currentExpression:complete?'ALL_SOURCE_REFS_PRESENT' as const:'SOURCE_REFS_CHANGED_OR_MISSING' as const,components});
 }
 return freeze({boundary:'SIGNATURE_DISPLAY_ONLY' as const,nativeAdmission:false as const,effectsApplied:false as const,
  scope:s,groups,visibleTraits:i.traits.filter(t=>!used.has(t.traitId)),originalTraits:i.traits});
}
