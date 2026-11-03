import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { inspectNativeSpinMotionBindingV223, type SpinMotionGateInputV223 } from './native-spin-motion-binding-gate-v223';
import { readNativeStandaloneBattingMotorEvidenceV224 } from '../../src/host/world/SqliteStandalonePracticeStore';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type RetainedV223 = ReturnType<typeof inspectNativeSpinMotionBindingV223>;
type EvidenceV224 = ReturnType<typeof readNativeStandaloneBattingMotorEvidenceV224>;
/** Validate joins against already-authenticated Native Owner results, without
 * inferring a relative aim from actual contact or labeling a new qualification. */
export function matchOriginalMotorEvidenceV224(retained:RetainedV223,evidence:readonly EvidenceV224[]) {
 const expected=retained.qualifications.flatMap(q=>q.contacts.map(c=>({q,c})));
 assert.equal(expected.length,6);assert.equal(evidence.length,6);assert.equal(new Set(evidence.map(e=>e.sourceEventId)).size,6);
 for(const {q,c} of expected){
  const matches=evidence.filter(e=>e.sourceEventId===c.eventId);assert.equal(matches.length,1,'original event missing or duplicate');
  const e=matches[0],s=e.source,command=s.command;assert.equal(command.kind,'BATTING_CONTACT');
  if(command.kind!=='BATTING_CONTACT')throw Error('wrong original practice family');
  assert.equal(e.acceptedEvidenceHash,c.proofHash,'original accepted proof differs');assert.deepStrictEqual({sourceId:s.sourceId,sourceVersion:s.sourceVersion},c.sourceRef);
  assert.equal(s.careerId,q.source.careerId);assert.equal(s.playerId,q.source.playerId);assert.equal(s.personLinkSourceId,q.source.personLinkSourceId);
  assert.equal(e.model.source.personId,q.person.personId);assert(s.atDay<=q.source.acceptedAtDay,'practice after qualification');
  assert.deepStrictEqual(e.model.source.repertoireRef,q.source.repertoireRef);assert.equal(command.spinIntentV123?.technique,q.source.technique);
  assert.deepStrictEqual({profileId:command.profileId,version:command.profileVersion},c.profileRef);assert.deepStrictEqual(e.contact,retained.contacts.find(x=>x.event.sourceEventId===c.eventId)?.contact);
 }
 return {matched:true as const,qualifications:2,retainedOriginalContacts:6,relativeTransferProven:false as const,originalPracticeOnly:true as const};
}
export function inspectNativeMotorEvidenceV224(db:DatabaseSync,pins:SpinMotionGateInputV223) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  const retained=inspectNativeSpinMotionBindingV223(db,pins), evidence=retained.qualifications.flatMap(q=>q.contacts.map(c=>readNativeStandaloneBattingMotorEvidenceV224(db,c.eventId))),
   matched=matchOriginalMotorEvidenceV224(retained,evidence);
  const summary={...matched,implementationFamilies:evidence.map(e=>e.implementationFamily),
   retainedPlanContactTargetPresent:evidence.map(e=>Object.hasOwn(e.source.command.plan,'targetBallCenterAtContact')),
   originalPlannedReleaseAndConsumedProofPresent:evidence.every(e=>!!e.plannedDelivery.release&&!!e.consumedRelease),
   relativeAnchorDerivation:'NOT_ESTABLISHED_FROM_PERSISTED_COMMAND' as const,futurePitchBindingProven:false as const,
   newNativeWrites:0,regeneratedContacts:0,performancePass:false as const};
  return {boundary:'NATIVE_ORIGINAL_PRACTICE_MOTOR_EVIDENCE_V224' as const,retained,evidence,summary};
 }));
}
