import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveAndRecordBattedWorldFirstFielderTouch, type BattedWorldFirstFielderTouchResult } from '../../core/sim/plateAppearance/BattedWorldFirstFielderTouch';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldContactEvidenceFromSqlite, type DurableBattedWorldContact, type SqliteBattedWorldContactStore } from './SqliteBattedWorldContactStore';

export type AcceptedBattedFirstFielderTouch = Readonly<{ sourceId: string; sourceVersion: string; worldContactSourceId: string }>;
export type DurableBattedFirstFielderTouch = Readonly<{
  source: AcceptedBattedFirstFielderTouch; worldContact: DurableBattedWorldContact; result: BattedWorldFirstFielderTouchResult;
}>;
export type SqliteBattedFirstFielderTouchStore = Readonly<{
  accept(sourceId: string): DurableBattedFirstFielderTouch; read(sourceId: string): DurableBattedFirstFielderTouch | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedTouch(sourceId: string): AcceptedBattedFirstFielderTouch | null }>;
type Row = { source_id: string; world_contact_source_id: string; physical_pitch_source_id: string; game_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const input = (raw: AcceptedBattedFirstFielderTouch, sourceId: string): AcceptedBattedFirstFielderTouch => {
  const s = cloneInert(raw);
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join('|') !== 'sourceId|sourceVersion|worldContactSourceId'
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.worldContactSourceId].every(id)) throw new Error('invalid accepted first-fielder touch Source');
  return s;
};

export const battedFirstFielderTouchEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const own = battedWorldContactEvidenceFromSqlite(db);
  const derive = (s: AcceptedBattedFirstFielderTouch): DurableBattedFirstFielderTouch => {
    const worldContact = own.read(s.worldContactSourceId);
    if (!worldContact) throw new Error('original batted World contact is missing');
    assertSupportedBattedWorldConsumer(worldContact, 'first_fielder_touch');
    const frame = worldContact.flight.physicalPitch.frame;
    const result = deriveAndRecordBattedWorldFirstFielderTouch({ timeline: worldContact.timeline,
      world: { flight: worldContact.flight.flight, parameters: worldContact.flight.source.execution.ballFlightParameters,
        throughTick: worldContact.flight.flight.contact.tick + worldContact.flight.source.searchDurationTicks,
        actors: worldContact.actors, surfaces: worldContact.model.surfaces },
      defenderIds: frame.batterActor!.defenderBindings.map((b) => b.playerId),
      field: worldContact.flight.source.execution.field });
    return freeze({ source: s, worldContact, result });
  };
  const read = (sourceId: string): DurableBattedFirstFielderTouch | null => {
    if (!id(sourceId)) throw new Error('invalid first-fielder touch scope');
    const row = db.prepare('SELECT * FROM batted_first_fielder_touches WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const s = input(JSON.parse(row.source_json) as AcceptedBattedFirstFielderTouch, sourceId), value = derive(s);
    if (row.world_contact_source_id !== s.worldContactSourceId || row.physical_pitch_source_id !== value.worldContact.flight.source.physicalPitchSourceId
      || row.game_id !== value.worldContact.model.gameId || row.source_json !== json(s) || row.source_hash !== hash(s)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original first-fielder touch archive');
    return value;
  };
  const current = (value: DurableBattedFirstFielderTouch) => {
    const world = value.worldContact, physicalId = world.flight.source.physicalPitchSourceId;
    if (json(own.head(physicalId)) !== json({ source_id: world.source.sourceId, revision: world.revision })) {
      throw new Error('first-fielder touch original World is not current');
    }
    const flightHead = own.ownFlights.currentHead(physicalId);
    const latestFlight = flightHead ? own.ownFlights.read(flightHead.source_id) : null;
    if (!latestFlight || latestFlight.revision !== flightHead!.revision
      || latestFlight.source.physicalPitchSourceId !== physicalId) throw new Error('first-fielder touch original flight prefix differs');
    own.ownFlights.openFrame(world.flight.physicalPitch);
  };
  return { read, derive, current, own };
};

/** Own original physical proof; positional rules do not imply catch, possession, OUT or play end. */
export const openSqliteBattedFirstFielderTouchStore = (path: string, contacts: Pick<SqliteBattedWorldContactStore, 'read'>,
  authority?: Authority): SqliteBattedFirstFielderTouchStore => {
  if (!id(path) || typeof contacts?.read !== 'function' || authority != null && typeof authority.readAcceptedTouch !== 'function') {
    throw new Error('invalid first-fielder touch sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_first_fielder_touches (source_id TEXT PRIMARY KEY,world_contact_source_id TEXT NOT NULL UNIQUE,
    physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed first-fielder touch scope'); };
  const { read, derive, current } = battedFirstFielderTouchEvidenceFromSqlite(db);
  return Object.freeze({
    read(sourceId) { check(sourceId); return read(sourceId); },
    accept(sourceId) {
      check(sourceId);
      const prior = read(sourceId), raw = authority?.readAcceptedTouch(sourceId) ?? null, s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('first-fielder touch Source is frozen differently');
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('original first-fielder touch changed during retry');
        return original;
      }
      if (!s) throw new Error('accepted first-fielder touch Source is missing');
      const value = derive(s); current(value);
      const peer = contacts.read(s.worldContactSourceId);
      if (!peer || json(peer) !== json(value.worldContact)) throw new Error('first-fielder touch peer World contact differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, value.worldContact.flight.source.physicalPitchSourceId, { owner: 'batted_first_fielder_touches', sourceId });
        current(value);
        if (json(derive(s)) !== json(value)) throw new Error('first-fielder touch original changed before write');
        db.prepare('INSERT INTO batted_first_fielder_touches VALUES (?,?,?,?,?,?,?,?)').run(sourceId, s.worldContactSourceId,
          value.worldContact.flight.source.physicalPitchSourceId, value.worldContact.model.gameId, json(s), hash(s), json(value), hash(value));
        recordActualLivePlayAdmission(db, liveFence);
        current(value);
        const saved = read(sourceId);
        if (json(saved) !== json(value)) throw new Error('first-fielder touch original changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
