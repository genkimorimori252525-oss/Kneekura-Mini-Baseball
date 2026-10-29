import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { recoverNativeSpinNeutralV193AcceptedContact } from './NativeSpinNeutralV193-recover';
import { readNativeStandaloneBattingContactV123 } from '../../src/host/world/SqliteStandalonePracticeStore';
import { readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { readSamePaBattingExecutionInputFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { calculateBattingSpinExecutionV123 } from '../../src/core/world/psychology/batting/BattingCommitment';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type Recovery = ReturnType<typeof recoverNativeSpinNeutralV193AcceptedContact>;
type Records = Recovery['records'];
export type SpinMotionGateInputV223 = Parameters<typeof recoverNativeSpinNeutralV193AcceptedContact>[1];
/** Compares only real retained inputs and authenticated qualification context.
 * TOP is a pure counterfactual: it is not an accepted Native operation. */
export function compareRetainedSpinMotorV223(records: Records) {
 const actual=records.commitment.calculation;assert.equal(actual.algorithm,'batting-spin-execution-calculation-v123');
 if(actual.algorithm!=='batting-spin-execution-calculation-v123')throw Error('spin calculation unavailable');
 assert.equal(actual.spinContext.intent.technique,'NO_SPIN_TARGET','original neutral intent differs');
 const common={nominalRequest:records.input.nominalRequest,effectiveValues:records.input.effectiveValues};
 const neutralResult=calculateBattingSpinExecutionV123({...common,spinContext:actual.spinContext});
 const topResult=calculateBattingSpinExecutionV123({...common,spinContext:{...actual.spinContext,intent:{...actual.spinContext.intent,technique:'TOPSPIN'}}});
 assert(neutralResult.ok,'retained neutral pure calculation failed');assert(topResult.ok,'retained TOP pure counterfactual failed');
 if(!neutralResult.ok||!topResult.ok)throw Error('pure motor calculation failed');
 const neutral=neutralResult.value,top=topResult.value;assert.deepStrictEqual(neutral,actual,'original neutral calculation differs');
 const neutralPlan=neutral.spinMotorPlanV123,topPlan=top.spinMotorPlanV123;assert(neutralPlan&&topPlan,'motor plan not available');
 const planMotionEqual=isDeepStrictEqual(neutralPlan.plan,topPlan.plan),commitmentEqual=isDeepStrictEqual(neutral.commitment,top.commitment);
 const motorOutcome=topPlan.selectedIntent!=='TOPSPIN'?'TOP_NOT_SELECTED':planMotionEqual&&commitmentEqual?'NO_MOTOR_DISTINCTION':'MOTOR_DISTINGUISHED';
 return {neutral,top,planMotionEqual,commitmentEqual,motorOutcome,qualificationComparison:isDeepStrictEqual(neutralPlan.selectedQualificationRef,topPlan.selectedQualificationRef)?'SAME':'DISTINCT',
  originalMotionEvidence:'MOTION_EVIDENCE_NOT_EXPOSED' as const,nativeTopAdmissionProven:false as const,performancePass:false as const};
}
/** Read-only reauthentication on a caller-owned transaction; no Writer or Native acceptance. */
export function inspectNativeSpinMotionBindingV223(db:DatabaseSync,pins:SpinMotionGateInputV223) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,pins.actorReference.sourceId);assert(actor,'actor missing');
  const qualifications=pins.qualificationReferences.map(ref=>{const q=readNativeSpinControlMasteryV123(db,ref.sourceId);assert(q,'qualification missing');return q});
  assert.deepStrictEqual(qualifications.map(q=>q.source.technique),['BACKSPIN','TOPSPIN']);
  const events=qualifications.flatMap(q=>q.contacts.map(c=>({q,c})));assert.equal(events.length,6);assert.equal(new Set(events.map(x=>x.c.eventId)).size,6);
  const contacts=events.map(({q,c})=>{const read=readNativeStandaloneBattingContactV123(db,c.eventId);
   assert.equal(read.careerId,actor.binding.careerId);assert.equal(read.playerId,actor.binding.playerId);assert.equal(read.personLinkSourceId,actor.person.sourceId);
   assert.equal(read.spinIntentV123?.technique,q.source.technique);assert.deepStrictEqual(read.profileRef,c.profileRef);
   assert.equal(read.proofHash,c.proofHash);assert.deepStrictEqual(read.sourceRef,c.sourceRef);assert.deepStrictEqual(read.observation,c.observation);
   assert.deepStrictEqual(read.repertoireRef,q.source.repertoireRef);return read});
  const input=readSamePaBattingExecutionInputFromSqlite(db,pins.inputReference);assert.deepStrictEqual(input,pins.originalInput);
  const recovered=recoverNativeSpinNeutralV193AcceptedContact(db,pins,()=>{});assert.deepStrictEqual(recovered.records.actor,actor);
  assert.deepStrictEqual(recovered.records.qualifications,qualifications);assert.deepStrictEqual(recovered.records.input,input);
  const comparison=compareRetainedSpinMotorV223(recovered.records);
  return {boundary:'NATIVE_READONLY_SPIN_MOTOR_BINDING_GATE_V223' as const,actor,qualifications,contacts,input,comparison,
   summary:{status:comparison.motorOutcome==='MOTOR_DISTINGUISHED'?'AVAILABLE' as const:'UNAVAILABLE' as const,
    reason:comparison.motorOutcome,originalMotionEvidence:comparison.originalMotionEvidence,qualifications:2,actualRetainedContacts:6,
    nativeTopAdmissionProven:false as const,newNativeWrites:0,regeneratedContacts:0,performancePass:false as const}};
 }));
}
