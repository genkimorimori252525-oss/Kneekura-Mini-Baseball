import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { commandReader } from '../../core/world/club/ClubCommands';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { freeze } from '../../core/world/club/ClubValidation';
import { createLeagueSeasonEventSnapshot } from '../../core/world/competition/LeagueSeasonEvents';
import { applyScheduleRevisions } from '../../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from '../../core/world/competition/OfficialStandingsScheduleSource';
import { projectProvisionalOfficialStandings } from '../../core/world/competition/ProvisionalOfficialStandings';
import { generateWorldBoundLeagueSchedule } from '../../core/world/competition/WorldLeagueSchedule';
import { openSqliteClubSeasonTransitionStore, type AcceptedClubSeasonTransition } from './SqliteClubSeasonTransitionStore';
import type { SqliteDomesticCompetitionSeasonStore } from './SqliteDomesticCompetitionSeasonStore';
import type { SqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { initializeWorldBoundDomesticSeason, type WorldBoundDomesticSeasonInput } from './WorldBoundDomesticSeasonRuntime';
import type { DomesticSeasonStores } from './DomesticSeasonRuntime';

export type AcceptedDomesticSeasonAdvance = Readonly<{
  sourceId: string; sourceVersion: string; previousSeasonId: string;
  nextSeason: Omit<WorldBoundDomesticSeasonInput, 'clubs'>;
  clubTransitions: readonly AcceptedClubSeasonTransition[];
}>;
export type DomesticSeasonAdvanceResult = Readonly<{
  sourceId: string; careerId: string; previousSeasonId: string; seasonId: string;
  clubSourceIds: readonly string[]; worldWindowSnapshotId: string;
}>;
export type DurableDomesticSeasonAdvance = Readonly<{
  request: AcceptedDomesticSeasonAdvance; status: 'PENDING' | 'COMPLETED'; result: DomesticSeasonAdvanceResult | null;
}>;
export type SqliteDomesticSeasonAdvanceStore = Readonly<{
  enqueue(sourceId: string): DurableDomesticSeasonAdvance;
  read(sourceId: string): DurableDomesticSeasonAdvance | null;
  resume(sourceId: string): DomesticSeasonAdvanceResult;
  submit(sourceId: string): DomesticSeasonAdvanceResult;
  close(): void;
}>;
type AdvanceSources = DomesticSeasonStores & Readonly<{
  cycle: Pick<SqliteWorldCompetitionCycleStore, 'readCycle'>;
  competition: Pick<SqliteDomesticCompetitionSeasonStore, 'readSnapshot'>;
}>;
type Row = { source_id: string; source_version: string; career_id: string; previous_season_id: string; next_season_id: string;
  status: string; request_json: string; competition_json: string; calendar_json: string; result_json: string | null };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const sameMembers = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length
  && new Set(a).size === a.length && new Set(b).size === b.length && a.every((member) => b.includes(member));
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const requestFrom = (raw: unknown, sourceId: string): AcceptedDomesticSeasonAdvance => {
  const input = cloneInert(raw) as AcceptedDomesticSeasonAdvance;
  if (!fields(input, ['sourceId', 'sourceVersion', 'previousSeasonId', 'nextSeason', 'clubTransitions'])
    || input.sourceId !== sourceId || !id(input.sourceId) || !id(input.sourceVersion) || !id(input.previousSeasonId)
    || !fields(input.nextSeason, ['careerId', 'cycleOrdinal', 'leagueRegion', 'seasonDayOne', 'standingsPolicy', 'eventProfile', 'generatorInput'])
    || !id(input.nextSeason.careerId) || !Array.isArray(input.clubTransitions) || input.clubTransitions.length === 0) {
    throw new Error('invalid accepted domestic season advance');
  }
  const clubTransitions = input.clubTransitions.map((record) => {
    if (!fields(record, ['sourceId', 'sourceVersion', 'command']) || !id(record.sourceId) || !id(record.sourceVersion)) {
      throw new Error('invalid domestic Club boundary Source');
    }
    const command = commandReader(record.command, 'command');
    if (command.operations.length !== 2 || command.operations[0].kind !== 'CLOSE_SEASON' || command.operations[1].kind !== 'OPEN_SEASON') {
      throw new Error('domestic advance requires close then open for every member');
    }
    return { sourceId: record.sourceId, sourceVersion: record.sourceVersion, command };
  });
  if (new Set(clubTransitions.map((record) => record.sourceId)).size !== clubTransitions.length) throw new Error('duplicate domestic boundary Source');
  return freeze({ ...input, clubTransitions });
};

/** Durable multi-stage progress joins accepted Club boundaries to the actual next World calendar. */
export const openSqliteDomesticSeasonAdvanceStore = (databasePath: string, sources: AdvanceSources,
  authority?: Readonly<{ readAcceptedAdvance(sourceId: string): AcceptedDomesticSeasonAdvance | null }> | null,
): SqliteDomesticSeasonAdvanceStore => {
  if (!id(databasePath) || !sources?.world || !sources.archive || !sources.match
    || typeof sources.cycle?.readCycle !== 'function' || typeof sources.competition?.readSnapshot !== 'function'
    || authority != null && typeof authority.readAcceptedAdvance !== 'function') throw new Error('invalid domestic advance sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_domestic_season_advances (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, career_id TEXT NOT NULL,
    previous_season_id TEXT NOT NULL, next_season_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'COMPLETED')),
    request_json TEXT NOT NULL, competition_json TEXT NOT NULL, calendar_json TEXT NOT NULL, result_json TEXT,
    UNIQUE(career_id, previous_season_id), UNIQUE(career_id, next_season_id),
    CHECK((status='PENDING' AND result_json IS NULL) OR (status='COMPLETED' AND result_json IS NOT NULL))
  );
  CREATE TABLE IF NOT EXISTS world_domestic_season_advance_sources (
    source_id TEXT PRIMARY KEY, advance_source_id TEXT NOT NULL, source_json TEXT NOT NULL,
    FOREIGN KEY(advance_source_id) REFERENCES world_domestic_season_advances(source_id)
  );`);
  const getRow = db.prepare('SELECT * FROM world_domestic_season_advances WHERE source_id=?');
  const getChild = db.prepare('SELECT advance_source_id, source_json FROM world_domestic_season_advance_sources WHERE source_id=?');
  let closed = false;
  const scope = (sourceId: string): void => { if (closed || !id(sourceId)) throw new Error('invalid domestic advance scope'); };
  const transitions = openSqliteClubSeasonTransitionStore(databasePath, { readAcceptedTransition: (sourceId) => {
    const child = getChild.get(sourceId) as { advance_source_id: string; source_json: string } | undefined;
    if (!child) return null;
    const row = getRow.get(child.advance_source_id) as Row | undefined;
    const record = row && requestFrom(JSON.parse(row.request_json), row.source_id).clubTransitions.find((item) => item.sourceId === sourceId);
    if (!record || child.source_json !== json(record)) throw new Error('corrupt domestic boundary Source archive');
    return record;
  } });
  const historical = (input: AcceptedDomesticSeasonAdvance) => {
    const next = input.nextSeason, generator = next.generatorInput;
    const competition = sources.competition.readSnapshot(next.careerId, input.previousSeasonId);
    if (!competition) throw new Error('previous domestic championship is not complete');
    const previous = sources.world.readSeason(next.careerId, input.previousSeasonId);
    const previousArchive = sources.archive.read(next.careerId, input.previousSeasonId);
    if (!previous || !previousArchive || previous.standings.kind !== 'OFFICIAL'
      || generator.calendarProfileVersion === competition.calendarProfileVersion
        && generator.regularSeasonGamesPerClub !== previous.schedule.regularSeasonGamesPerClub) {
      throw new Error('domestic advance changes a frozen calendar profile');
    }
    const lastRegularGameDay = Math.max(...applyScheduleRevisions(previousArchive.baseSchedule, previousArchive.revisions).games.map((game) => game.day));
    if (competition.seasonId !== input.previousSeasonId || generator.seasonId === input.previousSeasonId
      || competition.leagueId !== generator.leagueId
      || !sameMembers(competition.clubMembershipSnapshot, generator.memberClubIds)
      || !sameMembers(generator.memberClubIds, input.clubTransitions.map((record) => record.command.clubId))) {
      throw new Error('domestic advance League or member scope differs');
    }
    const cycle = sources.cycle.readCycle(next.careerId, next.cycleOrdinal);
    if (!cycle) throw new Error('accepted next World cycle is missing');
    const calendar = generateWorldBoundLeagueSchedule(generator, cycle, next.leagueRegion, next.seasonDayOne);
    createLeagueSeasonEventSnapshot(calendar.schedule, next.eventProfile);
    projectProvisionalOfficialStandings(captureOfficialStandingsSchedule(calendar.schedule, []), [], next.standingsPolicy);
    for (const record of input.clubTransitions) {
      const command = record.command, close = command.operations[0], open = command.operations[1];
      if (close.kind !== 'CLOSE_SEASON' || open.kind !== 'OPEN_SEASON' || command.careerId !== next.careerId
        || command.effectiveDay < lastRegularGameDay
        || close.resultRefs.domesticResultRef !== input.previousSeasonId || open.plan.financialProfile.leagueId !== generator.leagueId
        || !open.plan.competitionEditionIds.includes(generator.seasonId)
        || calendar.schedule.games.some((game) => game.day < open.plan.startsOnDay)) throw new Error('domestic boundary plan scope differs');
      const history = sources.world.readClubHistory(next.careerId, command.clubId);
      if (!history) throw new Error('domestic boundary lacks accepted Club history');
      const before = replayClubEvents(history.checkpoint, history.acceptedEvents.filter((event) => event.afterRevision <= command.expectedRevision));
      if (!before.ok || before.value.revision !== command.expectedRevision
        || !before.value.season.plan.competitionEditionIds.includes(input.previousSeasonId)) throw new Error('domestic boundary before scope differs');
      const applied = applyClubCommand(before.value, command);
      if (!applied.ok) throw new Error(applied.reason.code);
    }
    return { competition, calendar };
  };
  const resultFor = (input: AcceptedDomesticSeasonAdvance, worldWindowSnapshotId: string): DomesticSeasonAdvanceResult => freeze({
    sourceId: input.sourceId, careerId: input.nextSeason.careerId, previousSeasonId: input.previousSeasonId,
    seasonId: input.nextSeason.generatorInput.seasonId, clubSourceIds: input.clubTransitions.map((record) => record.sourceId), worldWindowSnapshotId,
  });
  const validateCalendarStage = (input: AcceptedDomesticSeasonAdvance, calendar: ReturnType<typeof historical>['calendar'], complete: boolean): void => {
    const { careerId, generatorInput } = input.nextSeason;
    const archive = sources.archive.read(careerId, generatorInput.seasonId);
    const events = sources.archive.readEvents(careerId, generatorInput.seasonId);
    const world = sources.world.readSeason(careerId, generatorInput.seasonId);
    if (archive && json(archive.baseSchedule) !== json(calendar.schedule)
      || events && json(events.profile) !== json(input.nextSeason.eventProfile)
      || world && json(world.standingsPolicy) !== json(input.nextSeason.standingsPolicy)
      || world && json(world.schedule) !== json(captureOfficialStandingsSchedule(calendar.schedule, archive?.revisions ?? []))
      || complete && (!archive || !events || !world)) throw new Error('domestic advance calendar stage differs');
  };
  const decode = (row: Row): DurableDomesticSeasonAdvance => {
    try {
      const input = requestFrom(JSON.parse(row.request_json), row.source_id), next = input.nextSeason;
      const accepted = historical(input);
      if (row.source_version !== input.sourceVersion || row.career_id !== next.careerId || row.previous_season_id !== input.previousSeasonId
        || row.next_season_id !== next.generatorInput.seasonId || row.request_json !== json(input)
        || row.competition_json !== json(accepted.competition) || row.calendar_json !== json(accepted.calendar)
        || !['PENDING', 'COMPLETED'].includes(row.status) || (row.status === 'PENDING') !== (row.result_json === null)) {
        throw new Error('progress metadata or accepted history differs');
      }
      const children = db.prepare('SELECT source_id, source_json FROM world_domestic_season_advance_sources WHERE advance_source_id=?')
        .all(row.source_id) as { source_id: string; source_json: string }[];
      if (children.length !== input.clubTransitions.length || children.some((child) => {
        const record = input.clubTransitions.find((item) => item.sourceId === child.source_id);
        return !record || child.source_json !== json(record);
      })) throw new Error('boundary Source archive differs');
      validateCalendarStage(input, accepted.calendar, row.status === 'COMPLETED');
      const result = row.status === 'COMPLETED' ? resultFor(input, accepted.calendar.worldWindowSnapshotId) : null;
      if (result) {
        if (row.result_json !== json(result) || input.clubTransitions.some((record) => {
          const saved = transitions.readApplication(record.sourceId);
          return !saved || json(saved.source) !== json(record);
        })) throw new Error('completed progress differs from accepted Club transitions');
      }
      return freeze({ request: input, status: row.status as 'PENDING' | 'COMPLETED', result });
    } catch (cause) { throw new Error('corrupt durable domestic season advance', { cause }); }
  };
  const read = (sourceId: string): DurableDomesticSeasonAdvance | null => {
    scope(sourceId); const row = getRow.get(sourceId) as Row | undefined; return row ? decode(row) : null;
  };
  const currentSource = (saved: AcceptedDomesticSeasonAdvance): void => {
    const input = authority?.readAcceptedAdvance(saved.sourceId) ?? null;
    if (input !== null && json(requestFrom(input, saved.sourceId)) !== json(saved)) throw new Error('frozen domestic advance Source differs');
  };
  const enqueue = (sourceId: string): DurableDomesticSeasonAdvance => {
    scope(sourceId);
    const prior = read(sourceId);
    if (prior) { currentSource(prior.request); return prior; }
    const raw = authority?.readAcceptedAdvance(sourceId) ?? null;
    if (raw === null) throw new Error('missing accepted domestic season advance');
    const input = requestFrom(raw, sourceId), accepted = historical(input);
    validateCalendarStage(input, accepted.calendar, false);
    for (const record of input.clubTransitions) {
      const current = sources.world.readClub(input.nextSeason.careerId, record.command.clubId);
      if (!current || current.revision !== record.command.expectedRevision) throw new Error('stale domestic boundary member');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      if (getRow.get(sourceId)) throw new Error('domestic advance concurrently accepted');
      db.prepare(`INSERT INTO world_domestic_season_advances
        (source_id, source_version, career_id, previous_season_id, next_season_id, status, request_json, competition_json, calendar_json, result_json)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, NULL)`).run(sourceId, input.sourceVersion, input.nextSeason.careerId,
          input.previousSeasonId, input.nextSeason.generatorInput.seasonId, json(input), json(accepted.competition), json(accepted.calendar));
      for (const record of input.clubTransitions) db.prepare('INSERT INTO world_domestic_season_advance_sources (source_id, advance_source_id, source_json) VALUES (?, ?, ?)')
        .run(record.sourceId, sourceId, json(record));
      db.exec('COMMIT'); return freeze({ request: input, status: 'PENDING', result: null });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const resume = (sourceId: string): DomesticSeasonAdvanceResult => {
    const entry = read(sourceId);
    if (!entry) throw new Error('domestic advance is not queued');
    currentSource(entry.request);
    if (entry.result) return entry.result;
    const input = entry.request, next = input.nextSeason, accepted = historical(input);
    transitions.applyBatch(input.clubTransitions.map((record) => record.sourceId));
    const existing = sources.archive.read(next.careerId, next.generatorInput.seasonId);
    if (existing) {
      validateCalendarStage(input, accepted.calendar, false);
      sources.archive.initializeEvents(next.careerId, next.generatorInput.seasonId, next.eventProfile);
    } else {
      const clubs = next.generatorInput.memberClubIds.map((clubId) => {
        const current = sources.world.readClub(next.careerId, clubId);
        const saved = transitions.readApplication(input.clubTransitions.find((record) => record.command.clubId === clubId)!.sourceId);
        if (!current || !saved || json(current.state.season.plan) !== json(saved.state.season.plan)) throw new Error('next domestic current Club plan differs');
        return current.state;
      });
      initializeWorldBoundDomesticSeason(sources, { ...next, clubs });
    }
    validateCalendarStage(input, accepted.calendar, true);
    const result = resultFor(input, accepted.calendar.worldWindowSnapshotId);
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = getRow.get(sourceId) as Row | undefined;
      if (!row || row.request_json !== json(input)) throw new Error('domestic advance changed while resuming');
      if (row.status === 'COMPLETED') { const prior = decode(row); db.exec('COMMIT'); return prior.result!; }
      const updated = db.prepare("UPDATE world_domestic_season_advances SET status='COMPLETED', result_json=? WHERE source_id=? AND status='PENDING'")
        .run(json(result), sourceId);
      if (updated.changes !== 1) throw new Error('domestic advance progress conflict');
      db.exec('COMMIT'); return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({ enqueue, read, resume, submit(sourceId: string) { enqueue(sourceId); return resume(sourceId); },
    close() { if (!closed) { transitions.close(); db.close(); closed = true; } } });
};
