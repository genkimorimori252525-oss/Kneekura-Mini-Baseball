import { readAdditionalNationalMatchFixture, readNativeNationalQualifierEdition } from './NativeNationalFixtureEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite } from './SqliteNationalCompetitionSelectionStore';
import { nationCompetitionRegionEvidenceFromSqlite } from './SqliteNationCompetitionRegionStore';
import { nationalEligibilityFactEvidenceFromSqlite } from './SqliteNationalEligibilityFactStore';
import { nationalCallupEvidenceFromSqlite, type NativeNationalEligibilityEvaluation } from './SqliteNationalCallupStore';
import { regionalNationalGroupInputEvidenceFromSqlite } from './SqliteRegionalNationalGroupStore';
import { regionalNationalScheduleEvidenceFromSqlite } from './SqliteRegionalNationalScheduleStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { readGlobalRosterSnapshotFromSqlite } from './SqliteNationalRosterSnapshotStore';
import { readClinicalParticipationReceipt } from './HealthRehabEvidenceFromSqlite';
import { readOwnedParticipationBindingJson } from './ActualLiveParticipationMetadata';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';

type Db = Pick<DatabaseSync, 'prepare'>;
export type NationalMatchOriginSource = Readonly<{
  sourceId: string; sourceVersion: 'national-regional-group-origin-v1' | 'national-match-origin-v1'; careerId: string; editionId: string; gameId: string;
}>;
export type NationalMatchFixture = Readonly<{
  careerId: string; competitionEditionId: string; gameDay: number; homeClubId: string; awayClubId: string;
  fixtureEventId: string; competitionScope: 'NATIONAL'; venueId: string; fixtureRevision: number;
  selectionHash: string; groupInputHash: string; scheduleHash: string;
}>;
export type NationalMatchMembership = Readonly<{
  binding: OfficialParticipantBinding; registrationSnapshotId: string;
  eligibility: NativeNationalEligibilityEvaluation;
}>;
export type DurableNationalMatchOrigin = Readonly<{
  source: NationalMatchOriginSource; fixture: NationalMatchFixture; participants: readonly NationalMatchMembership[];
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;
const native = (db: Db): DatabaseSync => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native)) throw new Error('National Match evidence requires a Native connection');
  return db;
};
const sourceInput = (raw: NationalMatchOriginSource): NationalMatchOriginSource => {
  const source = cloneInert(raw);
  if (!source || json(Object.keys(source).sort()) !== json(['careerId', 'editionId', 'gameId', 'sourceId', 'sourceVersion'])
    || !['national-regional-group-origin-v1', 'national-match-origin-v1'].includes(source.sourceVersion)
    || ![source.sourceId, source.careerId, source.editionId, source.gameId].every(id)) throw new Error('invalid National Match origin Source');
  return source;
};
const fixtureSources = (db: DatabaseSync) => {
  const cycle = worldCompetitionCycleEvidenceFromSqlite(db), nations = nationCompetitionRegionEvidenceFromSqlite(db);
  const selections = nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle });
  const groups = regionalNationalGroupInputEvidenceFromSqlite(db, { regions: nations, selections });
  const schedules = regionalNationalScheduleEvidenceFromSqlite(db, { groups, selections });
  return { nations, selections, groups, schedules };
};
/** Existing accepted group/schedule owners supply every date, venue and Nation. No slot creates knockout entrants. */
const readRegionalNationalMatchFixture = (db: Db, source: Pick<NationalMatchOriginSource, 'careerId' | 'editionId' | 'gameId'>): NationalMatchFixture => {
  const { careerId, editionId, gameId } = source, sources = fixtureSources(native(db));
  const edition = sources.groups.readEdition(careerId, editionId), plan = sources.groups.readPlan(careerId, editionId);
  const schedule = sources.schedules.readSchedule(careerId, editionId), selection = sources.selections.readSelection(careerId, editionId);
  const games = plan?.groups.flatMap(group => group.games).filter(game => game.gameId === gameId);
  const slots = schedule?.games.filter(slot => slot.gameId === gameId);
  if (!edition || !plan || !schedule || !selection || selection.kind !== 'REGIONAL_NATIONAL'
    || games?.length !== 1 || slots?.length !== 1 || slots[0].stage !== 'GROUP' || games[0].venueId !== slots[0].venueId) {
    throw new Error('National physical Match requires an accepted Regional group fixture');
  }
  const game = games[0], gameDay = slots[0].gameDay, scheduleHash = hash(schedule);
  const fixtureEventId = JSON.stringify(['regional-national-fixture-v1', careerId, scheduleHash,
    gameDay, game.gameId, game.homeNationId, game.awayNationId]);
  const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(gameId);
  if (!fixture || fixture.game_id !== gameId || fixture.fixture_event_id !== fixtureEventId
    || fixture.venue_id !== game.venueId || fixture.fixture_revision !== 1) throw new Error('National physical fixture differs from accepted Match');
  return freeze({ careerId, competitionEditionId: editionId, gameDay, homeClubId: game.homeNationId, awayClubId: game.awayNationId,
    fixtureEventId, competitionScope: 'NATIONAL', venueId: game.venueId, fixtureRevision: 1,
    selectionHash: hash(selection), groupInputHash: hash({ edition, plan }), scheduleHash });
};

export const nationalRegistrationEvidenceFromSqlite = (db: DatabaseSync) => {
  const nations = nationCompetitionRegionEvidenceFromSqlite(db), personLinks = playerPersonLinkEvidenceFromSqlite(db);
  const selections = nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle: worldCompetitionCycleEvidenceFromSqlite(db) });
  const facts = nationalEligibilityFactEvidenceFromSqlite(db, { nations, personLinks });
  return nationalCallupEvidenceFromSqlite(db, { nations, selections, personLinks, facts,
    qualifierEditions: { readSnapshot: (c, e) => readNativeNationalQualifierEdition(db, c, e) },
    rosterSnapshots: { readSnapshot: (careerId, snapshotId) => readGlobalRosterSnapshotFromSqlite(db, careerId, snapshotId),
      capture() { throw new Error('read-only National Match evidence cannot capture a roster'); } },
    // This existing receipt reader authenticates both legacy and tagged original actor chains on this connection.
    participation: { readReceipt: receiptId => readClinicalParticipationReceipt(db, receiptId) },
    games: { readGame(gameId) {
      const origin = readNationalMatchOrigin(db, gameId);
      if (origin) return nationalFixtureGame(origin.fixture);
      const row = db.prepare('SELECT player_id FROM official_participant_bindings WHERE game_id=? ORDER BY player_id LIMIT 1').get(gameId);
      const document = row && readOwnedParticipationBindingJson(db, gameId, String(row.player_id));
      if (!document) return null;
      const binding = JSON.parse(document) as OfficialParticipantBinding;
      if (!nationalBinding(binding)) return null;
      return nationalFixtureGame(readAdditionalNationalMatchFixture(db, {
        careerId: binding.careerId, editionId: binding.competitionEditionId, gameId,
      }));
    } },
  });
};
export const nationalFixtureGame = (fixture: NationalMatchFixture) => freeze({
  careerId: fixture.careerId, competitionEditionId: fixture.competitionEditionId, gameDay: fixture.gameDay,
  homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId, fixtureEventId: fixture.fixtureEventId, competitionScope: 'NATIONAL' as const,
});
const derive = (db: DatabaseSync, source: NationalMatchOriginSource, originals?: readonly NationalMatchMembership[]): DurableNationalMatchOrigin => {
  const fixture = source.sourceVersion === 'national-regional-group-origin-v1'
    ? readRegionalNationalMatchFixture(db, source) : readAdditionalNationalMatchFixture(db, source);
  const callups = nationalRegistrationEvidenceFromSqlite(db);
  const rows = db.prepare('SELECT player_id,binding_json FROM official_participant_bindings WHERE game_id=? ORDER BY player_id').all(source.gameId);
  const wanted = originals?.map(p => p.binding.playerId) ?? rows.map(row => String(row.player_id));
  if (!wanted.length || new Set(wanted).size !== wanted.length) throw new Error('National Match requires original bound participants');
  const participants = wanted.map(playerId => {
    const document = readOwnedParticipationBindingJson(db, source.gameId, playerId);
    if (!document) throw new Error('National Match original participant binding is missing');
    const binding = JSON.parse(document) as OfficialParticipantBinding, original = originals?.find(p => p.binding.playerId === playerId);
    if (JSON.stringify(binding) !== document || !id(binding.nationalRegistrationEventId) || !id(binding.nationalRosterSnapshotId)
      || binding.careerId !== source.careerId || binding.competitionEditionId !== source.editionId
      || binding.gameId !== source.gameId || binding.playerId !== playerId || binding.gameDay !== fixture.gameDay
      || binding.fixtureEventId !== fixture.fixtureEventId || !['HOME', 'AWAY'].includes(binding.side)
      || binding.clubId !== (binding.side === 'HOME' ? fixture.homeClubId : fixture.awayClubId)
      || original && json(binding) !== json(original.binding)) throw new Error('National Match original membership scope differs');
    const eligibility = original
      ? callups.readEligibilitySnapshot(source.careerId, binding.nationalRegistrationEventId, fixture.gameDay, original.eligibility.source)
      : callups.readEligibilityAtDay(source.careerId, binding.nationalRegistrationEventId, fixture.gameDay);
    if (!eligibility?.decision.eligible) throw new Error('National Match original legal eligibility is missing');
    const roster = callups.readRosterSnapshot(source.careerId, source.editionId, binding.clubId, fixture.gameDay, eligibility.source.representationRevision);
    const registration = roster.roster.find(entry => entry.input.eventId === binding.nationalRegistrationEventId);
    const snapshot = readGlobalRosterSnapshotFromSqlite(db, source.careerId, binding.nationalRosterSnapshotId);
    if (!registration || registration.input.playerId !== playerId || registration.input.personId !== binding.personId
      || registration.input.personLinkSourceId !== binding.personLinkSourceId || !snapshot || snapshot.revision !== binding.rosterRevision
      || snapshot.effectiveDay > fixture.gameDay || snapshot.roster.players.find(p => p.playerId === playerId)?.availability.status !== 'AVAILABLE'
      || original && (original.registrationSnapshotId !== registration.snapshotId || json(original.eligibility) !== json(eligibility))) {
      throw new Error('National Match original active registration or roster differs');
    }
    if (!originals) {
      const head = db.prepare('SELECT revision,roster_json FROM world_roster_heads WHERE career_id=?').get(source.careerId);
      if (!head || head.revision !== snapshot.revision || json(JSON.parse(String(head.roster_json))) !== json(snapshot.roster)) {
        throw new Error('National Match pregame roster is no longer current');
      }
    }
    return { binding, registrationSnapshotId: registration.snapshotId, eligibility };
  });
  if (new Set(participants.map(p => p.binding.personId)).size !== participants.length) throw new Error('National Match duplicate Person membership');
  return freeze({ source, fixture, participants });
};
const bracket = <T>(db: DatabaseSync, read: () => T): T => withBattedVenueLegalReadSnapshot(db, () => withCompetitionSourceReadPhase(read));
// Completed replay only, confined to the existing Native query-only read frame.
// Its owner guards all row/schema writes and releases its private savepoint before return.
const originReads = new WeakMap<object, Map<string, DurableNationalMatchOrigin | null>>();
/** Historical pins stop before later appearances, replacements and legal fact revisions. */
export const readNationalMatchOrigin = (inputDb: Db, gameId: string): DurableNationalMatchOrigin | null => {
  if (!id(gameId)) throw new Error('invalid National Match origin game');
  const db = native(inputDb), frame = activeBattedWorldFieldReadFrame(db);
  const cached = frame ? originReads.get(frame) : undefined;
  if (cached?.has(gameId)) return cached.get(gameId)!;
  const value = bracket(db, () => {
    if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='world_national_match_origins'").get()) return null;
    const rows = db.prepare(`SELECT * FROM world_national_match_origins WHERE game_id=$game
      OR ${claim('source_json', ['gameId'], '$game')} OR ${claim('snapshot_json', ['source', 'gameId'], '$game')}`).all({ game: gameId });
    if (!rows.length) return null;
    if (rows.length !== 1 || rows[0].game_id !== gameId) throw new Error('National Match origin game ownership differs');
    const row = rows[0], source = sourceInput(JSON.parse(String(row.source_json))), saved = JSON.parse(String(row.snapshot_json)) as DurableNationalMatchOrigin;
    const owners = db.prepare(`SELECT source_id FROM world_national_match_origins WHERE source_id=$source
      OR ${claim('source_json', ['sourceId'], '$source')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$source')}`).all({ source: source.sourceId });
    if (owners.length !== 1 || row.source_id !== source.sourceId || row.game_id !== source.gameId || row.career_id !== source.careerId
      || row.edition_id !== source.editionId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(saved) || row.snapshot_hash !== hash(saved)) throw new Error('National Match origin archive differs');
    const actual = derive(db, source, saved.participants);
    if (json(actual) !== row.snapshot_json) throw new Error('National Match original evidence changed');
    return actual;
  });
  if (frame && activeBattedWorldFieldReadFrame(db) === frame) {
    const values = originReads.get(frame) ?? new Map<string, DurableNationalMatchOrigin | null>();
    values.set(gameId, value); originReads.set(frame, values);
  }
  return value;
};
/** One original replay for the whole actor frame; Club-only bindings retain their historical bytes. */
export const assertNationalMatchBindings = (db: Db, bindings: readonly OfficialParticipantBinding[]): DurableNationalMatchOrigin | null => {
  if (!bindings.length) return null;
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native)) {
    // The established prepare-only Club adapter retains its independent legacy
    // replay. It cannot authenticate a National binding or a National owner,
    // even when its wrapper claims to be inside a transaction.
    if (bindings.some(nationalBinding)
      || db.prepare('SELECT 1 FROM main.sqlite_master WHERE name=? COLLATE NOCASE').get('world_national_match_origins')) {
      throw new Error('National Match evidence requires a Native connection');
    }
    return null;
  }
  const origin = readNationalMatchOrigin(db, bindings[0].gameId);
  if (!origin) {
    if (bindings.some(nationalBinding)) throw new Error('National physical actors require original National Match evidence');
    return null;
  }
  for (const binding of bindings) {
    const member = origin.participants.filter(p => p.binding.playerId === binding.playerId);
    if (member.length !== 1 || json(member[0].binding) !== json(binding)) throw new Error('National Match original membership differs');
  }
  return origin;
};
export const nationalBinding = (binding: OfficialParticipantBinding): boolean =>
  Object.hasOwn(binding, 'nationalRegistrationEventId') || Object.hasOwn(binding, 'nationalRosterSnapshotId');

/** One explicit pregame capture; this owner never creates schedules, registrations or roster assignments. */
export const openSqliteNationalMatchOriginStore = (path: string) => {
  if (!id(path)) throw new Error('invalid National Match origin database path');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_match_origins(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL UNIQUE,
    career_id TEXT NOT NULL,edition_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  const current = (gameId: string) => {
    const match = db.prepare('SELECT durable_revision,activation_json FROM matches WHERE match_id=?').get(gameId);
    if (!match || match.durable_revision !== 0 || match.activation_json !== null) throw new Error('National Match origin requires an unplayed pregame Match');
    for (const table of ['official_initial_world_sources', 'physical_plate_appearance_actors', 'physical_pitch_progress_actions']) {
      if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table)
        && db.prepare(`SELECT 1 FROM ${table} WHERE game_id=?`).get(gameId)) throw new Error('National Match origin must precede physical actor activation');
    }
  };
  return Object.freeze({
    read: (gameId: string) => readNationalMatchOrigin(db, gameId),
    capture(raw: NationalMatchOriginSource): DurableNationalMatchOrigin {
      const source = sourceInput(raw);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = readNationalMatchOrigin(db, source.gameId);
        if (prior) {
          if (json(prior.source) !== json(source)) throw new Error('National Match origin is frozen differently');
          db.exec('COMMIT'); return prior;
        }
        current(source.gameId);
        const expected = bracket(db, () => derive(db, source));
        db.prepare('INSERT INTO world_national_match_origins VALUES(?,?,?,?,?,?,?,?)')
          .run(source.sourceId, source.gameId, source.careerId, source.editionId, json(source), hash(source), json(expected), hash(expected));
        current(source.gameId);
        const actual = readNationalMatchOrigin(db, source.gameId);
        if (!actual || json(actual) !== json(expected) || json(bracket(db, () => derive(db, source))) !== json(expected)) {
          throw new Error('National Match origin changed during admission');
        }
        db.exec('COMMIT'); return actual;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
    close: () => db.close(),
  });
};
