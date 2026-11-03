import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { projectObservationClockV1 } from '../../core/sim/perception/ObservationClockProjectionV1';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { sourceFieldV3Fixture } from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaLifecycleCalibrationInput, SAME_PA_OBSERVATION_CLOCK_PROJECTION_VERSION as VERSION } from './SamePlateAppearanceLifecycleCalibrationSource';
import { deriveSamePaObservationClockProjectionV1 } from './SamePlateAppearanceObservationClockProjectionV1';
import { deriveSamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibration';
import { SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as INTEGER_STEP, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR_STEP } from './SamePlateAppearanceBallPhysics';
const owned=vi.hoisted(()=>({model:null as any,prior:null as any,field:null as any,root:null as any,oldView:null as any}));
vi.mock('./SqlitePlayerObservationModelStore',()=>({playerObservationModelEvidenceFromSqlite:()=>({read:(id:string)=>id===owned.model?.source.sourceId?owned.model:null})}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({readSamePaLifecycleCalibrationFromSqlite:()=>owned.prior,readHistoricalSamePaLifecycleViewFromSqlite:()=>owned.oldView}));
vi.mock('./SamePlateAppearancePhysicalEpisodeFromSqlite',()=>({readSamePaPhysicalOperationFromSqlite:(_db:unknown,ref:{sourceId:string})=>({record:ref.sourceId===owned.root?.source.sourceId?owned.root:owned.field})}));
const pin=(owner:string,id=owner)=>({owner,sourceId:id,sourceHash:hash(id),snapshotHash:hash('snapshot:'+id)}) as any;
const fixture=()=>{
  const old=playerObservationCalibrationFixture(),enrollment=pin('same_pa_enrollments'),lineage={enrollmentReference:enrollment,firstPhysicalPitchSourceId:'pitch',playId:1};
  const member={playerId:'fielder',bindingHash:hash('binding'),personHash:hash('person'),baselineSourceId:'baseline',reservedRevision:0,reservedStateHash:hash('state'),projectedStateHash:hash('projection')};
  const person={playerId:'fielder',sourceId:'person-link'};
  owned.model={source:{sourceId:'nominal',sourceVersion:'fixture-v1',calibration:old,careerId:'career',playerId:'fielder',personLinkSourceId:'person-link',acceptedAtDay:10},fieldingModel:{person}};
  const nominalReference=reference('world_player_observation_models',owned.model);
  const physical=sourceFieldV3Fixture();
  owned.field={kind:'same_pa_physical_field_root_v1',source:{sourceId:'field',sourceVersion:'same_pa_field_root_aero_ground_escape_v3',parameters:physical.response.world.parameters,ballPhysics:physical.cursor.sourceCurve.profile},lineage,
    physicalPitchSourceId:'pitch',field:{motion:{carrierPlayerId:null,cursor:{sourceCurve:physical.cursor.sourceCurve}}}};
  const fieldReference=reference('pa_physical_v1_field_roots',owned.field);
  const oldView={source:{sourceId:'old-view'},lineage,cut:{physicalPitchReference:pin('pa_physical_v1_launches','pitch'),evaluationTick:1,stage:'field_active'}};
  owned.oldView={view:oldView};
  owned.prior={kind:'same_pa_lifecycle_calibration',source:{sourceId:'old-calibration',sourceVersion:'fixture-v1',route:'defender_observation',member,
    nominalReference,viewReference:reference('pa_lifecycle_v1_execution_views',oldView),response:{kind:'accepted_execution_values_v1',values:old}},lineage,nominalInputHash:hash(owned.model)};
  const view={source:{sourceId:'new-view'},lineage,cut:{physicalOperationReference:fieldReference,physicalPitchReference:pin('pa_physical_v1_launches','pitch'),evaluationTick:2,stage:'field_active'}};
  const source={sourceId:'new-calibration',sourceVersion:VERSION,capability:'same_pa_lifecycle_execution_calibration_v1',enrollmentReference:enrollment,
    viewReference:reference('pa_lifecycle_v1_execution_views',view),firstPhysicalPitchSourceId:'pitch',member,route:'defender_observation',nominalReference,nominalParameterReference:null,acceptedAtDay:10,
    provenance:{assessmentSourceId:'assessment',assessmentVersion:'fixture-v1',calibrationSourceId:'unit-conversion',calibrationVersion:VERSION},
    response:{kind:'accepted_execution_values_v1',values:projectObservationClockV1(old,1_000_000)},observationClockProjection:{kind:'observation_clock_projection_v1',
      originalNominalReference:nominalReference,originalEffectiveCalibrationReference:reference('pa_lifecycle_v1_execution_calibrations',owned.prior),fieldReference}} as any;
  return {source,basis:{view,members:[member],actor:{binding:{playerId:'batter',gameDay:10},person:{playerId:'batter'},
    defenderBindings:[{playerId:'fielder',careerId:'career',personLinkSourceId:'person-link',gameDay:10}],defenderPersons:[person]}} as any,old};
};
beforeEach(()=>{owned.model=null;owned.prior=null;owned.field=null;owned.root=null;owned.oldView=null;});
it('accepts only the explicit new Source version and keeps omitted legacy JSON bytes',()=>{
  const h=fixture();expect(samePaLifecycleCalibrationInput(h.source)).toEqual(h.source);
  const {observationClockProjection:_,...legacy}=h.source;legacy.sourceVersion='legacy-v1';legacy.response={kind:'accepted_execution_values_v1',values:h.old};
  expect(JSON.stringify(samePaLifecycleCalibrationInput(legacy))).toBe(JSON.stringify(legacy));
  for(const bad of [{...h.source,sourceVersion:'legacy-v1'},{...legacy,sourceVersion:VERSION},{...h.source,observationClockProjection:undefined},
    {...h.source,observationClockProjection:null},{...h.source,route:'defender_decision'},
    {...h.source,observationClockProjection:{...h.source.observationClockProjection,targetTicksPerSecond:1_000_000}}])expect(()=>samePaLifecycleCalibrationInput(bad)).toThrow();
});
it('rederives projected nominal and effective values from authenticated original references and owned field clock',()=>{
  const h=fixture(),modelBytes=JSON.stringify(owned.model),priorBytes=JSON.stringify(owned.prior);
  const result=deriveSamePaObservationClockProjectionV1({} as DatabaseSync,h.source,h.basis);
  expect(result.nominalInput.projectedNominalCalibration).toEqual(h.source.response.values);
  expect(result.evidence.targetTicksPerSecond).toBe(1_000_000);expect(result.evidence.authority).toBe('UNIT_CONVERSION_NOT_ABILITY_CHANGE');
  expect(result.evidence.projectedEffectiveCalibrationHash).toBe(hash(h.source.response.values));
  expect(JSON.stringify(owned.model)).toBe(modelBytes);expect(JSON.stringify(owned.prior)).toBe(priorBytes);
});
it('rejects forged refs, effective-only edits, original clock mismatch, foreign/stale field, custody and chained projection',()=>{
  const run=(edit:(h:ReturnType<typeof fixture>)=>void)=>{const h=fixture();edit(h);expect(()=>deriveSamePaObservationClockProjectionV1({} as DatabaseSync,h.source,h.basis)).toThrow();};
  run(h=>{h.source.observationClockProjection.originalNominalReference.snapshotHash=hash('fake');});
  run(h=>{h.source.observationClockProjection.originalEffectiveCalibrationReference.snapshotHash=hash('fake');});
  run(h=>{h.source.observationClockProjection.fieldReference.snapshotHash=hash('fake');});
  run(h=>{h.source.response.values={...h.source.response.values,refreshPolicy:h.old.refreshPolicy};});
  run(()=>{owned.prior.source.response.values={...owned.prior.source.response.values,memoryDecayParameters:{...owned.prior.source.response.values.memoryDecayParameters,ticksPerSecond:2000}};});
  run(()=>{owned.field.lineage={...owned.field.lineage,playId:99};});
  run(h=>{h.basis.view.cut.physicalOperationReference=pin('pa_physical_v1_field_roots','other');});
  run(()=>{owned.field.field.motion.carrierPlayerId='fielder';});
  run(()=>{owned.field.field.motion.cursor=null;});
  run(()=>{owned.prior.source.observationClockProjection={kind:'observation_clock_projection_v1'};});
  run(()=>{owned.oldView.view.cut.physicalPitchReference=pin('pa_physical_v1_launches','other-pitch');});
});
it('integrates projected nominal hashing into the lifecycle owner while keeping legacy result keys and nominal hash unchanged',()=>{
  const h=fixture(),projection=deriveSamePaObservationClockProjectionV1({} as DatabaseSync,h.source,h.basis);
  const projected=deriveSamePaLifecycleCalibration({} as DatabaseSync,h.source,h.basis,false);
  expect(projected.nominalInputHash).toBe(hash(projection.nominalInput));expect(projected.nominalInputHash).not.toBe(hash(owned.model));
  expect(projected.observationClockProjection).toEqual(projection.evidence);expect(projected.effectiveResponseHash).toBe(hash(h.source.response));
  const {observationClockProjection:_,...legacy}=h.source;legacy.sourceVersion='legacy-v1';legacy.response={kind:'accepted_execution_values_v1',values:h.old};
  const old=deriveSamePaLifecycleCalibration({} as DatabaseSync,legacy,h.basis,false);
  expect(Object.keys(old)).toEqual(['kind','source','lineage','nominalInputHash','effectiveResponseHash']);
  expect(old.nominalInputHash).toBe(hash(owned.model));expect(old.source).toEqual(legacy);
});
it('explicitly permits owner-read integer and motor branch steps at the current view and keeps foreign versions/refs/custody closed',()=>{
  const setup=(version=INTEGER_STEP)=>{
    const h=fixture();owned.root=owned.field;
    owned.field={...owned.root,kind:'same_pa_physical_field_step_v1',source:{...owned.root.source,sourceId:'integer-step',sourceVersion:version,
      fieldRootReference:reference('pa_physical_v1_field_roots',owned.root)}};
    const fieldReference=reference('pa_physical_v1_field_steps',owned.field);
    h.basis.view.cut.physicalOperationReference=fieldReference;
    h.source.observationClockProjection.fieldReference=fieldReference;
    h.source.viewReference=reference('pa_lifecycle_v1_execution_views',h.basis.view);
    return h;
  };
  for(const version of [INTEGER_STEP,MOTOR_STEP]){
    const h=setup(version),result=deriveSamePaObservationClockProjectionV1({} as DatabaseSync,h.source,h.basis);
    expect(result.evidence.targetTicksPerSecond).toBe(1_000_000);
    expect(result.evidence.fieldReference).toEqual(h.basis.view.cut.physicalOperationReference);
  }
  for(const edit of [()=>{owned.field.source.sourceVersion='unknown-future-version';},
    ()=>{owned.field.field.motion.carrierPlayerId='fielder';},()=>{owned.root.source.sourceVersion='legacy-v1';},
    ()=>{owned.field.lineage={...owned.field.lineage,playId:999};}]){
    const next=setup();edit();expect(()=>deriveSamePaObservationClockProjectionV1({} as DatabaseSync,next.source,next.basis)).toThrow();
  }
  const next=setup();next.basis.view.cut.physicalOperationReference=pin('pa_physical_v1_field_steps','other');
  expect(()=>deriveSamePaObservationClockProjectionV1({} as DatabaseSync,next.source,next.basis)).toThrow();
});
