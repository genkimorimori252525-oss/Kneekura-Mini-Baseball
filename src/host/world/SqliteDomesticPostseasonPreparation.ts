import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getRuleProfile } from '../../core/rules/RuleProfile';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { resolvePostseasonSeries } from '../../core/world/competition/PostseasonSeries';
import { applyScheduleRevisions } from '../../core/world/competition/LeagueSchedule';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { PersistedMatch, SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import { readAcceptedContinentalHomeClub } from './ContinentalGroupFixtureFromWorld';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { readDurablePostseasonResults } from './PostseasonResultsFromMatches';
import type { DomesticCompetitionSourceRequest } from './SqliteDomesticCompetitionSeasonStore';
import { domesticPostseasonLayout, postseasonJson as json, validateDomesticPostseasonRequest } from './DomesticPostseasonPreparation';

export type AcceptedDomesticPostseasonPlan = Readonly<{
  sourceId: string; sourceVersion: string; expectedRevision: number;
  request: DomesticCompetitionSourceRequest;
  gameDays: readonly Readonly<{ gameId: string; day: number }>[];
}>;
export type DurableDomesticPostseasonPlan = Readonly<{ source: AcceptedDomesticPostseasonPlan; revision: number }>;
export type DomesticPostseasonMatchInput = Readonly<{
  sourceId: string; gameId: string; ruleProfileId: CanonicalMatchState['ruleProfileId']; playId: number;
}>;
export type PreparedDomesticPostseasonMatch = Readonly<{ fixture: OfficialGameVenueBinding; match: PersistedMatch }>;
export type DomesticPostseasonGame = Readonly<{ careerId: string; seasonId: string; gameId: string; gameDay: number;
  homeClubId: string; awayClubId: string; fixture: OfficialGameVenueBinding }>;
export type DomesticPostseasonPreparation = Readonly<{
  acceptPostseasonPlan(source: AcceptedDomesticPostseasonPlan): DurableDomesticPostseasonPlan;
  readPostseasonPlan(sourceId: string): DurableDomesticPostseasonPlan | null;
  preparePostseasonMatch(input: DomesticPostseasonMatchInput): PreparedDomesticPostseasonMatch;
  readPostseasonGame(careerId: string, seasonId: string, gameId: string): DomesticPostseasonGame | null;
}>;
export type DomesticPostseasonPreparationSources = Parameters<typeof readCompletedDomesticSeason>[0] & Readonly<{
  match: Parameters<typeof readCompletedDomesticSeason>[0]['match'] & Partial<Pick<SqliteOfficialStateStore, 'registerOfficialFixture' | 'initializeMatch'>>;
}>;
type Row = { source_id: string; career_id: string; season_id: string; revision: number; source_json: string; basis_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && !!value && value.trim() === value;
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const basisHash = (completed: NonNullable<ReturnType<typeof readCompletedDomesticSeason>>): string =>
  hash({ archive: hash(completed.archive), world: { ...completed.world, results: completed.world.results.map(hash) } });
const fields = (value: unknown, names: string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
const parse = (raw: AcceptedDomesticPostseasonPlan): AcceptedDomesticPostseasonPlan => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'expectedRevision', 'request', 'gameDays'])
    || !id(source.sourceId) || !id(source.sourceVersion) || !Number.isSafeInteger(source.expectedRevision) || source.expectedRevision < 0
    || !fields(source.request, ['kind', 'input']) || !id(source.request.input?.careerId) || !id(source.request.input?.seasonId)
    || !Array.isArray(source.gameDays) || source.gameDays.some(game => !fields(game, ['gameId', 'day'])
      || !id(game.gameId) || !Number.isSafeInteger(game.day) || game.day < 0)) throw new Error('invalid accepted domestic postseason plan');
  return source;
};

/** Additive plan history on the existing competition connection. Match remains
 * the final/result owner; this archive only retains explicitly accepted plans. */
export const domesticPostseasonPreparation = (db: DatabaseSync, sources: DomesticPostseasonPreparationSources, assertOpen: () => void):
DomesticPostseasonPreparation & Readonly<{ assertFinalRequest(request: DomesticCompetitionSourceRequest): void }> => {
  db.exec(`CREATE TABLE IF NOT EXISTS world_domestic_postseason_plans (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, season_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision>0), source_json TEXT NOT NULL, basis_hash TEXT NOT NULL,
    UNIQUE(career_id, season_id, revision)
  );`);
  const get = db.prepare('SELECT * FROM world_domestic_postseason_plans WHERE source_id=?');
  const rowsFor = (careerId: string, seasonId: string): Row[] => db.prepare(
    'SELECT * FROM world_domestic_postseason_plans WHERE career_id=? AND season_id=? ORDER BY revision').all(careerId, seasonId) as Row[];
  const validate = (source: AcceptedDomesticPostseasonPlan) => {
    const completed = validateDomesticPostseasonRequest(sources, source.request);
    const layout = domesticPostseasonLayout(source.request), games = layout.groups.flatMap(group => group.games);
    const days = new Map(source.gameDays.map(game => [game.gameId, game.day]));
    const regular = applyScheduleRevisions(completed.archive.baseSchedule, completed.archive.revisions);
    const lastDay = Math.max(...regular.games.map(game => game.day)), occupied = new Set<string>();
    if (!games.length || new Set(layout.groups.map(group => group.slot)).size !== layout.groups.length
      || new Set(games.map(game => game.gameId)).size !== games.length || days.size !== games.length || source.gameDays.length !== games.length) {
      throw new Error('postseason plan requires unique games and exact accepted dates');
    }
    for (const group of layout.groups) {
      let previousDay = -1;
      for (const game of group.games) {
        const day = days.get(game.gameId);
        if (day === undefined || day <= lastDay || game.day !== undefined && game.day !== day
          || group.series && day <= previousDay
          || regular.games.some(item => item.gameId === game.gameId)
          || !regular.reservedWindows.some(window => window.kind === 'POSTSEASON' && window.startsOnDay <= day && window.endsOnDay >= day)
          || regular.reservedWindows.some(window => window.kind !== 'POSTSEASON' && window.startsOnDay <= day && window.endsOnDay >= day)) {
          throw new Error('postseason game day differs from accepted calendar');
        }
        previousDay = day;
        for (const clubId of [game.homeClubId, game.awayClubId]) {
          const key = json([clubId, day]);
          if (occupied.has(key)) throw new Error('postseason Club has simultaneous games');
          occupied.add(key);
        }
      }
    }
    return { completed, layout, games, days };
  };
  const extension = (before: AcceptedDomesticPostseasonPlan | null, after: AcceptedDomesticPostseasonPlan): void => {
    if (!before) return;
    const old = domesticPostseasonLayout(before.request), next = domesticPostseasonLayout(after.request);
    if (json(old.header) !== json(next.header) || old.groups.some(group =>
      json(next.groups.find(item => item.slot === group.slot)) !== json(group))
      || before.gameDays.some(game => json(after.gameDays.find(item => item.gameId === game.gameId)) !== json(game))) {
      throw new Error('original postseason policy, series or day is already frozen differently');
    }
    if (next.groups.length <= old.groups.length) throw new Error('postseason advance adds no newly accepted stage');
  };
  const decodeRows = (rows: Row[]): DurableDomesticPostseasonPlan[] => {
    let prior: AcceptedDomesticPostseasonPlan | null = null;
    return rows.map((row, index) => {
      const source = parse(JSON.parse(row.source_json)), accepted = validate(source);
      if (row.revision !== index + 1 || source.expectedRevision !== index || row.source_id !== source.sourceId
        || row.career_id !== source.request.input.careerId || row.season_id !== source.request.input.seasonId
        || row.source_json !== json(source) || row.basis_hash !== basisHash(accepted.completed)) throw new Error('corrupt domestic postseason original basis');
      extension(prior, source); prior = source;
      return Object.freeze({ source, revision: row.revision });
    });
  };
  const read = (sourceId: string): DurableDomesticPostseasonPlan | null => {
    assertOpen(); if (!id(sourceId)) throw new Error('invalid postseason Source identity');
    const row = get.get(sourceId) as Row | undefined;
    if (!row) return null;
    return decodeRows(rowsFor(row.career_id, row.season_id)).find(entry => entry.source.sourceId === sourceId) ?? null;
  };
  const gameFrom = (source: AcceptedDomesticPostseasonPlan, gameId: string): DomesticPostseasonGame => {
    const { careerId, seasonId } = source.request.input;
    const origin = decodeRows(rowsFor(careerId, seasonId)).find(entry => entry.source.gameDays.some(game => game.gameId === gameId));
    if (!origin) throw new Error('postseason game lacks original accepted plan');
    const game = domesticPostseasonLayout(origin.source.request).groups.flatMap(group => group.games).find(game => game.gameId === gameId)!;
    const gameDay = origin.source.gameDays.find(game => game.gameId === gameId)!.day;
    const completed = readCompletedDomesticSeason(sources, careerId, seasonId)!;
    const identity = ['domestic-postseason-fixture-v1', careerId, seasonId, gameId, origin.source.sourceId,
      hash(origin.source), gameDay];
    const pinned = sources.match.getOfficialFixture(gameId);
    let originalHomeRevision: number | null = null;
    if (pinned) {
      const parts: unknown = JSON.parse(pinned.fixtureEventId);
      if (!Array.isArray(parts) || parts.length !== 9 || identity.some((value, index) => parts[index] !== value)
        || !Number.isSafeInteger(parts[7]) || parts[7] < 0 || parts[8] !== pinned.venueId
        || pinned.gameId !== gameId || pinned.fixtureRevision !== 1) throw new Error('postseason Match original fixture differs');
      originalHomeRevision = parts[7] as number;
    }
    const clubs = [game.homeClubId, game.awayClubId].map(clubId => {
      const history = readAcceptedClubHistory(db, careerId, clubId);
      if (!history) throw new Error('postseason Club journal is missing');
      // A pinned fixture owns its original home revision. A later same-day
      // receipt must not substitute a newer Club state into that historical fact.
      // The full journal is authenticated above before selecting its real prefix.
      const revision = clubId === game.homeClubId ? originalHomeRevision : null;
      const originalHistory = revision === null ? history : { checkpoint: history.checkpoint,
        acceptedEvents: history.acceptedEvents.filter(event => event.afterRevision <= revision) };
      const club = readAcceptedContinentalHomeClub({ careerId, editionId: seasonId, gameDay, homeClubId: clubId, history: originalHistory });
      if (revision !== null && club.revision !== revision) throw new Error('postseason original home revision is missing');
      if (club.season.closureRef !== null || club.season.plan.financialProfile.leagueId !== completed.world.schedule.leagueId) throw new Error('postseason Club season differs');
      return club;
    });
    const fixture = { gameId, venueId: clubs[0].institutional.stadium.stadiumId, fixtureRevision: 1,
      fixtureEventId: json([...identity, clubs[0].revision, clubs[0].institutional.stadium.stadiumId]) };
    return Object.freeze({ careerId, seasonId, gameId, gameDay, homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixture: Object.freeze(fixture) });
  };
  const assertPinned = (source: AcceptedDomesticPostseasonPlan): void => {
    for (const game of source.gameDays) {
      const fixture = sources.match.getOfficialFixture(game.gameId), match = sources.match.getMatch(game.gameId);
      if (match && !fixture || fixture && json(fixture) !== json(gameFrom(source, game.gameId).fixture)) throw new Error('postseason Match original fixture differs');
    }
  };
  return Object.freeze({
    acceptPostseasonPlan(raw) {
      assertOpen(); const source = parse(raw), { careerId, seasonId } = source.request.input;
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = read(source.sourceId);
        if (prior) {
          if (json(prior.source) !== json(source)) throw new Error('postseason Source is already frozen differently');
          assertPinned(source); db.exec('COMMIT'); return prior;
        }
        const rows = rowsFor(careerId, seasonId), accepted = decodeRows(rows), previous = accepted.at(-1)?.source ?? null;
        if (rows.length !== source.expectedRevision) throw new Error('stale postseason plan revision');
        extension(previous, source);
        const projection = validate(source), oldGames = new Set(previous?.gameDays.map(game => game.gameId) ?? []);
        for (const game of source.gameDays.filter(game => !oldGames.has(game.gameId))) {
          if (sources.match.getMatch(game.gameId) || sources.match.getOfficialFixture(game.gameId)) throw new Error('new postseason plan cannot adopt an existing Match or fixture');
          for (const before of previous?.gameDays ?? []) {
            const oldGame = domesticPostseasonLayout(previous!.request).groups.flatMap(group => group.games).find(item => item.gameId === before.gameId)!;
            const nextGame = projection.games.find(item => item.gameId === game.gameId)!;
            if (sources.match.getMatch(before.gameId)?.finalResult && before.day >= game.day
              && [oldGame.homeClubId, oldGame.awayClubId].some(club => [nextGame.homeClubId, nextGame.awayClubId].includes(club))) {
              throw new Error('new postseason stage predates its played Club history');
            }
          }
        }
        const sourceJson = json(source), basis = basisHash(projection.completed);
        db.prepare('INSERT INTO world_domestic_postseason_plans VALUES (?, ?, ?, ?, ?, ?)')
          .run(source.sourceId, careerId, seasonId, rows.length + 1, sourceJson, basis);
        const saved = read(source.sourceId);
        if (!saved || json(saved.source) !== sourceJson || (get.get(source.sourceId) as Row).basis_hash !== basis) throw new Error('postseason acceptance changed during write');
        assertPinned(source); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readPostseasonPlan(sourceId) { const entry = read(sourceId); if (entry) assertPinned(entry.source); return entry; },
    preparePostseasonMatch(raw) {
      assertOpen(); const input = cloneInert(raw);
      if (!fields(input, ['sourceId', 'gameId', 'ruleProfileId', 'playId']) || !id(input.sourceId) || !id(input.gameId)
        || !id(input.ruleProfileId) || !Number.isSafeInteger(input.playId) || input.playId < 0) throw new Error('invalid postseason opening input');
      const profile = getRuleProfile(input.ruleProfileId), entry = read(input.sourceId);
      if (!entry || !entry.source.gameDays.some(game => game.gameId === input.gameId)) throw new Error('postseason game is not accepted');
      assertPinned(entry.source);
      const group = domesticPostseasonLayout(entry.source.request).groups.find(group => group.games.some(game => game.gameId === input.gameId))!;
      if (group.series) {
        const results = readDurablePostseasonResults(sources.match, group.series), state = resolvePostseasonSeries(group.series, results);
        if (state.status === 'COMPLETE' || group.games[results.length]?.gameId !== input.gameId) throw new Error('postseason game is not the next required series game');
      } else if (sources.match.getMatch(input.gameId)?.finalResult) throw new Error('postseason game is already complete');
      if (!sources.match.registerOfficialFixture || !sources.match.initializeMatch) throw new Error('postseason Match writers are missing');
      const game = gameFrom(entry.source, input.gameId);
      const matchState: CanonicalMatchState = { ruleProfileId: profile.id, playId: input.playId, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
        bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 } };
      sources.match.registerOfficialFixture(game.fixture);
      const match = sources.match.initializeMatch(input.gameId, matchState);
      assertPinned(entry.source);
      return Object.freeze({ fixture: game.fixture, match });
    },
    readPostseasonGame(careerId, seasonId, gameId) {
      assertOpen(); if (![careerId, seasonId, gameId].every(id)) throw new Error('invalid postseason game scope');
      const entries = decodeRows(rowsFor(careerId, seasonId)), entry = entries.find(entry => entry.source.gameDays.some(game => game.gameId === gameId));
      if (!entry) return null;
      const game = gameFrom(entry.source, gameId), fixture = sources.match.getOfficialFixture(gameId);
      if (!fixture) return null;
      if (json(fixture) !== json(game.fixture)) throw new Error('postseason Match original fixture differs');
      return game;
    },
    assertFinalRequest(request) {
      const entries = decodeRows(rowsFor(request.input.careerId, request.input.seasonId)), latest = entries.at(-1);
      if (!latest && typeof sources.match?.getOfficialFixture === 'function') {
        for (const game of domesticPostseasonLayout(request).groups.flatMap(group => group.games)) {
          const fixture = sources.match.getOfficialFixture(game.gameId);
          if (fixture?.fixtureEventId.startsWith('["domestic-postseason-fixture-v1",')) {
            throw new Error('domestic final lost its original accepted postseason plan');
          }
        }
      }
      if (latest) {
        if (json(latest.source.request) !== json(request)) throw new Error('domestic final differs from accepted postseason plan');
        assertPinned(latest.source);
      }
    },
  });
};
