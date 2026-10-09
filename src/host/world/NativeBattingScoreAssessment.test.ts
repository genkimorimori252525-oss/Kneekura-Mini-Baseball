import {expect,it} from 'vitest';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const modules=import.meta.glob('./NativeBattingScoreAssessment.ts');
const implementation=async()=>{const load=modules['./NativeBattingScoreAssessment.ts'];expect(load,'OWNED_BATTING_SCORE_SOURCE_MISSING').toBeTypeOf('function');return await load() as any;};
const ref=(owner:string,id:string)=>({owner,sourceId:id,sourceHash:hash(['source',id]),snapshotHash:hash(['result',id])});
const fixture=()=>({sourceId:'fixture-score',sourceVersion:'fixture-only-v1',capability:'owned_batting_score_assessment_v1',
 predictionReference:ref('batting_prediction_v1_predictions','fixture-prediction'),modelReference:ref('world_player_batting_models','fixture-model'),
 observationCutReference:ref('batting_observation_v1_observations','fixture-observation'),
 member:{playerId:'away-2',bindingHash:hash('binding'),personHash:hash('person'),baselineSourceId:'baseline',reservedRevision:0,reservedStateHash:hash('reserved'),projectedStateHash:hash('projected')},
 viewReference:ref('reserved_pa_execution_views','fixture-view'),score:0.5,
 provenance:{assessmentSourceId:'fixture-human-assessment',assessmentVersion:'fixture-v1',calibrationSourceId:'fixture-explicit-assessment-domain',calibrationVersion:'fixture-v1'}});
/** Shape-only synthetic accepted-input tests. No Native prediction, observation,
 * model, assessment acceptance or autonomous scoring is claimed. */
it('BS01 explicit zero and one assessments retain independent Source and provenance bytes',async()=>{
 const api=await implementation();for(const score of [0,1]){const source={...fixture(),score},value=api.battingScoreAssessmentInput(source,source.sourceId);expect(value).toEqual(source);expect(value).not.toBe(source);expect(Object.isFrozen(value.provenance)).toBe(true);}
});
it('BS02 absent nonfinite out-of-domain or extra assessment fields never acquire a default score',async()=>{
 const api=await implementation();for(const edit of [(s:any)=>delete s.score,(s:any)=>s.score=-0.1,(s:any)=>s.score=1.1,(s:any)=>s.score=NaN,(s:any)=>s.score=Infinity,(s:any)=>s.generatedScore=0.5,(s:any)=>s.provenance.calibrationVersion=' ']){
  const source=fixture();edit(source);expect(()=>api.battingScoreAssessmentInput(source,source.sourceId)).toThrow(/batting score/);
 }
 let accessed=false;const source=fixture();Object.defineProperty(source,'score',{enumerable:true,get(){accessed=true;return 0;}});expect(()=>api.battingScoreAssessmentInput(source,source.sourceId)).toThrow();expect(accessed).toBe(false);
});
it('BS03 original prediction model member view and observation cut bind exactly without output reinterpretation',async()=>{
 const api=await implementation(),source=fixture(),basis={predictionReference:source.predictionReference,modelReference:source.modelReference,observationCutReference:source.observationCutReference,member:source.member,viewReference:source.viewReference};
 expect(()=>api.assertBattingScoreAssessmentBasis(source,basis)).not.toThrow();
 for(const edit of [(s:any)=>s.predictionReference.snapshotHash=hash('foreign'),(s:any)=>s.modelReference.sourceId='other',(s:any)=>s.observationCutReference.sourceId='other',
  (s:any)=>s.member.personHash=hash('foreign'),(s:any)=>s.member.projectedStateHash=hash('foreign'),(s:any)=>s.viewReference.sourceId='other']){const changed=structuredClone(source);edit(changed);expect(()=>api.assertBattingScoreAssessmentBasis(changed,basis)).toThrow(/batting score/);}
});
it('BS04 cross-domain owner references and supplied derived outcomes reject',async()=>{
 const api=await implementation();for(const edit of [(s:any)=>s.predictionReference.owner='physical_pitch_progress_actions',(s:any)=>s.observationCutReference.owner='actual_field_observations',
  (s:any)=>s.modelReference.sourceHash='bad',(s:any)=>s.member.playerId=' ',(s:any)=>s.trajectory={}]){
  const source=fixture();edit(source);expect(()=>api.battingScoreAssessmentInput(source,source.sourceId)).toThrow(/batting score/);
 }
 expect(()=>api.battingScoreAssessmentInput(fixture(),'different-source')).toThrow(/batting score/);
});
