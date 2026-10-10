import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { SamePaContinuationView } from './SamePlateAppearanceContinuation';
import type { AcceptedSamePaContinuationCalibration, SamePaContinuationCalibration } from './SamePlateAppearanceContinuationCalibrationSource';
export type { AcceptedSamePaContinuationCalibration, SamePaContinuationCalibration } from './SamePlateAppearanceContinuationCalibrationSource';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { readPlayerPitchTimingPrefixFromSqlite, assertCurrentPlayerPitchTimingPrefixFromSqlite } from './SqlitePlayerPitchTimingStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('nonempty calibration original nominal/member differs'); };
/** Private composition data only. The continuation owner supplies the actual
 * reauthenticated actor/view/member during its immutable proof. */
export const deriveSamePaContinuationCalibration = (db: DatabaseSync, source: AcceptedSamePaContinuationCalibration,
  basis: Readonly<{ actor: DurablePhysicalPlateAppearanceActor; view: SamePaContinuationView; members: readonly SamePaDispatchMember[] }>, current: boolean): SamePaContinuationCalibration => {
  const { actor, view, members } = basis, member = members.find(m => m.playerId === source.member.playerId);
  same(member, source.member); same(source.viewReference, reference('pa_continuation_v1_execution_views', view)); same(source.enrollmentReference, view.lineage.enrollmentReference);
  if (source.firstPhysicalPitchSourceId !== view.lineage.firstPhysicalPitchSourceId || source.acceptedAtDay > actor.binding.gameDay) throw new Error('nonempty calibration original scope/day differs');
  const binding = [actor.binding, ...actor.defenderBindings].find(b => b.playerId === source.member.playerId)!;
  const person = [actor.person, ...actor.defenderPersons].find(p => p.playerId === source.member.playerId)!;
  let nominal: unknown;
  if (source.route === 'pitch_delivery') {
    if (actor.world.defenders.find(d => d.playerId === binding.playerId)?.registeredPosition !== 'P') throw new Error('nonempty pitch calibration requires original pitcher');
    const timing = readPlayerPitchTimingPrefixFromSqlite(db, source.nominalReference), policy = readPitchFatiguePolicyFromSqlite(db, source.response.policyReference);
    if (timing.careerId !== binding.careerId || timing.playerId !== binding.playerId || policy.availableAtDay > binding.gameDay) throw new Error('nonempty pitch nominal scope differs');
    const row = db.prepare('SELECT source_json FROM main.world_pitch_timing_baselines WHERE career_id=? AND player_id=?').get(binding.careerId, binding.playerId);
    if (!row) throw new Error('nonempty pitcher Person baseline missing');
    const sourcePerson = playerPersonLinkEvidenceFromSqlite(db).readLink(JSON.parse(String(row.source_json)).personLinkSourceId); same(sourcePerson, person);
    if (current) assertCurrentPlayerPitchTimingPrefixFromSqlite(db, source.nominalReference, binding.gameDay); nominal = timing;
  } else if (source.nominalParameterReference) {
    if (binding.playerId !== actor.binding.playerId) throw new Error('nonempty batting calibration requires original batter');
    const owner = playerBattingModelEvidenceFromSqlite(db), model = owner.read(source.nominalReference.sourceId);
    if (!model) throw new Error('nonempty original batting model missing'); same(reference('world_player_batting_models', model), source.nominalReference);
    if (model.source.careerId !== binding.careerId || model.source.playerId !== binding.playerId || model.source.personLinkSourceId !== binding.personLinkSourceId
      || model.source.acceptedAtDay > binding.gameDay || model.bodyMaterialization.source.role !== 'batter') throw new Error('nonempty batting original scope differs');
    same(model.person, person); same(model.bodyMaterialization.person, person);
    const p = model[source.nominalParameterReference.parameterKey]; same(source.nominalParameterReference,
      { parameterKey: source.nominalParameterReference.parameterKey, sourceId: p.sourceId, sourceVersion: p.sourceVersion, sourceHash: hash(p) });
    if (current) same(owner.selectAtDay(binding.careerId, binding.playerId, binding.gameDay), model); nominal = p;
  } else {
    if (!actor.defenderBindings.some(b => b.playerId === binding.playerId)) throw new Error('nonempty defender calibration requires original defender');
    const owner = source.route === 'defender_observation' ? playerObservationModelEvidenceFromSqlite(db)
      : source.route === 'defender_decision' ? playerDecisionModelEvidenceFromSqlite(db) : playerLocomotionModelEvidenceFromSqlite(db);
    const model = owner.read(source.nominalReference.sourceId); if (!model) throw new Error('nonempty original defender model missing');
    same(reference(source.nominalReference.owner, model), source.nominalReference); same(model.fieldingModel.person, person);
    if (model.source.careerId !== binding.careerId || model.source.playerId !== binding.playerId || model.source.personLinkSourceId !== binding.personLinkSourceId
      || model.source.acceptedAtDay > binding.gameDay) throw new Error('nonempty defender original scope differs');
    if (current) same(owner.selectAtDay(binding.careerId, binding.playerId, binding.gameDay), model); nominal = model;
  }
  return freeze({ kind: 'nonempty_execution_calibration_prepared', source, lineage: view.lineage, nominalInputHash: hash(nominal), effectiveResponseHash: hash(source.response) });
};
