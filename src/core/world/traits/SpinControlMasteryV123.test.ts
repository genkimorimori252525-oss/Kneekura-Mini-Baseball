import {expect,it} from 'vitest';
import * as api from './SpinControlMasteryV123';
import {startPracticeDevelopmentLearningEpisode,appendDevelopmentLearningEvent} from '../development/DevelopmentLearningEpisode';
const kinds=['SLICE','HOOK','BACKSPIN','TOPSPIN'] as const;
const project=(input:unknown)=>{const f=(api as unknown as {projectSpinControlMasteryV123?:(v:unknown)=>any}).projectSpinControlMasteryV123;
 expect(f,'independent variant mastery projection').toBeTypeOf('function');return f!(input);};
function proof(kind:typeof kinds[number]){
 const prefix='test-'+kind,profile={careerId:'c',playerId:'p',createdAtDay:0,profileVersion:'synthetic'},
  policy={policyId:'learning',version:'1',availableAtDay:0,minimumPracticeEvents:2,minimumFeedbackEvents:1,minimumElapsedDays:2};
 let episode=startPracticeDevelopmentLearningEpisode(prefix,{careerId:'c',playerId:'p',occurredAtDay:1,sourceEventId:prefix+'-discovery',causeEventId:prefix+'-cause',motifId:'spin:'+kind},profile,policy);
 for(const [i,kind]of ['APPRAISAL_ENGAGED','HYPOTHESIS_FORMED','PRACTICE_RECORDED','PRACTICE_RECORDED','FEEDBACK_RECORDED','CONSOLIDATION_RECORDED'].entries()){
  const event={eventId:prefix+'-event-'+i,sourceEventId:prefix+'-source-'+i,atDay:1+i,
   kind:kind as any,...(kind==='APPRAISAL_ENGAGED'?{}:{domain:'TECHNICAL' as const})};
  episode=appendDevelopmentLearningEvent(episode,episode.revision,event);
 }
 return {technique:kind,sourceId:prefix,sourceVersion:'1',sourceEffectIdentity:prefix+'-underlying-skill',acceptedAtDay:7,episode,
  bundle:{policy:{policyId:'exposure',version:'1',availableAtDay:0,selfDirectedShare:0,minimumEffectiveExposure:1,minimumDistinctPracticeDays:2},
   prior:{careerId:'c',playerId:'p',atDay:1,domain:'TECHNICAL',receptivity:1,profileVersion:'trajectory',policyId:'prior',policyVersion:'1'},
   repetitions:episode.practiceSourceEventIds.map((sourceEventId,i)=>({sourceEventId,atDay:3+i,trainingStimulus:1,coachingFit:1,challengeFit:1,healthAvailability:1,fatigue:0,motivation:1,opportunity:1,novelty:1}))},
  distinctiveness:.95,repertoireRef:{sourceId:prefix+'-motor',sourceVersion:'1'},calibration:{sourceId:prefix+'-calibration',sourceVersion:'1',status:'MODEL_VERIFIED'}};
}
const input=(proofs:unknown[])=>({scope:{careerId:'c',playerId:'p'},atDay:10,policy:{policyId:'explicit-test-only',version:'1',availableAtDay:0,
 minimumEffectiveExposure:1,minimumDistinctPracticeDays:2,minimumDistinctiveness:.9},proofs});
it('projects no mastery, then one corresponding Blue, without treating variants as ordered tiers',()=>{
 expect(project(input([]))).toMatchObject({effectiveStateId:'NONE',masteredTechniqueSet:[],nativeAdmission:false});
 for(const kind of kinds){const p=project(input([proof(kind)]));expect(p.effectiveStateId).toBe('BLUE_'+kind);expect(p.masteredTechniqueSet).toEqual([kind]);}
});
it('SPIN-27/28/37/38 projects every independently qualified pair to one Gold and keeps only that repertoire',()=>{
 for(let a=0;a<kinds.length;a++)for(let b=a+1;b<kinds.length;b++){
  const proofs=[proof(kinds[a]),proof(kinds[b])],before=JSON.stringify(proofs),p=project(input(proofs));
  expect(p.effectiveStateId).toBe('GOLD');expect(p.masteredTechniqueSet).toEqual([kinds[a],kinds[b]]);
  expect(project(input([...proofs].reverse()))).toEqual(p);expect(JSON.stringify(proofs)).toBe(before);
  expect(p.boundary).toBe('SPIN_MASTERY_PROJECTION_ONLY');expect(p.nativeAdmission).toBe(false);
 }
 expect(project(input(kinds.map(proof))).masteredTechniqueSet).toEqual(kinds);
});
it('SPIN-35/39 excludes unverified, incomplete, future or aliased evidence while retaining independent genuine variants',()=>{
 const slice=proof('SLICE'),hook=proof('HOOK'),back=proof('BACKSPIN');
 expect(project(input([slice,{...hook,calibration:{...hook.calibration,status:'UNVERIFIED'}}])).effectiveStateId).toBe('BLUE_SLICE');
 expect(project(input([slice,{...hook,episode:{...hook.episode,stage:'PRACTICING'}}])).effectiveStateId).toBe('BLUE_SLICE');
 expect(project(input([slice,{...hook,acceptedAtDay:11}])).effectiveStateId).toBe('BLUE_SLICE');
 const aliased={...hook,sourceEffectIdentity:slice.sourceEffectIdentity},p=project(input([slice,aliased,back]));
 expect(p.masteredTechniqueSet).toEqual(['BACKSPIN']);expect(p.rejected).toHaveLength(2);
 expect(project(input([slice,{...hook,episode:slice.episode}])).effectiveStateId).toBe('NONE');
});
it('does not grant mastery from natural spin labels, Gold text or a missing opportunity',()=>{
 const slice=proof('SLICE'),noOpportunity={...slice,bundle:{...slice.bundle,repetitions:slice.bundle.repetitions.map(r=>({...r,opportunity:0}))}};
 expect(project(input([noOpportunity])).effectiveStateId).toBe('NONE');
 expect(()=>project({...input([]),gold:true})).toThrow();
 expect(project(input([{technique:'BACKSPIN',naturalSpinRpm:3000,gold:true}])).effectiveStateId).toBe('NONE');
});
