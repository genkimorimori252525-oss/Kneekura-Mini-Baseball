import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld, type ContinuousPlayerPitchRequest, type ContinuousPlayerPitchResult } from './ContinuousPlayerPitchRuntime';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink, type DurableInitialOfficialWorld, type SqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteOfficialParticipationStore, OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import type { AcceptedPhysicalPitchEffortPolicy } from './SqliteOfficialPitchWorkloadStore';

type ActionRequest = Omit<ContinuousPlayerPitchRequest, 'timeline' | 'delivery' | 'effortPolicySourceId'> & Readonly<{
  delivery: Omit<ContinuousPlayerPitchRequest['delivery'], 'playId' | 'pitchIndex'>;
}>;
export type AcceptedPhysicalPitchActionSource = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; request: ActionRequest; effortPolicy: AcceptedPhysicalPitchEffortPolicy;
}> & (Readonly<{ initialWorldSourceId: string }> | Readonly<{ activationApplicationId: string }>);
type Runtime = Parameters<typeof resolveContinuousPlayerPitchAgainstBatterFromWorld>[0];
type Sources = Readonly<{
  matches: Pick<SqliteOfficialStateStore, 'getMatch'>; initialWorlds: Pick<SqliteOfficialInitialWorldStore, 'readAcceptedSource'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readPregameBinding'>; runtime: Runtime;
}>;
type Frame = Readonly<{
  gameId: string; officialRevision: number; match: CanonicalMatchState; world: CanonicalWorldSnapshot;
  activation: NonNullable<ReturnType<Sources['matches']['getMatch']>>['activation'];
  activationApplicationId: string | null; matchSeed: number; outingId: string; moundReference: ActionRequest['delivery']['moundReference'];
  bindings: readonly OfficialParticipantBinding[]; initialWorld: DurableInitialOfficialWorld | null;
  workload: PlayerWorkloadRecoveryState; timing: PitchTimingProfile; release: PlayerReleaseGeometrySnapshot;
  policy: AcceptedPitchFatiguePolicy; effortPolicy: AcceptedPhysicalPitchEffortPolicy; immutableEvidence: Record<string, readonly string[]>;
}>;
export type DurablePhysicalPitch = Readonly<{
  source: AcceptedPhysicalPitchActionSource; progressRevision: number; frame: Frame;
  beforeTimeline: CanonicalPlateAppearanceTimeline; result: ContinuousPlayerPitchResult;
}>;
export type SqlitePhysicalPitchProgressStore = Readonly<{
  accept(sourceId: string, expectedProgressRevision: number): DurablePhysicalPitch;
  readAcceptedPitch(sourceId: string): DurablePhysicalPitch | null;
  readProgress(gameId: string, playId: number): DurablePhysicalPitch | null;
  close(): void;
}>;
type Row = { source_id: string; game_id: string; play_id: number; progress_revision: number; source_json: string;
  source_hash: string; snapshot_json: string; snapshot_hash: string };
type EvidenceScope = Pick<Frame, 'gameId' | 'workload' | 'bindings' | 'activationApplicationId'> & Readonly<{
  policy: Pick<AcceptedPitchFatiguePolicy, 'sourceId'>;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const actionInput = (raw: AcceptedPhysicalPitchActionSource, sourceId: string): AcceptedPhysicalPitchActionSource => {
  const source = cloneInert(raw), initial = source && 'initialWorldSourceId' in source;
  if (!source || !fields(source, ['sourceId', 'sourceVersion', 'gameId', 'request', 'effortPolicy', initial ? 'initialWorldSourceId' : 'activationApplicationId'])
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
  return source;
};

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
  if (mutable) {
    result.match = db.prepare('SELECT * FROM matches WHERE match_id=?').all(frame.gameId).map(hash);
    for (const table of ['world_pitch_timing_heads', 'world_player_release_heads', 'world_player_workload_heads']) {
      result[table] = db.prepare(`SELECT * FROM ${table} WHERE career_id=? AND player_id=?`).all(...scope).map(hash);
    }
  }
  return result;
};

export const openSqlitePhysicalPitchProgressStore = (databasePath: string, sources: Sources,
  authority?: Readonly<{ readAcceptedAction(sourceId: string): AcceptedPhysicalPitchActionSource | null }>): SqlitePhysicalPitchProgressStore => {
  if (!id(databasePath) || typeof sources?.matches?.getMatch !== 'function' || typeof sources.initialWorlds?.readAcceptedSource !== 'function'
    || typeof sources.participation?.readPregameBinding !== 'function' || !sources.runtime
    || authority != null && typeof authority.readAcceptedAction !== 'function') throw new Error('invalid physical pitch progress sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS physical_pitch_progress_heads (
    game_id TEXT NOT NULL, play_id INTEGER NOT NULL, revision INTEGER NOT NULL, last_source_id TEXT NOT NULL, PRIMARY KEY(game_id, play_id)
  ); CREATE TABLE IF NOT EXISTS physical_pitch_progress_actions (
    source_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, play_id INTEGER NOT NULL, progress_revision INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(game_id, play_id, progress_revision)
  );`);
  const bySource = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?');
  const getRows = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision');
  const getHead = db.prepare('SELECT revision, last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?');
  let closed = false;
  const check = (...ids: string[]) => { if (closed || ids.some((value) => !id(value))) throw new Error('invalid or closed physical pitch scope'); };
  const evidence = (frame: EvidenceScope, mutable = false): Record<string, readonly string[]> => {
    return capturePhysicalPitchEvidence(db, frame, mutable);
  };
  const originalEvidence = (frame: Frame): void => {
    const current = evidence(frame);
    if (!fields(frame.immutableEvidence, Object.keys(current))) throw new Error('physical pitch evidence fields differ');
    for (const key of Object.keys(current)) {
      const available = new Set(current[key]);
      if (!Array.isArray(frame.immutableEvidence[key]) || frame.immutableEvidence[key].some((value) => !available.has(value))) {
        throw new Error('original physical pitch evidence changed');
      }
    }
    if (frame.initialWorld) assertInitialOfficialWorldEvidence(db, frame.initialWorld, true);
  };
  const openFrame = (frame: Omit<Frame, 'immutableEvidence'>): void => {
    const row = db.prepare('SELECT durable_revision, state_json, activation_json FROM matches WHERE match_id=?')
      .get(frame.gameId) as { durable_revision: number; state_json: string; activation_json: string | null } | undefined;
    const expectedActivation = frame.activation === null ? null : { activation: frame.activation, nextWorld: frame.world };
    const workload = db.prepare('SELECT revision, state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
      .get(frame.workload.careerId, frame.workload.playerId) as { revision: number; state_json: string } | undefined;
    if (!row || row.durable_revision !== frame.officialRevision || json(JSON.parse(row.state_json)) !== json(frame.match)
      || json(row.activation_json === null ? null : JSON.parse(row.activation_json)) !== json(expectedActivation)
      || !workload || workload.revision !== frame.workload.revision || json(JSON.parse(workload.state_json)) !== json(frame.workload)) {
      throw new Error('physical pitch Match or workload advanced during open play');
    }
  };
  const frameInput = (source: AcceptedPhysicalPitchActionSource): Frame => {
    const current = cloneInert(sources.matches.getMatch(source.gameId));
    if (!current || current.finalResult) throw new Error('physical pitch Match is missing or final');
    const initialWorld = 'initialWorldSourceId' in source ? cloneInert(sources.initialWorlds.readAcceptedSource(source.initialWorldSourceId)) : null;
    let world: CanonicalWorldSnapshot;
    if ('initialWorldSourceId' in source) {
      if (!initialWorld || current.durableRevision !== 0 || current.activation !== null || json(current.matchState) !== json(initialWorld.match)
        || initialWorld.source.gameId !== source.gameId) throw new Error('accepted initial World is missing or advanced');
      world = initialWorld.world;
    } else {
      const activation = db.prepare('SELECT result_json FROM applications WHERE application_id=? AND match_id=?')
        .get(source.activationApplicationId, source.gameId) as { result_json: string } | undefined;
      const result = activation ? JSON.parse(activation.result_json) as { activation: unknown; nextWorld: CanonicalWorldSnapshot } : null;
      if (!result || !current.activation || !current.nextWorld || json(result.activation) !== json(current.activation)
        || json(result.nextWorld) !== json(current.nextWorld)) throw new Error('actual activation World differs');
      world = current.nextWorld;
    }
    const bindings = world.defenders.map((defender) => {
      const binding = cloneInert(sources.participation.readPregameBinding(source.gameId, defender.playerId));
      if (!binding || binding.gameId !== source.gameId || binding.playerId !== defender.playerId
        || binding.side !== (current.matchState.half === 'top' ? 'HOME' : 'AWAY')) throw new Error('actual defender binding differs');
      return binding;
    });
    const pitchers = world.defenders.filter((defender) => defender.registeredPosition === 'P');
    const binding = pitchers.length === 1 ? bindings.find((value) => value.playerId === pitchers[0].playerId) : null;
    const delivery = source.request.delivery;
    if (!binding || bindings.length !== 9 || binding.careerId !== delivery.careerId || binding.playerId !== delivery.playerId
      || binding.gameDay !== delivery.gameDay) throw new Error('physical pitch actor scope differs');
    const beforeHead = db.prepare('SELECT state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
      .get(delivery.careerId, delivery.playerId) as { state_json: string } | undefined;
    if (!beforeHead) throw new Error('physical pitch workload baseline is missing');
    const evidenceScope = { gameId: source.gameId, bindings, workload: JSON.parse(beforeHead.state_json) as PlayerWorkloadRecoveryState,
      policy: { sourceId: source.request.policySourceId }, activationApplicationId: 'activationApplicationId' in source ? source.activationApplicationId : null };
    const beforeReads = evidence(evidenceScope, true);
    const workload = cloneInert(sources.runtime.workload.selectAtRevision(delivery.careerId, delivery.playerId, source.request.workloadRevision));
    const policy = cloneInert(sources.runtime.policies.readAcceptedPolicy(source.request.policySourceId));
    if (!policy) throw new Error('accepted pitch response policy is missing');
    const frame = { gameId: source.gameId, officialRevision: current.durableRevision, match: current.matchState, world,
      activation: current.activation, activationApplicationId: 'activationApplicationId' in source ? source.activationApplicationId : null,
      matchSeed: delivery.matchSeed, outingId: delivery.outingId, moundReference: delivery.moundReference, bindings, initialWorld, workload,
      timing: cloneInert(sources.runtime.timing.selectProfileAtDay(delivery.careerId, delivery.playerId, delivery.gameDay)),
      release: cloneInert(sources.runtime.release.selectAtDay(delivery.careerId, delivery.playerId, delivery.gameDay)), policy, effortPolicy: source.effortPolicy };
    openFrame(frame);
    if (json(evidence(frame, true)) !== json(beforeReads)) throw new Error('physical pitch Source evidence changed during frame reads');
    return freeze({ ...frame, immutableEvidence: evidence(frame) });
  };
  const execute = (source: AcceptedPhysicalPitchActionSource, frame: Frame, beforeTimeline: CanonicalPlateAppearanceTimeline,
    progressRevision: number): DurablePhysicalPitch => {
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
  const history = (gameId: string, playId: number): DurablePhysicalPitch[] => {
    try {
      const rows = getRows.all(gameId, playId) as Row[];
      const head = getHead.get(gameId, playId) as { revision: number; last_source_id: string } | undefined;
      if (rows.length === 0) { if (head) throw new Error('physical pitch head lacks history'); return []; }
      const first = JSON.parse(rows[0].snapshot_json) as DurablePhysicalPitch, frame = cloneInert(first.frame);
      if (frame.gameId !== gameId || frame.match.playId !== playId) throw new Error('physical pitch frame scope differs');
      originalEvidence(frame);
      let timeline = createCanonicalPlateAppearanceTimeline(frame.match, frame.world.tick);
      const accepted: DurablePhysicalPitch[] = [];
      for (const [index, row] of rows.entries()) {
        const source = actionInput(JSON.parse(row.source_json) as AcceptedPhysicalPitchActionSource, row.source_id);
        const value = execute(source, frame, timeline, index + 1);
        if (row.game_id !== gameId || row.play_id !== playId || row.progress_revision !== index + 1 || row.source_json !== json(source)
          || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('physical pitch archive differs');
        timeline = value.result.pitch.resolution.timeline; accepted.push(value);
      }
      if (!head || head.revision !== rows.length || head.last_source_id !== rows[rows.length - 1].source_id) throw new Error('physical pitch head diverged');
      return accepted;
    } catch (cause) { throw new Error('corrupt physical pitch progress history', { cause }); }
  };
  return Object.freeze({
    accept(sourceId, expectedProgressRevision): DurablePhysicalPitch {
      check(sourceId); if (!integer(expectedProgressRevision)) throw new Error('invalid physical pitch progress revision');
      const prior = bySource.get(sourceId) as Row | undefined, raw = authority?.readAcceptedAction(sourceId) ?? null;
      const source = raw === null ? null : actionInput(raw, sourceId);
      if (prior) {
        const original = history(prior.game_id, prior.play_id)[prior.progress_revision - 1];
        if (expectedProgressRevision !== prior.progress_revision - 1 || source && json(source) !== prior.source_json) throw new Error('physical pitch action is already frozen differently');
        return original;
      }
      if (!source) throw new Error('accepted physical pitch action is missing');
      const fresh = frameInput(source), previous = history(source.gameId, fresh.match.playId);
      const frame = previous[0]?.frame ?? fresh;
      if (previous.length !== expectedProgressRevision || json(fresh.match) !== json(frame.match) || fresh.officialRevision !== frame.officialRevision
        || json(fresh.workload) !== json(frame.workload) || json(fresh.timing) !== json(frame.timing) || json(fresh.release) !== json(frame.release)
        || json(fresh.policy) !== json(frame.policy)) throw new Error('physical pitch progress revision or original execution frame differs');
      const head = db.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
        .get(frame.workload.careerId, frame.workload.playerId) as { revision: number } | undefined;
      if (!head || head.revision !== frame.workload.revision) throw new Error('physical pitch workload advanced during open play');
      const beforeTimeline = previous.at(-1)?.result.pitch.resolution.timeline ?? createCanonicalPlateAppearanceTimeline(frame.match, frame.world.tick);
      const result = execute(source, frame, beforeTimeline, expectedProgressRevision + 1), originalRows = evidence(frame, true);
      db.exec('BEGIN IMMEDIATE');
      try {
        openFrame(frame);
        if (json(evidence(frame, true)) !== json(originalRows) || history(source.gameId, frame.match.playId).length !== expectedProgressRevision) throw new Error('physical pitch evidence changed before append');
        originalEvidence(frame);
        db.prepare('INSERT INTO physical_pitch_progress_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(sourceId, source.gameId, frame.match.playId, result.progressRevision, json(source), hash(source), json(result), hash(result));
        if (expectedProgressRevision === 0) db.prepare('INSERT INTO physical_pitch_progress_heads VALUES (?, ?, ?, ?)')
          .run(source.gameId, frame.match.playId, result.progressRevision, sourceId);
        else {
          const changed = db.prepare('UPDATE physical_pitch_progress_heads SET revision=?, last_source_id=? WHERE game_id=? AND play_id=? AND revision=?')
            .run(result.progressRevision, sourceId, source.gameId, frame.match.playId, expectedProgressRevision);
          if (changed.changes !== 1) throw new Error('physical pitch head changed during append');
        }
        if (json(evidence(frame, true)) !== json(originalRows)) throw new Error('physical pitch evidence changed during append');
        openFrame(frame);
        const saved = history(source.gameId, frame.match.playId).at(-1)!;
        if (json(saved) !== json(result)) throw new Error('physical pitch Source changed during append');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readAcceptedPitch(sourceId): DurablePhysicalPitch | null {
      check(sourceId); const row = bySource.get(sourceId) as Row | undefined;
      return row ? history(row.game_id, row.play_id)[row.progress_revision - 1] : null;
    },
    readProgress(gameId, playId): DurablePhysicalPitch | null {
      check(gameId); if (!integer(playId)) throw new Error('invalid physical pitch playId');
      return history(gameId, playId).at(-1) ?? null;
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
