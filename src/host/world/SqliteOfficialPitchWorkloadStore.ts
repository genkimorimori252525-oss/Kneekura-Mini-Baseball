import { assertNoActualRoleWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assessOfficialPhysicalPitchWorkload, OFFICIAL_PHYSICAL_PITCH_WORKLOAD_VERSION,
  type PhysicalPitchEffortPolicy } from '../../core/world/development/OfficialPhysicalPitchWorkload';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { SqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import type { SqliteOfficialParticipationStore, AcceptedPitcherPlay } from './SqliteOfficialParticipationStore';
import { assertInitialOfficialWorldEvidence, type SqliteOfficialInitialWorldStore, type AcceptedInitialPitcherPlay,
  type DurableInitialOfficialWorld } from './SqliteOfficialInitialWorldStore';
import { capturePhysicalPitchEvidence, type SqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import type { SqliteEvidenceGuard } from '../SqliteEvidenceGuard';

export type AcceptedPhysicalPitchEffortPolicy = PhysicalPitchEffortPolicy & Readonly<{ sourceId: string; sourceVersion: string }>;
export type OfficialPitchWorkloadRequest = Readonly<{ scoringApplicationId: string; policySourceId: string }> & (
  Readonly<{ activationApplicationId: string }> | Readonly<{ initialWorldSourceId: string }>);
export type OfficialPhysicalPitchActivity = Extract<PlayerWorkloadActivity, { kind: 'MATCH' }>;
export type SqliteOfficialPitchWorkloadStore = Readonly<{
  accept(request: OfficialPitchWorkloadRequest): OfficialPhysicalPitchActivity;
  readAcceptedActivity(sourceId: string): OfficialPhysicalPitchActivity | null;
  close(): void;
}>;
type SourceRow = { source_id: string; career_id: string; player_id: string; game_id: string; played_play_id: number;
  scoring_application_id: string; policy_source_id: string; request_json: string; source_json: string; proof_json: string };
type PolicyRow = { source_id: string; policy_id: string; version: string; source_json: string; policy_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const requestInput = (raw: OfficialPitchWorkloadRequest): OfficialPitchWorkloadRequest => {
  const input = cloneInert(raw);
  if (!input || !id(input.scoringApplicationId) || !id(input.policySourceId)) throw new Error('invalid official pitch workload request');
  const activated = 'activationApplicationId' in input;
  if (!fields(input, ['scoringApplicationId', 'policySourceId', activated ? 'activationApplicationId' : 'initialWorldSourceId'])
    || (activated ? !id(input.activationApplicationId) : !id(input.initialWorldSourceId))) throw new Error('invalid official pitch workload request');
  return input;
};
const policyInput = (raw: AcceptedPhysicalPitchEffortPolicy | null, sourceId: string): AcceptedPhysicalPitchEffortPolicy => {
  const input = cloneInert(raw);
  if (!input || !fields(input, ['sourceId', 'sourceVersion', 'policyId', 'version', 'availableAtDay', 'effortUnitsPerPhysicalPitch'])
    || input.sourceId !== sourceId || !id(input.sourceVersion)) throw new Error('accepted physical pitch effort policy is missing or differs');
  return input;
};
const effortPolicy = (input: AcceptedPhysicalPitchEffortPolicy): PhysicalPitchEffortPolicy => ({
  policyId: input.policyId, version: input.version, availableAtDay: input.availableAtDay, effortUnitsPerPhysicalPitch: input.effortUnitsPerPhysicalPitch });
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Generates actual action Sources; the global workload owner alone advances fatigue. */
export const openSqliteOfficialPitchWorkloadStore = (databasePath: string, sources: Readonly<{
  scoring: Pick<SqliteOfficialScoringStore, 'readAcceptedPlay'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readPitcherPlay'>;
  initialWorlds?: Pick<SqliteOfficialInitialWorldStore, 'readInitialPitcherPlay' | 'readAcceptedSource'>;
  physicalPitches?: Pick<SqlitePhysicalPitchProgressStore, 'readProgress'>;
}>, authority?: Readonly<{ readAcceptedPolicy(sourceId: string): AcceptedPhysicalPitchEffortPolicy | null }>,
evidenceGuard?: SqliteEvidenceGuard<OfficialPitchWorkloadRequest>): SqliteOfficialPitchWorkloadStore => {
  if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid pitch workload evidence guard');
  if (!id(databasePath) || !sources || typeof sources.scoring?.readAcceptedPlay !== 'function'
    || typeof sources.participation?.readPitcherPlay !== 'function'
    || sources.initialWorlds != null && (typeof sources.initialWorlds.readInitialPitcherPlay !== 'function'
      || typeof sources.initialWorlds.readAcceptedSource !== 'function')
    || sources.physicalPitches != null && typeof sources.physicalPitches.readProgress !== 'function'
    || authority != null && typeof authority.readAcceptedPolicy !== 'function') throw new Error('invalid official pitch workload sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS official_pitch_workload_policies (
    source_id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, version TEXT NOT NULL, source_json TEXT NOT NULL, policy_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS official_pitch_workload_sources (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL, game_id TEXT NOT NULL,
    played_play_id INTEGER NOT NULL CHECK(played_play_id >= 0), scoring_application_id TEXT NOT NULL UNIQUE,
    policy_source_id TEXT NOT NULL, request_json TEXT NOT NULL, source_json TEXT NOT NULL, proof_json TEXT NOT NULL,
    UNIQUE(career_id, game_id, played_play_id, player_id)
  );`);
  const bySource = db.prepare('SELECT * FROM official_pitch_workload_sources WHERE source_id=?');
  const byScoring = db.prepare('SELECT * FROM official_pitch_workload_sources WHERE scoring_application_id=?');
  const getPolicy = db.prepare('SELECT * FROM official_pitch_workload_policies WHERE source_id=?');
  let closed = false;
  const checkOpen = () => { if (closed) throw new Error('official pitch workload store is closed'); };
  const project = (request: OfficialPitchWorkloadRequest, policy: AcceptedPhysicalPitchEffortPolicy) => {
    evidenceGuard?.(db, request, 'retry');
    const raw = sources.scoring.readAcceptedPlay(request.scoringApplicationId);
    if (!raw) throw new Error('accepted official scored play is missing');
    const play = cloneInert(raw), application = play.application;
    if (play.scoring.scoringApplicationId !== request.scoringApplicationId || play.scoring.officialApplicationId !== application.applicationId
      || play.scoring.matchId !== application.matchId) throw new Error('accepted official scored play scope differs');
    const timeline = application.kind === 'non_live' ? application.timeline : application.physicalTimeline;
    let pitcher: AcceptedPitcherPlay | AcceptedInitialPitcherPlay;
    let initialWorld: DurableInitialOfficialWorld | null = null;
    if ('activationApplicationId' in request) {
      pitcher = cloneInert(sources.participation.readPitcherPlay(application.matchId, request.activationApplicationId, application.applicationId));
      if (pitcher.activationApplicationId !== request.activationApplicationId) throw new Error('pitcher activation scope differs');
    } else {
      if (!sources.initialWorlds) throw new Error('accepted initial World authority is missing');
      initialWorld = cloneInert(sources.initialWorlds.readAcceptedSource(request.initialWorldSourceId));
      if (!initialWorld) throw new Error('accepted initial World Source is missing');
      assertInitialOfficialWorldEvidence(db, initialWorld, true);
      pitcher = cloneInert(sources.initialWorlds.readInitialPitcherPlay(request.initialWorldSourceId, application.applicationId));
      if (pitcher.initialWorldSourceId !== request.initialWorldSourceId || application.expectedDurableRevision !== 0
        || pitcher.startedAtTick !== timeline.startedAtTick) throw new Error('initial pitcher play scope or start differs');
    }
    if (pitcher.binding.gameId !== application.matchId || pitcher.closureApplicationId !== application.applicationId
      || pitcher.playedPlayId !== application.match.playId
      || json(pitcher.activatedMatchState) !== json(application.match)
      || pitcher.durableRevision !== application.expectedDurableRevision + 1) throw new Error('actual pitcher play scope differs');
    assertNoActualRoleWorkloadCharge(db, { careerId: pitcher.binding.careerId, gameId: application.matchId,
      playId: pitcher.playedPlayId, playerId: pitcher.binding.playerId });
    const workload = assessOfficialPhysicalPitchWorkload(timeline,
      effortPolicy(policy), pitcher.binding.gameDay);
    // Native readers on another connection cannot see this transaction's trigger changes.
    const closure = db.prepare('SELECT * FROM applications WHERE application_id=?').get(application.applicationId) as {
      application_id: string; match_id: string; closure_id: string; request_hash: string; result_json: string;
    } | undefined;
    const scoring = db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?')
      .get(request.scoringApplicationId) as { match_id: string; official_application_id: string; closure_id: string;
        source_event_id: string; request_json: string; result_json: string } | undefined;
    const receipt = closure ? (JSON.parse(closure.result_json) as { receipt: {
      applicationId: string; previousPlayId: number; durableRevision: number;
    } }).receipt : null;
    const scoredRequest = scoring ? JSON.parse(scoring.request_json) as { input: { officialApplication: unknown } } : null;
    const officialInput = 'game' in application ? { kind: 'game_final', request: application } : application;
    if (!closure || closure.match_id !== application.matchId || closure.closure_id !== play.scoring.closureId
      || closure.request_hash !== createHash('sha256').update(json(officialInput)).digest('hex')
      || !receipt || receipt.applicationId !== application.applicationId || receipt.previousPlayId !== application.match.playId
      || receipt.durableRevision !== application.expectedDurableRevision + 1 || !scoring || scoring.match_id !== application.matchId
      || scoring.official_application_id !== application.applicationId || scoring.closure_id !== play.scoring.closureId
      || scoring.source_event_id !== play.scoring.sourceEventId || json(JSON.parse(scoring.result_json)) !== json(play.scoring)
      || json(scoredRequest?.input?.officialApplication) !== json(application)) throw new Error('actual scored closure evidence differs');
    const officialEvidence = { closure, scoring };
    const physicalProgress = sources.physicalPitches?.readProgress(application.matchId, application.match.playId) ?? null;
    let progressEvidence: Readonly<{ actions: readonly string[]; head: readonly string[] }> | null = null;
    if (sources.physicalPitches) {
      if (!physicalProgress || json(physicalProgress.frame.effortPolicy) !== json(policy)) throw new Error('physical pitch progress calibration differs');
      if (json(physicalProgress.result.pitch.resolution.timeline) !== json(timeline) || json(physicalProgress.frame.match) !== json(application.match)
        || physicalProgress.frame.workload.careerId !== pitcher.binding.careerId || physicalProgress.frame.workload.playerId !== pitcher.binding.playerId) {
        throw new Error('actual durable physical pitch progress differs');
      }
      const current = capturePhysicalPitchEvidence(db, physicalProgress.frame);
      for (const [key, values] of Object.entries(physicalProgress.frame.immutableEvidence)) {
        const actual = new Set(current[key]);
        if (values.some((value) => !actual.has(value))) throw new Error('original physical pitch progress evidence changed');
      }
      if (physicalProgress.frame.initialWorld) assertInitialOfficialWorldEvidence(db, physicalProgress.frame.initialWorld, true);
      const rowHash = (row: unknown) => createHash('sha256').update(json(row)).digest('hex');
      progressEvidence = {
        actions: db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision')
          .all(application.matchId, application.match.playId).map(rowHash),
        head: db.prepare('SELECT * FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').all(application.matchId, application.match.playId).map(rowHash),
      };
    }
    const sourceId = `official-physical-pitch-workload:${createHash('sha256').update(json([
      pitcher.binding.careerId, application.matchId, pitcher.playedPlayId, pitcher.binding.playerId])).digest('hex')}`;
    const activity: OfficialPhysicalPitchActivity = freeze({ sourceEventId: sourceId, sourceVersion: OFFICIAL_PHYSICAL_PITCH_WORKLOAD_VERSION,
      evidenceId: application.applicationId, careerId: pitcher.binding.careerId, playerId: pitcher.binding.playerId,
      atDay: pitcher.binding.gameDay, kind: 'MATCH', effortUnits: workload.effortUnits });
    return { activity, gameId: application.matchId, playId: pitcher.playedPlayId, officialEvidence,
      proof: { pitcher, policy, scoring: play.scoring, physicalPitchSequences: workload.physicalPitchSequences,
        ...(initialWorld ? { initialWorld, officialEvidence } : {}),
        ...(physicalProgress ? { physicalProgress, progressEvidence } : {}) } };
  };
  const decode = (row: SourceRow): OfficialPhysicalPitchActivity => {
    try {
      const request = requestInput(JSON.parse(row.request_json) as OfficialPitchWorkloadRequest);
      const saved = getPolicy.get(request.policySourceId) as PolicyRow | undefined;
      if (!saved) throw new Error('original physical pitch policy is missing');
      const policy = policyInput(JSON.parse(saved.source_json) as AcceptedPhysicalPitchEffortPolicy, request.policySourceId);
      if (saved.source_id !== policy.sourceId || saved.policy_id !== policy.policyId || saved.version !== policy.version
        || json(policy) !== saved.source_json || json(effortPolicy(policy)) !== saved.policy_json) throw new Error('physical pitch policy snapshot differs');
      const expected = project(request, policy), stored = JSON.parse(row.source_json) as PlayerWorkloadActivity;
      if (row.source_id !== expected.activity.sourceEventId || row.career_id !== expected.activity.careerId
        || row.player_id !== expected.activity.playerId || row.game_id !== expected.gameId || row.played_play_id !== expected.playId
        || row.scoring_application_id !== request.scoringApplicationId || row.policy_source_id !== policy.sourceId
        || json(request) !== row.request_json || json(expected.activity) !== row.source_json || json(stored) !== row.source_json
        || json(expected.proof) !== row.proof_json) throw new Error('physical pitch workload snapshot differs');
      return expected.activity;
    } catch (cause) { throw new Error('corrupt accepted official physical pitch workload Source', { cause }); }
  };
  return Object.freeze({
    accept(rawRequest): OfficialPhysicalPitchActivity {
      checkOpen(); const request = requestInput(rawRequest);
      const prior = byScoring.get(request.scoringApplicationId) as SourceRow | undefined;
      if (prior) {
        const activity = decode(prior);
        if (json(request) !== prior.request_json) throw new Error('official pitch workload request is already frozen differently');
        const live = authority?.readAcceptedPolicy(request.policySourceId) ?? null;
        if (live !== null && json(policyInput(live, request.policySourceId)) !== (getPolicy.get(request.policySourceId) as PolicyRow).source_json) {
          throw new Error('physical pitch effort policy is already frozen differently');
        }
        return activity;
      }
      // Detach the independent calibration and finish cross-connection reads before any write.
      const policy = policyInput(authority?.readAcceptedPolicy(request.policySourceId) ?? null, request.policySourceId);
      const projected = project(request, policy), policyJson = json(effortPolicy(policy));
      db.exec('BEGIN IMMEDIATE');
      try {
        const raced = byScoring.get(request.scoringApplicationId) as SourceRow | undefined;
        if (raced) {
          const existing = decode(raced);
          if (raced.request_json !== json(request) || json(existing) !== json(projected.activity)
            || (getPolicy.get(policy.sourceId) as PolicyRow).source_json !== json(policy)) throw new Error('physical pitch workload was frozen differently');
          db.exec('COMMIT'); return existing;
        }
        assertNoActualRoleWorkloadCharge(db, { careerId: projected.activity.careerId, gameId: projected.gameId,
          playId: projected.playId, playerId: projected.activity.playerId });
        const saved = getPolicy.get(policy.sourceId) as PolicyRow | undefined;
        const version = db.prepare('SELECT policy_json FROM official_pitch_workload_policies WHERE policy_id=? AND version=? LIMIT 1')
          .get(policy.policyId, policy.version) as { policy_json: string } | undefined;
        if (saved && (saved.source_json !== json(policy) || saved.policy_json !== policyJson) || version && version.policy_json !== policyJson) {
          throw new Error('physical pitch effort policy version is already frozen differently');
        }
        if (!saved) db.prepare('INSERT INTO official_pitch_workload_policies VALUES (?, ?, ?, ?, ?)')
          .run(policy.sourceId, policy.policyId, policy.version, json(policy), policyJson);
        db.prepare('INSERT INTO official_pitch_workload_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(projected.activity.sourceEventId, projected.activity.careerId, projected.activity.playerId, projected.gameId,
            projected.playId, request.scoringApplicationId, policy.sourceId, json(request), json(projected.activity), json(projected.proof));
        const activity = decode(bySource.get(projected.activity.sourceEventId) as SourceRow);
        if (json(activity) !== json(projected.activity)
          || json(project(request, policy).officialEvidence) !== json(projected.officialEvidence)
          || (getPolicy.get(policy.sourceId) as PolicyRow).source_json !== json(policy)) {
          throw new Error('physical pitch workload Source or calibration changed during acceptance');
        }
        db.exec('COMMIT'); return activity;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readAcceptedActivity(sourceId): OfficialPhysicalPitchActivity | null {
      checkOpen(); if (!id(sourceId)) throw new Error('invalid official pitch workload Source identity');
      const row = bySource.get(sourceId) as SourceRow | undefined;
      return row ? decode(row) : null;
    },
    close: () => { if (!closed) { db.close(); closed = true; } },
  });
};
