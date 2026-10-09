import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { nonPitchOpportunityInput, type NonPitchRepetitionOpportunity, type NonPitchRepetitionExercise } from './NonPitchDevelopmentRepetition';
import { actorFreeze as freeze, actorHash as hash, actorJson as json, assertPhysicalActorOpenFrame,
  readPhysicalActorForPlayFromSqlite, readPhysicalPlateAppearanceActorFromSqlite,
  type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { assertBodyCompositionNativeConnection, bodyCompositionTableInstalled } from './BodyMaterializationSqliteOwnership';
import { originalFoulMetadataValues as metadata } from './OriginalFoulOwnershipMetadata';
import { assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { assertActualLiveClosureStage } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualRoleWorkloadEvidenceFromSqlite } from './ActualRoleWorkloadEvidenceFromSqlite';
import type { DurablePlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import { withFoulTerminalPriorLiveScope } from './FoulTerminalCompletionAncestryGuard';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { isBattedEpisodeFieldRoot } from './BattedWorldFieldRoot';

export type NonPitchRepetitionFrame = Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; binding: OfficialParticipantBinding;
  person: DurablePhysicalPlateAppearanceActor['person']; careerId: string; gameId: string;
  playId: number; playerId: string; gameDay: number;
}>;
const fail = (detail: string): never => { throw new Error('non-pitch repetition ' + detail); };
const same = (a: unknown, b: unknown): void => { if (json(a) !== json(b)) fail('original evidence differs'); };
const proof = <T>(db: DatabaseSync, body: () => T): T => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction) return fail('requires an active Native transaction');
  assertBodyCompositionNativeConnection(db);
  return withBattedWorldPhysicalReadTraversal(db, body);
};

/** Admission discovers raw original identities as well as indexed columns.
 * A moved head or a changed cached game/play cannot hide an already flown pitch. */
const assertPitchNotStarted = (db: DatabaseSync, actor: DurablePhysicalPlateAppearanceActor): void => {
  const game = actor.source.gameId, play = actor.match.playId;
  assertNoSamePaWorkReservation(db, { gameId: game, playId: play });
  for (const table of ['physical_pitch_progress_heads', 'physical_pitch_progress_actions'] as const) {
    if (!bodyCompositionTableInstalled(db, table)) continue;
    const columns = new Set(db.prepare(`PRAGMA main.table_info(${table})`).all().map(row => row.name));
    const required = table === 'physical_pitch_progress_heads'
      ? ['game_id', 'play_id', 'last_source_id', 'revision']
      : ['game_id', 'play_id', 'source_id', 'source_json', 'snapshot_json'];
    if (required.some(column => !columns.has(column))) fail('physical pitch owner schema differs');
    for (const row of db.prepare(`SELECT * FROM main.${table}`).all()) {
      if (row.game_id === game && row.play_id === play) fail('opportunity must precede its physical pitch');
      if (table !== 'physical_pitch_progress_actions') continue;
      const source = String(row.source_json), snapshot = String(row.snapshot_json);
      const games = [row.game_id, ...metadata(db, source, ['gameId']), ...metadata(db, snapshot, ['source', 'gameId']),
        ...metadata(db, snapshot, ['frame', 'gameId']), ...metadata(db, snapshot, ['frame', 'batterActor', 'source', 'gameId'])];
      const plays = [row.play_id, ...metadata(db, snapshot, ['frame', 'match', 'playId']),
        ...metadata(db, snapshot, ['beforeTimeline', 'playId']), ...metadata(db, snapshot, ['result', 'pitch', 'resolution', 'timeline', 'playId']),
        ...metadata(db, snapshot, ['frame', 'batterActor', 'match', 'playId'])];
      const actorIds = metadata(db, snapshot, ['frame', 'batterActor', 'source', 'sourceId']);
      const activationKey = 'initialWorldSourceId' in actor.source ? 'initialWorldSourceId' : 'activationApplicationId';
      const activationId = 'initialWorldSourceId' in actor.source ? actor.source.initialWorldSourceId : actor.source.activationApplicationId;
      const origins = [...metadata(db, source, [activationKey]), ...metadata(db, snapshot, ['source', activationKey])];
      if (games.includes(game) && plays.includes(play) || actorIds.includes(actor.source.sourceId) || origins.includes(activationId)) {
        fail('opportunity must precede every original physical pitch claim');
      }
    }
  }
};

const originalFrame = (db: DatabaseSync, actorSourceId: string, playerId: string,
  personLinkSourceId: string, exercise: NonPitchRepetitionExercise, fresh: boolean): NonPitchRepetitionFrame => {
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, actorSourceId);
  if (!actor) return fail('original actor is missing');
  const claimed = db.prepare('SELECT * FROM main.physical_plate_appearance_actors').all().filter(row =>
    row.source_id === actorSourceId || metadata(db, String(row.source_json), ['sourceId']).includes(actorSourceId)
    || metadata(db, String(row.snapshot_json), ['source', 'sourceId']).includes(actorSourceId));
  if (claimed.length !== 1 || claimed[0].source_id !== actorSourceId) fail('original actor identity is ambiguous');
  same(readPhysicalActorForPlayFromSqlite(db, actor.source.gameId, actor.match.playId), actor);
  if (actor.world.runners.length || Object.values(actor.match.bases).some(player => player !== null)) {
    fail('requires the ordinary empty-base physical actor');
  }
  const defender = exercise === 'FIELDING_GLOVE_CONTACT';
  const binding = defender ? actor.defenderBindings.find(value => value.playerId === playerId)
    : actor.binding.playerId === playerId ? actor.binding : undefined;
  const person = defender ? actor.defenderPersons.find(value => value.playerId === playerId) : actor.person;
  if (!binding || !person || binding.personLinkSourceId !== personLinkSourceId || person.sourceId !== personLinkSourceId
    || person.personId !== binding.personId || binding.gameId !== actor.source.gameId || binding.careerId !== actor.binding.careerId
    || binding.gameDay !== actor.binding.gameDay) return fail('exercise original participant or Person differs');
  if (fresh) { assertPhysicalActorOpenFrame(db, actor); assertPitchNotStarted(db, actor); }
  return freeze({ actor, binding, person, careerId: binding.careerId, gameId: actor.source.gameId,
    playId: actor.match.playId, playerId, gameDay: binding.gameDay });
};

/** Fresh admission is prospective. Historical reads retain the exact old actor. */
export const readNonPitchRepetitionFrame = (db: DatabaseSync, raw: NonPitchRepetitionOpportunity,
  fresh: boolean): NonPitchRepetitionFrame => {
  const source = nonPitchOpportunityInput(raw, raw.sourceId);
  return proof(db, () => originalFrame(db, source.actorSourceId, source.playerId, source.personLinkSourceId, source.exercise, fresh));
};

/** Existing owner replay proves occurrence. The accepted assessment separately
 * decides learning relevance; this reader creates no workload or source change. */
export const readNonPitchRepetitionCompletion = (db: DatabaseSync, rawFrame: NonPitchRepetitionFrame,
  exercise: NonPitchRepetitionExercise, closureId: string) => {
  const frame = cloneInert(rawFrame);
  if (!['BATTING_CONTACT', 'FIELDING_GLOVE_CONTACT', 'RUNNING_MOTION'].includes(exercise)
    || typeof closureId !== 'string' || !closureId.length || closureId !== closureId.trim()) fail('completion scope is invalid');
  return proof(db, () => withFoulTerminalPriorLiveScope(db, closureId, frame.gameId, frame.playId, () => {
    same(originalFrame(db, frame.actor.source.sourceId, frame.playerId, frame.binding.personLinkSourceId, exercise, false), frame);
    const owned = actualRoleWorkloadEvidenceFromSqlite(db).readWithClosure(closureId, closure => {
      const p = closure.proposal;
      if (closure.status !== 'OFFICIAL_APPLIED' || !closure.officialApplied || p.gameId !== frame.gameId || p.playId !== frame.playId) {
        return fail('exact applied ordinary closure is missing');
      }
      assertActualLiveClosureStage(db, p, true);
      const participant = p.actors.find(value => value.binding.playerId === frame.playerId);
      if (!participant) return fail('closure original participant is missing');
      same(participant, { binding: frame.binding, person: frame.person });
      return true;
    });
    const closure = owned.closure, settlement = owned.settlement;
    if (!settlement || settlement.kind !== 'complete') return fail('original total MATCH workload is incomplete');
    const participant = settlement.participants.find(value => value.playerId === frame.playerId);
    if (!participant || !participant.applied || participant.activity.kind !== 'MATCH'
      || participant.activity.careerId !== frame.careerId || participant.activity.playerId !== frame.playerId
      || participant.activity.atDay !== frame.gameDay || participant.personId !== frame.person.personId) {
      return fail('original MATCH workload participant differs');
    }
    const workload: DurablePlayerWorkloadActivity = { activity: participant.activity, before: participant.before, after: participant.after };
    const pair = actualLiveAdjudicationEvidenceFromSqlite(db).readWithClosureInputs(closure.source.adjudicationSourceId);
    if (!pair || pair.value.gameId !== frame.gameId || pair.value.playId !== frame.playId
      || isBattedEpisodeFieldRoot(pair.prefix.baseField)) return fail('ordinary closed physical prefix differs');
    same(pair.value.endReference, closure.proposal.physicalEndReference);
    same(pair.value.wholeHistoryReference, closure.proposal.wholeHistoryReference);
    const pitch = pair.prefix.baseField.response.touch.worldContact.flight.physicalPitch;
    same(pitch.frame.batterActor, frame.actor);
    if (pitch.frame.gameId !== frame.gameId || pitch.frame.match.playId !== frame.playId
      || pair.end.physicalPitchSourceId !== pitch.source.sourceId) return fail('physical pitch original actor scope differs');
    const physical = battedWorldFieldPhysicalPrefix({ ...pair.prefix, custodyPolicy: 'release_exclusive_v1' });
    let selected: unknown;
    if (exercise === 'BATTING_CONTACT') {
      const events = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length)
        .filter(event => event.kind === 'BatBallContact');
      if (frame.playerId !== physical.field.evidence.batterRunnerId || pitch.source.request.batter.action.kind !== 'swing'
        || events.length !== 1 || events[0].tick !== physical.field.evidence.originTick) return fail('actual batting contact is missing');
      selected = { events };
    } else if (exercise === 'FIELDING_GLOVE_CONTACT') {
      const contacts = physical.field.evidence.contacts.flatMap(frame => frame.contacts
        .filter(contact => contact.kind === 'actor' && contact.playerId === participant.playerId && contact.role === 'glove')
        .map(contact => ({ moment: frame.moment, contact })));
      if (!physical.field.evidence.defenderIds.includes(frame.playerId) || !contacts.length) return fail('actual defender glove contact is missing');
      selected = { contacts };
    } else {
      if (frame.playerId !== physical.field.evidence.batterRunnerId) return fail('running repetition requires the original batter-runner');
      const windows = physical.segments.flatMap(segment => {
        if (segment.endElapsedSeconds <= segment.startElapsedSeconds) return [];
        const bodies = segment.actors.filter(actor => actor.playerId === frame.playerId && actor.primitive.role === 'body');
        if (bodies.length !== 1) return fail('executed runner body is ambiguous');
        const actor = bodies[0], p = actor.primitive;
        const local = segment.startElapsedSeconds - (p.startTick - segment.originTick) / p.ticksPerSecond - (actor.startElapsedSeconds ?? 0);
        const velocity = { x: p.startVelocity.x + p.acceleration.x * local, z: p.startVelocity.z + p.acceleration.z * local };
        if (!Number.isFinite(local) || !Object.values(velocity).every(Number.isFinite)) return fail('executed runner motion is non-finite');
        if (velocity.x === 0 && velocity.z === 0 && p.acceleration.x === 0 && p.acceleration.z === 0) return [];
        return [{ originTick: segment.originTick, startElapsedSeconds: segment.startElapsedSeconds,
          endElapsedSeconds: segment.endElapsedSeconds, body: actor }];
      });
      if (!windows.length) return fail('actual positive-duration runner motion is missing');
      selected = { windows };
    }
    const evidence = freeze({ exercise, actorHash: hash(frame.actor), bindingHash: hash(frame.binding), personHash: hash(frame.person),
      physicalPitchReference: { sourceId: pitch.source.sourceId, sourceHash: hash(pitch.source), snapshotHash: hash(pitch) },
      physicalEndReference: closure.proposal.physicalEndReference, physicalPrefixReference: pair.end.physicalPrefixReference,
      wholeHistoryReference: closure.proposal.wholeHistoryReference, selected });
    return freeze({ closureProofHash: hash(closure), physicalProofHash: hash(evidence), workload, evidence });
  }));
};
