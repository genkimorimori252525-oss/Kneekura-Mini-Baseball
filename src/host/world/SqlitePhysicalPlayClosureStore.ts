import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore, type PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { openSqliteOfficialPitchWorkloadStore, type OfficialPitchWorkloadRequest } from './SqliteOfficialPitchWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore, type DurablePlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';
import type { SqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import type { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { closureJson as json, closureHash as hash, closureFreeze as freeze, physicalClosureInput, captureClosurePitchRows,
  derivePhysicalClosureProposal, readPhysicalClosureProposal, assertPhysicalClosureStages, assertPhysicalClosureOpenFrame,
  expectedClosureWorkloadAfter, readPhysicalClosureWorkload, type PhysicalClosureDb, type AcceptedPhysicalPlayClosure, type PhysicalClosureProposal } from './PhysicalPlayClosureEvidenceFromSqlite';
export type { AcceptedPhysicalPlayClosure } from './PhysicalPlayClosureEvidenceFromSqlite';

export type PhysicalPlayClosureResult = Readonly<{
  sourceId: string; gameId: string; playId: number; official: PhysicalClosureProposal['expectedOfficial'];
  scoring: PersistedOfficialScoring; workload: DurablePlayerWorkloadActivity;
}>;
export type DurablePhysicalPlayClosure = Readonly<{
  source: AcceptedPhysicalPlayClosure; proposal: PhysicalClosureProposal; status: 'PENDING' | 'COMPLETED'; result: PhysicalPlayClosureResult | null;
}>;
export type SqlitePhysicalPlayClosureStore = Readonly<{
  enqueue(sourceId: string): DurablePhysicalPlayClosure; read(sourceId: string): DurablePhysicalPlayClosure | null;
  resume(sourceId: string): PhysicalPlayClosureResult; submit(sourceId: string): PhysicalPlayClosureResult; close(): void;
}>;
type Sources = Readonly<{
  physicalPitches: Pick<SqlitePhysicalPitchProgressStore, 'readAcceptedPitch' | 'readProgress'>;
  initialWorlds: Pick<SqliteOfficialInitialWorldStore, 'readAcceptedSource' | 'readInitialPitcherPlay'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readPitcherPlay'>;
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>;
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
/** Each existing writer owns its transaction; the immutable queued proposal makes their sequence resumable. */
export const openSqlitePhysicalPlayClosureStore = (path: string, sources: Sources,
  authority?: Readonly<{ readAcceptedClosure(sourceId: string): AcceptedPhysicalPlayClosure | null }>): SqlitePhysicalPlayClosureStore => {
  if (!id(path) || typeof sources?.physicalPitches?.readAcceptedPitch !== 'function' || typeof sources.physicalPitches.readProgress !== 'function'
    || typeof sources.initialWorlds?.readAcceptedSource !== 'function' || typeof sources.initialWorlds.readInitialPitcherPlay !== 'function'
    || typeof sources.participation?.readPitcherPlay !== 'function' || typeof sources.personLinks?.readLink !== 'function'
    || authority != null && typeof authority.readAcceptedClosure !== 'function') throw new Error('invalid physical closure sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS physical_closure_game_policies (game_id TEXT PRIMARY KEY, policy_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS physical_play_closures (source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, game_id TEXT NOT NULL,
    play_id INTEGER NOT NULL, application_id TEXT NOT NULL UNIQUE, scoring_application_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('PENDING','COMPLETED')), source_json TEXT NOT NULL, source_hash TEXT NOT NULL,
    proposal_json TEXT NOT NULL, proposal_hash TEXT NOT NULL, result_json TEXT, UNIQUE(game_id,play_id),
    CHECK((status='PENDING' AND result_json IS NULL) OR (status='COMPLETED' AND result_json IS NOT NULL)));`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed physical closure scope'); };
  const transaction = <T>(work: () => T): T => { db.exec('BEGIN IMMEDIATE'); try { const result = work(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const byApplication = (connection: PhysicalClosureDb, applicationId: string) => {
    const row = connection.prepare('SELECT source_id FROM physical_play_closures WHERE application_id=?').get(applicationId) as { source_id: string } | undefined;
    const original = row && readPhysicalClosureProposal(connection, row.source_id);
    if (!original) throw new Error('accepted physical closure origin is missing'); return original;
  };
  const applicationGuard = (connection: PhysicalClosureDb, application: PhysicalClosureProposal['application'], writtenMatch = false, throughStage = 0) => {
    const original = byApplication(connection, application.applicationId);
    if (json(original.proposal.application) !== json(application)) throw new Error('physical closure application Source differs');
    assertPhysicalClosureStages(connection, original.proposal, writtenMatch, throughStage); return original;
  };
  const official = new SqliteOfficialStateStore(path, (connection, input, phase) => {
    const original = applicationGuard(connection, input as PhysicalClosureProposal['application'], phase === 'written');
    if (phase === 'write') assertPhysicalClosureOpenFrame(connection, original.proposal);
  });
  const scoring = openSqliteOfficialScoringStore(path, undefined, (connection, input) => applicationGuard(connection, input as PhysicalClosureProposal['application'], false, 1));
  const producer = openSqliteOfficialPitchWorkloadStore(path, { scoring, participation: sources.participation,
    initialWorlds: sources.initialWorlds, physicalPitches: sources.physicalPitches }, { readAcceptedPolicy: (policyId) => {
      const rows = db.prepare('SELECT proposal_json FROM physical_play_closures ORDER BY rowid').all() as { proposal_json: string }[];
      for (const row of rows) {
        const proposal = JSON.parse(row.proposal_json) as PhysicalClosureProposal, policy = proposal.physicalPitch.frame.effortPolicy;
        if (policy.sourceId === policyId) return policy;
      }
      return null;
    } }, (connection, request) => {
      const row = connection.prepare('SELECT source_id FROM physical_play_closures WHERE scoring_application_id=?')
        .get(request.scoringApplicationId) as { source_id: string } | undefined;
      const original = row && readPhysicalClosureProposal(connection, row.source_id);
      if (!original || json(workloadRequest(original.proposal)) !== json(request)) throw new Error('physical closure effort request Source differs');
      assertPhysicalClosureStages(connection, original.proposal, false, 2);
    });
  const workload = openSqlitePlayerWorkloadRecoveryStore(path, sources.personLinks, { readAcceptedBaseline: () => null,
    readAcceptedActivity: (sourceId) => producer.readAcceptedActivity(sourceId) }, (connection, activity, phase) => {
      const original = byApplication(connection, activity.evidenceId), proposal = original.proposal;
      if (json(activity) !== json(proposal.expectedActivity)) throw new Error('physical closure actual effort Source differs');
      assertPhysicalClosureStages(connection, proposal);
      if (phase !== 'write') {
        const record = connection.prepare('SELECT before_json,after_json FROM world_player_workload_activities WHERE source_id=?')
          .get(activity.sourceEventId) as { before_json: string; after_json: string } | undefined;
        const after = expectedClosureWorkloadAfter(proposal);
        if (!record || record.before_json !== json(proposal.physicalPitch.frame.workload) || record.after_json !== json(after)) throw new Error('physical closure original workload result differs');
        if (phase === 'written') {
          const head = connection.prepare('SELECT revision,state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
            .get(activity.careerId, activity.playerId) as { revision: number; state_json: string } | undefined;
          if (!head || head.revision !== after.revision || head.state_json !== json(after)) throw new Error('physical closure written workload head differs');
        }
      }
    });
  function workloadRequest(p: PhysicalClosureProposal): OfficialPitchWorkloadRequest {
    const f = p.physicalPitch.frame;
    return { scoringApplicationId: p.expectedScoring.scoringApplicationId, policySourceId: f.effortPolicy.sourceId,
      ...(f.activationApplicationId === null ? { initialWorldSourceId: f.initialWorld!.source.sourceId } : { activationApplicationId: f.activationApplicationId }) };
  }
  const completeResult = (sourceId: string, p: PhysicalClosureProposal): PhysicalPlayClosureResult | null => {
    assertPhysicalClosureStages(db, p);
    const activity = readPhysicalClosureWorkload(db, p);
    if (!activity) return null;
    return freeze({ sourceId, gameId: p.application.matchId, playId: p.application.match.playId,
      official: p.expectedOfficial, scoring: p.expectedScoring, workload: activity });
  };
  const read = (sourceId: string): DurablePhysicalPlayClosure | null => {
    check(sourceId); const original = readPhysicalClosureProposal(db, sourceId);
    if (!original) return null;
    assertPhysicalClosureStages(db, original.proposal);
    const result = original.row.status === 'COMPLETED' ? completeResult(sourceId, original.proposal) : null;
    if (original.row.status === 'COMPLETED' && (!result || original.row.result_json !== json(result))) throw new Error('physical closure completed checkpoint differs');
    return freeze({ source: original.source, proposal: original.proposal, status: original.row.status as 'PENDING' | 'COMPLETED', result });
  };
  const enqueue = (sourceId: string): DurablePhysicalPlayClosure => {
    check(sourceId); const prior = read(sourceId), raw = authority?.readAcceptedClosure(sourceId) ?? null;
    const source = raw === null ? null : physicalClosureInput(raw, sourceId);
    if (prior) { if (source && json(source) !== json(prior.source)) throw new Error('physical closure Source is frozen differently'); return prior; }
    if (!source) throw new Error('accepted physical closure Source is missing');
    const beforeReads = captureClosurePitchRows(db, source.physicalPitchSourceId);
    const physical = cloneInert(sources.physicalPitches.readAcceptedPitch(source.physicalPitchSourceId));
    if (!physical) throw new Error('actual accepted physical pitch is missing');
    const proposal = derivePhysicalClosureProposal(db, source, physical, beforeReads);
    return transaction(() => {
      assertPhysicalClosureOpenFrame(db, proposal);
      if (json(derivePhysicalClosureProposal(db, source, physical, beforeReads)) !== json(proposal)) throw new Error('physical closure evidence changed before acceptance');
      const policy = db.prepare('SELECT policy_json FROM physical_closure_game_policies WHERE game_id=?').get(proposal.application.matchId) as { policy_json: string } | undefined;
      if (policy && policy.policy_json !== json(source.game)) throw new Error('physical closure game policy is frozen differently');
      if (!policy) db.prepare('INSERT INTO physical_closure_game_policies VALUES (?,?)').run(proposal.application.matchId, json(source.game));
      db.prepare(`INSERT INTO physical_play_closures VALUES (?,?,?,?,?,?,'PENDING',?,?,?, ?,NULL)`)
        .run(sourceId, source.sourceVersion, proposal.application.matchId, proposal.application.match.playId, source.applicationId,
          source.scoringApplicationId, json(source), hash(source), json(proposal), hash(proposal));
      const accepted = read(sourceId);
      if (!accepted || json(accepted.proposal) !== json(proposal)) throw new Error('physical closure changed during acceptance');
      assertPhysicalClosureOpenFrame(db, proposal); return accepted;
    });
  };
  const resume = (sourceId: string): PhysicalPlayClosureResult => {
    check(sourceId); const queued = read(sourceId);
    if (!queued) throw new Error('accepted physical closure is missing');
    const live = authority?.readAcceptedClosure(sourceId) ?? null;
    if (live && json(physicalClosureInput(live, sourceId)) !== json(queued.source)) throw new Error('physical closure Source is frozen differently');
    if (queued.result) return queued.result;
    const p = queued.proposal;
    if ('game' in p.application) official.applyAndFinalize(p.application); else official.applyAndActivate(p.application);
    scoring.apply({ scoringApplicationId: p.expectedScoring.scoringApplicationId, officialApplication: p.application });
    const activity = producer.accept(workloadRequest(p));
    if (json(activity) !== json(p.expectedActivity)) throw new Error('actual physical effort differs');
    workload.apply(activity.sourceEventId, p.physicalPitch.frame.workload.revision);
    return transaction(() => {
      const original = read(sourceId), result = completeResult(sourceId, p);
      if (!original || json(original.proposal) !== json(p) || !result) throw new Error('physical closure is not complete');
      if (original.result) return original.result;
      const changed = db.prepare("UPDATE physical_play_closures SET status='COMPLETED',result_json=? WHERE source_id=? AND status='PENDING' AND proposal_hash=? AND source_hash=?")
        .run(json(result), sourceId, hash(p), hash(queued.source));
      if (changed.changes !== 1) throw new Error('physical closure completion CAS failed');
      const saved = read(sourceId)?.result;
      if (!saved || json(saved) !== json(result)) throw new Error('physical closure changed during completion'); return saved;
    });
  };
  return Object.freeze({ enqueue, read, resume, submit(sourceId) { enqueue(sourceId); return resume(sourceId); },
    close() { if (!closed) { workload.close(); producer.close(); scoring.close(); official.close(); db.close(); closed = true; } } });
};
