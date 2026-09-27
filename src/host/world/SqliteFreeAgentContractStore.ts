import { createRequire } from 'node:module';
import { readState as readClubState } from
  '../../core/world/club/ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from
  '../../core/world/club/ClubTypes';
import { getClubSeasonWageAllocations,
  type ClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { applyFreeAgentContract,
  type FreeAgentAcceptance,
  type FreeAgentRightsEvent } from
  '../../core/world/roster/FreeAgentContract';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import type { RecruitmentDecisionLedger } from
  '../../core/world/scouting/RecruitmentDecision';
import type { AcceptedFreeAgentRightsSource } from
  './SqlitePopularityHistoryStore';
import { appendAcceptedClubEvents,
  ensureClubEventJournalSchema } from './SqliteClubEventJournal';

export type FreeAgentContractStoreRequest = Readonly<{
  applicationId: string;
  expectedClubRevision: number;
  expectedRosterRevision: number;
  expectedWageRevision: number;
  roster: RosterState;
  beforeClub: ClubWorldState;
  afterClub: ClubWorldState;
  clubEvent: ClubTransitionEvent;
  beforeSchedules: ClubWageScheduleLedger;
  afterSchedules: ClubWageScheduleLedger;
  decisions: RecruitmentDecisionLedger;
  decisionId: string;
  acceptance: FreeAgentAcceptance;
  /** Accepted Player-Person link provenance, supplied by the host authority. */
  personLink: Readonly<{
    personId: string;
    playerId: string;
    personLinkSourceId: string;
  }>;
}>;
export type DurableFreeAgentContract = Readonly<{
  applicationId: string;
  clubRevision: number;
  rosterRevision: number;
  wageRevision: number;
  rightsEvent: FreeAgentRightsEvent;
}>;
export type AcceptedPlayerPersonLinkAuthority = Readonly<{
  readAcceptedPlayerPersonLink(sourceId: string): Readonly<{
    careerId: string;
    playerId: string;
    personId: string;
  }> | null;
}>;
export type SqliteFreeAgentContractStore = Readonly<{
  initializeWageSchedules(ledger: ClubWageScheduleLedger): void;
  readWageSchedules(careerId: string,
    clubId: string): ClubWageScheduleLedger | null;
  apply(request: FreeAgentContractStoreRequest): DurableFreeAgentContract;
  readApplication(applicationId: string): DurableFreeAgentContract | null;
  readAcceptedFreeAgentRightsEvent(eventId: string):
    AcceptedFreeAgentRightsSource | null;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const canonicalJson = (value: unknown): string => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('free-agent evidence exceeds size limit');
    }
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item === 0 ? 0 : item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) {
      throw new Error('free-agent evidence must be inert JSON');
    }
    ancestors.add(item);
    let normalized: unknown;
    if (Array.isArray(item)) {
      if (Reflect.ownKeys(item).length !== item.length + 1) {
        throw new Error('free-agent evidence requires dense arrays');
      }
      const array: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item,
          String(index));
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('free-agent evidence requires dense arrays');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      normalized = array;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('free-agent evidence must be plain JSON');
      }
      const entries: [string, unknown][] = [];
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') {
          throw new Error('free-agent evidence rejects symbol keys');
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('free-agent evidence rejects accessors');
        }
        entries.push([key, visit(descriptor.value, depth + 1)]);
      }
      normalized = Object.fromEntries(entries.sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }
    ancestors.delete(item);
    return normalized;
  };
  return JSON.stringify(visit(value, 0));
};

type ClubRow = { revision: number; state_json: string };
type RosterRow = { revision: number; roster_json: string };
type WageRow = { revision: number; ledger_json: string };
type ApplicationRow = { application_id: string; career_id: string;
  club_id: string; club_revision: number; roster_revision: number;
  wage_revision: number; rights_event_id: string;
  request_json: string; result_json: string };
type RightsRow = { application_id: string; source_json: string };

/**
 * Shares the manager store's career-global roster head. Rights acquisition
 * changes roster_json/revision only; club Mood heads remain untouched.
 */
export const openSqliteFreeAgentContractStore = (
  databasePath: string,
  personLinkAuthority: AcceptedPlayerPersonLinkAuthority,
): SqliteFreeAgentContractStore => {
  if (!id(databasePath)) throw new Error('invalid free-agent database path');
  if (!personLinkAuthority
    || typeof personLinkAuthority.readAcceptedPlayerPersonLink
      !== 'function') {
    throw new Error('accepted player-person link authority is required');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wage_schedule_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL, ledger_json TEXT NOT NULL,
    PRIMARY KEY (career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_free_agent_applications (
    application_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    club_revision INTEGER NOT NULL, roster_revision INTEGER NOT NULL,
    wage_revision INTEGER NOT NULL, rights_event_id TEXT NOT NULL UNIQUE,
    request_json TEXT NOT NULL, result_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_accepted_free_agent_rights (
    event_id TEXT PRIMARY KEY, application_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL
  );`);
  ensureClubEventJournalSchema(db);
  const getClub = db.prepare(`SELECT revision, state_json
    FROM world_club_heads WHERE career_id=? AND club_id=?`);
  const getRoster = db.prepare(`SELECT revision, roster_json
    FROM world_roster_heads WHERE career_id=?`);
  const getWage = db.prepare(`SELECT revision, ledger_json
    FROM world_wage_schedule_heads WHERE career_id=? AND club_id=?`);
  const getApplication = db.prepare(`SELECT application_id, career_id,
    club_id, club_revision, roster_revision, wage_revision,
    rights_event_id, request_json, result_json
    FROM world_free_agent_applications WHERE application_id=?`);
  const getRights = db.prepare(`SELECT application_id, source_json
    FROM world_accepted_free_agent_rights WHERE event_id=?`);
  const clubRow = (careerId: string, clubId: string): ClubRow | null =>
    (getClub.get(careerId, clubId) as ClubRow | undefined) ?? null;
  const rosterRow = (careerId: string): RosterRow | null =>
    (getRoster.get(careerId) as RosterRow | undefined) ?? null;
  const wageRow = (careerId: string, clubId: string): WageRow | null =>
    (getWage.get(careerId, clubId) as WageRow | undefined) ?? null;
  const applicationRow = (applicationId: string): ApplicationRow | null =>
    (getApplication.get(applicationId) as ApplicationRow | undefined)
      ?? null;
  const rightsRow = (eventId: string): RightsRow | null =>
    (getRights.get(eventId) as RightsRow | undefined) ?? null;
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const replay = (request: FreeAgentContractStoreRequest) =>
    applyFreeAgentContract(request.roster,
      request.expectedRosterRevision, request.beforeClub,
      request.afterClub, request.clubEvent,
      request.beforeSchedules, request.afterSchedules,
      request.decisions, request.decisionId, request.acceptance);
  const decodeApplication = (row: ApplicationRow):
  DurableFreeAgentContract => {
    try {
      const request = JSON.parse(row.request_json) as
        FreeAgentContractStoreRequest;
      const stored = JSON.parse(row.result_json) as
        DurableFreeAgentContract;
      const computed = replay(request);
      const club = clubRow(row.career_id, row.club_id);
      const roster = rosterRow(row.career_id);
      const wage = wageRow(row.career_id, row.club_id);
      const accepted = rightsRow(row.rights_event_id);
      const source = JSON.parse(accepted?.source_json ?? 'null') as
        AcceptedFreeAgentRightsSource | null;
      if (!club || !roster || !wage || !accepted || !source
        || !id(row.application_id)
        || JSON.stringify(request) !== row.request_json
        || canonicalJson(stored) !== row.result_json
        || request.applicationId !== row.application_id
        || request.beforeClub.careerId !== row.career_id
        || request.beforeClub.identity.clubId !== row.club_id
        || request.expectedClubRevision + 1 !== row.club_revision
        || request.expectedRosterRevision + 1 !== row.roster_revision
        || request.expectedWageRevision + 1 !== row.wage_revision
        || club.revision < row.club_revision
        || roster.revision < row.roster_revision
        || wage.revision < row.wage_revision
        || stored.applicationId !== row.application_id
        || stored.clubRevision !== row.club_revision
        || stored.rosterRevision !== row.roster_revision
        || stored.wageRevision !== row.wage_revision
        || stored.rightsEvent.eventId !== row.rights_event_id
        || canonicalJson(stored.rightsEvent)
          !== canonicalJson(computed.event)
        || accepted.application_id !== row.application_id
        || canonicalJson(source) !== accepted.source_json
        || canonicalJson(source.rightsEvent)
          !== canonicalJson(computed.event)
        || source.personId !== request.personLink.personId
        || source.playerId !== request.personLink.playerId
        || source.personLinkSourceId
          !== request.personLink.personLinkSourceId
        || (club.revision === row.club_revision
          && canonicalJson(request.afterClub) !== club.state_json)
        || (roster.revision === row.roster_revision
          && canonicalJson(computed.state) !== roster.roster_json)
        || (wage.revision === row.wage_revision
          && canonicalJson(request.afterSchedules) !== wage.ledger_json)) {
        throw new Error('free-agent application row mismatch');
      }
      return stored;
    } catch (cause) {
      throw new Error('corrupt durable free-agent application', { cause });
    }
  };
  let closed = false;
  const api: SqliteFreeAgentContractStore = Object.freeze({
    initializeWageSchedules(ledger): void {
      if (!ledger || !id(ledger.careerId) || !id(ledger.clubId)) {
        throw new Error('invalid wage schedule initialization');
      }
      const ledgerJson = canonicalJson(ledger);
      transaction(() => {
        const club = clubRow(ledger.careerId, ledger.clubId);
        const roster = rosterRow(ledger.careerId);
        if (!club || !roster) {
          throw new Error('world Club or roster head is not initialized');
        }
        const clubState = readClubState(JSON.parse(club.state_json));
        getClubSeasonWageAllocations(ledger, clubState);
        const current = wageRow(ledger.careerId, ledger.clubId);
        if (current) {
          if (current.revision !== ledger.revision
            || current.ledger_json !== ledgerJson) {
            throw new Error('wage schedule head already initialized differently');
          }
          return;
        }
        db.prepare(`INSERT INTO world_wage_schedule_heads
          (career_id, club_id, revision, ledger_json)
          VALUES (?, ?, ?, ?)`).run(ledger.careerId, ledger.clubId,
          ledger.revision, ledgerJson);
      });
    },
    readWageSchedules(careerId, clubId): ClubWageScheduleLedger | null {
      if (!id(careerId) || !id(clubId)) {
        throw new Error('invalid wage schedule scope');
      }
      const row = wageRow(careerId, clubId);
      if (!row) return null;
      const ledger = JSON.parse(row.ledger_json) as ClubWageScheduleLedger;
      if (ledger.careerId !== careerId || ledger.clubId !== clubId
        || ledger.revision !== row.revision
        || canonicalJson(ledger) !== row.ledger_json) {
        throw new Error('corrupt durable wage schedule head');
      }
      return ledger;
    },
    apply(request): DurableFreeAgentContract {
      if (!request || !id(request.applicationId)
        || !revision(request.expectedClubRevision)
        || !revision(request.expectedRosterRevision)
        || !revision(request.expectedWageRevision)) {
        throw new Error('invalid free-agent application');
      }
      canonicalJson(request);
      // Core's event replay also compares some objects using JSON.stringify.
      // Preserve their original field order for deterministic replay.
      const requestJson = JSON.stringify(request);
      return transaction(() => {
        const prior = applicationRow(request.applicationId);
        if (prior) {
          const durable = decodeApplication(prior);
          if (canonicalJson(JSON.parse(prior.request_json))
            !== canonicalJson(request)) {
            throw new Error('applicationId was used for different free-agent evidence');
          }
          return durable;
        }
        const careerId = request.beforeClub.careerId;
        const clubId = request.beforeClub.identity.clubId;
        const club = clubRow(careerId, clubId);
        const roster = rosterRow(careerId);
        const wage = wageRow(careerId, clubId);
        if (!club || !roster || !wage) {
          throw new Error('world Club, roster or wage head is not initialized');
        }
        if (club.revision !== request.expectedClubRevision) {
          throw new Error('stale world club revision');
        }
        if (roster.revision !== request.expectedRosterRevision) {
          throw new Error('stale world roster revision');
        }
        if (wage.revision !== request.expectedWageRevision) {
          throw new Error('stale world wage revision');
        }
        if (canonicalJson(readClubState(request.beforeClub))
            !== club.state_json
          || canonicalJson(createRosterState(request.roster))
            !== roster.roster_json
          || canonicalJson(request.beforeSchedules) !== wage.ledger_json) {
          throw new Error('free-agent input does not match durable heads');
        }
        const computed = replay(request);
        const link = request.personLink;
        const acceptedLink = link && id(link.personLinkSourceId)
          ? personLinkAuthority.readAcceptedPlayerPersonLink(
            link.personLinkSourceId) : null;
        if (!link || !id(link.personId)
          || !id(link.personLinkSourceId)
          || link.playerId !== computed.event.playerId
          || acceptedLink?.careerId !== careerId
          || acceptedLink.playerId !== link.playerId
          || acceptedLink.personId !== link.personId) {
          throw new Error('accepted player-person link is missing');
        }
        const nextClub = canonicalJson(request.afterClub);
        const nextRoster = canonicalJson(computed.state);
        const nextWage = canonicalJson(request.afterSchedules);
        appendAcceptedClubEvents(db, request.beforeClub,
          [request.clubEvent], request.afterClub);
        const clubUpdate = db.prepare(`UPDATE world_club_heads
          SET revision=?, state_json=?
          WHERE career_id=? AND club_id=? AND revision=?
          AND state_json=?`).run(request.afterClub.revision,
          nextClub, careerId, clubId, request.expectedClubRevision,
          club.state_json);
        const rosterUpdate = db.prepare(`UPDATE world_roster_heads
          SET revision=?, roster_json=?
          WHERE career_id=? AND revision=?
          AND roster_json=?`).run(computed.state.revision,
          nextRoster, careerId,
          request.expectedRosterRevision, roster.roster_json);
        const wageUpdate = db.prepare(`UPDATE world_wage_schedule_heads
          SET revision=?, ledger_json=?
          WHERE career_id=? AND club_id=? AND revision=?
          AND ledger_json=?`).run(request.afterSchedules.revision,
          nextWage, careerId, clubId,
          request.expectedWageRevision, wage.ledger_json);
        if (clubUpdate.changes !== 1 || rosterUpdate.changes !== 1
          || wageUpdate.changes !== 1) {
          throw new Error('free-agent compare-and-swap failed');
        }
        const durable: DurableFreeAgentContract = {
          applicationId: request.applicationId,
          clubRevision: request.afterClub.revision,
          rosterRevision: computed.state.revision,
          wageRevision: request.afterSchedules.revision,
          rightsEvent: computed.event,
        };
        const source: AcceptedFreeAgentRightsSource = {
          rightsEvent: computed.event, personId: link.personId,
          playerId: link.playerId,
          personLinkSourceId: link.personLinkSourceId,
        };
        db.prepare(`INSERT INTO world_free_agent_applications
          (application_id, career_id, club_id, club_revision,
           roster_revision, wage_revision, rights_event_id,
           request_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          request.applicationId, careerId, clubId,
          durable.clubRevision, durable.rosterRevision,
          durable.wageRevision, computed.event.eventId,
          requestJson, canonicalJson(durable));
        db.prepare(`INSERT INTO world_accepted_free_agent_rights
          (event_id, application_id, source_json)
          VALUES (?, ?, ?)`).run(computed.event.eventId,
          request.applicationId, canonicalJson(source));
        return decodeApplication(applicationRow(request.applicationId)!);
      });
    },
    readApplication(applicationId): DurableFreeAgentContract | null {
      if (!id(applicationId)) throw new Error('invalid free-agent applicationId');
      const row = applicationRow(applicationId);
      return row ? decodeApplication(row) : null;
    },
    readAcceptedFreeAgentRightsEvent(eventId):
    AcceptedFreeAgentRightsSource | null {
      if (!id(eventId)) throw new Error('invalid accepted rights eventId');
      const row = rightsRow(eventId);
      if (!row) return null;
      const application = api.readApplication(row.application_id);
      if (!application || application.rightsEvent.eventId !== eventId) {
        throw new Error('corrupt durable accepted rights source');
      }
      return JSON.parse(row.source_json) as AcceptedFreeAgentRightsSource;
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
  return api;
};
