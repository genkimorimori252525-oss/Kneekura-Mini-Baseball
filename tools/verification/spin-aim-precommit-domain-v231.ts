import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { inspectNativeSpinTrialCohortV228 } from './native-spin-trial-cohort-v228';
import { readObservedSpinAimDomainBeforeCommitmentV231 } from '../../src/host/world/SpinAimObservedDomainConditionsV231';
import { readNativeSpinTrialDomainV228 } from '../../src/host/world/NativeSpinTrialCohortInventoryV228';
import { readNativeSpinAimQualificationV230 } from '../../src/host/world/SqliteSpinAimQualificationV230';
import { readSamePaPhysicalOperationFromSqlite, readHistoricalSamePaInFlightCutFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readHistoricalSamePaLifecycleViewFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import type { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;
type Prior=ReturnType<typeof inspectNativeSpinTrialCohortV228>;
/** Historical reconstruction of the already accepted trial input, not a new decision. */
export function inspectHistoricalSpinAimPrecommitV231(db:DatabaseSync,retained:Evidence,previous:Prior,qualificationId:string){
 const prior=inspectNativeSpinTrialCohortV228(db,retained.resolutionReference,retained);assert.deepStrictEqual(prior,previous);
 const qualification=readNativeSpinAimQualificationV230(db,qualificationId);assert(qualification?.snapshotReauthenticated);assert.equal(qualification.applicable,false);
 assert.equal(qualification.currentEvaluation.status,'INELIGIBLE');assert.equal(qualification.currentEvaluation.reason,'INSUFFICIENT_TRIALS');
 const commitmentProof=readSamePaPhysicalOperationFromSqlite(db,retained.commitmentReference),commitment=commitmentProof.record;
 if(commitment.kind!=='same_pa_physical_commitment_v1'||commitment.source.capability!=='same_pa_physical_observed_spin_aim_trial_v226')throw Error('V231 historical trial commitment missing');
 const source=commitment.source,cut=readHistoricalSamePaInFlightCutFromSqlite(db,source.previousOperationReference),view=readHistoricalSamePaLifecycleViewFromSqlite(db,source.viewReference),input=readSamePaBattingExecutionInputFromSqlite(db,source.inputReference);
 assert.deepStrictEqual(cut.physicalPitchReference,source.launchReference);assert.deepStrictEqual(input.physicalPitchReference,source.launchReference);assert.deepStrictEqual(input.source.viewReference,source.viewReference);
 assert.deepStrictEqual(cut.actor,commitmentProof.actor);assert.deepStrictEqual(input.source.intentReference,source.intentReference);
 const basis={actor:cut.actor,modelReference:cut.action.source.batterModelReference,input,decisionTick:view.view.cut.evaluationTick,actualFlightParameters:cut.action.source.actualFlightParameters};
 const before=readObservedSpinAimDomainBeforeCommitmentV231(db,source.trial,basis),after=readNativeSpinTrialDomainV228(db,retained.resolutionReference);
 assert.deepStrictEqual(before,after);assert.deepStrictEqual(before.domain,prior.domain);assert.deepStrictEqual(before.provenance,prior.provenance);
 assert.equal(view.view.cut.evaluationTick,commitment.evaluationTick);assert.equal(prior.inventory.members.length,1);
 return {before,after,historical:{inputReference:source.inputReference,viewReference:source.viewReference,previousOperationReference:source.previousOperationReference,physicalPitchReference:source.launchReference,decisionTick:basis.decisionTick},
  summary:{boundary:'HISTORICAL_PRECOMMIT_V231_READONLY',prePostDomainAndProvenanceExact:true,normalOwnersReauthenticated:true,currentDecisionAccepted:false,actualTrialCount:1,qualificationApplicable:false,newContact:0,newPractice:0,newWrites:0}};
}
