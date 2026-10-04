import { derivePrePitchRunnerExecution, type DurablePrePitchRunnerExecution } from './PrePitchRunnerEvidenceFromSqlite';
import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import { beginActualLivePlayWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createHash } from 'node:crypto';
import { capturePhysicalPitchEvidence, physicalPitchActionInput as actionInput, assertPhysicalPitchOriginalEvidence,
  executePhysicalPitchAction as execute, readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
export { capturePhysicalPitchEvidence } from './PhysicalPitchEvidenceFromSqlite';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld, type ContinuousPlayerPitchRequest, type ContinuousPlayerPitchResult } from './ContinuousPlayerPitchRuntime';
import { type DurableInitialOfficialWorld, type SqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteOfficialParticipationStore, OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { AcceptedPitchFatiguePolicy } from './SqlitePitchFatiguePolicyStore';
import type { AcceptedPhysicalPitchEffortPolicy } from './SqliteOfficialPitchWorkloadStore';
import { readPhysicalActorForPlayFromSqlite, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type ActionRequest = Omit<ContinuousPlayerPitchRequest, 'timeline' | 'delivery' | 'effortPolicySourceId'> & Readonly<{
  delivery: Omit<ContinuousPlayerPitchRequest['delivery'], 'playId' | 'pitchIndex'>;
}>;
export type AcceptedPhysicalPitchActionSource = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; request: ActionRequest; effortPolicy: AcceptedPhysicalPitchEffortPolicy;
  prePitchRunner?: AcceptedPrePitchRunnerExecution;
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
  batterActor?: DurablePhysicalPlateAppearanceActor;
  prePitchRunner?: DurablePrePitchRunnerExecution;
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
type EvidenceScope = Pick<Frame, 'gameId' | 'workload' | 'bindings' | 'activationApplicationId' | 'batterActor' | 'prePitchRunner'> & Readonly<{
  policy: Pick<AcceptedPitchFatiguePolicy, 'sourceId'>;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const openSqlitePhysicalPitchProgressStore = (databasePath: string, sources: Sources,
  authority?: Readonly<{ readAcceptedAction(sourceId: string): AcceptedPhysicalPitchActionSource | null }>): SqlitePhysicalPitchProgressStore => {
  if (!id(databasePath) || typeof sources?.matches?.getMatch !== 'function' || typeof sources.initialWorlds?.readAcceptedSource !== 'function'
    || typeof sources.participation?.readPregameBinding !== 'function' || !sources.runtime
    || authority != null && typeof authority.readAcceptedAction !== 'function') throw new Error('invalid physical pitch progress sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  try {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS physical_pitch_progress_heads (
    game_id TEXT NOT NULL, play_id INTEGER NOT NULL, revision INTEGER NOT NULL, last_source_id TEXT NOT NULL, PRIMARY KEY(game_id, play_id)
  ); CREATE TABLE IF NOT EXISTS physical_pitch_progress_actions (
    source_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, play_id INTEGER NOT NULL, progress_revision INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(game_id, play_id, progress_revision)
  );`);
  const bySource = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?');
  let closed = false;
  const check = (...ids: string[]) => { if (closed || ids.some((value) => !id(value))) throw new Error('invalid or closed physical pitch scope'); };
  const evidence = (frame: EvidenceScope, mutable = false): Record<string, readonly string[]> => {
    return capturePhysicalPitchEvidence(db, frame, mutable);
  };
  const openFrame = (frame: Omit<Frame, 'immutableEvidence'>): void => {
    assertPriorPhysicalClosureCompleted(db, frame.activationApplicationId);
    const actualBatter = readPhysicalActorForPlayFromSqlite(db, frame.gameId, frame.match.playId);
    if (json(actualBatter ?? null) !== json(frame.batterActor ?? null)) throw new Error('physical batter ownership changed during frame reads');
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
    assertPriorPhysicalClosureCompleted(db, 'activationApplicationId' in source ? source.activationApplicationId : null);
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
    const batterActor = readPhysicalActorForPlayFromSqlite(db, source.gameId, current.matchState.playId);
    if (batterActor && (json(batterActor.match) !== json(current.matchState) || json(batterActor.world) !== json(world)
      || batterActor.officialRevision !== current.durableRevision)) throw new Error('physical batter current execution frame differs');
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
      policy: { sourceId: source.request.policySourceId }, activationApplicationId: 'activationApplicationId' in source ? source.activationApplicationId : null,
      ...(batterActor ? { batterActor } : {}) };
    if (source.prePitchRunner && !batterActor) throw new Error('pre-pitch runner requires the original accepted physical actor');
    const prePitchRunner = source.prePitchRunner ? derivePrePitchRunnerExecution(db, source.prePitchRunner, batterActor!) : undefined;
    const beforeReads = evidence({ ...evidenceScope, ...(prePitchRunner ? { prePitchRunner } : {}) }, true);
    const workload = cloneInert(sources.runtime.workload.selectAtRevision(delivery.careerId, delivery.playerId, source.request.workloadRevision));
    const policy = cloneInert(sources.runtime.policies.readAcceptedPolicy(source.request.policySourceId));
    if (!policy) throw new Error('accepted pitch response policy is missing');
    const frame = { gameId: source.gameId, officialRevision: current.durableRevision, match: current.matchState, world,
      activation: current.activation, activationApplicationId: 'activationApplicationId' in source ? source.activationApplicationId : null,
      matchSeed: delivery.matchSeed, outingId: delivery.outingId, moundReference: delivery.moundReference, bindings, initialWorld, workload,
      timing: cloneInert(sources.runtime.timing.selectProfileAtDay(delivery.careerId, delivery.playerId, delivery.gameDay)),
      release: cloneInert(sources.runtime.release.selectAtDay(delivery.careerId, delivery.playerId, delivery.gameDay)), policy, effortPolicy: source.effortPolicy,
      ...(batterActor ? { batterActor } : {}), ...(prePitchRunner ? { prePitchRunner } : {}) };
    openFrame(frame);
    if (json(evidence(frame, true)) !== json(beforeReads)) throw new Error('physical pitch Source evidence changed during frame reads');
    return freeze({ ...frame, immutableEvidence: evidence(frame) });
  };
  const history = (gameId: string, playId: number) => readPhysicalPitchProgressFromSqlite(db, gameId, playId);
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
        || json(fresh.policy) !== json(frame.policy) || json(fresh.prePitchRunner ?? null) !== json(frame.prePitchRunner ?? null)) throw new Error('physical pitch progress revision or original execution frame differs');
      const head = db.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
        .get(frame.workload.careerId, frame.workload.playerId) as { revision: number } | undefined;
      if (!head || head.revision !== frame.workload.revision) throw new Error('physical pitch workload advanced during open play');
      const beforeTimeline = previous.at(-1)?.result.pitch.resolution.timeline ?? createCanonicalPlateAppearanceTimeline(frame.match, frame.world.tick);
      const result = execute(source, frame, beforeTimeline, expectedProgressRevision + 1), originalRows = evidence(frame, true);
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePlayWrite(db, { gameId: source.gameId, playId: frame.match.playId }, { owner: 'physical_pitch_progress_actions', sourceId });
        openFrame(frame);
        if (json(evidence(frame, true)) !== json(originalRows) || history(source.gameId, frame.match.playId).length !== expectedProgressRevision) throw new Error('physical pitch evidence changed before append');
        assertPhysicalPitchOriginalEvidence(db, frame);
        db.prepare('INSERT INTO physical_pitch_progress_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(sourceId, source.gameId, frame.match.playId, result.progressRevision, json(source), hash(source), json(result), hash(result));
        if (expectedProgressRevision === 0) db.prepare('INSERT INTO physical_pitch_progress_heads VALUES (?, ?, ?, ?)')
          .run(source.gameId, frame.match.playId, result.progressRevision, sourceId);
        else {
          const changed = db.prepare('UPDATE physical_pitch_progress_heads SET revision=?, last_source_id=? WHERE game_id=? AND play_id=? AND revision=?')
            .run(result.progressRevision, sourceId, source.gameId, frame.match.playId, expectedProgressRevision);
          if (changed.changes !== 1) throw new Error('physical pitch head changed during append');
        }
        recordActualLivePlayAdmission(db, liveFence);
        if (json(evidence(frame, true)) !== json(originalRows)) throw new Error('physical pitch evidence changed during append');
        openFrame(frame);
        const saved = history(source.gameId, frame.match.playId).at(-1)!;
        if (json(saved) !== json(result)) throw new Error('physical pitch Source changed during append');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
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
  } catch (error) { db.close(); throw error; }
};
