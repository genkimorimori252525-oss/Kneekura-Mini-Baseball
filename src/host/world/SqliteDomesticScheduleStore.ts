import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyScheduleRevisions, createBaseScheduleSnapshot,
  type BaseScheduleSnapshot, type ScheduleRevisionEvent } from
  '../../core/world/competition/LeagueSchedule';
import { createLeagueSeasonEventSnapshot, marketDecisionTriggersOnDay,
  type LeagueSeasonEventProfile, type LeagueSeasonEventSnapshot,
  type MarketDecisionTrigger } from
  '../../core/world/competition/LeagueSeasonEvents';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { projectProvisionalOfficialStandings } from
  '../../core/world/competition/ProvisionalOfficialStandings';

export type DurableDomesticSchedule = Readonly<{
  careerId: string;
  seasonId: string;
  revision: number;
  baseSchedule: BaseScheduleSnapshot;
  revisions: readonly ScheduleRevisionEvent[];
  acceptedAtDays: readonly number[];
}>;
export type DurableLeagueSeasonEvents = Readonly<{
  careerId: string;
  seasonId: string;
  profile: LeagueSeasonEventProfile;
  snapshot: LeagueSeasonEventSnapshot;
}>;
export type SqliteDomesticScheduleStore = Readonly<{
  initialize(careerId: string,
    baseSchedule: BaseScheduleSnapshot): DurableDomesticSchedule;
  read(careerId: string, seasonId: string): DurableDomesticSchedule | null;
  appendRevision(careerId: string, seasonId: string,
    expectedRevision: number, event: ScheduleRevisionEvent,
    acceptedAtDay: number): DurableDomesticSchedule;
  initializeEvents(careerId: string, seasonId: string,
    profile: LeagueSeasonEventProfile): DurableLeagueSeasonEvents;
  readEvents(careerId: string, seasonId: string):
    DurableLeagueSeasonEvents | null;
  marketTriggersOnDay(careerId: string, seasonId: string,
    day: number): readonly MarketDecisionTrigger[];
  close(): void;
}>;

type ArchiveRow = { revision: number; base_json: string;
  records_json: string };
type SeasonRow = { revision: number; schedule_json: string;
  policy_json: string; results_json: string };
type EventsRow = { profile_json: string; snapshot_json: string };
type RevisionRecord = Readonly<{ event: ScheduleRevisionEvent;
  acceptedAtDay: number }>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value),
  (_key, item: unknown) => item !== null && typeof item === 'object'
    && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0)) : item);

/** Stores the frozen generator output and accepted revisions beside World heads. */
export const openSqliteDomesticScheduleStore = (
  databasePath: string,
): SqliteDomesticScheduleStore => {
  if (!id(databasePath)) throw new Error('invalid domestic schedule database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_domestic_schedules (
    career_id TEXT NOT NULL, season_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision >= 0),
    base_json TEXT NOT NULL, records_json TEXT NOT NULL,
    PRIMARY KEY (career_id, season_id)
  );
  CREATE TABLE IF NOT EXISTS world_league_season_events (
    career_id TEXT NOT NULL, season_id TEXT NOT NULL,
    profile_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, season_id)
  );`);
  const archiveQuery = db.prepare(`SELECT revision, base_json, records_json
    FROM world_domestic_schedules WHERE career_id=? AND season_id=?`);
  const seasonQuery = db.prepare(`SELECT revision, schedule_json,
    policy_json, results_json FROM world_season_heads
    WHERE career_id=? AND season_id=?`);
  const eventsQuery = db.prepare(`SELECT profile_json, snapshot_json
    FROM world_league_season_events WHERE career_id=? AND season_id=?`);
  const archiveRow = (careerId: string, seasonId: string): ArchiveRow | null =>
    (archiveQuery.get(careerId, seasonId) as ArchiveRow | undefined) ?? null;
  const seasonRow = (careerId: string, seasonId: string): SeasonRow | null =>
    (seasonQuery.get(careerId, seasonId) as SeasonRow | undefined) ?? null;
  const eventsRow = (careerId: string, seasonId: string): EventsRow | null =>
    (eventsQuery.get(careerId, seasonId) as EventsRow | undefined) ?? null;
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
  const parse = (careerId: string, seasonId: string,
    row: ArchiveRow, season: SeasonRow): DurableDomesticSchedule => {
    const baseSchedule = JSON.parse(row.base_json) as BaseScheduleSnapshot;
    const records = JSON.parse(row.records_json) as RevisionRecord[];
    const reconstructed = createBaseScheduleSnapshot(baseSchedule);
    if (!Array.isArray(records) || !day(row.revision)
      || row.revision !== records.length
      || canonicalJson(baseSchedule) !== row.base_json
      || canonicalJson(records) !== row.records_json
      || !isDeepStrictEqual(reconstructed, baseSchedule)
      || baseSchedule.seasonId !== seasonId
      || records.some((record, index) => !day(record.acceptedAtDay)
        || !id(record.event?.eventId)
        || record.acceptedAtDay > record.event.newDay
        || (index > 0 && record.acceptedAtDay
          < records[index - 1]!.acceptedAtDay))) {
      throw new Error('corrupt durable domestic schedule');
    }
    const revisions = records.map((record) => record.event);
    const current = captureOfficialStandingsSchedule(baseSchedule, revisions);
    if (!isDeepStrictEqual(JSON.parse(season.schedule_json), current)) {
      throw new Error('durable domestic schedule diverges from World season');
    }
    return Object.freeze({ careerId, seasonId, revision: row.revision,
      baseSchedule, revisions: Object.freeze(revisions),
      acceptedAtDays: Object.freeze(records.map((record) =>
        record.acceptedAtDay)) });
  };
  const parseEvents = (careerId: string, seasonId: string,
    schedule: DurableDomesticSchedule,
    row: EventsRow): DurableLeagueSeasonEvents => {
    const profile = JSON.parse(row.profile_json) as LeagueSeasonEventProfile;
    const snapshot = JSON.parse(row.snapshot_json) as LeagueSeasonEventSnapshot;
    const recomputed = createLeagueSeasonEventSnapshot(
      schedule.baseSchedule, profile);
    const current = applyScheduleRevisions(schedule.baseSchedule,
      schedule.revisions);
    if (canonicalJson(profile) !== row.profile_json
      || canonicalJson(snapshot) !== row.snapshot_json
      || !isDeepStrictEqual(snapshot, recomputed)
      || (snapshot.allStarEvent !== null && current.games.some((game) =>
        game.day === snapshot.allStarEvent!.day))) {
      throw new Error('corrupt durable league season events');
    }
    return Object.freeze({ careerId, seasonId, profile, snapshot });
  };
  const readSchedule = (careerId: string,
    seasonId: string): DurableDomesticSchedule | null => {
    if (!id(careerId) || !id(seasonId)) {
      throw new Error('invalid domestic schedule scope');
    }
    const archive = archiveRow(careerId, seasonId);
    if (!archive) return null;
    const season = seasonRow(careerId, seasonId);
    if (!season) throw new Error('durable World season is missing');
    return parse(careerId, seasonId, archive, season);
  };
  const readEvents = (careerId: string,
    seasonId: string): DurableLeagueSeasonEvents | null => {
    if (!id(careerId) || !id(seasonId)) {
      throw new Error('invalid league season event scope');
    }
    const row = eventsRow(careerId, seasonId);
    if (!row) return null;
    const schedule = readSchedule(careerId, seasonId);
    if (!schedule) throw new Error('domestic schedule is not initialized');
    return parseEvents(careerId, seasonId, schedule, row);
  };
  return Object.freeze({
    initialize(careerId: string,
      baseSchedule: BaseScheduleSnapshot): DurableDomesticSchedule {
      if (!id(careerId) || !baseSchedule) {
        throw new Error('invalid domestic schedule initialization');
      }
      const reconstructed = createBaseScheduleSnapshot(baseSchedule);
      if (!isDeepStrictEqual(reconstructed, baseSchedule)) {
        throw new Error('domestic base schedule does not match its series');
      }
      const baseJson = canonicalJson(baseSchedule);
      return transaction(() => {
        const season = seasonRow(careerId, baseSchedule.seasonId);
        if (!season) throw new Error('durable World season is missing');
        const existing = archiveRow(careerId, baseSchedule.seasonId);
        if (existing) {
          const prior = parse(careerId, baseSchedule.seasonId,
            existing, season);
          if (!isDeepStrictEqual(prior.baseSchedule, baseSchedule)) {
            throw new Error('domestic base schedule is already pinned differently');
          }
          return prior;
        }
        if (season.revision !== 0
          || !isDeepStrictEqual(JSON.parse(season.results_json), [])
          || !isDeepStrictEqual(JSON.parse(season.schedule_json),
            captureOfficialStandingsSchedule(baseSchedule, []))) {
          throw new Error('World season already progressed or differs from base schedule');
        }
        db.prepare(`INSERT INTO world_domestic_schedules
          (career_id, season_id, revision, base_json, records_json)
          VALUES (?, ?, 0, ?, '[]')`).run(careerId,
          baseSchedule.seasonId, baseJson);
        return parse(careerId, baseSchedule.seasonId,
          archiveRow(careerId, baseSchedule.seasonId)!, season);
      });
    },
    read(careerId: string, seasonId: string): DurableDomesticSchedule | null {
      return readSchedule(careerId, seasonId);
    },
    appendRevision(careerId: string, seasonId: string,
      expectedRevision: number, event: ScheduleRevisionEvent,
      acceptedAtDay: number): DurableDomesticSchedule {
      if (!id(careerId) || !id(seasonId)
        || !day(expectedRevision) || !day(acceptedAtDay)
        || !id(event?.eventId) || !day(event.newDay)
        || acceptedAtDay > event.newDay) {
        throw new Error('invalid domestic schedule revision request');
      }
      canonicalJson(event);
      return transaction(() => {
        const archive = archiveRow(careerId, seasonId);
        const season = seasonRow(careerId, seasonId);
        if (!archive || !season) throw new Error('domestic schedule is not initialized');
        const prior = parse(careerId, seasonId, archive, season);
        const duplicateIndex = prior.revisions.findIndex((item) =>
          item.eventId === event.eventId);
        if (duplicateIndex >= 0) {
          if (duplicateIndex !== expectedRevision
            || !isDeepStrictEqual(prior.revisions[duplicateIndex], event)
            || prior.acceptedAtDays[duplicateIndex] !== acceptedAtDay) {
            throw new Error('domestic schedule revision event was reused differently');
          }
          return prior;
        }
        if (prior.revision !== expectedRevision) {
          throw new Error('stale domestic schedule revision');
        }
        if (prior.acceptedAtDays.length > 0
          && acceptedAtDay < prior.acceptedAtDays[prior.acceptedAtDays.length - 1]!) {
          throw new Error('backdated domestic schedule revision');
        }
        const scheduled = applyScheduleRevisions(prior.baseSchedule,
          prior.revisions).games.find((game) => game.gameId === event.gameId);
        if (scheduled && scheduled.day < acceptedAtDay) {
          throw new Error('past game cannot be rescheduled');
        }
        const results = JSON.parse(season.results_json) as OfficialGameResult[];
        if (!Array.isArray(results)
          || results.some((result) => result.gameId === event.gameId)) {
          throw new Error('completed domestic game cannot be rescheduled');
        }
        const revisions = [...prior.revisions, event];
        const revised = applyScheduleRevisions(prior.baseSchedule, revisions);
        const pinnedEvents = eventsRow(careerId, seasonId);
        if (pinnedEvents) {
          const events = parseEvents(careerId, seasonId,
            prior, pinnedEvents);
          if (events.snapshot.allStarEvent !== null
            && revised.games.some((game) =>
              game.day === events.snapshot.allStarEvent!.day)) {
            throw new Error('domestic revision overlaps the All-Star break');
          }
        }
        const schedule = captureOfficialStandingsSchedule(
          prior.baseSchedule, revisions);
        const policy = JSON.parse(season.policy_json) as
          StandingsTiebreakPolicy;
        const standings = projectProvisionalOfficialStandings(
          schedule, results, policy);
        const records: RevisionRecord[] = revisions.map((item, index) => ({
          event: item, acceptedAtDay: index === prior.revision
            ? acceptedAtDay : prior.acceptedAtDays[index]!,
        }));
        db.prepare(`UPDATE world_domestic_schedules
          SET revision=?, records_json=? WHERE career_id=? AND season_id=?
          AND revision=?`).run(prior.revision + 1,
          canonicalJson(records), careerId, seasonId, prior.revision);
        db.prepare(`UPDATE world_season_heads
          SET schedule_json=?, standings_json=?
          WHERE career_id=? AND season_id=? AND revision=?`).run(
          canonicalJson(schedule), canonicalJson(standings),
          careerId, seasonId, season.revision);
        return parse(careerId, seasonId,
          archiveRow(careerId, seasonId)!, seasonRow(careerId, seasonId)!);
      });
    },
    initializeEvents(careerId: string, seasonId: string,
      profile: LeagueSeasonEventProfile): DurableLeagueSeasonEvents {
      if (!id(careerId) || !id(seasonId)) {
        throw new Error('invalid league season event scope');
      }
      const profileJson = canonicalJson(profile);
      return transaction(() => {
        const schedule = readSchedule(careerId, seasonId);
        if (!schedule) throw new Error('domestic schedule is not initialized');
        const snapshot = createLeagueSeasonEventSnapshot(
          schedule.baseSchedule, profile);
        const prior = eventsRow(careerId, seasonId);
        if (prior) {
          const durable = parseEvents(careerId, seasonId, schedule, prior);
          if (prior.profile_json !== profileJson) {
            throw new Error('league season event profile is already pinned');
          }
          return durable;
        }
        if (schedule.revision !== 0) {
          throw new Error('league season events must be pinned before revision');
        }
        db.prepare(`INSERT INTO world_league_season_events
          (career_id, season_id, profile_json, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(careerId, seasonId,
          profileJson, canonicalJson(snapshot));
        return parseEvents(careerId, seasonId, schedule,
          eventsRow(careerId, seasonId)!);
      });
    },
    readEvents(careerId: string, seasonId: string):
    DurableLeagueSeasonEvents | null {
      return readEvents(careerId, seasonId);
    },
    marketTriggersOnDay(careerId: string, seasonId: string,
      eventDay: number): readonly MarketDecisionTrigger[] {
      if (!day(eventDay)) throw new Error('invalid league season event day');
      const events = readEvents(careerId, seasonId);
      if (!events) throw new Error('league season events are not initialized');
      return marketDecisionTriggersOnDay(events.snapshot, eventDay);
    },
    close(): void { db.close(); },
  });
};
