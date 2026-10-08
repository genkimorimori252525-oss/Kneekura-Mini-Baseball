import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import { battedWorldFieldCalibrationEvidenceFromSqlite } from './BattedWorldFieldCalibrationEvidenceFromSqlite';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import type { AcceptedBattedEpisodeFieldBinding, BattedEpisodeFieldBindingAuthority,
  DurableBattedEpisodeFieldBinding, SqliteBattedEpisodeFieldBindingStore } from './BattedEpisodeFieldBinding';

type Db = import('node:sqlite').DatabaseSync;
type Row = { source_id: string; source_version: string; binding_version: string; game_id: string; play_id: number;
  physical_pitch_source_id: string; response_source_id: string; field_calibration_source_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const input = (raw: AcceptedBattedEpisodeFieldBinding, sourceId: string): AcceptedBattedEpisodeFieldBinding => {
  const source = cloneInert(raw);
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).sort().join('|') !== ['sourceId', 'sourceVersion', 'version', 'responseSourceId', 'fieldCalibrationSourceId'].sort().join('|')
    || source.sourceId !== sourceId || source.version !== 'batted_episode_field_binding_v1'
    || ![sourceId, source.sourceVersion, source.responseSourceId, source.fieldCalibrationSourceId].every(id)) {
    throw new Error('invalid accepted episode field binding Source');
  }
  return freeze(source);
};

/** A main-only immutable snapshot, without schema installation or changing a caller transaction. */
const snapshot = <T>(db: Db, work: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('episode binding evidence requires a real SQLite connection');
  const databases = db.prepare('PRAGMA database_list').all();
  if (databases.filter(row => row.name === 'main').length !== 1
    || databases.some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('episode binding evidence requires main-only authority storage');
  }
  const outer = db.isTransaction, queryOnly = db.prepare('PRAGMA query_only').get()!.query_only;
  if (queryOnly !== 0 && queryOnly !== 1) throw new Error('episode binding query-only setting is unavailable');
  const name = `episode_binding_read_${randomUUID().replaceAll('-', '')}`;
  let opened = false, failed = false, error: unknown, result!: T;
  const cleanup: unknown[] = [];
  try {
    db.exec(outer ? `SAVEPOINT ${name}` : 'BEGIN'); opened = true;
    if (queryOnly === 0) db.exec('PRAGMA query_only=ON');
    const stamp = () => json([db.prepare('SELECT total_changes() AS n').get()!.n,
      db.prepare('PRAGMA main.schema_version').get()!.schema_version,
      db.prepare('PRAGMA temp.schema_version').get()!.schema_version]);
    const before = stamp(); result = work();
    if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1 || stamp() !== before) {
      throw new Error('episode binding snapshot changed during read');
    }
    db.exec(outer ? `RELEASE ${name}` : 'COMMIT'); opened = false;
    if (db.isTransaction !== outer) throw new Error('episode binding enclosing transaction changed');
  } catch (failure) { failed = true; error = failure; }
  finally {
    if (opened) try { db.exec(outer ? `RELEASE ${name}` : 'ROLLBACK'); } catch (failure) { cleanup.push(failure); }
    try {
      if (db.prepare('PRAGMA query_only').get()!.query_only !== queryOnly) db.exec(`PRAGMA query_only=${queryOnly}`);
      if (db.prepare('PRAGMA query_only').get()!.query_only !== queryOnly) throw new Error('episode binding read setting restore failed');
    } catch (failure) { cleanup.push(failure); }
  }
  if (cleanup.length) throw new AggregateError([...(failed ? [error] : []), ...cleanup], 'episode binding read cleanup failed');
  if (failed) throw error;
  return result;
};

const bindingOwner = (db: Db) => {
  const responses = battedContactResponseEvidenceFromSqlite(db), flights = battedBallFlightEvidenceFromSqlite(db);
  const calibrations = battedWorldFieldCalibrationEvidenceFromSqlite(db);
  const installed = () => {
    const rows = db.prepare("SELECT type FROM main.sqlite_master WHERE name='batted_episode_field_bindings'").all();
    if (!rows.length) return false;
    if (rows.length !== 1 || rows[0].type !== 'table') throw new Error('episode binding owner storage differs');
    return true;
  };
  const claim = (document: string, path: readonly string[]) => `EXISTS (SELECT 1 FROM (${nodes(document, path)}) identity WHERE identity.type='text' AND identity.atom=?)`;
  const identities = (sourceId: string): Row[] => !installed() ? [] : db.prepare(`SELECT * FROM main.batted_episode_field_bindings
    WHERE source_id=? OR ${claim('source_json', ['sourceId'])} OR ${claim('snapshot_json', ['source', 'sourceId'])}`)
    .all(sourceId, sourceId, sourceId) as Row[];
  const scope = (value: DurableBattedEpisodeFieldBinding): Row[] => !installed() ? [] : db.prepare(`SELECT * FROM main.batted_episode_field_bindings
    WHERE physical_pitch_source_id=? OR response_source_id=?
      OR ${claim('source_json', ['responseSourceId'])} OR ${claim('snapshot_json', ['source', 'responseSourceId'])}
      OR ${claim('snapshot_json', ['physicalPitchSourceId'])}
      OR ${claim('snapshot_json', ['response', 'source', 'sourceId'])}
      OR ${claim('snapshot_json', ['response', 'touch', 'worldContact', 'flight', 'physicalPitch', 'source', 'sourceId'])}
      OR ${claim('snapshot_json', ['response', 'touch', 'worldContact', 'flight', 'source', 'physicalPitchSourceId'])}`)
    .all(value.physicalPitchSourceId, value.source.responseSourceId, value.source.responseSourceId,
      value.source.responseSourceId, value.physicalPitchSourceId, value.source.responseSourceId, value.physicalPitchSourceId, value.physicalPitchSourceId) as Row[];
  const derive = (raw: AcceptedBattedEpisodeFieldBinding): DurableBattedEpisodeFieldBinding => {
    const inert = cloneInert(raw), source = input(inert, inert.sourceId), response = responses.read(source.responseSourceId);
    const calibration = calibrations.readGeometry(source.fieldCalibrationSourceId);
    if (!response || !calibration) throw new Error('original episode response or field calibration is missing');
    calibrations.historicalGeometry(calibration);
    const world = response.touch.worldContact, flight = world.flight, pitch = flight.physicalPitch;
    const old = calibration.baseGeometry, oldActor = old.flight.physicalPitch.frame.batterActor;
    const actor = pitch.frame.batterActor, initial = flight.flight.initialBall;
    assertSupportedBattedWorldConsumer(world, 'episode_field_binding');
    if (response.source.kind !== undefined || response.touch.source.kind !== undefined || world.source.kind !== undefined
      || !actor || !oldActor || old.flight.physicalPitch.frame.world.runners.length
      || Object.values(old.flight.physicalPitch.frame.match.bases).some(player => player !== null)) {
      throw new Error('episode field binding requires the strict original empty-bases root');
    }
    const appended = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length)
      .filter(event => event.kind === 'BatBallContact');
    const contact = appended[0];
    if (appended.length !== 1 || !contact || contact.kind !== 'BatBallContact' || contact.tick !== initial.tick
      || flight.source.searchDurationTicks !== 0 || flight.source.previousFlightSourceId !== null
      || world.source.previousContactSourceId !== null || world.result.kind !== 'airborne' || world.result.throughTick !== initial.tick
      || json(world.result.ball) !== json(initial) || response.result.kind !== 'airborne' || json(response.result.ball) !== json(initial)) {
      throw new Error('episode field binding requires the unadvanced original bat contact root');
    }
    const bindings = [actor.binding, ...actor.defenderBindings], originalBindings = [oldActor.binding, ...oldActor.defenderBindings];
    if (bindings.length !== 10 || actor.defenderBindings.length !== 9 || new Set(bindings.map(binding => binding.playerId)).size !== 10
      || json(bindings) !== json(originalBindings) || world.actors.length !== 50
      || bindings.some(binding => world.modelActorEvidence.filter(item => json(item.binding) === json(binding)).length !== 1)
      || pitch.frame.gameId !== old.fixture.game_id || response.model.gameId !== old.fixture.game_id
      || world.model.gameId !== old.fixture.game_id || actor.binding.careerId !== oldActor.binding.careerId
      || world.model.careerId !== actor.binding.careerId || response.model.careerId !== actor.binding.careerId
      || actor.binding.fixtureEventId !== old.fixture.fixture_event_id || world.model.fixtureEventId !== old.fixture.fixture_event_id
      || response.model.fixtureEventId !== old.fixture.fixture_event_id || flight.source.execution.venueId !== old.fixture.venue_id
      || world.model.venueId !== old.fixture.venue_id || response.model.venueId !== old.fixture.venue_id
      || old.source.availableAtDay > actor.binding.gameDay || flight.source.execution.availableAtDay > actor.binding.gameDay
      || json(flight.source.execution.field) !== json(old.flight.source.execution.field)) {
      throw new Error('episode field binding original Player/Person/fixture/day or orientation differs');
    }
    const centers = battedWorldFrameBaseCenters(db, flight);
    if ((['first', 'second', 'third'] as const).some(base => json(centers[base]) !== json(old.source.bases[base].region.center))) {
      throw new Error('episode field binding authenticated frame base centers differ');
    }
    const baseGeometry = createBattedWorldBaseGeometry({ field: flight.source.execution.field, bases: old.source.bases });
    const geometry = createBattedWorldFieldGeometry({ baseGeometry, baseModels: calibration.source.baseModels });
    if (json(geometry) !== json(calibration.geometry)) throw new Error('episode field binding accepted physical calibration differs');
    return freeze({ source, gameId: pitch.frame.gameId, playId: pitch.frame.match.playId, physicalPitchSourceId: pitch.source.sourceId,
      contactSequence: contact.sequence, contactTick: contact.tick, response, calibration, geometry });
  };
  const checkRow = (row: Row, value: DurableBattedEpisodeFieldBinding) => {
    const source = value.source;
    if (row.source_id !== source.sourceId || row.source_version !== source.sourceVersion || row.binding_version !== source.version
      || row.game_id !== value.gameId || row.play_id !== value.playId || row.physical_pitch_source_id !== value.physicalPitchSourceId
      || row.response_source_id !== source.responseSourceId || row.field_calibration_source_id !== source.fieldCalibrationSourceId
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt episode field binding archive or dependency');
  };
  const read = (sourceId: string): DurableBattedEpisodeFieldBinding | null => {
    if (!id(sourceId)) throw new Error('invalid episode field binding scope');
    const rows = identities(sourceId);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('episode binding Source identity ownership differs');
    if (!rows.length) return null;
    const value = derive(input(JSON.parse(rows[0].source_json), sourceId)), claims = scope(value);
    if (claims.length !== 1 || claims[0].source_id !== sourceId) throw new Error('episode binding pitch/response ownership differs');
    checkRow(rows[0], value); return value;
  };
  const current = (value: DurableBattedEpisodeFieldBinding) => {
    const flight = value.response.touch.worldContact.flight;
    flights.openFrame(flight.physicalPitch);
    const head = flights.currentHead(value.physicalPitchSourceId);
    if (head?.source_id !== flight.source.sourceId) throw new Error('episode binding requires its exact current flight head');
    responses.current(value.response);
    if (json(derive(value.source)) !== json(value)) throw new Error('episode binding original dependencies changed');
  };
  return { read, derive, current, identities, scope };
};

export const battedEpisodeFieldBindingEvidenceFromSqlite = (db: Db) => {
  const own = bindingOwner(db);
  return Object.freeze({ read: (sourceId: string) => snapshot(db, () => own.read(sourceId)),
    derive: (source: AcceptedBattedEpisodeFieldBinding) => snapshot(db, () => own.derive(source)),
    current: (value: DurableBattedEpisodeFieldBinding) => snapshot(db, () => own.current(value)) });
};
export const openSqliteBattedEpisodeFieldBindingStore = (path: string,
  authority?: BattedEpisodeFieldBindingAuthority): SqliteBattedEpisodeFieldBindingStore => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedBinding !== 'function') throw new Error('invalid episode field binding authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.batted_episode_field_bindings (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
        binding_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,
        response_source_id TEXT NOT NULL UNIQUE,field_calibration_source_id TEXT NOT NULL,
        source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  } catch (error) { db.close(); throw error; }
  const own = bindingOwner(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed episode field binding store'); };
  return Object.freeze({ read(sourceId) { check(); return snapshot(db, () => own.read(sourceId)); },
    accept(sourceId) {
      check(); const prior = snapshot(db, () => own.read(sourceId));
      const raw = authority?.readAcceptedBinding(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('episode field binding Source is frozen differently');
        return snapshot(db, () => {
          const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(prior)) throw new Error('episode field binding changed during retry');
          return saved;
        });
      }
      if (!source) throw new Error('accepted episode field binding Source is missing');
      const value = snapshot(db, () => { const proposed = own.derive(source); own.current(proposed); return proposed; });
      db.exec('BEGIN IMMEDIATE');
      try {
        snapshot(db, () => {
          if (own.identities(sourceId).length || own.scope(value).length) throw new Error('episode pitch/response already has a binding owner');
          own.current(value);
        });
        const before = db.prepare('SELECT total_changes() AS n').get()!.n;
        if (typeof before !== 'number' || !Number.isSafeInteger(before + 1)) throw new Error('episode binding write accounting unavailable');
        const witnessed = () => {
          if (db.prepare('SELECT total_changes() AS n').get()!.n !== before + 1) throw new Error('episode binding changed more than its own insertion');
        };
        db.prepare('INSERT INTO main.batted_episode_field_bindings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
          source.version, value.gameId, value.playId, value.physicalPitchSourceId, source.responseSourceId, source.fieldCalibrationSourceId,
          json(source), hash(source), json(value), hash(value));
        witnessed();
        const saved = snapshot(db, () => { own.current(value); return own.read(sourceId); });
        witnessed();
        if (!saved || json(saved) !== json(value)) throw new Error('episode binding changed during insertion');
        db.exec('COMMIT'); return saved;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } } });
};
