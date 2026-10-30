import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { inspectHistoricalSpinAimPrecommitV231 } from './spin-aim-precommit-domain-v231';
import { readSamePaPhysicalOperationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readNativeSpinAimQualificationHeaderV233,readNativeSpinAimQualificationV230,spinAimQualificationReferenceV230 } from '../../src/host/world/SqliteSpinAimQualificationV230';
import { assertQualificationDependencyRankV232 } from '../../src/host/world/PhysicalCommitmentWorldMembershipV232';
import { selectQualifiedSpinAimCandidateV233 } from '../../src/host/world/SamePaQualifiedSpinAimV233';
import { calculateBattingExecution } from '../../src/core/world/psychology/batting/BattingCommitment';
import type { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
import type { inspectNativeSpinTrialCohortV228 } from './native-spin-trial-cohort-v228';
import type { readNativeSpinAimQualificationV230 as qualificationReader } from '../../src/host/world/SqliteSpinAimQualificationV230';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;type Cohort=ReturnType<typeof inspectNativeSpinTrialCohortV228>;
type Historical=ReturnType<typeof inspectHistoricalSpinAimPrecommitV231>;type Qualification=NonNullable<ReturnType<typeof qualificationReader>>;
/** Historical diagnostic only: the saved trial cannot consume its own future qualification. */
export function inspectQualifiedFallbackV233(db:DatabaseSync,evidence:Evidence,cohort:Cohort,historical:Historical,stored:Qualification,baselineCalculation:typeof calculateBattingExecution){
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  assert(stored.snapshot);const q=readNativeSpinAimQualificationV230(db,stored.snapshot.source.sourceId);assert.deepStrictEqual(q,stored);assert(q?.snapshotReauthenticated&&!q.applicable);
  const reference=spinAimQualificationReferenceV230(q),header=readNativeSpinAimQualificationHeaderV233(db,reference);
  const proof=readSamePaPhysicalOperationFromSqlite(db,evidence.commitmentReference),record=proof.record;
  if(record.kind!=='same_pa_physical_commitment_v1'||record.source.capability!=='same_pa_physical_observed_spin_aim_trial_v226')throw Error('V233 retained trial commitment differs');
  const before=record.beforeWorldRevision;assert(header.endWorldRevision>before);assert.throws(()=>assertQualificationDependencyRankV232(header.endWorldRevision,before,before+1),/membership differs/);
  const checked=inspectHistoricalSpinAimPrecommitV231(db,evidence,cohort,stored.snapshot.source.sourceId);assert.deepStrictEqual(checked,historical);
  const trial=record.source.trial,candidate={qualificationReference:reference,originalEvidenceEventId:trial.originalEvidenceEventId,assessmentReference:trial.assessmentReference,transform:trial.transform,coordinateSystem:trial.coordinateSystem};
  const selection=selectQualifiedSpinAimCandidateV233(candidate,q,{careerId:proof.actor.binding.careerId,playerId:proof.actor.binding.playerId,personId:proof.actor.binding.personId},checked.before.domain);
  assert.equal(selection.kind,'NORMAL_FALLBACK');assert.equal(selection.reason,'NOT_APPLICABLE');
  const bad={...reference,snapshotHash:'0'.repeat(64)};assert.throws(()=>readNativeSpinAimQualificationHeaderV233(db,bad),/fullref differs/);
  const input=readSamePaBattingExecutionInputFromSqlite(db,record.source.inputReference),args={nominalRequest:input.nominalRequest,effectiveValues:input.effectiveValues},legacy=calculateBattingExecution(args),baseline=baselineCalculation(args);
  assert.deepStrictEqual(legacy,baseline);if(!legacy.ok)throw Error('V233 historical normal fallback unavailable');
  return {header,beforeWorldRevision:before,selection,legacy,historical:checked.historical,summary:{boundary:'V233_HISTORICAL_INSUFFICIENT_FALLBACK_READONLY',qualificationStatus:'INELIGIBLE',selection:'NORMAL_FALLBACK',reason:'NOT_APPLICABLE',historicalCausalRank:'REJECT_FUTURE',headerCorruptionRejected:true,legacyFullCalculationExact:true,currentDecisionAccepted:false,newQualifiedCommitment:0,newWrites:0,newPractice:0,newContact:0,positiveQualificationProven:false}};
 }));
}
