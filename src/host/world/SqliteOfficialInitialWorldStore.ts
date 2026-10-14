import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { prepareBetweenPlayWorld, type BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { SqliteOfficialStateStore, PersistOfficialPlayResult, PersistOfficialFinalResult } from '../SqliteOfficialStateStore';
import type { OfficialParticipantBinding, SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { isAcceptedPlayerIntakeSource, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

export type AcceptedInitialWorldSetup = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; fixtureEventId: string; startedAtTick: number; worldSetup: BetweenPlayWorldSetup;
}>;
export type DurableInitialOfficialWorld = Readonly<{
  source: AcceptedInitialWorldSetup; match: CanonicalMatchState; fixture: OfficialGameVenueBinding;
  world: CanonicalWorldSnapshot; bindings: readonly OfficialParticipantBinding[]; personLinks: readonly DurablePlayerPersonLink[];
}>;
export type AcceptedInitialPitcherPlay = Readonly<{
  initialWorldSourceId: string; binding: OfficialParticipantBinding; activatedMatchState: CanonicalMatchState;
  startedAtTick: number; closureApplicationId: string; playedPlayId: number; durableRevision: number;
}>;
export type SqliteOfficialInitialWorldStore = Readonly<{
  accept(sourceId: string): DurableInitialOfficialWorld;
  readAcceptedSource(sourceId: string): DurableInitialOfficialWorld | null;
  readInitialPitcherPlay(sourceId: string, closureApplicationId: string): AcceptedInitialPitcherPlay;
  close(): void;
}>;
type Row = { source_id: string; game_id: string; source_json: string; snapshot_json: string; source_hash: string; snapshot_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const setupInput = (raw: AcceptedInitialWorldSetup, sourceId: string): AcceptedInitialWorldSetup => {
  const source = cloneInert(raw);
  if (!source || !fields(source, ['sourceId', 'sourceVersion', 'gameId', 'fixtureEventId', 'startedAtTick', 'worldSetup'])
    || source.sourceId !== sourceId || !id(source.sourceId) || !id(source.sourceVersion) || !id(source.gameId) || !id(source.fixtureEventId)
    || !integer(source.startedAtTick) || !source.worldSetup || !fields(source.worldSetup, ['baseCenters', 'defenders', 'activePreviousPlayControllerIds'])
    || !Array.isArray(source.worldSetup.defenders) || !Array.isArray(source.worldSetup.activePreviousPlayControllerIds)
    || !source.worldSetup.baseCenters || !fields(source.worldSetup.baseCenters, ['first', 'second', 'third'])) throw new Error('invalid accepted initial World setup');
  for (const center of Object.values(source.worldSetup.baseCenters)) {
    if (!center || !fields(center, ['x', 'z']) || !Number.isFinite(center.x) || !Number.isFinite(center.z)) throw new Error('invalid initial World base center');
  }
  for (const defender of source.worldSetup.defenders) {
    if (!defender || !fields(defender, ['playerId', 'registeredPosition', 'position']) || !defender.position
      || !fields(defender.position, ['x', 'z']) || !Number.isFinite(defender.position.x) || !Number.isFinite(defender.position.z)) {
      throw new Error('invalid initial World defender position');
    }
  }
  return source;
};
const initialMatch = (match: CanonicalMatchState): void => {
  if (!match || !fields(match, ['ruleProfileId', 'inning', 'half', 'outs', 'balls', 'strikes', 'bases', 'score', 'playId'])
    || !id(match.ruleProfileId) || !integer(match.playId) || match.inning !== 1 || match.half !== 'top'
    || match.outs !== 0 || match.balls !== 0 || match.strikes !== 0 || !match.score || !fields(match.score, ['home', 'away'])
    || match.score.home !== 0 || match.score.away !== 0 || !match.bases || !fields(match.bases, ['first', 'second', 'third'])
    || Object.values(match.bases).some((runner) => runner !== null)) throw new Error('initial World requires an unplayed pregame Match');
};

export const readOfficialActorPersonLink = (db: Pick<DatabaseSync, 'prepare'>, binding: OfficialParticipantBinding): DurablePlayerPersonLink => {
  const row = db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(binding.personLinkSourceId) as {
    source_id: string; career_id: string; player_id: string; person_id: string; roster_revision: number; accepted_at_day: number; source_json: string;
  } | undefined;
  const source = row ? JSON.parse(row.source_json) as DurablePlayerPersonLink : null;
  if (!row || !isAcceptedPlayerIntakeSource(source, binding.personLinkSourceId) || row.source_json !== json(source)
    || row.source_id !== source.sourceId || row.career_id !== source.careerId || row.player_id !== source.playerId
    || row.person_id !== source.personId || row.roster_revision !== source.rosterRevision || row.accepted_at_day !== source.acceptedAtDay
    || source.careerId !== binding.careerId || source.playerId !== binding.playerId || source.personId !== binding.personId) {
    throw new Error('initial actor Person link differs');
  }
  return source;
};

/** Check the caller's SQLite transaction, including uncommitted trigger changes. */
export const assertInitialOfficialWorldEvidence = (db: Pick<DatabaseSync, 'prepare'>, snapshot: DurableInitialOfficialWorld,
  archived = false): void => {
  const match = db.prepare('SELECT durable_revision, state_json, activation_json FROM matches WHERE match_id=?')
    .get(snapshot.source.gameId) as { durable_revision: number; state_json: string; activation_json: string | null } | undefined;
  const fixture = db.prepare('SELECT fixture_event_id, venue_id, fixture_revision FROM official_fixtures WHERE game_id=?')
    .get(snapshot.source.gameId) as { fixture_event_id: string; venue_id: string; fixture_revision: number } | undefined;
  if (!match || match.durable_revision === 0 && (match.activation_json !== null || json(JSON.parse(match.state_json)) !== json(snapshot.match))
    || !fixture || fixture.fixture_event_id !== snapshot.fixture.fixtureEventId || fixture.venue_id !== snapshot.fixture.venueId
    || fixture.fixture_revision !== snapshot.fixture.fixtureRevision) throw new Error('initial Match or fixture evidence differs');
  assertNationalMatchBindings(db, snapshot.bindings);
  for (const [index, binding] of snapshot.bindings.entries()) {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
      .get(binding.gameId, binding.playerId) as { binding_json: string } | undefined;
    if (!row || json(JSON.parse(row.binding_json)) !== json(binding)
      || json(readOfficialActorPersonLink(db, binding)) !== json(snapshot.personLinks[index])) throw new Error('initial actor evidence differs');
  }
  if (archived) {
    const row = db.prepare('SELECT * FROM official_initial_world_sources WHERE source_id=?').get(snapshot.source.sourceId) as Row | undefined;
    if (!row || row.game_id !== snapshot.source.gameId || row.source_json !== json(snapshot.source) || row.source_hash !== hash(snapshot.source)
      || row.snapshot_json !== json(snapshot) || row.snapshot_hash !== hash(snapshot)) throw new Error('initial World archive evidence differs');
  }
};

/** Archives the initial actual actor setup without inventing an activation/appearance receipt. */
export const openSqliteOfficialInitialWorldStore = (databasePath: string, sources: Readonly<{
  matches: Pick<SqliteOfficialStateStore, 'getMatch' | 'getOfficialFixture'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readPregameBinding'>;
}>, authority?: Readonly<{ readAcceptedSetup(sourceId: string): AcceptedInitialWorldSetup | null }>): SqliteOfficialInitialWorldStore => {
  if (!id(databasePath) || !sources || typeof sources.matches?.getMatch !== 'function' || typeof sources.matches?.getOfficialFixture !== 'function'
    || typeof sources.participation?.readPregameBinding !== 'function' || authority != null && typeof authority.readAcceptedSetup !== 'function') {
    throw new Error('invalid initial World sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  try {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS official_initial_world_sources (
    source_id TEXT PRIMARY KEY, game_id TEXT NOT NULL UNIQUE, source_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    source_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL
  );`);
  const get = db.prepare('SELECT * FROM official_initial_world_sources WHERE source_id=?');
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed initial World scope'); };
  const project = (source: AcceptedInitialWorldSetup, match: CanonicalMatchState): DurableInitialOfficialWorld => {
    initialMatch(match);
    const fixture = cloneInert(sources.matches.getOfficialFixture(source.gameId));
    if (!fixture || fixture.gameId !== source.gameId || fixture.fixtureEventId !== source.fixtureEventId) throw new Error('initial World fixture differs');
    const world = prepareBetweenPlayWorld(match, source.startedAtTick, source.worldSetup);
    const bindings = world.defenders.map((defender) => {
      const binding = cloneInert(sources.participation.readPregameBinding(source.gameId, defender.playerId));
      if (!binding || binding.gameId !== source.gameId || binding.playerId !== defender.playerId || binding.side !== 'HOME'
        || binding.fixtureEventId !== source.fixtureEventId) throw new Error('initial World actor lacks actual pregame binding');
      return binding;
    });
    if (new Set(bindings.map((binding) => binding.personId)).size !== 9 || bindings.some((binding) => binding.careerId !== bindings[0].careerId
      || binding.competitionEditionId !== bindings[0].competitionEditionId || binding.gameDay !== bindings[0].gameDay
      || binding.clubId !== bindings[0].clubId)) throw new Error('initial World actor scopes differ');
    const personLinks = bindings.map((binding) => readOfficialActorPersonLink(db, binding));
    return freeze({ source, match, fixture, world, bindings, personLinks });
  };
  const decode = (row: Row): DurableInitialOfficialWorld => {
    try {
      const source = setupInput(JSON.parse(row.source_json) as AcceptedInitialWorldSetup, row.source_id);
      const saved = cloneInert(JSON.parse(row.snapshot_json) as DurableInitialOfficialWorld);
      const expected = project(source, saved.match), current = sources.matches.getMatch(source.gameId);
      if (!current || row.game_id !== source.gameId || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(expected) || row.snapshot_hash !== hash(expected)
        || current.durableRevision === 0 && (current.activation !== null || current.finalResult !== null
          || json(current.matchState) !== json(saved.match))) throw new Error('initial World snapshot differs');
      assertInitialOfficialWorldEvidence(db, expected, true);
      return expected;
    } catch (cause) { throw new Error('corrupt accepted initial official World Source', { cause }); }
  };
  const freshGuard = (snapshot: DurableInitialOfficialWorld): void => {
    // Use this transaction's rows, not another connection's last committed snapshot.
    const match = db.prepare('SELECT durable_revision FROM matches WHERE match_id=?').get(snapshot.source.gameId) as { durable_revision: number } | undefined;
    if (!match || match.durable_revision !== 0) throw new Error('initial Match changed during acceptance');
    assertInitialOfficialWorldEvidence(db, snapshot);
  };
  return Object.freeze({
    accept(sourceId): DurableInitialOfficialWorld {
      check(sourceId);
      const prior = get.get(sourceId) as Row | undefined;
      const raw = authority?.readAcceptedSetup(sourceId) ?? null;
      const source = raw === null ? null : setupInput(raw, sourceId);
      if (prior) {
        const saved = decode(prior);
        if (source && json(source) !== json(saved.source)) throw new Error('initial World Source is already frozen differently');
        return saved;
      }
      if (!source) throw new Error('accepted initial World setup is missing');
      const current = cloneInert(sources.matches.getMatch(source.gameId));
      if (!current || current.durableRevision !== 0 || current.activation !== null || current.finalResult !== null) throw new Error('initial World Match is already advanced or missing');
      const snapshot = project(source, current.matchState);
      db.exec('BEGIN IMMEDIATE');
      try {
        const raced = get.get(sourceId) as Row | undefined;
        if (raced) {
          const saved = decode(raced);
          if (json(saved) !== json(snapshot)) throw new Error('initial World Source is already frozen differently');
          db.exec('COMMIT'); return saved;
        }
        freshGuard(snapshot);
        db.prepare('INSERT INTO official_initial_world_sources VALUES (?, ?, ?, ?, ?, ?)')
          .run(sourceId, source.gameId, json(source), json(snapshot), hash(source), hash(snapshot));
        const saved = decode(get.get(sourceId) as Row);
        if (json(saved) !== json(snapshot)) throw new Error('initial World Source changed during acceptance');
        freshGuard(snapshot); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readAcceptedSource(sourceId): DurableInitialOfficialWorld | null {
      check(sourceId); const row = get.get(sourceId) as Row | undefined;
      return row ? decode(row) : null;
    },
    readInitialPitcherPlay(sourceId, closureApplicationId): AcceptedInitialPitcherPlay {
      check(sourceId); if (!id(closureApplicationId)) throw new Error('invalid initial play closure reference');
      const row = get.get(sourceId) as Row | undefined;
      if (!row) throw new Error('accepted initial World Source is missing');
      const snapshot = decode(row);
      const application = db.prepare('SELECT match_id, result_json FROM applications WHERE application_id=?')
        .get(closureApplicationId) as { match_id: string; result_json: string } | undefined;
      if (!application || application.match_id !== snapshot.source.gameId) throw new Error('initial closure is not durable for game');
      const result = cloneInert(JSON.parse(application.result_json) as PersistOfficialPlayResult | PersistOfficialFinalResult);
      if (result.receipt.applicationId !== closureApplicationId || result.receipt.previousPlayId !== snapshot.match.playId
        || result.receipt.durableRevision !== 1) throw new Error('initial play closure chain differs');
      const pitcher = snapshot.world.defenders.filter((defender) => defender.registeredPosition === 'P');
      if (pitcher.length !== 1) throw new Error('initial World requires exactly one pitcher');
      const binding = snapshot.bindings.find((value) => value.playerId === pitcher[0].playerId)!;
      return freeze({ initialWorldSourceId: sourceId, binding, activatedMatchState: snapshot.match, startedAtTick: snapshot.world.tick,
        closureApplicationId, playedPlayId: snapshot.match.playId, durableRevision: result.receipt.durableRevision });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
  } catch (error) { db.close(); throw error; }
};
