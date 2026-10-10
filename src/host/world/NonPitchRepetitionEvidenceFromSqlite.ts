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
import { battedEpisodeFieldBindingEvidenceFromSqlite, withBattedEpisodeFieldBindingReadPhase } from './SqliteBattedEpisodeFieldBindingStore';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { readSamePaTerminalEndpointFromSqlite } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { readSamePaTerminalReleaseFromSqlite, readSamePaTerminalSettlementFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { readSamePaLifecycleOutcomeFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';

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
  const occupied = actor.world.runners.length || Object.values(actor.match.bases).some(player => player !== null);
  const defender = exercise === 'FIELDING_GLOVE_CONTACT';
  const original = occupied ? readSamePaOriginalParticipants(db, actor).find(value => value.binding.playerId === playerId
    && (defender ? value.role === 'defender' : exercise === 'BATTING_CONTACT' ? value.role === 'batter' : value.role !== 'defender')) : undefined;
  const binding = occupied ? original?.binding : defender ? actor.defenderBindings.find(value => value.playerId === playerId)
    : actor.binding.playerId === playerId ? actor.binding : undefined;
  const person = occupied ? original?.person : defender ? actor.defenderPersons.find(value => value.playerId === playerId) : actor.person;
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

const runningWindows = (segments: readonly BallWorldPlayerBaseContactSegment[], playerId: string) => {
  const windows = segments.flatMap(segment => {
    if (segment.endElapsedSeconds <= segment.startElapsedSeconds) return [];
    const bodies = segment.actors.filter(actor => actor.playerId === playerId && actor.primitive.role === 'body');
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
  return windows;
};

/** The string identifies an original closure owner, never a caller-supplied
 * endpoint. Raw aliases and collisions with the ordinary owner fail closed. */
const reservedEndpointReference = (db: DatabaseSync, closureId: string) => {
  if (!bodyCompositionTableInstalled(db, 'pa_terminal_v1_endpoints')) return null;
  const rows = db.prepare('SELECT * FROM main.pa_terminal_v1_endpoints').all().filter(row => row.source_id === closureId
    || metadata(db, String(row.source_json), ['sourceId']).includes(closureId)
    || metadata(db, String(row.snapshot_json), ['source', 'sourceId']).includes(closureId));
  if (!rows.length) return null;
  if (rows.length !== 1 || rows[0].source_id !== closureId) return fail('reserved terminal identity is ambiguous');
  if (bodyCompositionTableInstalled(db, 'actual_live_play_closures')
    && db.prepare('SELECT * FROM main.actual_live_play_closures').all().some(row => row.source_id === closureId
      || metadata(db, String(row.source_json), ['sourceId']).includes(closureId)
      || typeof row.proposal_json === 'string' && metadata(db, row.proposal_json, ['source', 'sourceId']).includes(closureId)
      || typeof row.result_json === 'string' && metadata(db, row.result_json, ['sourceId']).includes(closureId))) {
    return fail('closure owner identity is ambiguous');
  }
  return { owner: 'pa_terminal_v1_endpoints' as const, sourceId: closureId,
    sourceHash: String(rows[0].source_hash), snapshotHash: String(rows[0].snapshot_hash) };
};

/** Existing completed fair-catch endpoints are the bounded reserved adapter.
 * Their original release proves official transition and every actual TOTAL
 * effect. Stationary occupied membership by itself is never a repetition. */
const reservedCompletion = (db: DatabaseSync, frame: NonPitchRepetitionFrame, exercise: NonPitchRepetitionExercise,
  terminalReference: NonNullable<ReturnType<typeof reservedEndpointReference>>) => withBattedEpisodeFieldBindingReadPhase(db,
  () => withSamePaLifecycleReadPhase(db, () => {
    const endpoint = readSamePaTerminalEndpointFromSqlite(db, terminalReference, 'historical');
    if (endpoint.lineage.careerId !== frame.careerId || endpoint.lineage.gameId !== frame.gameId
      || endpoint.lineage.playId !== frame.playId || endpoint.gameDay !== frame.gameDay || !endpoint.fairCatch) {
      return fail('reserved completed physical endpoint differs');
    }
    same(endpoint.actor, frame.actor);
    const release = readSamePaTerminalReleaseFromSqlite(db, endpoint.enrollmentReference.sourceId);
    if (!release) return fail('reserved terminal release is incomplete');
    same(release.terminalReference, terminalReference); same(release.enrollmentReference, endpoint.enrollmentReference);
    const settlement = readSamePaTerminalSettlementFromSqlite(db, release.settlementReference);
    same(settlement.plan.lineage, endpoint.lineage); same(settlement.plan.finalViewReference, endpoint.finalViewReference);
    same(settlement.plan.coverageHash, endpoint.coverageHash);
    const participant = settlement.participants.find(value => value.playerId === frame.playerId);
    if (settlement.kind !== 'settled' || !participant || !participant.applied || participant.activity.kind !== 'MATCH'
      || participant.activity.careerId !== frame.careerId || participant.activity.playerId !== frame.playerId
      || participant.activity.atDay !== frame.gameDay) return fail('reserved original TOTAL MATCH workload is incomplete or differs');
    const workload: DurablePlayerWorkloadActivity = { activity: participant.activity,
      before: participant.reservedState, after: participant.projectedState };
    const outcome = readSamePaLifecycleOutcomeFromSqlite(db, endpoint.outcomeReference);
    same(outcome.lineage, endpoint.lineage); same(outcome.actor, frame.actor); same(outcome.fairCatch, endpoint.fairCatch);
    if (outcome.source.kind !== 'fair_catch') return fail('reserved physical outcome differs');
    const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, outcome.source.viewReference, 'historical');
    if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return fail('reserved sealed physical field prefix is missing');
    const end = endpoint.fairCatch, physical = pair.value.evidence.physical, root = pair.fields[0];
    same(pair.actor, frame.actor); same(pair.view.lineage, endpoint.lineage);
    same(pair.view.coverageHash, end.generation.completeCoverageHash);
    same(pair.value.physicalPitchReference, end.physicalPitchReference);
    same(pair.value.physicalOperationReference, end.physicalOperationReference);
    same(pair.value.fieldReferences, end.generation.ruleConsumption.fieldReferences);
    same(pair.value.evidenceHash, end.generation.ruleConsumption.ruleEvidenceHash);
    const horizon = physical.field.evidence.horizon;
    same({ originTick: horizon.originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick }, end.exactEnd);
    if (root?.kind !== 'same_pa_physical_field_root_v1') return fail('reserved original field root is missing');
    let selected: unknown;
    if (exercise === 'BATTING_CONTACT') {
      const resolution = readSamePaPhysicalOperationFromSqlite(db, root.source.resolutionReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, root.source.launchReference);
      for (const value of [resolution, launch]) {
        same(value.actor, frame.actor); same(value.lineage, endpoint.lineage); same(value.physicalPitchReference, end.physicalPitchReference);
      }
      if (frame.playerId !== frame.actor.binding.playerId || resolution.record.kind !== 'same_pa_physical_resolution_v1'
        || launch.record.kind !== 'same_pa_physical_launch_v1' || !resolution.record.contact
        || !resolution.record.source.commitmentReference) return fail('actual reserved batting contact is missing');
      const commitment = readSamePaPhysicalOperationFromSqlite(db, resolution.record.source.commitmentReference);
      same(commitment.actor, frame.actor); same(commitment.lineage, endpoint.lineage); same(commitment.physicalPitchReference, end.physicalPitchReference);
      const events = resolution.record.timeline.events.slice(launch.record.timeline.events.length).filter(event => event.kind === 'BatBallContact');
      if (commitment.record.kind !== 'same_pa_physical_commitment_v1' || commitment.record.commitment.action !== 'SWING'
        || events.length !== 1 || events[0].tick !== physical.field.evidence.originTick) return fail('actual reserved swing contact is missing');
      same(events[0].payload.contact, resolution.record.contact);
      selected = { contactReference: root.source.resolutionReference, commitmentReference: resolution.record.source.commitmentReference, events };
    } else if (exercise === 'FIELDING_GLOVE_CONTACT') {
      const contacts = physical.field.evidence.contacts.flatMap(frame => frame.contacts
        .filter(contact => contact.kind === 'actor' && contact.playerId === participant.playerId && contact.role === 'glove')
        .map(contact => ({ moment: frame.moment, contact })));
      if (!physical.field.evidence.defenderIds.includes(frame.playerId) || !contacts.length) return fail('actual defender glove contact is missing');
      selected = { contacts };
    } else {
      if (frame.playerId !== frame.actor.binding.playerId && !frame.actor.world.runners.some(runner => runner.playerId === frame.playerId)) {
        return fail('running repetition requires an original offensive participant');
      }
      selected = { windows: runningWindows(physical.segments, frame.playerId) };
    }
    const evidence = freeze({ kind: 'reserved_same_pa_repetition_v1' as const, exercise,
      actorHash: hash(frame.actor), bindingHash: hash(frame.binding), personHash: hash(frame.person), terminalReference,
      physicalPitchReference: end.physicalPitchReference, physicalOperationReference: end.physicalOperationReference,
      fieldReferences: pair.value.fieldReferences, fieldEvidenceHash: pair.value.evidenceHash, selected });
    return freeze({ closureProofHash: hash({ endpoint, release }), physicalProofHash: hash(evidence), workload, evidence });
  }));

/** Existing owner replay proves occurrence. The accepted assessment separately
 * decides learning relevance; this reader creates no workload or source change. */
export const readNonPitchRepetitionCompletion = (db: DatabaseSync, rawFrame: NonPitchRepetitionFrame,
  exercise: NonPitchRepetitionExercise, closureId: string) => {
  const frame = cloneInert(rawFrame);
  if (!['BATTING_CONTACT', 'FIELDING_GLOVE_CONTACT', 'RUNNING_MOTION'].includes(exercise)
    || typeof closureId !== 'string' || !closureId.length || closureId !== closureId.trim()) fail('completion scope is invalid');
  return proof(db, () => {
    const terminalReference = reservedEndpointReference(db, closureId);
    if (terminalReference) {
      same(originalFrame(db, frame.actor.source.sourceId, frame.playerId, frame.binding.personLinkSourceId, exercise, false), frame);
      return reservedCompletion(db, frame, exercise, terminalReference);
    }
    return withFoulTerminalPriorLiveScope(db, closureId, frame.gameId, frame.playId, () => {
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
    if (!pair || pair.value.gameId !== frame.gameId || pair.value.playId !== frame.playId) return fail('ordinary closed physical prefix differs');
    same(pair.value.endReference, closure.proposal.physicalEndReference);
    same(pair.value.wholeHistoryReference, closure.proposal.wholeHistoryReference);
    const pitch = pair.prefix.baseField.response.touch.worldContact.flight.physicalPitch;
    same(pitch.frame.batterActor, frame.actor);
    if (pitch.frame.gameId !== frame.gameId || pitch.frame.match.playId !== frame.playId
      || pair.end.physicalPitchSourceId !== pitch.source.sourceId) return fail('physical pitch original actor scope differs');
    const root = pair.prefix.baseField;
    const episodeFieldBindingReference = isBattedEpisodeFieldRoot(root) ? (() => {
      const binding = root.episodeFieldBinding;
      same(battedEpisodeFieldBindingEvidenceFromSqlite(db).read(binding.source.sourceId), binding);
      if (binding.gameId !== frame.gameId || binding.playId !== frame.playId || binding.physicalPitchSourceId !== pitch.source.sourceId
        || binding.source.version !== 'batted_episode_field_binding_v1' && binding.source.physicalActorSourceId !== frame.actor.source.sourceId) {
        return fail('episode field original actor or pitch differs');
      }
      return { sourceId: binding.source.sourceId, sourceHash: hash(binding.source), snapshotHash: hash(binding) };
    })() : undefined;
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
      selected = { windows: runningWindows(physical.segments, frame.playerId) };
    }
    const evidence = freeze({ exercise, actorHash: hash(frame.actor), bindingHash: hash(frame.binding), personHash: hash(frame.person),
      physicalPitchReference: { sourceId: pitch.source.sourceId, sourceHash: hash(pitch.source), snapshotHash: hash(pitch) },
      physicalEndReference: closure.proposal.physicalEndReference, physicalPrefixReference: pair.end.physicalPrefixReference,
      wholeHistoryReference: closure.proposal.wholeHistoryReference,
      ...(episodeFieldBindingReference ? { episodeFieldBindingReference } : {}), selected });
    return freeze({ closureProofHash: hash(closure), physicalProofHash: hash(evidence), workload, evidence });
    });
  });
};
