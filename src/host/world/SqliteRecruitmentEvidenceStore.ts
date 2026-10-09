import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { readState } from '../../core/world/club/ClubSchemas';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import { getClubSeasonWageAllocations, type ClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import type { RosterNeedRequest, RosterNeedPlanningPolicy } from '../../core/world/roster/SourceBackedRosterNeed';
import { appendScoutingEvidence, appendPlayerKnowledgeReport, createClubScoutingKnowledge, frozenScoutingCopy,
  type ScoutingEvidenceRecord, type PlayerKnowledgeReport, type ClubScoutingKnowledge } from '../../core/world/scouting/ScoutingKnowledge';
import { appendRecruitmentDecisionWithRosterNeedAndClubFinance, createRecruitmentDecisionLedger,
  type RecruitmentDecisionInput, type RecruitmentDecisionLedger } from '../../core/world/scouting/RecruitmentDecision';
import type { RecruitmentAuthorityProfile } from '../../core/world/scouting/RecruitmentAuthority';
import { canonicalRosterEvidenceJson as json } from './RosterEvidenceJson';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import { readDomesticMarketTriggerFromSqlite, type DomesticMarketTriggerReference } from './SqliteDomesticScheduleStore';

export type AcceptedScoutingSource = Readonly<{ sourceId: string; sourceVersion: string }> &
  (Readonly<{ kind: 'EVIDENCE'; record: ScoutingEvidenceRecord }> | Readonly<{ kind: 'REPORT'; record: PlayerKnowledgeReport }>);
export type AcceptedRecruitmentSource = Readonly<{
  sourceId: string; sourceVersion: string;
  expected: Readonly<{ clubRevision: number; rosterRevision: number; wageRevision: number; knowledgeRevision: number }>;
  need: RosterNeedRequest; needPolicy: RosterNeedPlanningPolicy; authorityProfile: RecruitmentAuthorityProfile;
  proposedCurrentSeasonPayrollMinorUnits: number | null;
  decision: Omit<RecruitmentDecisionInput, 'rosterNeedSnapshot' | 'budgetContext'>;
  /** Explicitly adopted cause; matching dates never create an association. */
  marketOrigin?: DomesticMarketTriggerReference;
}>;
export type RecruitmentDecisionReference = Readonly<{
  owner: 'world_recruitment_decisions'; sourceId: string; sourceHash: string; snapshotHash: string;
}>;
type Basis = Readonly<{ club: ClubWorldState; roster: RosterState; wages: ClubWageScheduleLedger; knowledgeHash: string }>;
export type DurableRecruitmentDecision = Readonly<{
  source: AcceptedRecruitmentSource; basis: Basis; ledger: RecruitmentDecisionLedger; reference: RecruitmentDecisionReference;
}>;
export type RecruitmentEvidenceAuthority = Readonly<{
  readAcceptedScoutingSource(sourceId: string): AcceptedScoutingSource | null;
  readAcceptedRecruitmentSource(sourceId: string): AcceptedRecruitmentSource | null;
}>;
export type SqliteRecruitmentEvidenceStore = Readonly<{
  acceptScouting(sourceId: string, expectedRevision: number): ClubScoutingKnowledge;
  readKnowledge(careerId: string, clubId: string): ClubScoutingKnowledge | null;
  acceptDecision(sourceId: string, expectedRevision: number): DurableRecruitmentDecision;
  readDecision(sourceId: string): DurableRecruitmentDecision | null;
  close(): void;
}>;
type Head = { revision: number; state_json: string };
type ScoutingRow = { source_id: string; career_id: string; club_id: string; revision: number; source_json: string; source_hash: string; state_json: string };
type DecisionRow = ScoutingRow & { decision_id: string; basis_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, keys: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const hash = (v: unknown): string => createHash('sha256').update(json(v)).digest('hex');
const sourceInput = (raw: AcceptedScoutingSource, sourceId: string): AcceptedScoutingSource => {
  const s = JSON.parse(json(raw)) as AcceptedScoutingSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'kind', 'record']) || s.sourceId !== sourceId || !id(s.sourceId)
    || !id(s.sourceVersion) || !['EVIDENCE', 'REPORT'].includes(s.kind) || !id(s.record?.careerId) || !id(s.record.clubId)) {
    throw new Error('invalid accepted scouting source');
  }
  return s;
};
const decisionInput = (raw: AcceptedRecruitmentSource, sourceId: string): AcceptedRecruitmentSource => {
  const s = JSON.parse(json(raw)) as AcceptedRecruitmentSource;
  const hasMarketOrigin = s != null && Object.hasOwn(s, 'marketOrigin');
  if (!fields(s, ['sourceId', 'sourceVersion', 'expected', 'need', 'needPolicy', 'authorityProfile',
    'proposedCurrentSeasonPayrollMinorUnits', 'decision', ...(hasMarketOrigin ? ['marketOrigin'] : [])])
    || s.sourceId !== sourceId || !id(s.sourceId) || !id(s.sourceVersion)
    || !fields(s.expected, ['clubRevision', 'rosterRevision', 'wageRevision', 'knowledgeRevision'])
    || !Object.values(s.expected).every(revision) || !id(s.decision?.careerId) || !id(s.decision.clubId)
    || !id(s.decision.decisionId) || (['BID', 'ACQUIRE'].includes(s.decision.decision)
      ? !revision(s.proposedCurrentSeasonPayrollMinorUnits) : s.proposedCurrentSeasonPayrollMinorUnits !== null)) {
    throw new Error('invalid accepted recruitment source');
  }
  const origin = s.marketOrigin;
  if (hasMarketOrigin && (!origin || !fields(origin, ['owner', 'careerId', 'baseScheduleHash', 'seasonEventsHash', 'trigger'])
    || origin.owner !== 'world_league_season_events' || origin.careerId !== s.decision.careerId
    || !/^[0-9a-f]{64}$/.test(origin.baseScheduleHash) || !/^[0-9a-f]{64}$/.test(origin.seasonEventsHash))) {
    throw new Error('invalid accepted recruitment market origin');
  }
  return s;
};

/** Shared with the contract consumer: preserve the caller's active write transaction. */
export const withRecruitmentEvidenceRead = <T>(db: DatabaseSync, body: () => T): T => {
  if (db.prepare('PRAGMA database_list').all().some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('recruitment evidence requires main-only storage');
  }
  if (db.isTransaction) return body();
  db.exec('BEGIN');
  try { const value = body(); db.exec('COMMIT'); return value; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};
const scoutingHistory = (db: DatabaseSync, careerId: string, clubId: string) => {
  if (!id(careerId) || !id(clubId)) throw new Error('invalid scouting scope');
  const head = db.prepare('SELECT revision,state_json FROM main.world_scouting_heads WHERE career_id=? AND club_id=?')
    .get(careerId, clubId) as Head | undefined;
  const rows = db.prepare('SELECT * FROM main.world_scouting_sources WHERE career_id=? AND club_id=? ORDER BY revision')
    .all(careerId, clubId) as ScoutingRow[];
  let state = createClubScoutingKnowledge(careerId, clubId);
  const states = [state];
  for (const row of rows) {
    const source = sourceInput(JSON.parse(row.source_json), row.source_id);
    state = source.kind === 'EVIDENCE' ? appendScoutingEvidence(state, state.revision, source.record)
      : appendPlayerKnowledgeReport(state, state.revision, source.record);
    if (row.career_id !== careerId || row.club_id !== clubId || row.revision !== state.revision
      || row.source_json !== json(source) || row.source_hash !== hash(source) || row.state_json !== json(state)) {
      throw new Error('corrupt durable scouting history');
    }
    states.push(state);
  }
  if (head ? head.revision !== rows.length || head.state_json !== json(state) : rows.length !== 0) {
    throw new Error('corrupt durable scouting head');
  }
  return { head, rows, states, state };
};
const readBasis = (db: DatabaseSync, source: AcceptedRecruitmentSource): Basis => {
  const { careerId, clubId } = source.decision;
  const clubRow = db.prepare('SELECT revision,state_json FROM main.world_club_heads WHERE career_id=? AND club_id=?').get(careerId, clubId) as Head | undefined;
  const rosterRow = db.prepare('SELECT revision,roster_json AS state_json FROM main.world_roster_heads WHERE career_id=?').get(careerId) as Head | undefined;
  const wageRow = db.prepare('SELECT revision,ledger_json AS state_json FROM main.world_wage_schedule_heads WHERE career_id=? AND club_id=?').get(careerId, clubId) as Head | undefined;
  const scouting = scoutingHistory(db, careerId, clubId);
  if (!clubRow || !rosterRow || !wageRow || !scouting.head) throw new Error('accepted recruitment owners are missing');
  if (clubRow.revision !== source.expected.clubRevision || rosterRow.revision !== source.expected.rosterRevision
    || wageRow.revision !== source.expected.wageRevision || scouting.state.revision !== source.expected.knowledgeRevision) {
    throw new Error('stale recruitment source revisions');
  }
  return { club: readState(JSON.parse(clubRow.state_json)), roster: createRosterState(JSON.parse(rosterRow.state_json)),
    wages: JSON.parse(wageRow.state_json) as ClubWageScheduleLedger, knowledgeHash: hash(scouting.state) };
};
const authenticateBasis = (db: DatabaseSync, source: AcceptedRecruitmentSource, basis: Basis, knowledge: ClubScoutingKnowledge): void => {
  if (!fields(basis, ['club', 'roster', 'wages', 'knowledgeHash']) || basis.knowledgeHash !== hash(knowledge)
    || basis.club.revision !== source.expected.clubRevision || basis.roster.revision !== source.expected.rosterRevision
    || basis.wages.revision !== source.expected.wageRevision || knowledge.revision !== source.expected.knowledgeRevision) {
    throw new Error('recruitment original basis differs');
  }
  const { careerId, clubId } = source.decision;
  if (source.marketOrigin) {
    const original = readDomesticMarketTriggerFromSqlite(db, careerId, source.marketOrigin.trigger);
    if (json(original.reference) !== json(source.marketOrigin)
      || !original.baseSchedule.memberClubIds.includes(clubId)
      || !basis.club.season.plan.competitionEditionIds.includes(source.marketOrigin.trigger.seasonId)
      || basis.club.season.plan.financialProfile.leagueId !== source.marketOrigin.trigger.leagueId) {
      throw new Error('recruitment market origin differs from original Club calendar');
    }
    if (source.marketOrigin.trigger.day > source.decision.decidedAtDay) {
      throw new Error('recruitment market origin is from the future');
    }
  }
  const history = readAcceptedClubHistory(db, careerId, clubId);
  const prior = history && replayClubEvents(history.checkpoint, history.acceptedEvents.filter(e => e.afterRevision <= source.expected.clubRevision));
  if (!prior?.ok || json(prior.value) !== json(readState(basis.club))) throw new Error('recruitment original Club history differs');
  const roster = createRosterState(basis.roster);
  if (roster.careerId !== careerId || json(roster) !== json(basis.roster)) throw new Error('recruitment original roster differs');
  getClubSeasonWageAllocations(basis.wages, basis.club);
  const currentRoster = db.prepare('SELECT revision,roster_json AS state_json FROM main.world_roster_heads WHERE career_id=?').get(careerId) as Head | undefined;
  const currentWage = db.prepare('SELECT revision,ledger_json AS state_json FROM main.world_wage_schedule_heads WHERE career_id=? AND club_id=?').get(careerId, clubId) as Head | undefined;
  for (const [current, original] of [[currentRoster, basis.roster], [currentWage, basis.wages]] as const) {
    if (!current || current.revision < original.revision || current.revision === original.revision && current.state_json !== json(original)) {
      throw new Error('recruitment original head differs');
    }
  }
};
const appendDecision = (ledger: RecruitmentDecisionLedger, source: AcceptedRecruitmentSource, basis: Basis,
  knowledge: ClubScoutingKnowledge) => appendRecruitmentDecisionWithRosterNeedAndClubFinance(ledger, ledger.revision,
  knowledge, basis.roster, source.needPolicy, source.need, basis.club, 'payroll', source.decision,
  source.proposedCurrentSeasonPayrollMinorUnits ?? undefined,
  source.proposedCurrentSeasonPayrollMinorUnits === null ? [] : getClubSeasonWageAllocations(basis.wages, basis.club), source.authorityProfile);
const decisionHistory = (db: DatabaseSync, careerId: string, clubId: string) => {
  const head = db.prepare('SELECT revision,state_json FROM main.world_recruitment_heads WHERE career_id=? AND club_id=?').get(careerId, clubId) as Head | undefined;
  const rows = db.prepare('SELECT * FROM main.world_recruitment_decisions WHERE career_id=? AND club_id=? ORDER BY revision').all(careerId, clubId) as DecisionRow[];
  let ledger = createRecruitmentDecisionLedger(careerId, clubId);
  const scouting = scoutingHistory(db, careerId, clubId), values: DurableRecruitmentDecision[] = [];
  for (const row of rows) {
    const source = decisionInput(JSON.parse(row.source_json), row.source_id), basis = JSON.parse(row.basis_json) as Basis;
    const knowledge = scouting.states[source.expected.knowledgeRevision];
    if (!knowledge) throw new Error('recruitment original knowledge is missing');
    authenticateBasis(db, source, basis, knowledge);
    ledger = appendDecision(ledger, source, basis, knowledge);
    const snapshotHash = hash({ source, basis, ledger });
    if (source.decision.careerId !== careerId || source.decision.clubId !== clubId || row.decision_id !== source.decision.decisionId
      || row.revision !== ledger.revision || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.basis_json !== json(basis) || row.state_json !== json(ledger) || row.snapshot_hash !== snapshotHash) {
      throw new Error('corrupt durable recruitment decision');
    }
    values.push(frozenScoutingCopy({ source, basis, ledger, reference: { owner: 'world_recruitment_decisions' as const,
      sourceId: source.sourceId, sourceHash: hash(source), snapshotHash } }));
  }
  if (head ? head.revision !== rows.length || head.state_json !== json(ledger) : rows.length !== 0) throw new Error('corrupt durable recruitment head');
  return { head, ledger, values };
};

/** No peer connection or mutable caller ledger participates in contract intake. */
export const readRecruitmentDecisionFromSqlite = (db: DatabaseSync, sourceId: string): DurableRecruitmentDecision | null =>
  withRecruitmentEvidenceRead(db, () => {
    if (!id(sourceId)) throw new Error('invalid recruitment source reference');
    const row = db.prepare('SELECT career_id,club_id FROM main.world_recruitment_decisions WHERE source_id=?').get(sourceId) as { career_id: string; club_id: string } | undefined;
    if (!row) return null;
    return decisionHistory(db, row.career_id, row.club_id).values.find(v => v.source.sourceId === sourceId) ?? null;
  });

export const openSqliteRecruitmentEvidenceStore = (path: string, authority?: RecruitmentEvidenceAuthority): SqliteRecruitmentEvidenceStore => {
  if (!id(path) || authority && (typeof authority.readAcceptedScoutingSource !== 'function'
    || typeof authority.readAcceptedRecruitmentSource !== 'function')) throw new Error('invalid recruitment evidence sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_scouting_heads (career_id TEXT NOT NULL,club_id TEXT NOT NULL,revision INTEGER NOT NULL,state_json TEXT NOT NULL,PRIMARY KEY(career_id,club_id));
    CREATE TABLE IF NOT EXISTS world_scouting_sources (source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,club_id TEXT NOT NULL,revision INTEGER NOT NULL,
      source_json TEXT NOT NULL,source_hash TEXT NOT NULL,state_json TEXT NOT NULL,UNIQUE(career_id,club_id,revision));
    CREATE TABLE IF NOT EXISTS world_recruitment_heads (career_id TEXT NOT NULL,club_id TEXT NOT NULL,revision INTEGER NOT NULL,state_json TEXT NOT NULL,PRIMARY KEY(career_id,club_id));
    CREATE TABLE IF NOT EXISTS world_recruitment_decisions (source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,club_id TEXT NOT NULL,revision INTEGER NOT NULL,decision_id TEXT NOT NULL,
      source_json TEXT NOT NULL,source_hash TEXT NOT NULL,basis_json TEXT NOT NULL,state_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(career_id,club_id,revision),UNIQUE(career_id,club_id,decision_id));`);
  let closed = false;
  const check = () => { if (closed) throw new Error('recruitment evidence store is closed'); };
  const transaction = <T>(body: () => T): T => {
    check(); db.exec('BEGIN IMMEDIATE');
    try { const result = withRecruitmentEvidenceRead(db, body); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({
    readKnowledge(careerId, clubId) { check(); return withRecruitmentEvidenceRead(db, () => {
      const history = scoutingHistory(db, careerId, clubId); return history.head ? history.state : null;
    }); },
    acceptScouting(sourceId, expectedRevision) {
      if (!id(sourceId) || !revision(expectedRevision)) throw new Error('invalid scouting intake revision');
      return transaction(() => {
        const raw = authority?.readAcceptedScoutingSource(sourceId) ?? null;
        const source = raw === null ? null : sourceInput(raw, sourceId);
        const prior = db.prepare('SELECT * FROM main.world_scouting_sources WHERE source_id=?').get(sourceId) as ScoutingRow | undefined;
        if (prior) {
          const history = scoutingHistory(db, prior.career_id, prior.club_id);
          if (prior.revision !== expectedRevision + 1 || source && prior.source_json !== json(source)) throw new Error('scouting source is frozen differently');
          return history.states[prior.revision];
        }
        if (!source) throw new Error('accepted scouting source is missing');
        const { careerId, clubId } = source.record, history = scoutingHistory(db, careerId, clubId);
        if (history.state.revision !== expectedRevision) throw new Error('stale scouting revision');
        const state = source.kind === 'EVIDENCE' ? appendScoutingEvidence(history.state, expectedRevision, source.record)
          : appendPlayerKnowledgeReport(history.state, expectedRevision, source.record);
        db.prepare('INSERT INTO main.world_scouting_sources VALUES (?,?,?,?,?,?,?)')
          .run(sourceId, careerId, clubId, state.revision, json(source), hash(source), json(state));
        if (!history.head) db.prepare('INSERT INTO main.world_scouting_heads VALUES (?,?,?,?)').run(careerId, clubId, state.revision, json(state));
        else if (db.prepare('UPDATE main.world_scouting_heads SET revision=?,state_json=? WHERE career_id=? AND club_id=? AND revision=? AND state_json=?')
          .run(state.revision, json(state), careerId, clubId, expectedRevision, history.head.state_json).changes !== 1) throw new Error('scouting compare-and-swap failed');
        const saved = scoutingHistory(db, careerId, clubId).state;
        if (json(saved) !== json(state)) throw new Error('scouting evidence changed during intake');
        return saved;
      });
    },
    readDecision(sourceId) { check(); return readRecruitmentDecisionFromSqlite(db, sourceId); },
    acceptDecision(sourceId, expectedRevision) {
      if (!id(sourceId) || !revision(expectedRevision)) throw new Error('invalid recruitment intake revision');
      return transaction(() => {
        const raw = authority?.readAcceptedRecruitmentSource(sourceId) ?? null;
        const source = raw === null ? null : decisionInput(raw, sourceId), prior = readRecruitmentDecisionFromSqlite(db, sourceId);
        if (prior) {
          if (prior.ledger.revision !== expectedRevision + 1 || source && json(source) !== json(prior.source)) throw new Error('recruitment source is frozen differently');
          return prior;
        }
        if (!source) throw new Error('accepted recruitment source is missing');
        const { careerId, clubId } = source.decision, history = decisionHistory(db, careerId, clubId);
        if (history.ledger.revision !== expectedRevision) throw new Error('stale recruitment decision revision');
        const basis = readBasis(db, source), knowledge = scoutingHistory(db, careerId, clubId).state;
        authenticateBasis(db, source, basis, knowledge);
        const ledger = appendDecision(history.ledger, source, basis, knowledge), snapshotHash = hash({ source, basis, ledger });
        db.prepare('INSERT INTO main.world_recruitment_decisions VALUES (?,?,?,?,?,?,?,?,?,?)').run(sourceId, careerId, clubId, ledger.revision,
          source.decision.decisionId, json(source), hash(source), json(basis), json(ledger), snapshotHash);
        if (!history.head) db.prepare('INSERT INTO main.world_recruitment_heads VALUES (?,?,?,?)').run(careerId, clubId, ledger.revision, json(ledger));
        else if (db.prepare('UPDATE main.world_recruitment_heads SET revision=?,state_json=? WHERE career_id=? AND club_id=? AND revision=? AND state_json=?')
          .run(ledger.revision, json(ledger), careerId, clubId, expectedRevision, history.head.state_json).changes !== 1) throw new Error('recruitment compare-and-swap failed');
        // Both current heads and original evidence must survive source-changing INSERT triggers.
        if (json(readBasis(db, source)) !== json(basis)) throw new Error('recruitment owners changed during intake');
        const saved = readRecruitmentDecisionFromSqlite(db, sourceId);
        if (!saved || saved.reference.snapshotHash !== snapshotHash) throw new Error('recruitment evidence changed during intake');
        return saved;
      });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
