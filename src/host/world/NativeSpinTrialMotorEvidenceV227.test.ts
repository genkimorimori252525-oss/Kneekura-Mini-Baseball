import { expect, it } from 'vitest';
import { describeSpinTrialContactV227, spinTrialIndependenceKeyV227 } from './NativeSpinTrialMotorEvidenceV227';
const hash='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:hash,snapshotHash:hash});
it('V227-P01 preserves a no-contact trial as a failure record (synthetic stub)',()=>{
 expect(describeSpinTrialContactV227(null,'R')).toEqual({hasActualContact:false,contact:null,exitVelocity:null,exitSpin:null,spinObservation:null});
});
it('V227-P02 keys repetition by person and physical pitch, regardless of input or resolution',()=>{
 const pitch=ref('pa_physical_v1_launches','pitch'),input={careerId:'c',playerId:'p',personId:'person',physicalPitchReference:pitch},
  one={...input,inputReference:ref('batting_execution_v1_inputs','one')},two={...input,inputReference:ref('batting_execution_v1_inputs','two')};
 const key=(v:typeof one)=>spinTrialIndependenceKeyV227({careerId:v.careerId,playerId:v.playerId,personId:v.personId,physicalPitchReference:v.physicalPitchReference});
 expect(key(one)).toEqual(key(two));expect(key(one)).toEqual({policy:'ONE_PER_PHYSICAL_PITCH',careerId:'c',playerId:'p',personId:'person',physicalPitchOwner:'pa_physical_v1_launches',physicalPitchSourceId:'pitch'});
 const conflicting={...one,physicalPitchReference:{...pitch,sourceHash:'b'.repeat(64)}};expect(key(conflicting)).toEqual(key(one));expect(conflicting.physicalPitchReference).not.toEqual(one.physicalPitchReference);
 expect(()=>spinTrialIndependenceKeyV227({...input,physicalPitchReference:ref('other','pitch')} as never)).toThrow();
});
import { afterEach, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import * as physical from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import * as inputReader from './SqliteBattingExecutionInputStore';
import * as venue from './SqliteBattedVenueLegalPolicyStore';
import * as lifecycle from './SamePlateAppearanceLifecycleFromSqlite';
import { readNativeSpinTrialMotorEvidenceV227 } from './NativeSpinTrialMotorEvidenceV227';
afterEach(()=>vi.restoreAllMocks());
it('V227-P03 rejects nontrial and foreign actor/ball/input; preserves a no-contact trial (stub only)',()=>{
 const resolutionRef=ref('pa_physical_v1_resolutions','r'),commitRef=ref('pa_physical_v1_commitments','c'),pitchRef=ref('pa_physical_v1_launches','p'),inputRef=ref('batting_execution_v1_inputs','i'),
  actor={binding:{careerId:'career',playerId:'player',personId:'person'}},lineage={id:'lineage'},bindingRef=ref('world_spin_motion_bindings_v225','binding'),assessmentRef=ref('batting_score_v1_assessments','assessment'),
  inputSource={capability:'owned_in_flight_same_pa_batting_execution_input_v1'},nominalRequest={source:{handedness:'R'}},effectiveValues={x:1},
  trial={bindingReference:bindingRef,assessmentReference:assessmentRef,originalEvidenceEventId:'event'},evidence={authority:'EXPLICIT_UNCALIBRATED_CONTROL',qualifiedTransferProven:false,
   bindingReference:bindingRef,masteryReference:ref('world_spin_mastery_v123','mastery'),assessmentReference:assessmentRef,predictionReference:ref('batting_prediction_v1_predictions','pred'),
   deliveryReference:ref('batting_observation_v1_deliveries','delivery'),observationReference:ref('batting_observation_v1_observations','capture'),originalEvidenceEventId:'event'},
  commitment={kind:'same_pa_physical_commitment_v1',source:{capability:'same_pa_physical_observed_spin_aim_trial_v226',inputReference:inputRef,trial},
   lineage,inputSource,trialEvidenceV226:evidence,calculation:{algorithm:'batting-observed-spin-aim-trial-v226',nominalRequest,effectiveValues,observedSpinAimTrialV226:null}},
  resolution={kind:'same_pa_physical_resolution_v1',source:{commitmentReference:commitRef},contact:null},
  proof={actor,lineage,physicalPitchReference:pitchRef,record:resolution},commitProof={actor,lineage,physicalPitchReference:pitchRef,record:commitment},
  originalInput={source:inputSource,lineage,physicalPitchReference:pitchRef,nominalRequest,effectiveValues};
 vi.spyOn(venue,'withBattedVenueLegalReadSnapshot').mockImplementation((_db,body)=>body());vi.spyOn(lifecycle,'withSamePaLifecycleReadPhase').mockImplementation((_db,body)=>body());
 vi.spyOn(physical,'readSamePaPhysicalOperationFromSqlite').mockImplementation((_db,r)=>r.owner==='pa_physical_v1_resolutions'?proof as never:commitProof as never);
 vi.spyOn(inputReader,'readSamePaBattingExecutionInputFromSqlite').mockReturnValue(originalInput as never);
 const db={} as DatabaseSync,result=readNativeSpinTrialMotorEvidenceV227(db,resolutionRef);
 expect(result.hasActualContact).toBe(false);expect(result.contact).toBeNull();expect(result.spinObservation).toBeNull();expect(result.earnedQualification).toBe(false);
 expect(Object.isFrozen(result)).toBe(true);expect(result.identityConflictPolicy).toBe('SAME_PITCH_ID_DIFFERENT_FULLREF_IS_CONFLICT');
 commitment.source.capability='same_pa_physical_commitment_v123';expect(()=>readNativeSpinTrialMotorEvidenceV227(db,resolutionRef)).toThrow(/not an explicit trial/);commitment.source.capability='same_pa_physical_observed_spin_aim_trial_v226';
 commitProof.actor={binding:{careerId:'career',playerId:'other',personId:'person'}};expect(()=>readNativeSpinTrialMotorEvidenceV227(db,resolutionRef)).toThrow(/actor/);commitProof.actor=actor;
 commitProof.physicalPitchReference=ref('pa_physical_v1_launches','other');expect(()=>readNativeSpinTrialMotorEvidenceV227(db,resolutionRef)).toThrow(/physical pitch/);commitProof.physicalPitchReference=pitchRef;
 originalInput.source={capability:'owned_other'};expect(()=>readNativeSpinTrialMotorEvidenceV227(db,resolutionRef)).toThrow(/input owner/);originalInput.source=inputSource;
 commitment.trialEvidenceV226.bindingReference={...bindingRef,sourceHash:'0'.repeat(64)};expect(()=>readNativeSpinTrialMotorEvidenceV227(db,resolutionRef)).toThrow(/binding reference/);
 expect(()=>readNativeSpinTrialMotorEvidenceV227(db,{...resolutionRef,sourceHash:'bad'})).toThrow(/invalid resolution fullref/);
});
