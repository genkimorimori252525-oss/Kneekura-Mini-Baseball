import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assessDevelopmentPracticeExposure, type DevelopmentPracticeBundle,
  type DevelopmentPracticeEpisode, type DevelopmentPracticeRepetition } from '../../core/world/development/DevelopmentPracticeExposure';
import { advancePlayerWorkloadRecovery, createPlayerWorkloadRecovery, type PlayerWorkloadActivity,
  type PlayerWorkloadBaseline, type PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';

export type AcceptedPlayerWorkloadBaseline = PlayerWorkloadBaseline & Readonly<{
  sourceId: string; sourceVersion: string; personLinkSourceId: string;
}>;
export type AcceptedPlayerWorkloadAuthority = Readonly<{
  readAcceptedBaseline(sourceId: string): AcceptedPlayerWorkloadBaseline | null;
  readAcceptedActivity(sourceId: string): PlayerWorkloadActivity | null;
}>;
export type DurablePlayerWorkloadActivity = Readonly<{
  activity: PlayerWorkloadActivity; before: PlayerWorkloadRecoveryState; after: PlayerWorkloadRecoveryState;
}>;
export type SqlitePlayerWorkloadRecoveryStore = Readonly<{
  initialize(sourceId: string): PlayerWorkloadRecoveryState;
  apply(sourceId: string, expectedRevision: number): PlayerWorkloadRecoveryState;
  readHead(careerId: string, playerId: string): PlayerWorkloadRecoveryState | null;
  selectAtRevision(careerId: string, playerId: string, revision: number): PlayerWorkloadRecoveryState;
  readActivity(sourceId: string): DurablePlayerWorkloadActivity | null;
  close(): void;
}>;
type BaselineRow = { source_id: string; career_id: string; player_id: string; source_json: string; initial_json: string };
type ActivityRow = { source_id: string; career_id: string; player_id: string; before_revision: number; after_revision: number;
  source_json: string; before_json: string; after_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Actual accepted activity owns fatigue; Calendar labels never write this state. */
export const openSqlitePlayerWorkloadRecoveryStore = (databasePath: string, personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>,
  authority?: AcceptedPlayerWorkloadAuthority | null): SqlitePlayerWorkloadRecoveryStore => {
  if (!id(databasePath) || !personLinks || typeof personLinks.readLink !== 'function'
    || authority != null && (typeof authority.readAcceptedBaseline !== 'function' || typeof authority.readAcceptedActivity !== 'function')) {
    throw new Error('invalid Player workload sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_workload_policies (
    career_id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_id, version)
  );
  CREATE TABLE IF NOT EXISTS world_player_workload_baselines (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    source_json TEXT NOT NULL, initial_json TEXT NOT NULL, UNIQUE(career_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS world_player_workload_heads (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL, PRIMARY KEY(career_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS world_player_workload_activities (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0), after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, after_revision)
  );`);
  const getBaseline = db.prepare('SELECT * FROM world_player_workload_baselines WHERE career_id=? AND player_id=?');
  const getBaselineBySource = db.prepare('SELECT * FROM world_player_workload_baselines WHERE source_id=?');
  const getHead = db.prepare('SELECT revision, state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?');
  const getActivities = db.prepare('SELECT * FROM world_player_workload_activities WHERE career_id=? AND player_id=? ORDER BY after_revision');
  const getActivity = db.prepare('SELECT * FROM world_player_workload_activities WHERE source_id=?');
  const getPolicy = db.prepare('SELECT policy_json FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?');
  let closed = false;
  const scope = (...ids: string[]): void => { if (closed || ids.some((value) => !id(value))) throw new Error('invalid Player workload scope'); };
  const initialState = (input: AcceptedPlayerWorkloadBaseline, sourceId: string): PlayerWorkloadRecoveryState => {
    if (!fields(input, ['sourceId', 'sourceVersion', 'personLinkSourceId', 'careerId', 'playerId', 'createdAtDay', 'fatigue', 'recoveryCapacity', 'policy'])
      || input.sourceId !== sourceId || !id(input.sourceVersion) || !id(input.personLinkSourceId)) throw new Error('invalid accepted Player workload baseline');
    const link = personLinks.readLink(input.personLinkSourceId);
    if (!link || link.sourceId !== input.personLinkSourceId || link.careerId !== input.careerId || link.playerId !== input.playerId
      || !revision(link.acceptedAtDay) || link.acceptedAtDay > input.createdAtDay) throw new Error('workload baseline lacks exact accepted Player Person link');
    return createPlayerWorkloadRecovery({ careerId: input.careerId, playerId: input.playerId, createdAtDay: input.createdAtDay,
      fatigue: input.fatigue, recoveryCapacity: input.recoveryCapacity, policy: input.policy });
  };
  const replay = (careerId: string, playerId: string, selectedRevision?: number): PlayerWorkloadRecoveryState | null => {
    scope(careerId, playerId);
    const baseline = getBaseline.get(careerId, playerId) as BaselineRow | undefined;
    const head = getHead.get(careerId, playerId) as { revision: number; state_json: string } | undefined;
    const activities = getActivities.all(careerId, playerId) as ActivityRow[];
    if (!baseline) {
      if (head || activities.length) throw new Error('corrupt orphan Player workload history');
      return null;
    }
    try {
      const input = JSON.parse(baseline.source_json) as AcceptedPlayerWorkloadBaseline;
      let current = initialState(input, baseline.source_id);
      let selected = current.revision === selectedRevision ? current : null;
      const policy = getPolicy.get(careerId, current.policy.policyId, current.policy.version) as { policy_json: string } | undefined;
      if (baseline.career_id !== careerId || baseline.player_id !== playerId || current.careerId !== careerId || current.playerId !== playerId
        || json(input) !== baseline.source_json || json(current) !== baseline.initial_json || policy?.policy_json !== json(current.policy)) {
        throw new Error('baseline or policy differs');
      }
      for (const row of activities) {
        const activity = JSON.parse(row.source_json) as PlayerWorkloadActivity;
        if (activity.sourceEventId !== row.source_id || row.career_id !== careerId || row.player_id !== playerId
          || row.before_revision !== current.revision || row.after_revision !== current.revision + 1
          || json(activity) !== row.source_json || json(current) !== row.before_json) throw new Error('activity before state differs');
        current = advancePlayerWorkloadRecovery(current, row.before_revision, activity);
        if (current.revision === selectedRevision) selected = current;
        if (json(current) !== row.after_json) throw new Error('activity after state differs');
      }
      if (!head || head.revision !== current.revision || head.state_json !== json(current)) throw new Error('head diverged');
      return selectedRevision === undefined ? current : selected;
    } catch (cause) { throw new Error('corrupt Player workload history', { cause }); }
  };
  const readActivity = (sourceId: string): DurablePlayerWorkloadActivity | null => {
    scope(sourceId);
    const row = getActivity.get(sourceId) as ActivityRow | undefined;
    if (!row) return null;
    replay(row.career_id, row.player_id);
    return freeze({ activity: JSON.parse(row.source_json) as PlayerWorkloadActivity,
      before: JSON.parse(row.before_json) as PlayerWorkloadRecoveryState, after: JSON.parse(row.after_json) as PlayerWorkloadRecoveryState });
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({
    initialize(sourceId: string): PlayerWorkloadRecoveryState {
      scope(sourceId);
      return transaction(() => {
        const prior = getBaselineBySource.get(sourceId) as BaselineRow | undefined;
        const raw = authority?.readAcceptedBaseline(sourceId) ?? null;
        const input = raw === null ? null : cloneInert(raw);
        if (prior) {
          if (input && json(input) !== prior.source_json) throw new Error('Player workload baseline is already frozen differently');
          return replay(prior.career_id, prior.player_id)!;
        }
        if (getActivity.get(sourceId)) throw new Error('Player workload sourceId belongs to an activity');
        if (!input) throw new Error('accepted Player workload baseline is missing');
        const initial = initialState(input, sourceId);
        const saved = getPolicy.get(initial.careerId, initial.policy.policyId, initial.policy.version) as { policy_json: string } | undefined;
        const policyJson = json(initial.policy);
        if (saved && saved.policy_json !== policyJson) throw new Error('Player workload policy version is already frozen differently');
        if (!saved) db.prepare('INSERT INTO world_player_workload_policies VALUES (?, ?, ?, ?)')
          .run(initial.careerId, initial.policy.policyId, initial.policy.version, policyJson);
        db.prepare('INSERT INTO world_player_workload_baselines VALUES (?, ?, ?, ?, ?)')
          .run(sourceId, initial.careerId, initial.playerId, json(input), json(initial));
        db.prepare('INSERT INTO world_player_workload_heads VALUES (?, ?, ?, ?)').run(initial.careerId, initial.playerId, 0, json(initial));
        return replay(initial.careerId, initial.playerId)!;
      });
    },
    apply(sourceId: string, expectedRevision: number): PlayerWorkloadRecoveryState {
      scope(sourceId);
      if (!revision(expectedRevision)) throw new Error('invalid Player workload revision');
      return transaction(() => {
        const prior = readActivity(sourceId);
        const raw = authority?.readAcceptedActivity(sourceId) ?? null;
        const activity = raw === null ? null : cloneInert(raw);
        if (prior) {
          if (expectedRevision !== prior.before.revision) throw new Error('Player workload retry revision differs');
          if (activity && json(activity) !== json(prior.activity)) throw new Error('Player workload activity is already frozen differently');
          return prior.after;
        }
        if (getBaselineBySource.get(sourceId)) throw new Error('Player workload sourceId belongs to a baseline');
        if (!activity || activity.sourceEventId !== sourceId) throw new Error('accepted Player workload activity is missing or differs');
        const before = replay(activity.careerId, activity.playerId);
        if (!before) throw new Error('Player workload baseline is missing');
        const after = advancePlayerWorkloadRecovery(before, expectedRevision, activity);
        db.prepare('INSERT INTO world_player_workload_activities VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(sourceId, before.careerId, before.playerId, before.revision, after.revision, json(activity), json(before), json(after));
        const result = db.prepare(`UPDATE world_player_workload_heads SET revision=?, state_json=?
          WHERE career_id=? AND player_id=? AND revision=? AND state_json=?`)
          .run(after.revision, json(after), before.careerId, before.playerId, before.revision, json(before));
        if (result.changes !== 1) throw new Error('Player workload head CAS failed');
        return replay(before.careerId, before.playerId)!;
      });
    },
    readHead: (careerId, playerId) => replay(careerId, playerId), readActivity,
    selectAtRevision(careerId, playerId, targetRevision): PlayerWorkloadRecoveryState {
      if (!revision(targetRevision)) throw new Error('invalid Player workload revision');
      const selected = replay(careerId, playerId, targetRevision);
      if (!selected) throw new Error('Player workload revision is missing');
      return selected;
    },
    close: () => { if (!closed) { db.close(); closed = true; } },
  });
};

export type WorkloadBoundPracticeInput = Omit<DevelopmentPracticeBundle, 'repetitions'> & Readonly<{
  repetitions: readonly Omit<DevelopmentPracticeRepetition, 'fatigue' | 'healthAvailability'>[];
}>;
/** Bind the exact historical practice BEFORE state, never the latest Player head. */
export const bindDevelopmentPracticeFromWorkload = (store: Pick<SqlitePlayerWorkloadRecoveryStore, 'readActivity'>,
  rawEpisode: DevelopmentPracticeEpisode, rawInput: WorkloadBoundPracticeInput): DevelopmentPracticeBundle => {
  const episode = cloneInert(rawEpisode), input = cloneInert(rawInput);
  if (!store || typeof store.readActivity !== 'function' || !fields(input, ['policy', 'prior', 'repetitions'])
    || !Array.isArray(input.repetitions)) throw new Error('invalid workload-bound practice input');
  const repetitions = input.repetitions.map((item): DevelopmentPracticeRepetition => {
    if (!fields(item, ['sourceEventId', 'atDay', 'trainingStimulus', 'coachingFit', 'challengeFit', 'motivation', 'opportunity', 'novelty'])) {
      throw new Error('invalid workload-bound practice factors');
    }
    const evidence = store.readActivity(item.sourceEventId);
    if (!evidence || evidence.activity.kind !== 'PRACTICE' || evidence.activity.careerId !== episode.careerId
      || evidence.activity.playerId !== episode.playerId || evidence.activity.atDay !== item.atDay
      || evidence.before.careerId !== episode.careerId || evidence.before.playerId !== episode.playerId) {
      throw new Error('exact accepted workload practice evidence is missing or differs');
    }
    return { ...item, fatigue: evidence.before.fatigue, healthAvailability: evidence.activity.healthAvailability };
  });
  const bundle = { policy: input.policy, prior: input.prior, repetitions };
  assessDevelopmentPracticeExposure(episode, bundle);
  return freeze(bundle);
};
