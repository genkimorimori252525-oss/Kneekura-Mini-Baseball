import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleNextPitchBasisFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readSamePaPhysicalOperationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaPhysicalOperationOwners, type SamePaPhysicalOperationReference } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';

const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V197 original prelaunch ownership differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V197 required original record missing'); return value; };
const label = 'native-spin-neutral-v193:pitch3';
const qualificationIds = ['native-spin-neutral-v193:back:mastery-backspin', 'native-spin-neutral-v193:top:mastery-topspin'];

/** Read-only authentication of the retained early boundary. The path-owning
 * right reader and Gold selector are intentionally never opened: one lacks a
 * borrowed readonly API and the other opens DDL/PRAGMA-owning storage. */
export function readNativeSpinNeutralPrelaunchV197(db: DatabaseSync, emit: (name: string, value?: unknown) => void) {
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const visited: { owner: string; sourceId: string; rowid: string }[] = [];
    const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
      const query = db.prepare(`SELECT rowid native_rowid,source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`); query.setReadBigInts(true);
      const row = must(query.get(sourceId));
      if (!visited.some(r => r.owner === owner && r.sourceId === sourceId)) visited.push({ owner, sourceId, rowid: String(row.native_rowid) });
      return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    };
    const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, 'batter-1'));
    const actorReference = reference('physical_plate_appearance_actors', actor); same(locate(actorReference.owner, actorReference.sourceId), actorReference);
    assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
    emit('original-actor-authenticated', { actorReference, actor });
    const qualifications = qualificationIds.map(id => must(readNativeSpinControlMasteryV123(db, id)));
    const qualificationReferences = qualifications.map(value => reference('world_spin_mastery_v123', value));
    for (let i = 0; i < qualifications.length; i++) {
      const value = qualifications[i], ref = qualificationReferences[i]; same(locate(ref.owner, ref.sourceId), ref);
      assert.equal(value.source.careerId, actor.binding.careerId); assert.equal(value.source.playerId, actor.binding.playerId);
      assert.equal(value.person.personId, actor.binding.personId); assert.equal(value.source.personLinkSourceId, actor.person.sourceId);
      assert(value.source.acceptedAtDay <= actor.binding.gameDay); assert.equal(value.successfulContacts, 3); assert(value.motorProfileRefs.length > 0);
    }
    assert.deepEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
    assert.equal(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size, 2);
    assert.equal(new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size, 2);
    assert.equal(new Set(qualifications.flatMap(q => q.contacts.map(c => c.eventId))).size, 6);
    emit('two-original-native-qualifications-authenticated', { qualificationReferences, qualifications,
      effectiveGoldSelectorReexecuted: false, reason: 'NO_BORROWED_READONLY_GOLD_SELECTOR_EXPORTED' });
    const actionReference = locate('pa_physical_v1_action_plans', label + ':action');
    const action = readSamePaPhysicalActionFromSqlite(db, actionReference); same(action.actor, actor);
    const postureReference = locate('batting_observation_v1_postures', label + ':posture');
    const posture = readBattingPerceptionFromSqlite(db, 'posture', postureReference);
    if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V197 original prospective posture missing');
    const intentReference = locate('batting_execution_v1_intents', label + ':intent');
    const intent = readSamePaBattingIntentFromSqlite(db, intentReference);
    same(posture.lineage, action.lineage); same(posture.source.actionReference, actionReference); same(posture.source.viewReference, action.source.viewReference);
    same(intent.lineage, action.lineage); same(intent.source.postureReference, postureReference); same(intent.source.viewReference, action.source.viewReference);
    const modelOwner = playerBattingModelEvidenceFromSqlite(db), model = must(modelOwner.read(action.source.batterModelReference.sourceId));
    same(reference('world_player_batting_models', model), action.source.batterModelReference);
    same(modelOwner.selectAtDay(actor.binding.careerId, actor.binding.playerId, actor.binding.gameDay), model);
    same(posture.model, model); same(posture.source.modelReference, action.source.batterModelReference);
    for (const qualification of qualifications) same(qualification.source.repertoireRef, model.source.repertoireRef);
    same(locate('world_player_batting_models', model.source.sourceId), action.source.batterModelReference);
    emit('pitch3-action-posture-intent-current-model-authenticated', { actionReference, action, postureReference, posture, intentReference, intent,
      modelReference: action.source.batterModelReference, model });

    const rightRows = db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.pa_physical_v1_rights WHERE source_id=?').all(action.source.sourceId + ':right');
    const right = { status: rightRows.length ? 'UNAUTHENTICATED_LOCATOR_ONLY' : 'UNAVAILABLE',
      reason: 'NO_BORROWED_READONLY_PREPARED_RIGHT_GETTER_EXPORTED', normalReaderNotCalled: 'Store.readRight is path-owning',
      candidates: rightRows.map(row => locate('pa_physical_v1_rights', String(row.source_id))), authorityGrantedByRawLocator: false,
      requiredForProspectiveFieldCalibration: false };
    emit('prepared-right-locator-only', right);
    const heads = db.prepare('SELECT last_owner,last_source_id,last_snapshot_hash FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
    if (heads.length) {
      assert.equal(heads.length, 1); assert(samePaPhysicalOperationOwners.some(owner => owner === heads[0].last_owner));
      const ref = locate(String(heads[0].last_owner), String(heads[0].last_source_id)) as SamePaPhysicalOperationReference;
      assert.equal(ref.snapshotHash, heads[0].last_snapshot_hash);
      const physical = readSamePaPhysicalOperationFromSqlite(db, ref); same(physical.lineage, action.lineage);
      emit('normal-physical-head-already-launched', physical);
      throw Error('V197 PRELAUNCH_REJECTED: an accepted physical head already exists');
    }
    // Zero raw locators alone is not a proof: the normal current lifecycle and
    // next-pitch census below must still admit the original action view.
    emit('no-scoped-physical-head-locator', { boundary: 'RAW_LOCATOR_ABSENCE_ONLY', enrollmentReference: action.lineage.enrollmentReference });
    const current = readCurrentSamePaLifecycleViewFromSqlite(db, action.source.viewReference);
    const next = readSamePaLifecycleNextPitchBasisFromSqlite(db, action.source.viewReference, 'current');
    if (next.kind !== 'ready') { emit('normal-next-pitch-basis-rejected', next); throw Error('V197 PRELAUNCH_REJECTED: ' + next.reason); }
    same(current.actor, actor); same(next.actor, actor); same(next.view, current.view);
    assert.equal(next.nextPitchOrdinal, action.pitchOrdinal); assert.equal(action.pitchOrdinal, 3);
    same(next.previousPitchReference, action.previousPitchReference); same(next.physicalWorld, action.physicalWorld);
    same(next.timeline, action.timeline); same(next.bodyCut, action.bodyCut); same(next.baseCenters, action.baseCenters);
    same(reference('pa_lifecycle_v1_execution_views', current.view), action.source.viewReference);
    locate(action.source.viewReference.owner, action.source.viewReference.sourceId);
    emit('original-view-current-and-next-pitch-basis-authenticated', { viewReference: action.source.viewReference, current, next });
    return { boundary: 'NATIVE_READONLY_PROSPECTIVE_PRELAUNCH_BOUNDARY_ONLY', actorReference, qualificationReferences,
      modelReference: action.source.batterModelReference, actionReference, postureReference, intentReference, preparedRight: right,
      viewReference: action.source.viewReference, currentLifecycleProven: true, nextPitchBasisProven: true, nextPitchOrdinal: next.nextPitchOrdinal,
      unlaunchedBasis: 'NORMAL_CURRENT_AND_NEXT_PITCH_WORK_CENSUS_WITH_NO_SCOPED_PHYSICAL_HEAD',
      twoIndependentNativeQualificationRefsProven: true, effectiveGoldSelectorReexecuted: false,
      prospectiveFieldCalibrationAcceptance: 'NOT_EXERCISED', originalActionAndPostureViewMatch: true,
      bodyCount: 1 + posture.sceneBodies.length, visitedRowLocators: visited,
      newSourcesAuthored: 0, newWriterCalls: 0, newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0,
      fieldRootBallPhysicsRequirement: 'RESERVED_SOURCE_VERSION_AND_EXPLICIT_AERO_GROUND_BALL_PHYSICS_V1_REQUIRED_NOT_AUTHORED',
      originalFailedRunsPreserved: true, originalExecutionSourceEndPin: 'UNKNOWN', performancePass: false,
      modelAndQualificationsHash: hash({ modelReference: action.source.batterModelReference, qualificationReferences }) };
  }));
}
