import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, assertPhysicalActorOpenFrame,
  readPhysicalPlateAppearanceActorFromSqlite, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionSourceClaim as claim } from './BodyMaterializationSqliteOwnership';
import { batterRunArchiveFromSqlite, openBatterRunSourceArchive, assertBatterRunArchiveStorage, type BatterRunArchiveOwner } from './BatterRunSourceArchive';
import { samePaOccupiedRunnerHoldInput as input, samePaOccupiedRunnerHoldCurves,
  type AcceptedSamePaOccupiedRunnerHold as Source } from './SamePlateAppearanceOccupiedRunnerHold';
import { readHistoricalSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollmentFromSqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
const table = 'world_same_pa_occupied_runner_holds' as const;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('occupied runner original hold ownership differs'); };
const derive = (db: DatabaseSync, source: Source) => {
  const enrollment = readHistoricalSamePlateAppearanceEnrollment(db, source.enrollmentReference.sourceId);
  if (!enrollment) throw new Error('occupied runner original enrollment missing');
  same(reference('same_pa_enrollments', enrollment), source.enrollmentReference);
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, enrollment.source.actorReference.sourceId);
  if (!actor) throw new Error('occupied runner original actor missing');
  same(reference('physical_plate_appearance_actors', actor), enrollment.source.actorReference);
  const participant = readSamePaOriginalParticipants(db, actor).find(p => p.binding.playerId === source.playerId);
  const reserved = enrollment.participants.find(p => p.binding.playerId === source.playerId);
  if (!participant || participant.role !== 'runner' || participant.binding.personId !== source.personId || !reserved)
    throw new Error('occupied runner original Player, Person or role differs');
  same(reserved.binding, participant.binding); same(reserved.personHash, hash(participant.person));
  const body = playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(source.bodyReference.sourceId);
  const models = playerRunnerDecisionMotionModelEvidenceFromSqlite(db), model = models.read(source.runnerModelReference.sourceId);
  if (!body || !model) throw new Error('occupied runner original body or decision-motion model missing');
  same(reference('world_player_body_materializations', body), source.bodyReference);
  same(reference('world_player_runner_decision_motion_models', model), source.runnerModelReference);
  same(body.person, participant.person); same(model.person, participant.person);
  if (body.source.role !== 'runner' || body.source.careerId !== enrollment.careerId || body.source.playerId !== source.playerId
    || body.source.atDay > actor.binding.gameDay || model.source.careerId !== enrollment.careerId || model.source.playerId !== source.playerId
    || model.source.acceptedAtDay > actor.binding.gameDay || model.source.motion.ticksPerSecond !== 1_000_000) throw new Error('occupied runner original body/model scope or clock differs');
  const runner = actor.world.runners.find(r => r.playerId === source.playerId)!;
  const setup = { ...runner, personId: source.personId, tick: actor.world.tick };
  const actors = samePaOccupiedRunnerHoldCurves(source, setup, body.actor, model.source.motion.ticksPerSecond);
  return freeze({ kind: 'same_pa_occupied_runner_hold_v1' as const, source, actorReference: enrollment.source.actorReference,
    gameId: enrollment.gameId, playId: enrollment.playId, careerId: enrollment.careerId, binding: participant.binding,
    person: participant.person, startingBase: participant.startingBase, setup, body, model, actors,
    motionExecuted: false as const });
};
export type DurableSamePaOccupiedRunnerHold = ReturnType<typeof derive>;
const make = (db: DatabaseSync): BatterRunArchiveOwner<Source, DurableSamePaOccupiedRunnerHold> => ({ input, derive: s => derive(db, s),
  key: s => json([s.enrollmentReference.sourceId, s.playerId]),
  scope: s => ({ sql: `(${claim('source_json', ['enrollmentReference', 'sourceId'])} OR ${claim('snapshot_json', ['source', 'enrollmentReference', 'sourceId'])})
    AND (${claim('source_json', ['playerId'])} OR ${claim('snapshot_json', ['source', 'playerId'])})`,
  values: [s.enrollmentReference.sourceId, s.enrollmentReference.sourceId, s.playerId, s.playerId] }),
  assertCurrent: value => {
    const enrollment = readHistoricalSamePlateAppearanceEnrollment(db, value.source.enrollmentReference.sourceId)!;
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, value.actorReference.sourceId)!;
    assertPhysicalActorOpenFrame(db, actor);
    same(playerRunnerDecisionMotionModelEvidenceFromSqlite(db).selectAtDay(value.careerId, value.source.playerId, actor.binding.gameDay), value.model);
    // An original pre-pitch command cannot be accepted retroactively after its
    // first physical consumer. Immutable retries remain historical reads.
    if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='pa_dispatch_v1_pitch_actions'").get()
      && db.prepare(`SELECT 1 FROM main.pa_dispatch_v1_pitch_actions WHERE enrollment_source_id=? OR
        ${claim('source_json', ['enrollmentReference', 'sourceId'])} OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'])}`)
        .get(enrollment.source.sourceId, enrollment.source.sourceId, enrollment.source.sourceId)) throw new Error('occupied runner hold must precede original pitch consumption');
    for (const p of enrollment.participants) same(readActualRoleWorkloadState(db, enrollment.careerId, p.binding.playerId, undefined, p.binding.personLinkSourceId), p.state);
  },
});
export const assertSamePaOccupiedRunnerHoldStorage = (db: Pick<DatabaseSync, 'prepare'>) => assertBatterRunArchiveStorage(db, table);
export const readSamePaOccupiedRunnerHoldFromSqlite = (db: DatabaseSync, pin: SamePaReference<typeof table>) => {
  if (!samePaReferenceValid(pin, table)) throw new Error('invalid occupied runner hold reference');
  const value = batterRunArchiveFromSqlite(db, table, make(db)).read(pin.sourceId);
  if (!value) throw new Error('original occupied runner hold missing'); same(reference(table, value), pin); return value;
};
/** Read only selected original commands. Neither another player's body nor a
 * posture's declared horizon can replace this runner's finite issued coverage. */
export const readSamePaOccupiedRunnerHolds = (db: DatabaseSync, actor: DurablePhysicalPlateAppearanceActor,
  enrollmentReference: SamePaReference<'same_pa_enrollments'>, pins: readonly SamePaReference<typeof table>[] | undefined,
  fromTick: number, throughTick: number): readonly DurableSamePaOccupiedRunnerHold[] => withSamePaLifecycleReadPhase(db, () => {
  const expected = actor.world.runners.map(r => r.playerId).sort(), refs = pins ?? [];
  if (!expected.length && !refs.length) return [];
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(throughTick) || fromTick < actor.world.tick || throughTick < fromTick
    || refs.length !== expected.length || new Set(refs.map(r => r.sourceId)).size !== refs.length) throw new Error('occupied runner exact hold coverage missing');
  const values = refs.map(pin => readSamePaOccupiedRunnerHoldFromSqlite(db, pin));
  same(values.map(v => v.source.playerId).sort(), expected);
  for (const v of values) {
    same(v.source.enrollmentReference, enrollmentReference); same(v.actorReference, reference('physical_plate_appearance_actors', actor));
    if (v.source.intent.issuedTick > fromTick || v.source.coverageThroughTick < throughTick) throw new Error('occupied runner finite hold coverage exhausted');
  }
  return freeze(values);
});
export const openSqliteSamePlateAppearanceOccupiedRunnerHoldStore = (path: string,
  authority?: Readonly<{ readAcceptedHold(id: string): Source | null }>) =>
  openBatterRunSourceArchive(path, table, make, authority?.readAcceptedHold.bind(authority));

/** Retires the original issued authority at rule-system reset. This inventory
 * does not claim that its whole declared future was physically executed. */
export const samePaOccupiedRunnerHoldRetirement = (db: DatabaseSync, actor: DurablePhysicalPlateAppearanceActor,
  enrollmentReference: SamePaReference<'same_pa_enrollments'>, completedAtTick: number): readonly import('./SamePlateAppearanceLifecycleOutcome').SamePaControllerCommand[] => {
  if (!actor.world.runners.length) return [];
  if (!assertSamePaOccupiedRunnerHoldStorage(db)) throw new Error('occupied runner retirement original hold owner missing');
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE ${claim('source_json', ['enrollmentReference', 'sourceId'])}
    OR ${claim('snapshot_json', ['source', 'enrollmentReference', 'sourceId'])}`).all(enrollmentReference.sourceId, enrollmentReference.sourceId);
  const pins = rows.map(r => ({ owner: table, sourceId: String(r.source_id), sourceHash: String(r.source_hash), snapshotHash: String(r.snapshot_hash) }));
  const holds = readSamePaOccupiedRunnerHolds(db, actor, enrollmentReference, pins, actor.world.tick, completedAtTick);
  return freeze(holds.map(hold => ({ kind: 'occupied_runner_hold' as const, sourceReference: reference(table, hold), playerId: hold.source.playerId,
    role: 'runner_hold', validThroughTick: hold.source.coverageThroughTick, originalCommand: hold.source, originalCommandHash: hash(hold.source) })));
};
