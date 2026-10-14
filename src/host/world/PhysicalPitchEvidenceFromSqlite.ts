import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import { assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import { originalBattingIntentInput } from './OriginalBattingIntent';
import { derivePrePitchRunnerExecution } from './PrePitchRunnerEvidenceFromSqlite';
import { prePitchRunnerExecutionInput } from './PrePitchRunnerExecution';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { AcceptedPhysicalPitchActionSource, DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';

import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame, assertBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';

type Frame = DurablePhysicalPitch['frame'];
type Row = { source_id: string; game_id: string; play_id: number; progress_revision: number; source_json: string;
  source_hash: string; snapshot_json: string; snapshot_hash: string };
type PhysicalPitchDb = Pick<DatabaseSync, 'prepare'>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
type EvidenceScope = Pick<DurablePhysicalPitch['frame'], 'gameId' | 'workload' | 'bindings' | 'activationApplicationId' | 'batterActor' | 'prePitchRunner'> & Readonly<{
  policy: Pick<DurablePhysicalPitch['frame']['policy'], 'sourceId'>;
}>;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');

/** Owns actual pitch progress; independent action Sources contain no authoritative timeline or outcome. */
export const capturePhysicalPitchEvidence = (db: Pick<DatabaseSync, 'prepare'>,
  frame: EvidenceScope, mutable = false): Record<string, readonly string[]> => {
  const result: Record<string, readonly string[]> = {};
  if (frame.bindings.length !== 9 || new Set(frame.bindings.map((binding) => binding.playerId)).size !== 9
    || new Set(frame.bindings.map((binding) => binding.personId)).size !== 9) throw new Error('physical pitch actor evidence is incomplete');
  const fixture = db.prepare('SELECT fixture_event_id FROM official_fixtures WHERE game_id=?')
    .get(frame.gameId) as { fixture_event_id: string } | undefined;
  for (const binding of frame.bindings) {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
      .get(binding.gameId, binding.playerId) as { binding_json: string } | undefined;
    const first = frame.bindings[0];
    if (!row || json(JSON.parse(row.binding_json)) !== json(binding) || !fixture || binding.gameId !== frame.gameId
      || binding.fixtureEventId !== fixture.fixture_event_id || binding.careerId !== frame.workload.careerId
      || binding.competitionEditionId !== first.competitionEditionId || binding.gameDay !== first.gameDay
      || binding.clubId !== first.clubId || binding.side !== first.side) throw new Error('physical pitch actor binding evidence differs');
    readOfficialActorPersonLink(db, binding);
  }
  const national = assertNationalMatchBindings(db, [...frame.bindings,
    ...(frame.batterActor ? [frame.batterActor.binding] : []), ...(frame.prePitchRunner ? [frame.prePitchRunner.binding] : [])]);
  if (national) result.nationalMatchOrigin = [hash(national)];
  const scope = [frame.workload.careerId, frame.workload.playerId];
  for (const table of ['world_pitch_timing_baselines', 'world_pitch_timing_updates', 'world_player_release_baselines',
    'world_player_release_changes', 'world_player_workload_baselines', 'world_player_workload_activities']) {
    result[table] = db.prepare(`SELECT * FROM ${table} WHERE career_id=? AND player_id=?`).all(...scope).map(hash).sort();
  }
  result.policy = db.prepare('SELECT * FROM world_pitch_fatigue_policies WHERE source_id=?').all(frame.policy.sourceId).map(hash);
  result.workloadPolicy = db.prepare('SELECT * FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
    .all(frame.workload.careerId, frame.workload.policy.policyId, frame.workload.policy.version).map(hash);
  result.bindings = frame.bindings.flatMap((binding) => db.prepare('SELECT * FROM official_participant_bindings WHERE game_id=? AND player_id=?')
    .all(binding.gameId, binding.playerId).map(hash));
  result.personLinks = frame.bindings.flatMap((binding) => db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?')
    .all(binding.personLinkSourceId).map(hash));
  result.fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').all(frame.gameId).map(hash);
  result.activation = frame.activationApplicationId === null ? [] : db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?')
    .all(frame.activationApplicationId, frame.gameId).map(hash);
  if (frame.batterActor) {
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, frame.batterActor.source.sourceId);
    if (!actor || json(actor) !== json(frame.batterActor) || actor.source.gameId !== frame.gameId
      || actor.binding.careerId !== frame.workload.careerId || json(actor.defenderBindings) !== json(frame.bindings)) throw new Error('physical batter original evidence differs');
    result.batterActor = db.prepare('SELECT * FROM physical_plate_appearance_actors WHERE source_id=?').all(actor.source.sourceId).map(hash);
  }
  if (frame.prePitchRunner) {
    if (!frame.batterActor || json(derivePrePitchRunnerExecution(db, frame.prePitchRunner.source, frame.batterActor)) !== json(frame.prePitchRunner)) {
      throw new Error('pre-pitch runner original execution evidence differs');
    }
    const binding = frame.prePitchRunner.binding;
    result.prePitchRunner = [hash(frame.prePitchRunner),
      ...db.prepare('SELECT * FROM official_participant_bindings WHERE game_id=? AND player_id=?').all(binding.gameId, binding.playerId).map(hash),
      ...db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').all(binding.personLinkSourceId).map(hash)];
  }
  if (mutable) {
    result.match = db.prepare('SELECT * FROM matches WHERE match_id=?').all(frame.gameId).map(hash);
    for (const table of ['world_pitch_timing_heads', 'world_player_release_heads', 'world_player_workload_heads']) {
      result[table] = db.prepare(`SELECT * FROM ${table} WHERE career_id=? AND player_id=?`).all(...scope).map(hash);
    }
  }
  return result;
};

export const physicalPitchActionInput = (raw: AcceptedPhysicalPitchActionSource, sourceId: string): AcceptedPhysicalPitchActionSource => {
  const source = cloneInert(raw), initial = source && 'initialWorldSourceId' in source;
  if (!source || !fields(source, ['sourceId', 'sourceVersion', 'gameId', 'request', 'effortPolicy', initial ? 'initialWorldSourceId' : 'activationApplicationId', ...('prePitchRunner' in source ? ['prePitchRunner'] : []), ...('battingIntent' in source ? ['battingIntent'] : [])])
    || source.sourceId !== sourceId || !id(sourceId) || !id(source.sourceVersion) || !id(source.gameId)
    || !id(initial ? source.initialWorldSourceId : source.activationApplicationId)
    || !source.request || !fields(source.request, ['delivery', 'flight', 'batter', 'workloadRevision', 'policySourceId'])
    || !integer(source.request.workloadRevision) || !id(source.request.policySourceId) || !source.request.delivery
    || !fields(source.request.delivery, ['careerId', 'playerId', 'gameDay', 'matchSeed', 'moundReference', 'outingId', 'readyAtUs', 'timingIntent', 'physics'])
    || !id(source.request.delivery.careerId) || !id(source.request.delivery.playerId) || !integer(source.request.delivery.gameDay)
    || !source.request.flight || !fields(source.request.flight, ['durationUs', 'acceleration']) || !source.request.batter
    || !fields(source.request.batter, source.request.batter.action?.kind === 'take' ? ['action', 'plateZ', 'strikeZone', 'ballRadiusMeters'] : ['action'])
    || !source.request.batter.action || !fields(source.request.batter.action, source.request.batter.action.kind === 'take' ? ['kind'] : ['kind', 'swing'])) {
    throw new Error('invalid accepted physical pitch action Source');
  }
  if ('prePitchRunner' in source) prePitchRunnerExecutionInput(source.prePitchRunner!);
  if ('battingIntent' in source) {
    originalBattingIntentInput(source.battingIntent!);
    if (source.request.batter.action.kind !== 'swing') throw new Error('original batting intent requires a swing action');
  }
  return source;
};

export const assertPhysicalPitchOriginalEvidence = (db: PhysicalPitchDb, frame: Frame): void => {
  if (frame.activation) {
    if (frame.activation.nextMatchState.playId !== frame.match.playId) throw new Error('physical pitch activation consuming frame differs');
    assertFoulTerminalPriorActivation(db,frame.gameId,frame.activation.previousPlayId,frame.match.playId);
  }
  if (frame.batterActor?.origin.foulTerminalReadiness && (frame.batterActor.origin.actualLiveReadiness
    || frame.batterActor.origin.foulTerminalReadiness.applicationId !== frame.activationApplicationId
    || frame.batterActor.origin.foulTerminalReadiness.gameId !== frame.gameId
    || frame.batterActor.origin.foulTerminalReadiness.previousPlayId + 1 !== frame.match.playId)) throw new Error('terminal physical pitch readiness frame differs');
  if (frame.batterActor && (json(frame.batterActor.match) !== json(frame.match) || json(frame.batterActor.world) !== json(frame.world)
    || frame.batterActor.officialRevision !== frame.officialRevision)) throw new Error('physical batter original execution frame differs');
  const current = capturePhysicalPitchEvidence(db, frame);
  if (!fields(frame.immutableEvidence, Object.keys(current))) throw new Error('physical pitch evidence fields differ');
  for (const key of Object.keys(current)) {
    const available = new Set(current[key]);
    if (!Array.isArray(frame.immutableEvidence[key]) || frame.immutableEvidence[key].some((value) => !available.has(value))) {
      throw new Error('original physical pitch evidence changed');
    }
  }
  if (frame.initialWorld) assertInitialOfficialWorldEvidence(db, frame.initialWorld, true);
};

export const executePhysicalPitchAction = (source: AcceptedPhysicalPitchActionSource, frame: Frame, beforeTimeline: CanonicalPlateAppearanceTimeline,
  progressRevision: number): DurablePhysicalPitch => {
  if ('battingIntent' in source) {
    const intent = originalBattingIntentInput(source.battingIntent!);
    if (!frame.batterActor || intent.actorSourceId !== frame.batterActor.source.sourceId || source.request.batter.action.kind !== 'swing') {
      throw new Error('original batting intent actor or action differs');
    }
  }
  if (json(source.prePitchRunner ?? null) !== json(frame.prePitchRunner?.source ?? null)) throw new Error('physical pitch original runner Source differs');
  if (source.gameId !== frame.gameId || json(source.effortPolicy) !== json(frame.effortPolicy) || source.request.workloadRevision !== frame.workload.revision
    || source.request.policySourceId !== frame.policy.sourceId || source.request.delivery.careerId !== frame.workload.careerId
    || source.request.delivery.playerId !== frame.workload.playerId || source.request.delivery.gameDay !== frame.bindings[0].gameDay
    || source.request.delivery.matchSeed !== frame.matchSeed || source.request.delivery.outingId !== frame.outingId
    || json(source.request.delivery.moundReference) !== json(frame.moundReference)) throw new Error('physical pitch frame differs');
  const result = resolveContinuousPlayerPitchAgainstBatterFromWorld({ workload: { selectAtRevision: () => frame.workload },
    timing: { selectProfileAtDay: () => frame.timing }, release: { selectAtDay: () => frame.release },
    policies: { readAcceptedPolicy: () => frame.policy }, effortPolicies: { readAcceptedPolicy: () => frame.effortPolicy } },
  { ...source.request, timeline: beforeTimeline, effortPolicySourceId: frame.effortPolicy.sourceId,
    delivery: { ...source.request.delivery, playId: frame.match.playId, pitchIndex: progressRevision - 1 } });
  if (result.pitch.resolution.kind !== 'recorded') throw new Error('physical pitch action is unresolved');
  return freeze({ source, progressRevision, frame, beforeTimeline, result });
};

const replayPhysicalPitchRows = (db: PhysicalPitchDb, rows: readonly Row[], gameId: string, playId: number): DurablePhysicalPitch[] => {
    const first = JSON.parse(rows[0].snapshot_json) as DurablePhysicalPitch, frame = cloneInert(first.frame);
    if (frame.gameId !== gameId || frame.match.playId !== playId) throw new Error('physical pitch frame scope differs');
    assertPhysicalPitchOriginalEvidence(db, frame);
    let timeline = createCanonicalPlateAppearanceTimeline(frame.match, frame.world.tick);
    const accepted: DurablePhysicalPitch[] = [];
    for (const [index, row] of rows.entries()) {
      const source = physicalPitchActionInput(JSON.parse(row.source_json) as AcceptedPhysicalPitchActionSource, row.source_id);
      const value = executePhysicalPitchAction(source, frame, timeline, index + 1);
      if (row.game_id !== gameId || row.play_id !== playId || row.progress_revision !== index + 1 || row.source_json !== json(source)
        || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('physical pitch archive differs');
      timeline = value.result.pitch.resolution.timeline; accepted.push(value);
    }
    return accepted;
};

export const readPhysicalPitchProgressFromSqlite = (db: PhysicalPitchDb, gameId: string, playId: number): DurablePhysicalPitch[] => {
  try {
    const rows = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision').all(gameId, playId) as Row[];
    const head = db.prepare('SELECT revision, last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').get(gameId, playId) as { revision: number; last_source_id: string } | undefined;
    if (rows.length === 0) { if (head) throw new Error('physical pitch head lacks history'); return []; }
    const accepted = replayPhysicalPitchRows(db, rows, gameId, playId);
    if (!head || head.revision !== rows.length || head.last_source_id !== rows[rows.length - 1].source_id) throw new Error('physical pitch head diverged');
    return accepted;
  } catch (cause) { throw new Error('corrupt physical pitch progress history', { cause }); }
};

/** Replay only the original owned prefix, without executing later Sources that may depend on this evidence. */
export const readOriginalPhysicalPitchPrefixFromSqlite = (db: PhysicalPitchDb, sourceId: string): DurablePhysicalPitch[] => {
  if (activeBattedWorldFieldReadFrame(db)) return [...readOriginalPhysicalPitchWithRowsFromSqlite(db, sourceId).prefix];
  try {
    if (!id(sourceId)) throw new Error('invalid original physical pitch Source');
    const endpoint = db.prepare('SELECT source_id,game_id,play_id,progress_revision FROM physical_pitch_progress_actions WHERE source_id=?')
      .get(sourceId) as Pick<Row, 'source_id' | 'game_id' | 'play_id' | 'progress_revision'> | undefined;
    if (!endpoint || !id(endpoint.game_id) || !integer(endpoint.play_id) || !integer(endpoint.progress_revision) || endpoint.progress_revision === 0) {
      throw new Error('original physical pitch Source is missing or invalid');
    }
    const head = db.prepare('SELECT revision,last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?')
      .get(endpoint.game_id, endpoint.play_id) as { revision: number; last_source_id: string } | undefined;
    const metadata = db.prepare('SELECT source_id,progress_revision FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision')
      .all(endpoint.game_id, endpoint.play_id) as Pick<Row, 'source_id' | 'progress_revision'>[];
    if (!head || !integer(head.revision) || head.revision < endpoint.progress_revision || !id(head.last_source_id)
      || metadata.length !== head.revision || metadata.at(-1)?.source_id !== head.last_source_id
      || metadata.some((row, index) => !id(row.source_id) || !integer(row.progress_revision) || row.progress_revision !== index + 1)) {
      throw new Error('original physical pitch current prefix structure differs');
    }
    const rows = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? AND progress_revision<=? ORDER BY progress_revision')
      .all(endpoint.game_id, endpoint.play_id, endpoint.progress_revision) as Row[];
    if (rows.length !== endpoint.progress_revision || rows.at(-1)?.source_id !== sourceId) throw new Error('original physical pitch endpoint differs');
    return replayPhysicalPitchRows(db, rows, endpoint.game_id, endpoint.play_id);
  } catch (cause) { throw new Error('corrupt original physical pitch prefix', { cause }); }
};

/** Canonical identity of the owned endpoint, equal to its actual head archive when first accepted. */
export const captureOriginalPhysicalPitchRows = (db: PhysicalPitchDb, sourceId: string): Readonly<{ actions: readonly string[]; head: string }> => {
  const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, sourceId).at(-1)!;
  const actions = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? AND progress_revision<=? ORDER BY progress_revision')
    .all(pitch.frame.gameId, pitch.frame.match.playId, pitch.progressRevision).map(hash);
  return freeze({ actions, head: hash({ game_id: pitch.frame.gameId, play_id: pitch.frame.match.playId,
    revision: pitch.progressRevision, last_source_id: sourceId }) });
};

type OriginalPhysicalPitchWithRows = Readonly<{
  prefix: readonly DurablePhysicalPitch[];
  originalPitchRows: Readonly<{ actions: readonly string[]; head: string }>;
}>;
type PhysicalPitchPairIdentity = Readonly<{ endpoint: string; head: string; metadata: readonly string[]; rows: readonly string[] }>;
// No result crosses an owner frame, including its fresh child frames. Only the
// full successful replay and both raw audits can install a completed proof.
const completedPhysicalPitchPairs = new WeakMap<object, { failed: boolean; namespace: string;
  values: Map<string, Readonly<{ identity: PhysicalPitchPairIdentity; value: OriginalPhysicalPitchWithRows }>> }>();
const samePairIdentity = (left: PhysicalPitchPairIdentity, right: PhysicalPitchPairIdentity): boolean =>
  left.endpoint === right.endpoint && left.head === right.head
  && left.metadata.length === right.metadata.length && left.metadata.every((row, index) => row === right.metadata[index])
  && left.rows.length === right.rows.length && left.rows.every((row, index) => row === right.rows[index]);

// Private to the paired owner: detach each SQL value before any authentication
// callback. Each row keeps the existing inert encoding budget independently.
const loadOriginalPhysicalPitchPairRows = (db: PhysicalPitchDb, sourceId: string) => {
  if (!id(sourceId)) throw new Error('invalid original physical pitch Source');
  const endpoint = freeze(cloneInert(db.prepare('SELECT source_id,game_id,play_id,progress_revision FROM physical_pitch_progress_actions WHERE source_id=?')
    .get(sourceId) ?? null)) as Pick<Row, 'source_id' | 'game_id' | 'play_id' | 'progress_revision'> | null;
  if (!endpoint || !id(endpoint.game_id) || !integer(endpoint.play_id) || !integer(endpoint.progress_revision) || endpoint.progress_revision === 0) {
    throw new Error('original physical pitch Source is missing or invalid');
  }
  const head = freeze(cloneInert(db.prepare('SELECT revision,last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?')
    .get(endpoint.game_id, endpoint.play_id) ?? null)) as { revision: number; last_source_id: string } | null;
  const metadata = Object.freeze((db.prepare('SELECT source_id,progress_revision FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision')
    .all(endpoint.game_id, endpoint.play_id) as Pick<Row, 'source_id' | 'progress_revision'>[]).map(row => freeze(cloneInert(row))));
  if (!head || !integer(head.revision) || head.revision < endpoint.progress_revision || !id(head.last_source_id)
    || metadata.length !== head.revision || metadata.at(-1)?.source_id !== head.last_source_id
    || metadata.some((row, index) => !id(row.source_id) || !integer(row.progress_revision) || row.progress_revision !== index + 1)) {
    throw new Error('original physical pitch current prefix structure differs');
  }
  const rows = Object.freeze((db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? AND progress_revision<=? ORDER BY progress_revision')
    .all(endpoint.game_id, endpoint.play_id, endpoint.progress_revision) as Row[]).map(row => freeze(cloneInert(row))));
  if (rows.length !== endpoint.progress_revision || rows.at(-1)?.source_id !== sourceId) throw new Error('original physical pitch endpoint differs');
  return { endpoint, head, metadata, rows };
};

/** A fully authenticated replay and its exact rows, confined to one unchanged owner read frame. */
export const readOriginalPhysicalPitchWithRowsFromSqlite = (db: PhysicalPitchDb, sourceId: string): OriginalPhysicalPitchWithRows => {
  const frame = activeBattedWorldFieldReadFrame(db);
  if (!frame) throw new Error('original physical pitch pair requires an owned read frame');
  let completed = completedPhysicalPitchPairs.get(frame);
  const checkFrame = () => {
    try { assertBattedWorldFieldReadFrame(db, frame); }
    catch (error) { if (completed) { completed.failed = true; completed.values.clear(); } throw error; }
  };
  checkFrame();
  let value: OriginalPhysicalPitchWithRows, identities: PhysicalPitchPairIdentity;
  let reusable = false;
  try {
    const databases = db.prepare('PRAGMA database_list').all(), namespace = json(databases);
    // Attached owners may be replaced without changing the main/temp stamp.
    // Preserve their original fresh-read route rather than caching their proof.
    reusable = databases.every(database => database.name === 'main' || database.name === 'temp');
    if (!completed) {
      completed = { failed: false, namespace, values: new Map() };
      completedPhysicalPitchPairs.set(frame, completed);
    }
    if (completed.failed || completed.namespace !== namespace) throw new Error('original physical pitch completed proof expired');
    const owned = loadOriginalPhysicalPitchPairRows(db, sourceId);
    identities = { endpoint: json(owned.endpoint), head: json(owned.head),
      metadata: owned.metadata.map(json), rows: owned.rows.map(json) };
    const prior = reusable ? completed.values.get(sourceId) : undefined;
    if (prior && !samePairIdentity(identities, prior.identity)) throw new Error('original physical pitch paired identity changed');
    const prefix = prior?.value.prefix ?? replayPhysicalPitchRows(db, owned.rows, owned.endpoint.game_id, owned.endpoint.play_id);
    // Recheck SQL structure and raw bytes only; the audit never authenticates or
    // replays again, and its rows never replace the replayed copies for hashing.
    const audit = loadOriginalPhysicalPitchPairRows(db, sourceId);
    if (!samePairIdentity({ endpoint: json(audit.endpoint), head: json(audit.head),
      metadata: audit.metadata.map(json), rows: audit.rows.map(json) }, identities)) {
      throw new Error('original physical pitch paired identity changed');
    }
    const pitch = prefix.at(-1)!;
    const originalPitchRows = freeze({ actions: owned.rows.map(hash),
      head: hash({ game_id: pitch.frame.gameId, play_id: pitch.frame.match.playId,
        revision: pitch.progressRevision, last_source_id: sourceId }) });
    if (json(db.prepare('PRAGMA database_list').all()) !== namespace) throw new Error('original physical pitch namespace changed');
    value = prior?.value ?? Object.freeze({ prefix: Object.freeze(prefix), originalPitchRows });
  } catch (cause) {
    if (completed) { completed.failed = true; completed.values.clear(); }
    throw new Error('corrupt original physical pitch prefix', { cause });
  }
  checkFrame();
  if (completed!.failed) throw new Error('corrupt original physical pitch prefix', {
    cause: new Error('original physical pitch completed proof expired') });
  if (reusable) completed!.values.set(sourceId, { identity: identities, value });
  return value;
};
