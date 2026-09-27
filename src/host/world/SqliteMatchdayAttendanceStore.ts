import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { MatchdayAttendanceFact } from
  '../../core/world/club/OfficialMatchdayRevenue';
import { matchesDomesticFixtureRevision } from
  '../../core/world/competition/DomesticFixtureVenue';
import { applyScheduleRevisions } from
  '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import type { SqliteDomesticScheduleStore } from
  './SqliteDomesticScheduleStore';
import type { SqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

export type AcceptedGateCountAuthority = Readonly<{
  readAcceptedGateCount(factId: string): MatchdayAttendanceFact | null;
}>;
export type SqliteMatchdayAttendanceStore = Readonly<{
  accept(factId: string, seasonId: string): MatchdayAttendanceFact;
  read(factId: string): MatchdayAttendanceFact | null;
  close(): void;
}>;
export type AttendanceWorldSources = Readonly<{
  world: SqliteWorldSettlementStore;
  archive: SqliteDomesticScheduleStore;
  match: SqliteOfficialStateStore;
}>;

type Row = { season_id: string; career_id: string; game_id: string;
  source_event_id: string; fact_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);
const validFact = (fact: MatchdayAttendanceFact | null,
  factId: string): fact is MatchdayAttendanceFact =>
  fact !== null && Object.keys(fact).sort().join('|') === [
    'availableAtDay', 'careerId', 'count', 'factId', 'gameId',
    'observedAtDay', 'sourceEventId', 'stadiumId',
    'venueRevisionAtObservation',
  ].join('|')
  && fact.factId === factId && id(fact.careerId)
  && id(fact.gameId) && id(fact.sourceEventId)
  && id(fact.stadiumId) && day(fact.observedAtDay)
  && day(fact.availableAtDay)
  && fact.availableAtDay >= fact.observedAtDay
  && day(fact.venueRevisionAtObservation) && day(fact.count);

/** Keeps the gate counter independent of the settlement request. */
export const openSqliteMatchdayAttendanceStore = (
  databasePath: string, sources: AttendanceWorldSources,
  authority?: AcceptedGateCountAuthority | null,
): SqliteMatchdayAttendanceStore => {
  if (!id(databasePath) || !sources?.world || !sources.archive
    || !sources.match || (authority != null
      && typeof authority.readAcceptedGateCount !== 'function')) {
    throw new Error('invalid attendance store sources');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_matchday_attendance (
    fact_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    season_id TEXT NOT NULL, game_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL, fact_json TEXT NOT NULL,
    UNIQUE(career_id, game_id), UNIQUE(career_id, source_event_id)
  );`);
  const get = db.prepare(`SELECT season_id, career_id, game_id,
    source_event_id, fact_json FROM world_matchday_attendance
    WHERE fact_id=?`);
  const row = (factId: string): Row | null =>
    (get.get(factId) as Row | undefined) ?? null;
  const validateWorld = (fact: MatchdayAttendanceFact,
    seasonId: string): void => {
    const archived = sources.archive.read(fact.careerId, seasonId);
    const world = sources.world.readSeason(fact.careerId, seasonId);
    const fixture = sources.match.getOfficialFixture(fact.gameId);
    if (!archived || !world || !fixture
      || !matchesDomesticFixtureRevision(fixture, fact.careerId,
        archived.baseSchedule, archived.revisions)
      || !isDeepStrictEqual(world.schedule,
        captureOfficialStandingsSchedule(archived.baseSchedule,
          archived.revisions))) {
      throw new Error('accepted gate count lacks a durable domestic fixture');
    }
    const game = applyScheduleRevisions(archived.baseSchedule,
      archived.revisions).games.find((item) => item.gameId === fact.gameId);
    if (!game || game.day !== fact.observedAtDay
      || fixture.venueId !== fact.stadiumId) {
      throw new Error('accepted gate count differs from scheduled venue or day');
    }
    const history = readAcceptedClubHistory(db, fact.careerId,
      game.homeClubId);
    if (!history || history.checkpoint.revision
      > fact.venueRevisionAtObservation) {
      throw new Error('accepted gate count lacks home Club history');
    }
    const before = history.acceptedEvents.filter((event) =>
      event.afterRevision <= fact.venueRevisionAtObservation);
    const atGate = replayClubEvents(history.checkpoint, before);
    const next = history.acceptedEvents[before.length];
    if (!atGate.ok || atGate.value.revision
        !== fact.venueRevisionAtObservation
      || atGate.value.effectiveDay > fact.observedAtDay
      || (next && next.command.effectiveDay < fact.observedAtDay)
      || atGate.value.institutional.stadium.stadiumId
        !== fact.stadiumId
      || fact.count > atGate.value.institutional.stadium.capacity) {
      throw new Error('accepted gate count exceeds or differs from stadium state');
    }
  };
  const read = (factId: string): MatchdayAttendanceFact | null => {
    if (!id(factId)) throw new Error('invalid attendance factId');
    const stored = row(factId);
    if (!stored) return null;
    const fact = JSON.parse(stored.fact_json) as MatchdayAttendanceFact;
    if (!validFact(fact, factId)
      || canonicalJson(fact) !== stored.fact_json
      || fact.careerId !== stored.career_id
      || fact.gameId !== stored.game_id
      || fact.sourceEventId !== stored.source_event_id
      || !id(stored.season_id)) {
      throw new Error('corrupt accepted gate count');
    }
    validateWorld(fact, stored.season_id);
    return Object.freeze(fact);
  };
  let closed = false;
  return Object.freeze({
    accept(factId: string, seasonId: string): MatchdayAttendanceFact {
      if (!id(factId) || !id(seasonId)) {
        throw new Error('invalid gate count acceptance scope');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = row(factId);
        if (prior) {
          if (prior.season_id !== seasonId) {
            throw new Error('attendance factId was used in another season');
          }
          const result = read(factId)!;
          db.exec('COMMIT');
          return result;
        }
        if (!authority) {
          throw new Error('accepted gate count authority is required');
        }
        const raw = authority.readAcceptedGateCount(factId);
        const fact = raw === null ? null : cloneInert(raw);
        if (!validFact(fact, factId)) {
          throw new Error('gate count source is absent or invalid');
        }
        validateWorld(fact, seasonId);
        db.prepare(`INSERT INTO world_matchday_attendance
          (fact_id, career_id, season_id, game_id,
           source_event_id, fact_json) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(fact.factId, fact.careerId, seasonId, fact.gameId,
            fact.sourceEventId, canonicalJson(fact));
        const result = read(factId)!;
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    read,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};
