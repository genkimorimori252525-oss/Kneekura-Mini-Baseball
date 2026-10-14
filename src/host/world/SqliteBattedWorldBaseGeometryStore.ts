import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLiveClosureApplicationRows } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { actualLiveScoringEvidenceFromSqlite, assertActualLiveScoringStage } from './ActualLiveScoringEvidenceFromSqlite';
import { scoringOwnershipRows } from './ActualLiveScoringMetadata';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { MatchdayClubHistory } from '../../core/world/club/OfficialMatchdayRevenue';
import { createBattedWorldBaseGeometry, type BattedWorldBaseGeometry, type BattedWorldBaseGeometryInput } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import { battedBallFlightEvidenceFromSqlite, type DurableBattedBallFlight, type SqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';

export type AcceptedBattedWorldBaseGeometry = Readonly<{ sourceId: string; sourceVersion: string; flightSourceId: string;
  geometryRef: string; availableAtDay: number; bases: BattedWorldBaseGeometryInput['bases'] }>;
type Fixture = Readonly<{ game_id: string; venue_id: string; fixture_event_id: string; fixture_revision: number }>;
export type DurableBattedWorldBaseGeometry = Readonly<{ source: AcceptedBattedWorldBaseGeometry; flight: DurableBattedBallFlight;
  fixture: Fixture; geometry: BattedWorldBaseGeometry; domesticVenueHistory: MatchdayClubHistory | null }>;
export type SqliteBattedWorldBaseGeometryStore = Readonly<{ accept(sourceId: string): DurableBattedWorldBaseGeometry;
  read(sourceId: string): DurableBattedWorldBaseGeometry | null; close(): void }>;
type Authority = Readonly<{ readAcceptedGeometry(sourceId: string): AcceptedBattedWorldBaseGeometry | null }>;
type Row = { source_id: string; flight_source_id: string; game_id: string; fixture_event_id: string; geometry_ref: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const fields = (value: unknown, names: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const input = (raw: AcceptedBattedWorldBaseGeometry, sourceId: string) => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'flightSourceId', 'geometryRef', 'availableAtDay', 'bases'])
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.flightSourceId, s.geometryRef].every(id)
    || !Number.isSafeInteger(s.availableAtDay) || s.availableAtDay < 0) throw new Error('invalid accepted actual base geometry Source');
  return s;
};

/** Independent actual scoring may coexist, but can never become a setup owner. */
const assertCompatibleActualSetupScoring = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>,
  closure: Extract<ReturnType<ReturnType<typeof actualLivePlayReadinessFromSqlite>['readHistorical']>, { kind: 'ready' }>['closure']) => {
  const p = closure.proposal;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='official_scoring_applications'").get()) return;
  const rows = scoringOwnershipRows(db, 'official_scoring_applications', [
    [{ column: 'official_application_id', value: p.application.applicationId, mirrors: [
      ['request_json', ['input', 'officialApplication', 'applicationId']], ['result_json', ['officialApplicationId']],
    ] }],
    [{ column: 'closure_id', value: closure.source.sourceId, mirrors: [
      ['request_json', ['evidence', 'closureId']], ['result_json', ['closureId']], ['result_json', ['record', 'closureId']],
      ['request_json', ['input', 'officialApplication', 'adjudication', 'events', { array: 'all' }, 'closureId']],
    ] }],
    [{ column: 'match_id', value: p.gameId, mirrors: [['request_json', ['input', 'officialApplication', 'matchId']], ['result_json', ['matchId']]] },
      { column: 'NULL', value: p.playId, mirrors: [['request_json', ['evidence', 'playId']],
        ['request_json', ['input', 'officialApplication', 'match', 'playId']], ['result_json', ['record', 'playId']]] }],
  ]);
  if (!rows.length) return;
  if (rows.length !== 1 || typeof rows[0].source_event_id !== 'string'
    || !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_scoring_sources'").get()) {
    throw new Error('actual setup scoring claim lacks its unique owner');
  }
  const score = actualLiveScoringEvidenceFromSqlite(db).readSource(rows[0].source_event_id);
  if (!score || score.source.closureReference.sourceId !== closure.source.sourceId
    || score.source.closureReference.proposalHash !== hash(p) || json(score.proposal.application) !== json(p.application)) {
    throw new Error('actual setup independent scoring owner differs');
  }
  assertActualLiveScoringStage(db, score.proposal, true);
};

/** Read only this original physical frame's accepted setup, on its Native snapshot. */
export const battedWorldFrameBaseCenters = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>,
  flight: DurableBattedBallFlight): BetweenPlayWorldSetup['baseCenters'] => {
  const frame = flight.physicalPitch.frame;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const read = () => {
    if (frame.initialWorld && (frame.activationApplicationId || frame.batterActor?.origin.actualLiveReadiness)) {
      throw new Error('actual physical frame has competing initial and activation setups');
    }
    let centers = frame.initialWorld?.source.worldSetup.baseCenters;
    if (!centers && frame.activationApplicationId) {
      const applicationId = frame.activationApplicationId, actor = frame.batterActor, origin = actor?.origin.actualLiveReadiness;
      const claims = freeze(cloneInert(actualLiveClosureApplicationRows(db, applicationId)));
      if (claims.length || origin) {
        if (!(db instanceof DatabaseSync) || !db.isTransaction) throw new Error('actual live setup requires a Native read snapshot');
        if (claims.length !== 1) throw new Error('actual live setup owner is missing or ambiguous');
        if (!actor || !origin || origin.closureSourceId !== claims[0].source_id || origin.applicationId !== applicationId
          || origin.gameId !== frame.gameId || origin.previousPlayId + 1 !== frame.match.playId
          || !('activationApplicationId' in actor.source) || actor.source.activationApplicationId !== applicationId
          || actor.source.gameId !== frame.gameId || json(actor.match) !== json(frame.match) || json(actor.world) !== json(frame.world)
          || actor.officialRevision !== frame.officialRevision
          || !('activationApplicationId' in flight.physicalPitch.source) || flight.physicalPitch.source.activationApplicationId !== applicationId
          || flight.physicalPitch.source.gameId !== frame.gameId || flight.source.physicalPitchSourceId !== flight.physicalPitch.source.sourceId) {
          throw new Error('actual live setup physical frame scope differs');
        }
        const ready = actualLivePlayReadinessFromSqlite(db).readHistorical(String(claims[0].source_id));
        if (ready.kind !== 'ready' || ready.closure.status !== 'OFFICIAL_APPLIED' || !ready.closure.officialApplied) {
          throw new Error('actual live setup original effects are pending');
        }
        const closure = ready.closure, p = closure.proposal, official = p.expectedOfficial;
        if (!('activation' in official) || !('worldSetup' in p.application) || !closure.source.worldSetup
          || p.gameId !== frame.gameId || p.application.applicationId !== applicationId || closure.source.applicationId !== applicationId
          || official.receipt.applicationId !== applicationId || official.receipt.previousPlayId !== p.playId
          || official.activation.previousPlayId !== p.playId || official.activation.nextMatchState.playId !== frame.match.playId
          || official.receipt.durableRevision !== frame.officialRevision || json(official.activation) !== json(frame.activation)
          || json(official.activation.nextMatchState) !== json(frame.match) || json(official.nextWorld) !== json(frame.world)
          || json(ready.reference) !== json(origin) || json(p.application.worldSetup) !== json(closure.source.worldSetup)
          || p.fixture.game_id !== frame.gameId || p.fixture.fixture_event_id !== actor.binding.fixtureEventId
          || hash(p.fixture) !== actor.fixtureHash || p.fixture.venue_id !== flight.source.execution.venueId) {
          throw new Error('actual live setup original activation, World or fixture differs');
        }
        assertCompatibleActualSetupScoring(db, closure);
        if (json(actualLiveClosureApplicationRows(db, applicationId)) !== json(claims)) throw new Error('actual live setup owner changed during read');
        centers = closure.source.worldSetup.baseCenters;
      } else {
        const row = db.prepare('SELECT request_json FROM official_scoring_applications WHERE official_application_id=?')
          .get(applicationId) as { request_json: string } | undefined;
        const saved = row ? JSON.parse(row.request_json) as { input?: { officialApplication?: { worldSetup?: BetweenPlayWorldSetup } } } : null;
        centers = saved?.input?.officialApplication?.worldSetup?.baseCenters;
      }
    }
    if (!fields(centers, ['first', 'second', 'third']) || Object.values(centers!).some(point => !fields(point, ['x', 'z'])
      || ![point.x, point.z].every(Number.isFinite))) throw new Error('actual physical frame base centers are missing');
    return centers!;
  };
  if (!frame.activationApplicationId || !(db instanceof DatabaseSync)) return read();
  const owned = !db.isTransaction, queryOnly = () => db.prepare('PRAGMA query_only').get()!.query_only;
  const beforeQueryOnly = queryOnly();
  if (beforeQueryOnly !== 0 && beforeQueryOnly !== 1) throw new Error('actual setup query-only state is unavailable');
  try {
    // BEGIN can acquire and then throw through a Native boundary observer.
    if (owned) db.exec('BEGIN');
    if (!db.isTransaction || queryOnly() !== beforeQueryOnly) throw new Error('actual setup read snapshot acquisition differs');
    const value = withBattedWorldPhysicalReadTraversal(db, read);
    if (!db.isTransaction || queryOnly() !== beforeQueryOnly) throw new Error('actual setup read snapshot completion differs');
    if (owned) {
      db.exec('COMMIT');
      if (db.isTransaction) throw new Error('actual setup read transaction did not end');
    }
    if (queryOnly() !== beforeQueryOnly) throw new Error('actual setup query-only setting changed during completion');
    return value;
  } catch (error) {
    const cleanup: unknown[] = [];
    if (owned) try {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (db.isTransaction) throw new Error('actual setup read rollback did not end its transaction');
    } catch (failure) { cleanup.push(failure); }
    try {
      if (queryOnly() !== beforeQueryOnly) db.exec(`PRAGMA query_only=${beforeQueryOnly}`);
      if (queryOnly() !== beforeQueryOnly) throw new Error('actual setup query-only setting could not be restored');
    } catch (failure) { cleanup.push(failure); }
    if (cleanup.length) throw new AggregateError([error, ...cleanup], 'actual setup read cleanup failed', { cause: error });
    throw error;
  }
};

/** This calibration is owned by its original accepted fixture, not a caller control window or a home-Club guess. */
export const battedWorldBaseGeometryEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownFlights = battedBallFlightEvidenceFromSqlite(db);
  const derive = (source: AcceptedBattedWorldBaseGeometry): DurableBattedWorldBaseGeometry => {
    const flight = ownFlights.read(source.flightSourceId);
    if (!flight) throw new Error('actual base geometry original flight is missing');
    const actor = flight.physicalPitch.frame.batterActor!, binding = actor.binding;
    const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(actor.source.gameId) as Fixture | undefined;
    if (!fixture || fixture.game_id !== actor.source.gameId || fixture.fixture_event_id !== binding.fixtureEventId
      || fixture.venue_id !== flight.source.execution.venueId || source.availableAtDay > binding.gameDay) throw new Error('actual base geometry fixture/day differs');
    let parts: unknown = null;
    try { parts = JSON.parse(fixture.fixture_event_id); } catch { /* Existing non-domestic fixture identifiers need not be JSON. */ }
    let domesticVenueHistory: MatchdayClubHistory | null = null;
    if (Array.isArray(parts) && parts[0] === 'domestic-fixture-venue-v1') {
      const revision = parts.at(-2), history = readAcceptedClubHistory(db as import('node:sqlite').DatabaseSync,
        binding.careerId, actor.worldFixture.game.homeClubId);
      if (parts.length < 6 || parts[1] !== binding.careerId || parts[2] !== binding.competitionEditionId
        || parts[3] !== fixture.game_id || parts.at(-1) !== fixture.venue_id
        || fixture.fixture_revision !== parts.length - 5 || !Number.isSafeInteger(revision) || revision < 0
        || !history || history.checkpoint.revision > revision) throw new Error('actual domestic base geometry venue history is missing');
      const acceptedEvents = history.acceptedEvents.filter((event) => event.afterRevision <= revision);
      const pinned = replayClubEvents(history.checkpoint, acceptedEvents), next = history.acceptedEvents[acceptedEvents.length];
      if (!pinned.ok || pinned.value.revision !== revision || pinned.value.effectiveDay > binding.gameDay
        || next && next.command.effectiveDay <= binding.gameDay || pinned.value.institutional.stadium.stadiumId !== fixture.venue_id
        || pinned.value.institutional.stadium.geometryRef !== source.geometryRef) throw new Error('actual domestic stadium geometry reference differs');
      domesticVenueHistory = { checkpoint: history.checkpoint, acceptedEvents };
    }
    const geometry = createBattedWorldBaseGeometry({ field: flight.source.execution.field, bases: source.bases });
    const centers = battedWorldFrameBaseCenters(db, flight);
    if ((['first', 'second', 'third'] as const).some((base) => json(geometry.bases[base].region.center) !== json(centers[base]))) {
      throw new Error('actual base geometry and own physical setup centers differ');
    }
    return freeze({ source, flight, fixture, geometry, domesticVenueHistory });
  };
  const checkRows = (value: DurableBattedWorldBaseGeometry) => {
    const rows = db.prepare(`SELECT g.* FROM batted_world_base_geometries g
      LEFT JOIN batted_ball_flights f ON f.source_id=json_extract(g.source_json,'$.flightSourceId')
      LEFT JOIN physical_pitch_progress_actions p ON p.source_id=json_extract(f.source_json,'$.physicalPitchSourceId')
      WHERE g.game_id=? OR g.flight_source_id=? OR json_extract(g.source_json,'$.flightSourceId')=?
        OR f.game_id=? OR json_extract(p.source_json,'$.gameId')=?`)
      .all(value.fixture.game_id, value.source.flightSourceId, value.source.flightSourceId, value.fixture.game_id, value.fixture.game_id) as Row[];
    if (rows.length > 1) throw new Error('actual fixture has competing base geometry owners');
    for (const row of rows) {
      const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldBaseGeometry, row.source_id), own = derive(source);
      if (row.game_id !== own.fixture.game_id || row.game_id !== value.fixture.game_id || row.flight_source_id !== source.flightSourceId
        || row.fixture_event_id !== own.fixture.fixture_event_id || row.geometry_ref !== source.geometryRef
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(own) || row.snapshot_hash !== hash(own)) throw new Error('corrupt own actual base geometry proof');
      if (source.sourceId !== value.source.sourceId || json(own) !== json(value)) throw new Error('actual game base geometry is frozen differently');
    }
    return rows;
  };
  const read = (sourceId: string): DurableBattedWorldBaseGeometry | null => {
    if (!id(sourceId)) throw new Error('invalid actual base geometry scope');
    const row = db.prepare('SELECT * FROM batted_world_base_geometries WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const value = derive(input(JSON.parse(row.source_json) as AcceptedBattedWorldBaseGeometry, sourceId));
    checkRows(value); return value;
  };
  const current = (value: DurableBattedWorldBaseGeometry) => {
    ownFlights.openFrame(value.flight.physicalPitch);
    const head = ownFlights.currentHead(value.flight.source.physicalPitchSourceId);
    if (head?.source_id !== value.source.flightSourceId || json(derive(value.source)) !== json(value)) throw new Error('actual base geometry original changed during write');
    checkRows(value);
  };
  return { derive, read, current };
};

export const openSqliteBattedWorldBaseGeometryStore = (path: string, flights: Pick<SqliteBattedBallFlightStore, 'read'>,
  authority?: Authority): SqliteBattedWorldBaseGeometryStore => {
  if (!id(path) || typeof flights?.read !== 'function' || authority != null && typeof authority.readAcceptedGeometry !== 'function') throw new Error('invalid actual base geometry sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_base_geometries (source_id TEXT PRIMARY KEY,flight_source_id TEXT NOT NULL,
    game_id TEXT NOT NULL UNIQUE,fixture_event_id TEXT NOT NULL,geometry_ref TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  const own = battedWorldBaseGeometryEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual base geometry scope'); };
  return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); }, accept(sourceId) {
    check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedGeometry(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
    if (prior) {
      if (source && json(source) !== json(prior.source)) throw new Error('actual base geometry Source is frozen differently');
      const saved = own.read(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('actual base geometry original changed during retry'); return saved;
    }
    if (!source) throw new Error('accepted actual base geometry Source is missing');
    const value = own.derive(source); own.current(value); const peer = flights.read(source.flightSourceId);
    if (!peer || json(peer) !== json(value.flight)) throw new Error('actual base geometry peer flight differs');
    db.exec('BEGIN IMMEDIATE');
    try {
      own.current(value);
      db.prepare('INSERT INTO batted_world_base_geometries VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, source.flightSourceId, value.fixture.game_id,
        value.fixture.fixture_event_id, source.geometryRef, json(source), hash(source), json(value), hash(value));
      own.current(value); const saved = own.read(sourceId);
      if (!saved || json(saved) !== json(value)) throw new Error('actual base geometry original changed during write');
      db.exec('COMMIT'); return saved;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, close() { if (!closed) { db.close(); closed = true; } } });
};
