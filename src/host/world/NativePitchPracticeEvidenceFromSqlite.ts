import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { personGenesisEvidenceFromSqlite } from './SqlitePersonGenesisStore';
import { readPlayerPitchTimingPrefixFromSqlite, type AcceptedPitchTimingLearning } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryAtRevisionFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { playerWorkloadRecoveryStoreFromSqlite, assertArchivedPlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { readNativeDevelopmentEpisodeFromSqlite } from './NativeDevelopmentEpisodeFromSqlite';
import { createPitchPracticeOwner, type PitchPracticeSources } from './SqlitePitchPracticeAttemptStore';
import type { PracticeOrderExecutionReader } from './OwnedPitchPracticeOrder';
import { practiceHash as hash, practiceId as id, practiceRevision as revision,
  practiceTimingAtRevision, type PitchPracticeFrame, type PitchPracticeOpportunity } from './PitchPracticeAttempt';

type Db = DatabaseSync;
const native = (db: Db): void => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('practice history requires a Native connection and transaction');
  assertBodyCompositionNativeConnection(db);
};
const cannotWrite = (): never => { throw new Error('Native historical practice reader cannot write'); };

/** Reuse the original decoder graph on this snapshot. Its dependencies are
 * original Native owners, not the writer instances that first accepted them. */
const reader = (db: Db) => {
  native(db);
  const persons = playerPersonLinkEvidenceFromSqlite(db), genesis = personGenesisEvidenceFromSqlite(db);
  const workload = playerWorkloadRecoveryStoreFromSqlite(db, persons, undefined, { transaction: cannotWrite });
  let owner: ReturnType<typeof createPitchPracticeOwner>;
  const timingAtRevision: PitchPracticeSources['timing']['selectAtRevision'] = (careerId, playerId, cut) => {
    if (![careerId, playerId].every(id) || !revision(cut)) throw new Error('invalid Native practice timing prefix');
    const table = cut === 0 ? 'world_pitch_timing_baselines' : 'world_pitch_timing_updates';
    const row = db.prepare(`SELECT * FROM main.${table} WHERE career_id=? AND player_id=?${cut === 0 ? '' : ' AND after_revision=?'}`)
      .get(...(cut === 0 ? [careerId, playerId] : [careerId, playerId, cut]));
    if (!row) throw new Error('Native practice timing endpoint is missing');
    const value = readPlayerPitchTimingPrefixFromSqlite(db, { owner: table, sourceId: String(row.source_id),
      sourceHash: hash(JSON.parse(String(row.source_json))),
      snapshotHash: hash(JSON.parse(String(cut === 0 ? row.initial_json : row.state_json))) });
    if (value.careerId !== careerId || value.playerId !== playerId || value.revision !== cut) throw new Error('Native practice timing scope differs');
    // A changed timing source used by this physical proof must retain the
    // original standardized practice owner, with strictly earlier timing cuts.
    for (const update of db.prepare(`SELECT * FROM main.world_pitch_timing_updates
      WHERE career_id=? AND player_id=? AND after_revision<=? ORDER BY after_revision`).all(careerId, playerId, cut)) {
      const request = db.prepare('SELECT request_json FROM main.pitch_practice_learning_requests WHERE source_id=?').get(update.source_id!);
      const boundary = request && JSON.parse(String(request.request_json)) as { expectedTimingRevision: number } | undefined;
      if (!boundary || boundary.expectedTimingRevision !== update.before_revision
        || boundary.expectedTimingRevision >= Number(update.after_revision)) throw new Error('Native practice timing requires its earlier original learning boundary');
      owner.api.assertTimingEvidence(db, JSON.parse(String(update.source_json)) as AcceptedPitchTimingLearning, 'read');
    }
    return value;
  };
  const timingHead: PitchPracticeSources['timing']['readHead'] = (careerId, playerId) => {
    const head = db.prepare('SELECT revision FROM main.world_pitch_timing_heads WHERE career_id=? AND player_id=?').get(careerId, playerId);
    return head ? timingAtRevision(careerId, playerId, Number(head.revision)) : null;
  };
  const policy: PitchPracticeSources['policies']['readAcceptedPolicy'] = sourceId => {
    if (!id(sourceId)) throw new Error('invalid Native practice policy identity');
    const row = db.prepare('SELECT source_json FROM main.world_pitch_fatigue_policies WHERE source_id=?').get(sourceId);
    if (!row) return null;
    const source = JSON.parse(String(row.source_json));
    return readPitchFatiguePolicyFromSqlite(db, { owner: 'world_pitch_fatigue_policies', sourceId,
      sourceHash: hash(source), snapshotHash: hash(source) });
  };
  const readEpisodePrefix = (connection: Pick<Db, 'prepare'>, episodeId: string, cut: number) => {
    if (connection !== db) throw new Error('Native practice episode connection differs');
    return readNativeDevelopmentEpisodeFromSqlite(db, episodeId, cut)?.episode ?? null;
  };
  const captureFrame = (opportunity: PitchPracticeOpportunity): PitchPracticeFrame => {
    const o = opportunity, personLink = persons.readLink(o.personLinkSourceId), person = genesis.read(o.personLinkSourceId);
    if (!personLink || !person || personLink.careerId !== o.careerId || personLink.playerId !== o.playerId
      || personLink.acceptedAtDay > o.atDay || person.careerId !== o.careerId || person.playerId !== o.playerId
      || person.personId !== personLink.personId || person.sourceId !== o.personLinkSourceId) throw new Error('practice Player Person scope differs');
    const timing = practiceTimingAtRevision(timingAtRevision(o.careerId, o.playerId, o.timingRevision), o.timingRevision);
    const history = readPlayerReleaseGeometryAtRevisionFromSqlite(db, o.careerId, o.playerId, o.releaseRevision);
    const release = o.releaseRevision === 0 ? history.baseline : history.changes[o.releaseRevision - 1];
    const state = workload.selectAtRevision(o.careerId, o.playerId, o.workloadRevision), fatiguePolicy = policy(o.fatiguePolicySourceId);
    if (!release || !fatiguePolicy || timing.effectiveDay > o.atDay || release.effectiveDay > o.atDay
      || state.effectiveDay > o.atDay || fatiguePolicy.availableAtDay > o.atDay) throw new Error('practice source revision is missing or future');
    return { personLink, person, timing, release, workload: state, policy: fatiguePolicy };
  };
  const sources: PitchPracticeSources = {
    personLinks: persons, person: genesis, timing: { readHead: timingHead, selectAtRevision: timingAtRevision },
    release: { readHead(careerId, playerId) {
      const row = db.prepare('SELECT revision FROM main.world_player_release_heads WHERE career_id=? AND player_id=?').get(careerId, playerId);
      return row ? readPlayerReleaseGeometryAtRevisionFromSqlite(db, careerId, playerId, Number(row.revision)) : null;
    } },
    workload: { ...workload, apply: cannotWrite, readActivity(sourceId) {
      const receipt = workload.readActivity(sourceId);
      if (receipt) assertArchivedPlayerWorkloadActivity(db, receipt);
      return receipt;
    } },
    policies: { readAcceptedPolicy: policy },
    episodes: { advance: cannotWrite, read(episodeId) {
      const row = db.prepare('SELECT revision FROM main.world_development_initiations WHERE episode_id=?').get(episodeId);
      return row ? readNativeDevelopmentEpisodeFromSqlite(db, episodeId, Number(row.revision)) : null;
    } },
  };
  owner = createPitchPracticeOwner(db, sources, undefined, { captureFrame, readEpisodePrefix });
  return owner;
};

export const readNativePitchPracticeAttemptFromSqlite = (db: Db, attemptId: string, timingCeiling?: number) => {
  native(db);
  if (!id(attemptId) || timingCeiling !== undefined && !revision(timingCeiling)) throw new Error('invalid Native practice attempt scope');
  return reader(db).readAttempt(db, attemptId, timingCeiling);
};

export const readNativePitchPracticeRepetitionFromSqlite = (db: Db, eventId: string) => {
  native(db);
  if (!id(eventId)) throw new Error('invalid Native practice repetition identity');
  return reader(db).readRepetition(db, eventId);
};

export const readNativePracticeOrderExecutionFromSqlite: PracticeOrderExecutionReader = (connection, executionId, consumer) => {
  native(connection as Db);
  if (!id(executionId)) throw new Error('invalid Native practice order execution');
  return reader(connection as Db).readOrderExecution(connection, executionId, consumer);
};
