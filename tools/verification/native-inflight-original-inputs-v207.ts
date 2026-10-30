import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, type readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite, type readSamePaPhysicalOperationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { NativeDeliveryForecastV206Input } from './native-delivery-forecast-v206';

const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V206 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V206 normal retained prerequisite missing'); return value; };
type Actor = NonNullable<ReturnType<typeof readPhysicalPlateAppearanceActorFromSqlite>>;
type Launch = Extract<ReturnType<typeof readSamePaPhysicalOperationFromSqlite>['record'], { kind: 'same_pa_physical_launch_v1' }>;
type Locator = <O extends string>(owner: O, sourceId: string) => SamePaReference<O>;

/** Stage-independent original inputs only. The caller authenticates actor/launch
 * and owns the enclosing SQLite read snapshot/lifecycle read phase. The locator
 * supplies identifiers; each located value is authenticated by its normal reader. */
export function readNativeInFlightOriginalInputsV207(db: DatabaseSync, preparation: NativeDeliveryForecastV206Input['retainedInputReferences'],
  pins: NativeDeliveryForecastV206Input['resumePins'], actor: Actor, launch: Launch, locate: Locator) {
  const refs = preparation.retainedInputReferences;
  const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
  same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
  const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
  if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V206 original in-flight posture missing');
  const intent = readSamePaBattingIntentFromSqlite(db, pins.intentReference);
  same(posture.lineage, action.lineage); same(intent.lineage, action.lineage); same(posture.source.actionReference, refs.actionReference);
  same(posture.source.viewReference, refs.viewReference); same(intent.source.viewReference, refs.viewReference); same(intent.source.postureReference, pins.postureReference);
  const model = must(playerBattingModelEvidenceFromSqlite(db).read(refs.modelReference.sourceId));
  same(reference('world_player_batting_models', model), refs.modelReference); same(posture.model, model); same(action.source.batterModelReference, refs.modelReference);
  const fieldCalibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, preparation.calibrationReference);
  same(fieldCalibration.source.actionReference, refs.actionReference); same(fieldCalibration.source.postureReference, pins.postureReference);
  same(fieldCalibration.source.viewReference, refs.viewReference); same(fieldCalibration.source.bodyModelReference, preparation.bodyModelReference);
  const bodyModel = must(battedBodyModelMaterializationEvidenceFromSqlite(db).read(preparation.bodyModelReference.sourceId));
  same(locate('world_batted_body_materializations', bodyModel.sourceId), preparation.bodyModelReference); same(fieldCalibration.calibration.model, bodyModel); assert.equal(bodyModel.actors.length, 10);
  const batterBody = must(playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(preparation.batterBodyReference.sourceId));
  same(reference('world_player_body_materializations', batterBody), preparation.batterBodyReference);
  same(batterBody.source, refs.matchDayBatterPreparation.request); same(batterBody.actor, posture.model.bodyMaterialization.actor); assert.equal(batterBody.source.atDay, actor.binding.gameDay);
  const qualifications = refs.qualificationReferences.map(ref => {
    const value = must(readNativeSpinControlMasteryV123(db, ref.sourceId)); same(reference('world_spin_mastery_v123', value), ref);
    assert.equal(value.source.careerId, actor.binding.careerId); assert.equal(value.source.playerId, actor.binding.playerId);
    assert.equal(value.source.personLinkSourceId, actor.person.sourceId); assert.equal(value.person.personId, actor.binding.personId);
    assert(value.source.acceptedAtDay <= actor.binding.gameDay); same(value.source.repertoireRef, model.source.repertoireRef); return value;
  });
  assert.deepStrictEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
  assert.equal(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size, 2);
  assert.equal(new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size, 2);
  assert.equal(new Set(qualifications.flatMap(q => q.contacts.map(c => c.eventId))).size, 6);
  const acceptedAction = readSamePaPreparedActionFromSqlite(db, locate('pa_dispatch_v1_action_plans', 'native-action'));
  same(acceptedAction.lineage, action.lineage);
  const dispatchCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
    .all(action.lineage.enrollmentReference.sourceId).map(row => String(row.source_id)); assert.equal(dispatchCalibrationIds.length, 32);
  const genesis = must(readBattingEmotionGenesisFromSqlite(db, 'physical-fixture:emotion-genesis'));
  const world = must(readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId));
  const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
  assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, pins.deliveryCutReference.owner);
  assert.equal(physicalHead[0].last_source_id, pins.deliveryCutReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, pins.deliveryCutReference.snapshotHash);
  const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
    .all('batting_observation_v1_observations', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
  assert.equal(observationHead.length, 1); assert.equal(observationHead[0].revision, 1);
  assert.equal(observationHead[0].last_source_id, pins.observationReference.sourceId); assert.equal(observationHead[0].last_snapshot_hash, pins.observationReference.snapshotHash);
  const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
    .all('batting_observation_v1_deliveries', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
  assert.equal(deliveryHead.length, 1); assert.equal(deliveryHead[0].revision, 1);
  assert.equal(deliveryHead[0].last_source_id, pins.deliveryReference.sourceId); assert.equal(deliveryHead[0].last_snapshot_hash, pins.deliveryReference.snapshotHash);
  return { action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead, observationHead, deliveryHead };
}
