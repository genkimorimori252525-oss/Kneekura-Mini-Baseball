import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { SamePaPhysicalCommitment, SamePaPhysicalResolution } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
export type RetainedSpinTrialV227=Readonly<{resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>;
 commitmentReference:SamePaReference<'pa_physical_v1_commitments'>;resolution:SamePaPhysicalResolution;commitment:SamePaPhysicalCommitment}>;
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;
const same=(a:unknown,b:unknown,label:string)=>{if(!isDeepStrictEqual(a,b))throw Error('V227 retained '+label+' differs')};
/** The comparison is evidence preservation, not a new acceptance or trial. */
export function assertRetainedSpinTrialV227(evidence:Evidence,retained:RetainedSpinTrialV227) {
 same(evidence.resolutionReference,retained.resolutionReference,'resolution fullref');same(evidence.commitmentReference,retained.commitmentReference,'commitment fullref');
 same(evidence.contact,retained.resolution.contact,'contact');same(evidence.trialEvidence,retained.commitment.trialEvidenceV226,'trial evidence');
 if(retained.commitment.calculation.algorithm!=='batting-observed-spin-aim-trial-v226')throw Error('V227 retained calculation is not an explicit trial');
 same(evidence.motorTrace,retained.commitment.calculation.observedSpinAimTrialV226,'motor trace');
 if(evidence.qualifiedTransferProven!==false||evidence.earnedQualification!==false)throw Error('V227 trial must not imply qualification');
 return true;
}
export function inspectRetainedSpinTrialV227(db:DatabaseSync,retained:RetainedSpinTrialV227) {
 const evidence=readNativeSpinTrialMotorEvidenceV227(db,retained.resolutionReference);assertRetainedSpinTrialV227(evidence,retained);
 return {evidence,summary:{boundary:'NATIVE_SPIN_TRIAL_MOTOR_EVIDENCE_READONLY_V227' as const,normalReaderReauthenticated:true,
  hasActualContact:evidence.hasActualContact,independencePolicy:evidence.independenceKey.policy,qualifiedTransferProven:false as const,
  earnedQualification:false as const,newNativeWrites:0,newPractice:0,newContact:0,performancePass:false as const}};
}
