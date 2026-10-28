import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { samePaPhysicalOperationOwners, type SamePaPhysicalOperationReference } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import { readCurrentSamePaInFlightCutFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readHistoricalSamePaLifecycleViewFromSqlite, readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

/** Additional joins between independently authenticated owner records. This
 * comparison alone never turns synthetic values into Native evidence. */
export function assertNativeSpinNeutralV193Join(actorReference: SamePaReference<'physical_plate_appearance_actors'>,
  physical: Pick<ReturnType<typeof readCurrentSamePaInFlightCutFromSqlite>, 'actor' | 'lineage' | 'physicalPitchReference'>,
  observation: { lineage: unknown; source: { physicalPitchReference: unknown } }) {
  if (json(reference('physical_plate_appearance_actors', physical.actor)) !== json(actorReference)
    || json(physical.lineage.actorReference) !== json(actorReference)
    || json(observation.lineage) !== json(physical.lineage)
    || json(observation.source.physicalPitchReference) !== json(physical.physicalPitchReference)) throw Error('V193 Actor/physical/observation join differs');
}

function requireValue<T>(value: T | null | undefined, message: string): T { if (value == null) throw Error(message); return value; }
function locator<O extends string>(db: DatabaseSync, owner: O, sourceId: string): SamePaReference<O> {
  const row = requireValue(db.prepare(`SELECT source_hash,snapshot_hash FROM main."${owner}" WHERE source_id=?`).get(sourceId), 'missing locator: ' + owner);
  return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
}

/** Raw rows supply locators only. Every returned record is replayed by its
 * normal owner, on the copied database's one Native immutable snapshot. */
function authenticateFrontier(db: DatabaseSync, emit: (stage: string, value: unknown) => void, currentRequired: boolean) {
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const actor = requireValue(readPhysicalPlateAppearanceActorFromSqlite(db, 'batter-1'), 'normal original Actor missing');
    if (actor.binding.careerId !== 'career-a' || actor.binding.playerId !== 'away-1' || actor.binding.gameDay !== 40) throw Error('V193 Actor scope differs');
    const actorReference = reference('physical_plate_appearance_actors', actor); emit('actor', { actorReference, actor });
    const qualifications = ['native-spin-neutral-v193:back:mastery-backspin', 'native-spin-neutral-v193:top:mastery-topspin']
      .map(id => requireValue(readNativeSpinControlMasteryV123(db, id), 'normal qualification missing: ' + id));
    if (qualifications.some(q => q.source.careerId !== actor.binding.careerId || q.source.playerId !== actor.binding.playerId
      || q.source.personLinkSourceId !== actor.person.sourceId || q.person.personId !== actor.binding.personId || q.source.acceptedAtDay > actor.binding.gameDay)
      || json(qualifications.map(q => q.source.technique)) !== json(['BACKSPIN', 'TOPSPIN'])
      || new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size !== 2
      || new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size !== 2
      || new Set(qualifications.flatMap(q => q.contacts.map(c => c.eventId))).size !== 6) throw Error('normal qualifications are not independent same-Actor practices');
    const qualificationReferences = qualifications.map(q => reference('world_spin_mastery_v123', q));
    emit('qualifications', { qualificationReferences, qualifications });
    const world = requireValue(readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId), 'normal World head missing'); emit('world', world);
    const heads = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE career_id=? AND game_id=? AND play_id=?')
      .all(actor.binding.careerId, actor.binding.gameId, actor.match.playId);
    if (heads.length !== 1 || !samePaPhysicalOperationOwners.some(owner => owner === heads[0].last_owner)) throw Error('physical frontier locator is absent or ambiguous');
    const head = heads[0], physicalReference = locator(db, String(head.last_owner), String(head.last_source_id)) as SamePaPhysicalOperationReference;
    if (physicalReference.snapshotHash !== head.last_snapshot_hash) throw Error('physical head/locator differs');
    const physical = readCurrentSamePaInFlightCutFromSqlite(db, physicalReference); emit('physical', physical);
    const model = requireValue(playerBattingModelEvidenceFromSqlite(db).read(physical.batterModelReference.sourceId), 'normal model missing');
    if (hash(model.source) !== physical.batterModelReference.sourceHash || hash(model) !== physical.batterModelReference.snapshotHash
      || qualifications.some(q => json(q.source.repertoireRef) !== json(model.source.repertoireRef))) throw Error('normal model/repertoire differs');
    emit('model', { reference: physical.batterModelReference, model });
    const observationReference = locator(db, 'batting_observation_v1_observations', 'native-spin-neutral-v193:pitch3:capture');
    const observation = readBattingPerceptionFromSqlite(db, 'observation', observationReference);
    if (observation.kind !== 'batting_observation') throw Error('normal observation owner differs');
    assertNativeSpinNeutralV193Join(actorReference, physical, observation);
    emit('observation', { observationReference, observation });
    const views = db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.pa_lifecycle_v1_execution_views WHERE enrollment_source_id=? ORDER BY rowid DESC LIMIT 1')
      .all(physical.lineage.enrollmentReference.sourceId);
    if (views.length !== 1) throw Error('latest lifecycle locator missing');
    const viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> = { owner: 'pa_lifecycle_v1_execution_views', sourceId: String(views[0].source_id),
      sourceHash: String(views[0].source_hash), snapshotHash: String(views[0].snapshot_hash) };
    const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference); emit('historical-lifecycle', { viewReference, historical });
    // A rejected current view is preserved as an authentication failure; an
    // earlier historical record is never substituted for a current frontier.
    const current = currentRequired ? readCurrentSamePaLifecycleViewFromSqlite(db, viewReference) : null;
    if (current) emit('current-lifecycle', { viewReference, current });
    return { boundary: currentRequired ? 'AUTHENTICATED_NATIVE_SPIN_NEUTRAL_FRONTIER_ONLY' : 'AUTHENTICATED_NATIVE_SPIN_NEUTRAL_HISTORICAL_RECORDS_ONLY', actorReference, qualificationReferences,
      modelReference: physical.batterModelReference, physicalReference, lifecycleViewReference: viewReference, observationReference,
      actor: { careerId: actor.binding.careerId, playerId: actor.binding.playerId, personId: actor.binding.personId, gameDay: actor.binding.gameDay },
      physical: { kind: physical.kind, stage: physical.stage, pitchOrdinal: physical.pitchOrdinal, evaluationTick: physical.evaluationTick,
        operationOrdinal: physical.record.operationOrdinal }, currentLifecycle: current ? { kind: current.view.kind, cut: current.view.cut } : null,
      worldRevision: world.head.worldRevision, consumerAdoptionProven: false, officialTerminalProven: false, performancePass: false,
      retained: { actor, actorReference, physical, physicalReference, observation, observationReference, historical, viewReference, qualifications, qualificationReferences, model, world } };
  }));
}

export function authenticateNativeSpinNeutralV193Frontier(db: DatabaseSync, emit: (stage: string, value: unknown) => void) {
  return authenticateFrontier(db, emit, true);
}

/** A historical cut is explicitly not a current coverage proof. The sole
 * consumer is the normal cut4 admission gate, which must prove current again. */
export function readNativeSpinNeutralV193PostObservationRecords(db: DatabaseSync, emit: (stage: string, value: unknown) => void) {
  const result = authenticateFrontier(db, emit, false), r = result.retained;
  if (r.observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V193 in-flight capture required');
  if (r.viewReference.sourceId !== 'physical-fixture:cut3:view'
    || r.physicalReference.owner !== 'pa_physical_v1_cuts' || r.physicalReference.sourceId !== 'native-spin-neutral-v193:pitch3:capture-cut'
    || r.observation.source.viewReference.sourceId !== r.viewReference.sourceId
    || json(r.observation.source.physicalOperationReference) !== json(r.physicalReference)
    || json(r.historical.view.cut.physicalOperationReference) !== json(r.physicalReference)) throw Error('V193 retained post-observation cut differs');
  return r;
}
