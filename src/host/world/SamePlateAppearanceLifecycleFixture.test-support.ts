import type { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
import { openSqliteSamePlateAppearanceLifecycleStore } from './SqliteSamePlateAppearanceLifecycleStore';
import { readCurrentSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import type { PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import type { AcceptedBattingCapability, AcceptedBattingObservationCalibration } from './PlayerBattingModel';

/** Real Source acceptance only. Each caller explicitly declares all ten TOTALs;
 * the32 response values remain the separately accepted original fixture values.
 * This helper never constructs a view, actor, model, or physical proof itself. */
export const prepareSamePaLifecycleFixture=(f:ReturnType<typeof directNativeDispatchFixture>,anchorViewReference:SamePaReference<'pa_continuation_v1_execution_views'>,
  eventReferences:readonly SamePaLifecycleWorkReference[],label:string,effortUnitsByPlayer:Readonly<Record<string,number>>,
  explicitBatterObservation?:AcceptedBattingObservationCalibration['values'],explicitDefenderObservation?:PlayerObservationCalibration,explicitBatterMotor?:AcceptedBattingCapability['values'],explicitDefenderLocomotion?:PlayerLocomotionCalibration)=>{
  const accepted=new Map<string,unknown>(),owner=f.x.f.track(openSqliteSamePlateAppearanceLifecycleStore(f.path,{
    readAcceptedPrefix:id=>accepted.get(id),readAcceptedTotal:id=>accepted.get(id),readAcceptedView:id=>accepted.get(id),readAcceptedCalibration:id=>accepted.get(id)}));
  const prefixSource={sourceId:label+':prefix',sourceVersion:'fixture-only-v1',capability:'same_pa_lifecycle_prefix_v1',
    enrollmentReference:f.acceptedAction.source.enrollmentReference,anchorViewReference,eventReferences};
  accepted.set(prefixSource.sourceId,prefixSource);const prefix=owner.acceptPrefix(prefixSource.sourceId);if(prefix.kind==='pending')throw new Error('real lifecycle prefix pending');
  const prefixReference=reference('pa_lifecycle_v1_work_prefixes',prefix);
  const totals=prefix.lineage.participantReferences.map(p=>({sourceId:label+':total:'+p.playerId,sourceVersion:'fixture-only-v1',capability:'same_pa_lifecycle_cumulative_total_v1',
    enrollmentReference:prefix.lineage.enrollmentReference,prefixReference,participantReference:p,effortUnits:effortUnitsByPlayer[p.playerId],
    provenance:{assessmentSourceId:label+':assessment:'+p.playerId,assessmentVersion:'fixture-only-v1',calibrationSourceId:label+':explicit-total',calibrationVersion:'fixture-only-v1'}}));
  totals.forEach(s=>accepted.set(s.sourceId,s));const totalSet=owner.acceptTotalSet(totals.map(s=>s.sourceId));if(totalSet.kind!=='same_pa_lifecycle_total_set')throw new Error('real lifecycle ten TOTALs pending');
  const viewSource={sourceId:label+':view',sourceVersion:'fixture-only-v1',capability:'same_pa_lifecycle_cumulative_view_v1',enrollmentReference:prefix.lineage.enrollmentReference,prefixReference,
    participantTotalReferences:totalSet.participantTotalReferences};
  accepted.set(viewSource.sourceId,viewSource);const view=owner.acceptView(viewSource.sourceId);if(view.kind==='pending')throw new Error('real lifecycle view pending');
  const viewReference=reference('pa_lifecycle_v1_execution_views',view),basis=withSqliteReadTransaction(f.db,()=>readCurrentSamePaLifecycleViewFromSqlite(f.db,viewReference));
  const calibrations=f.acceptedCalibrations.calibrations.map(c=>({...c.source,sourceId:label+':'+c.source.sourceId,capability:'same_pa_lifecycle_execution_calibration_v1',
    viewReference,member:basis.members.find(m=>m.playerId===c.source.member.playerId)!,provenance:{...c.source.provenance,assessmentSourceId:label+':'+c.source.provenance.assessmentSourceId,...(c.source.route==='batter_motor'&&explicitBatterMotor?{calibrationSourceId:label+':explicit-batter-motor',calibrationVersion:'fixture-only-declared-motor-v1'}:{}),...(c.source.route==='defender_locomotion'&&explicitDefenderLocomotion?{calibrationSourceId:label+':explicit-defender-locomotion',calibrationVersion:'fixture-only-declared-coverage-v1'}:{})},
    response:c.source.route==='defender_locomotion'&&explicitDefenderLocomotion?{kind:'accepted_execution_values_v1',values:explicitDefenderLocomotion}:c.source.route==='batter_motor'&&explicitBatterMotor?{kind:'accepted_execution_values_v1',values:explicitBatterMotor}:c.source.route==='batter_observation'&&explicitBatterObservation?{kind:'accepted_execution_values_v1',values:explicitBatterObservation}:c.source.route==='defender_observation'&&explicitDefenderObservation?{kind:'accepted_execution_values_v1',values:explicitDefenderObservation}:c.source.response}));
  calibrations.forEach(s=>accepted.set(s.sourceId,s));const calibrationSet=owner.acceptCalibrationSet(calibrations.map(s=>s.sourceId));if(calibrationSet.kind!=='same_pa_lifecycle_calibration_set')throw new Error('real lifecycle32 calibration set pending');
  return {owner,accepted,prefixSource,prefix,prefixReference,totals,totalSet,viewSource,view,viewReference,basis,calibrations,calibrationSet};
};
