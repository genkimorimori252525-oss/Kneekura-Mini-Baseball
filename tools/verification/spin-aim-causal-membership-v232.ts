import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { inspectHistoricalSpinAimPrecommitV231 } from './spin-aim-precommit-domain-v231';
import { inspectNativeSpinTrialCohortV228 } from './native-spin-trial-cohort-v228';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readPhysicalCommitmentWorldMembershipV232 } from '../../src/host/world/PhysicalCommitmentWorldMembershipV232';
import { readNativeSpinAimQualificationV230 } from '../../src/host/world/SqliteSpinAimQualificationV230';
import type { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;
type Cohort=ReturnType<typeof inspectNativeSpinTrialCohortV228>;
type Historical=ReturnType<typeof inspectHistoricalSpinAimPrecommitV231>;
type Qualification=NonNullable<ReturnType<typeof readNativeSpinAimQualificationV230>>;
/** Reauthenticate only the retained historical single-trial evidence. */
export function inspectCausalSpinAimMembershipV232(db:DatabaseSync,evidence:Evidence,cohort:Cohort,historical:Historical,storedQualification:Qualification) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
 const c=cohort.inventory,membership=readPhysicalCommitmentWorldMembershipV232(db,{careerId:cohort.subject.careerId,endWorldRevision:c.closedWorldRevision,expectedWorldPrefixHash:c.closedWorldPrefixHash,expectedWorldEventHash:c.closedWorldEventHash});
 const matches=membership.commitments.filter(v=>v.reference.sourceId===evidence.commitmentReference.sourceId);assert.equal(matches.length,1);assert.deepStrictEqual(matches[0].reference,evidence.commitmentReference);
 const resolutions=membership.resolutionCandidates.filter(v=>v.commitmentReference.sourceId===evidence.commitmentReference.sourceId);assert.equal(resolutions.length,1);
 assert.deepStrictEqual(resolutions[0].commitmentReference,evidence.commitmentReference);assert.deepStrictEqual(resolutions[0].reference,evidence.resolutionReference);
 // The historical reader itself reauthenticates and compares the entire cohort.
 const observed=inspectHistoricalSpinAimPrecommitV231(db,evidence,cohort,storedQualification.snapshot!.source.sourceId);assert.deepStrictEqual(observed,historical);
 const qualification=readNativeSpinAimQualificationV230(db,storedQualification.snapshot!.source.sourceId);assert.deepStrictEqual(qualification,storedQualification);
 assert.equal(qualification?.applicable,false);assert.equal(qualification?.currentEvaluation.status,'INELIGIBLE');assert.equal(qualification?.currentEvaluation.reason,'INSUFFICIENT_TRIALS');
 return {membership,cohort,historical:observed,qualification,summary:{boundary:'V232_HISTORICAL_SINGLE_TRIAL_READONLY',worldMembershipReauthenticated:true,normalCensusExact:true,prePostDomainExact:true,storedDiagnosticExact:true,actualTrialCount:1,qualificationApplicable:false,currentDecisionAccepted:false,newContact:0,newPractice:0,newWrites:0,futureQualifiedTrialProven:false}};
 }));
}
