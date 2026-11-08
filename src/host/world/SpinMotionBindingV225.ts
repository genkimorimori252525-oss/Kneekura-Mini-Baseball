import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SPIN_TECHNIQUES_V123, type SpinTechniqueV123 } from '../../core/world/traits/SpinControlMasteryV123';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash, samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { DurableSpinMasteryV123 } from './SqliteSpinControlMasteryV123';
import type { readNativeStandaloneBattingMotorEvidenceV224 } from './SqliteStandalonePracticeStore';

type Evidence = ReturnType<typeof readNativeStandaloneBattingMotorEvidenceV224>;
export type SpinMotionEvidenceReferenceV225 = Readonly<{sourceEventId:string;sourceRef:Readonly<{sourceId:string;sourceVersion:string}>;acceptedEvidenceHash:string;physicalProofHash:string}>;
export type SpinMotionBindingSourceV225 = Readonly<{version:'spin_motion_binding_source_v225';sourceId:string;sourceVersion:string;
 careerId:string;playerId:string;personLinkSourceId:string;acceptedAtDay:number;technique:SpinTechniqueV123;
 masteryReference:SamePaReference<'world_spin_mastery_v123'>;evidenceReferences:readonly SpinMotionEvidenceReferenceV225[];
 ruleVersion:'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'}>;
const fail=(m:string):never=>{throw Error('spin motion binding v225: '+m)};
const same=(a:unknown,b:unknown)=>json(a)===json(b);
/** Source declares an original-drill description only. The rule enum itself is
 * not qualification authority, a physical boost, or a future-pitch license. */
export function validateSpinMotionBindingSourceV225(raw:unknown,id?:string):SpinMotionBindingSourceV225 {
 const s=cloneInert(raw) as SpinMotionBindingSourceV225;
 if(!fields(s,['version','sourceId','sourceVersion','careerId','playerId','personLinkSourceId','acceptedAtDay','technique','masteryReference','evidenceReferences','ruleVersion'])
  ||s.version!=='spin_motion_binding_source_v225'||![s.sourceId,s.sourceVersion,s.careerId,s.playerId,s.personLinkSourceId].every(samePaText)
  ||id!==undefined&&s.sourceId!==id||!Number.isSafeInteger(s.acceptedAtDay)||s.acceptedAtDay<0||!SPIN_TECHNIQUES_V123.includes(s.technique)
  ||!samePaReferenceValid(s.masteryReference,'world_spin_mastery_v123')||s.ruleVersion!=='ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1'
  ||!Array.isArray(s.evidenceReferences)||s.evidenceReferences.length!==3)fail('invalid Source');
 for(const e of s.evidenceReferences)if(!fields(e,['sourceEventId','sourceRef','acceptedEvidenceHash','physicalProofHash'])||!samePaText(e.sourceEventId)
  ||!fields(e.sourceRef,['sourceId','sourceVersion'])||![e.sourceRef.sourceId,e.sourceRef.sourceVersion].every(samePaText)
  ||!samePaHash(e.acceptedEvidenceHash)||!samePaHash(e.physicalProofHash))fail('invalid original evidence reference');
 if(new Set(s.evidenceReferences.map(e=>e.sourceEventId)).size!==3||new Set(s.evidenceReferences.map(e=>e.sourceRef.sourceId)).size!==3)fail('original evidence alias');
 return freeze(s);
}
/** Inputs must already come from the normal Native Mastery and V224 readers. */
export function deriveSpinMotionBindingV225(raw:SpinMotionBindingSourceV225,mastery:DurableSpinMasteryV123,evidence:readonly Evidence[]) {
 const source=validateSpinMotionBindingSourceV225(raw),m=mastery;
 if(!m||m.source.sourceId!==source.masteryReference.sourceId||hash(m.source)!==source.masteryReference.sourceHash||hash(m)!==source.masteryReference.snapshotHash
  ||m.source.careerId!==source.careerId||m.source.playerId!==source.playerId||m.source.personLinkSourceId!==source.personLinkSourceId
  ||m.source.technique!==source.technique||m.source.acceptedAtDay>source.acceptedAtDay||m.contacts.length!==3||evidence.length!==3)fail('mastery or scope differs');
 const observations=source.evidenceReferences.map(ref=>{
  const contacts=m.contacts.filter(c=>c.eventId===ref.sourceEventId),items=evidence.filter(e=>e.sourceEventId===ref.sourceEventId);
  if(contacts.length!==1||items.length!==1)fail('missing or duplicate original evidence');const c=contacts[0],e=items[0],s=e.source,command=s.command,release=e.plannedDelivery.release,p=command.plan,physics=command.parameters;
  if(e.acceptedEvidenceHash!==ref.acceptedEvidenceHash||e.physicalProofHash!==ref.physicalProofHash||c.proofHash!==ref.acceptedEvidenceHash
   ||!same(c.sourceRef,ref.sourceRef)||!same({sourceId:s.sourceId,sourceVersion:s.sourceVersion},ref.sourceRef)
   ||s.careerId!==source.careerId||s.playerId!==source.playerId||s.personLinkSourceId!==source.personLinkSourceId||s.episodeId!==m.projection.qualified[0].episodeId
   ||s.atDay>m.source.acceptedAtDay||e.model.source.personId!==m.person.personId||!same(e.model.source.repertoireRef,m.source.repertoireRef)
   ||command.spinIntentV123?.technique!==source.technique||!same({profileId:command.profileId,version:command.profileVersion},c.profileRef))fail('original qualification or evidence differs');
  // This named description corresponds only to the preserved simple original
  // drill: no gravity/drag, straight release, a plate at z=0 and R-box plan.
  // Values are not assigned by technique; the stored target is never changed.
  if(e.implementationFamily!=='COURSE_AWARE_V1'||p.handedness!=='R'||physics.ticksPerSecond!==s.ticksPerSecond||s.ticksPerSecond!==1_000_000
   ||physics.gravityY!==0||physics.aerodynamics.airDensityKgM3!==0||physics.aerodynamics.dragCoefficient!==0
   ||release.velocity.x!==0||release.velocity.y!==0||release.velocity.z>=0||p.targetBallCenterAtPlate.z!==0
   ||p.targetBallCenterAtPlate.x!==release.position.x||Object.hasOwn(p,'targetBallCenterAtContact')||command.issuedTick>release.releaseAtUs)fail('original drill outside declared rule');
  const neutralAnchor={x:release.position.x,y:release.position.y,z:0};
  return {sourceEventId:ref.sourceEventId,sourceRef:ref.sourceRef,acceptedEvidenceHash:ref.acceptedEvidenceHash,physicalProofHash:ref.physicalProofHash,
   originalSource:s,model:e.model,plannedDelivery:e.plannedDelivery,consumedRelease:e.consumedRelease,implementationFamily:e.implementationFamily,
   originalContact:e.contact,originalBall:e.ball,neutralAnchor,absoluteTarget:p.targetBallCenterAtPlate,
   targetAnchorOperation:'EXACT_TARGET_ANCHOR_PAIR_NO_TRANSFER' as const};
 });
 if(new Set(observations.map(o=>json({model:o.model.source,repertoire:o.model.repertoire,equipment:o.model.equipment,profile:o.originalSource.command.profileId,
  profileVersion:o.originalSource.command.profileVersion,implementation:o.implementationFamily}))).size!==1)fail('original motor/model group differs');
 return freeze({version:'spin_motion_binding_snapshot_v225' as const,source,scope:'ORIGINAL_PRACTICE_DESCRIPTION_ONLY' as const,
  originalQualificationNativeRead:true as const,ruleAuthority:'DESCRIPTION_ONLY_NOT_QUALIFICATION' as const,observations,futureTransferProven:false as const});
}
export type DurableSpinMotionBindingV225 = ReturnType<typeof deriveSpinMotionBindingV225>;
