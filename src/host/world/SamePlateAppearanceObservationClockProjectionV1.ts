import type { DatabaseSync } from 'node:sqlite';
import { projectObservationClockV1 } from '../../core/sim/perception/ObservationClockProjectionV1';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { readSamePaLifecycleCalibrationFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaLifecycleCalibrationInput, type AcceptedSamePaLifecycleCalibration, type SamePaObservationClockProjectionEvidenceV1 } from './SamePlateAppearanceLifecycleCalibrationSource';
import type { SamePaLifecycleView } from './SamePlateAppearanceLifecycle';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFieldBallPhysics, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as INTEGER_STEP, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR_STEP } from './SamePlateAppearanceBallPhysics';
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('observation clock projection original Source or values differ');};

/** Native-private composition. Existing owners authenticate all references on
 * the caller's original immutable read phase; no serialized projection is proof. */
export const deriveSamePaObservationClockProjectionV1 = (db: DatabaseSync, raw: AcceptedSamePaLifecycleCalibration,
  basis: Readonly<{view:SamePaLifecycleView}>) => {
  const source=samePaLifecycleCalibrationInput(raw),p=source.observationClockProjection;
  if(source.route!=='defender_observation'||!p)throw new Error('explicit defender observation clock projection required');
  same(source.viewReference,reference('pa_lifecycle_v1_execution_views',basis.view));
  same(source.nominalReference,p.originalNominalReference);same(p.fieldReference,basis.view.cut.physicalOperationReference);
  const model=playerObservationModelEvidenceFromSqlite(db).read(p.originalNominalReference.sourceId);
  if(!model)throw new Error('original observation clock nominal model missing');
  same(reference('world_player_observation_models',model),p.originalNominalReference);
  const prior=readSamePaLifecycleCalibrationFromSqlite(db,p.originalEffectiveCalibrationReference);
  if(prior.source.route!=='defender_observation'||prior.source.observationClockProjection||prior.observationClockProjection||prior.source.sourceId===source.sourceId)
    throw new Error('observation clock projection requires an original unprojected calibration');
  same(reference('pa_lifecycle_v1_execution_calibrations',prior),p.originalEffectiveCalibrationReference);
  same(prior.source.nominalReference,p.originalNominalReference);same(prior.lineage,basis.view.lineage);
  if((['playerId','bindingHash','personHash','baselineSourceId'] as const).some(key=>prior.source.member[key]!==source.member[key]))
    throw new Error('observation clock projection original player binding differs');
  same(prior.nominalInputHash,hash(model));
  const oldView=readHistoricalSamePaLifecycleViewFromSqlite(db,prior.source.viewReference).view;
  same(reference('pa_lifecycle_v1_execution_views',oldView),prior.source.viewReference);same(oldView.lineage,basis.view.lineage);
  same(oldView.cut.physicalPitchReference,basis.view.cut.physicalPitchReference);
  if(oldView.cut.stage!=='field_active'||basis.view.cut.stage!=='field_active'||oldView.cut.evaluationTick>basis.view.cut.evaluationTick)
    throw new Error('observation clock projection original view is stale or foreign');
  const field=readSamePaPhysicalOperationFromSqlite(db,p.fieldReference).record;
  if(field.kind!=='same_pa_physical_field_root_v1'&&field.kind!=='same_pa_physical_field_step_v1')throw new Error('observation clock projection requires an original field');
  same(reference(field.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',field),p.fieldReference);
  same(field.lineage,basis.view.lineage);
  if(field.physicalPitchSourceId!==basis.view.cut.physicalPitchReference.sourceId)
    throw new Error('observation clock projection field pitch differs');
  const cursor=field.field.motion.cursor;
  if(!(field.kind==='same_pa_physical_field_root_v1'?field.source.sourceVersion===ROOT:[STEP,INTEGER_STEP,MOTOR_STEP].includes(field.source.sourceVersion))
    ||field.field.motion.carrierPlayerId!==null||!cursor?.sourceCurve)
    throw new Error('observation clock projection supports only a free original v3 Source');
  const root=field.kind==='same_pa_physical_field_root_v1'?field:readSamePaPhysicalOperationFromSqlite(db,field.source.fieldRootReference).record;
  if(root.kind!=='same_pa_physical_field_root_v1'||root.source.sourceVersion!==ROOT)throw new Error('observation clock projection original v3 root missing');
  same(root.lineage,field.lineage);same(cursor.sourceCurve.profile,samePaFieldBallPhysics(root.source));
  const target=cursor.sourceCurve.profile.air.ticksPerSecond;
  const oldNominal=model.source.calibration,oldEffective=prior.source.response.values;
  if(oldNominal.memoryDecayParameters.ticksPerSecond!==oldEffective.memoryDecayParameters.ticksPerSecond)
    throw new Error('observation clock projection original nominal and effective clocks differ');
  const projectedNominalCalibration=projectObservationClockV1(oldNominal,target),projectedEffectiveCalibration=projectObservationClockV1(oldEffective,target);
  same(source.response.values,projectedEffectiveCalibration);
  const evidence:SamePaObservationClockProjectionEvidenceV1={authority:'UNIT_CONVERSION_NOT_ABILITY_CHANGE',originalNominalInputHash:hash(model),
    originalEffectiveCalibrationHash:hash(prior),originalTicksPerSecond:oldNominal.memoryDecayParameters.ticksPerSecond,targetTicksPerSecond:target,
    projectedNominalCalibrationHash:hash(projectedNominalCalibration),projectedEffectiveCalibrationHash:hash(projectedEffectiveCalibration),fieldReference:p.fieldReference};
  return freeze({nominalInput:{kind:'projected_observation_nominal_input_v1' as const,originalNominalReference:p.originalNominalReference,
    originalNominalInputHash:hash(model),originalEffectiveCalibrationReference:p.originalEffectiveCalibrationReference,fieldReference:p.fieldReference,
    projectedNominalCalibration},evidence});
};
