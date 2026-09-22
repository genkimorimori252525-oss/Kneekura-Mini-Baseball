import type { TraitEntry,TraitResult,TraitEvaluationResult,TraitReceipt } from './TraitTypes';
import { readState } from './TraitState';
import { advanceGreen } from './GreenPreference';
import { attempt,readEvaluation,fail,same,timeAfter,family,qualifiesMastery,order } from './TraitValidation';
export const evaluateTrait=(stateInput:unknown,input:unknown):TraitResult<TraitEvaluationResult>=>attempt(()=>{
  const s=readState(stateInput),e=readEvaluation(input,'evaluation'),f=family(e.familyId,'evaluation.familyId');
  if(!same(s.scope,e.scope))fail('SCOPE_MISMATCH','evaluation.scope');
  if(e.policyRef.policyId!==s.policy.policyId||e.policyRef.version!==s.policy.version)fail('POLICY_MISMATCH','evaluation.policyRef');
  if(e.expectedRevision!==s.revision)fail('STALE_REVISION','evaluation.expectedRevision');
  if(s.revision===Number.MAX_SAFE_INTEGER)fail('OVERFLOW','state.revision');
  if(s.time&&!timeAfter(e.time,s.time))fail('BACKDATED_EVALUATION','evaluation.time');
  for(const x of s.entries)for(const known of [x.lastEvaluation,x.masteryProof,x.preferenceProof?.evaluation])if(known){
    if(known.evaluationId===e.evaluationId||(known.familyId===e.familyId&&known.source.episodeId===e.source.episodeId))
      fail('DUPLICATE_EVIDENCE','evaluation.source');
  }
  const old=s.entries.find(x=>x.familyId===e.familyId),before=old?.effectiveStateId??f.neutralStateId;
  if(old){const a=old.lastEvaluation.source,b=e.source;
    if(b.evidenceRevision<=a.evidenceRevision||b.episodeId===a.episodeId)fail('DUPLICATE_EVIDENCE','evaluation.source');
    const sameSource=b.sourceRevision===a.sourceRevision&&b.sourceSnapshotId===a.sourceSnapshotId;
    if(a.sourceKey!==b.sourceKey||b.sourceRevision<a.sourceRevision
      ||(b.changeKind==='RECOGNITION'&&!sameSource)||(b.changeKind!=='RECOGNITION'&&(b.sourceRevision<=a.sourceRevision||b.sourceSnapshotId===a.sourceSnapshotId)))
      fail('SOURCE_CONFLICT','evaluation.source');
  }
  let entry:TraitEntry={familyId:f.familyId,effectiveStateId:before,lastEvaluation:e,masteryProof:old?.masteryProof??null,
    pending:old?.pending??null,preferenceProof:old?.preferenceProof??null,changesThisSeason:s.time?.season===e.time.season?(old?.changesThisSeason??0):0};
  const a=e.assessment;
  if(a.kind==='CURRENT_SOURCE')entry={...entry,effectiveStateId:a.stateId};
  else if(a.kind==='LEARNED_TECHNIQUE'){
    if(qualifiesMastery(e,s.policy)&&f.stateIds.indexOf(a.stateId!)>f.stateIds.indexOf(before!)){
      if(s.entries.some(x=>x.familyId!==f.familyId&&x.masteryProof?.source.sourceKey===e.source.sourceKey))fail('DUPLICATE_SOURCE_MASTERY','evaluation.source.sourceKey');
      entry={...entry,effectiveStateId:a.stateId,masteryProof:e};
    }
  }else {
    const p=s.policy.green.find(x=>x.familyId===e.familyId);
    if(!p)fail('MISSING_FAMILY_POLICY',e.familyId);
    entry=advanceGreen(entry,p);
  }
  const after=entry.effectiveStateId;
  const transition:TraitReceipt['transition']=after===before
    ?a.kind==='LEARNED_TECHNIQUE'&&before!==null&&a.stateId!==before?'MASTERY_RETAINED':'UNCHANGED'
    :before===null?'ACQUIRED':after===null?'REMOVED':'CHANGED';
  const entries=s.entries.filter(x=>x.familyId!==e.familyId).map(x=>s.time?.season===e.time.season?x:{...x,changesThisSeason:0});
  entries.push(entry);entries.sort((a,b)=>order(a.familyId,b.familyId));
  return{state:{...s,revision:s.revision+1,time:e.time,entries},receipt:{type:'TRAIT_EVALUATION_ACCEPTED',beforeRevision:s.revision,afterRevision:s.revision+1,
    evaluation:e,beforeStateId:before,afterStateId:after,transition,diagnostics:after!==before&&entry.changesThisSeason>=5?['GREEN_CHURN_CALIBRATION']:[]}};
});
