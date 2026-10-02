import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assertBattedActorResponseProfile, deriveBattedBallContactResponse, type BattedActorResponseProfile,
  type BattedBallContactResponse } from '../../core/sim/ball/BattedBallContactResponse';
import type { BallContactMaterial } from '../../core/sim/ball/BallContactResponse';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedFirstFielderTouchEvidenceFromSqlite, type DurableBattedFirstFielderTouch,
  type SqliteBattedFirstFielderTouchStore } from './SqliteBattedFirstFielderTouchStore';

export type AcceptedBattedContactResponseModel = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; careerId: string; fixtureEventId: string; venueId: string; availableAtDay: number;
  actors: readonly Readonly<{ playerId: string; personId: string; primitives: readonly BattedActorResponseProfile[] }>[];
  surfaces: readonly Readonly<{ surfaceId: string; material: BallContactMaterial }>[];
}>;
export type AcceptedBattedContactResponse = Readonly<{
  sourceId: string; sourceVersion: string; firstFielderTouchSourceId: string; responseModelSourceId: string;
}>;
export type DurableBattedContactResponse = Readonly<{
  source: AcceptedBattedContactResponse; model: AcceptedBattedContactResponseModel;
  touch: DurableBattedFirstFielderTouch; result: BattedBallContactResponse;
}>;
export type SqliteBattedContactResponseStore = Readonly<{
  accept(sourceId: string): DurableBattedContactResponse; read(sourceId: string): DurableBattedContactResponse | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedResponse(sourceId: string): AcceptedBattedContactResponse | null;
  readAcceptedModel(sourceId: string): AcceptedBattedContactResponseModel | null }>;
type Row = { source_id: string; first_fielder_touch_source_id: string; world_contact_source_id: string;
  physical_pitch_source_id: string; game_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const material = (m: BallContactMaterial) => fields(m, ['restitution', 'tangentialDamping', 'spinDamping'])
  && [m.restitution, m.tangentialDamping, m.spinDamping].every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const input = (raw: AcceptedBattedContactResponse, sourceId: string): AcceptedBattedContactResponse => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'firstFielderTouchSourceId', 'responseModelSourceId']) || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.firstFielderTouchSourceId, s.responseModelSourceId].every(id)) throw new Error('invalid accepted batted response Source');
  return s;
};
const modelInput = (raw: AcceptedBattedContactResponseModel, sourceId: string): AcceptedBattedContactResponseModel => {
  const m = cloneInert(raw);
  if (!fields(m, ['sourceId', 'sourceVersion', 'gameId', 'careerId', 'fixtureEventId', 'venueId', 'availableAtDay', 'actors', 'surfaces'])
    || m.sourceId !== sourceId || ![sourceId, m.sourceVersion, m.gameId, m.careerId, m.fixtureEventId, m.venueId].every(id)
    || !Number.isSafeInteger(m.availableAtDay) || m.availableAtDay < 0 || !Array.isArray(m.actors) || m.actors.length < 10
    || new Set(m.actors.map((a) => a?.playerId)).size !== m.actors.length || new Set(m.actors.map((a) => a?.personId)).size !== m.actors.length
    || m.actors.some((a) => !fields(a, ['playerId', 'personId', 'primitives']) || !id(a.playerId) || !id(a.personId)
      || !Array.isArray(a.primitives) || a.primitives.length !== roles.length || new Set(a.primitives.map((p: BattedActorResponseProfile) => p?.role)).size !== roles.length
      || a.primitives.some((p: BattedActorResponseProfile) => !p || !roles.includes(p.role) || (p.role !== 'glove'
        ? !fields(p, ['role', 'material']) || !material(p.material)
        : !fields(p, ['role', 'pocketCenterOffset', 'bodyStability', 'parameters']) || !fields(p.pocketCenterOffset, ['x', 'y', 'z'])
          || !fields(p.parameters, ['ticksPerSecond', 'ballMassKg', 'ballRadiusMeters', 'pocketRadiusMeters', 'centerRetentionCapacityJ',
            'captureDissipationPowerW', 'failedContactRestitution', 'failedTangentialDamping', 'failedSpinDamping']))))
    || !Array.isArray(m.surfaces) || new Set(m.surfaces.map((s) => s?.surfaceId)).size !== m.surfaces.length
    || m.surfaces.some((s) => !fields(s, ['surfaceId', 'material']) || !id(s.surfaceId) || !material(s.material))) throw new Error('invalid accepted batted response model');
  return m;
};

export const battedContactResponseEvidenceFromSqlite = (
  db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>,
) => {
  const own = battedFirstFielderTouchEvidenceFromSqlite(db);
  const readModel = (sourceId: string): AcceptedBattedContactResponseModel | null => {
    const row = db.prepare('SELECT * FROM batted_contact_response_models WHERE source_id=?').get(sourceId) as {
      source_id: string; game_id: string; source_json: string; source_hash: string;
    } | undefined;
    if (!row) return null;
    const m = modelInput(JSON.parse(row.source_json) as AcceptedBattedContactResponseModel, sourceId);
    if (row.game_id !== m.gameId || row.source_json !== json(m) || row.source_hash !== hash(m)) throw new Error('corrupt batted response model');
    return m;
  };
  const sameModel = (m: AcceptedBattedContactResponseModel) => {
    const current = db.prepare('SELECT source_id FROM batted_contact_response_models WHERE game_id=?').get(m.gameId) as { source_id: string } | undefined;
    if (current && (current.source_id !== m.sourceId || json(readModel(current.source_id)) !== json(m))) throw new Error('batted response game model is frozen differently');
  };
  const derive = (s: AcceptedBattedContactResponse, m: AcceptedBattedContactResponseModel): DurableBattedContactResponse => {
    const touch = own.read(s.firstFielderTouchSourceId);
    if (!touch) throw new Error('original first-fielder touch Source is missing');
    const w = touch.worldContact, original = w.model, p = w.flight.source.execution.ballFlightParameters;
    if (m.gameId !== original.gameId || m.careerId !== original.careerId || m.fixtureEventId !== original.fixtureEventId
      || m.venueId !== original.venueId || m.availableAtDay > w.flight.physicalPitch.frame.batterActor!.binding.gameDay
      || m.actors.length !== original.actors.length || m.actors.some((a) => !original.actors.some((b) => a.playerId === b.playerId && a.personId === b.personId))
      || m.surfaces.length !== original.surfaces.length || m.surfaces.some((a) => !original.surfaces.some((b) => a.surfaceId === b.surfaceId))) {
      throw new Error('batted response original Player/Person/fixture/model scope differs');
    }
    m.actors.forEach((a) => a.primitives.forEach((profile) => assertBattedActorResponseProfile(profile, p)));
    const result = deriveBattedBallContactResponse({ world: { flight: w.flight.flight, parameters: p,
      throughTick: w.flight.flight.contact.tick + w.flight.source.searchDurationTicks, actors: w.actors, surfaces: original.surfaces },
      actors: m.actors.filter((a) => w.actors.some((b) => a.playerId === b.playerId)).flatMap((a) => a.primitives.map((profile) => ({ playerId: a.playerId, profile }))),
      surfaces: m.surfaces });
    if (json(result.world) !== json(w.result)) throw new Error('batted response original physical World differs');
    return freeze({ source: s, model: m, touch, result });
  };
  const read = (sourceId: string): DurableBattedContactResponse | null => {
    const row = db.prepare('SELECT * FROM batted_contact_responses WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const s = input(JSON.parse(row.source_json) as AcceptedBattedContactResponse, sourceId), m = readModel(s.responseModelSourceId);
    if (!m) throw new Error('original batted response model is missing');
    const value = derive(s, m), w = value.touch.worldContact;
    if (row.first_fielder_touch_source_id !== s.firstFielderTouchSourceId || row.world_contact_source_id !== w.source.sourceId
      || row.physical_pitch_source_id !== w.flight.source.physicalPitchSourceId || row.game_id !== m.gameId
      || row.source_json !== json(s) || row.source_hash !== hash(s) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original batted response archive');
    }
    return value;
  };
  const current = (value: DurableBattedContactResponse): void => {
    own.current(value.touch);
    sameModel(value.model);
  };
  return { read, readModel, sameModel, derive, current, own };
};

/** Original actual physical Source and independently versioned calibration own the ball response, not the peer/caller. */
export const openSqliteBattedContactResponseStore = (path: string, touches: Pick<SqliteBattedFirstFielderTouchStore, 'read'>,
  authority?: Authority): SqliteBattedContactResponseStore => {
  if (!id(path) || typeof touches?.read !== 'function' || authority != null
    && (typeof authority.readAcceptedResponse !== 'function' || typeof authority.readAcceptedModel !== 'function')) throw new Error('invalid batted response sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_contact_response_models (source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS batted_contact_responses (source_id TEXT PRIMARY KEY,first_fielder_touch_source_id TEXT NOT NULL UNIQUE,
    world_contact_source_id TEXT NOT NULL UNIQUE,physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted response scope'); };
  const { read, readModel, sameModel, derive, current, own } = battedContactResponseEvidenceFromSqlite(db);
  return Object.freeze({
    read(sourceId) { check(sourceId); return read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = read(sourceId), raw = authority?.readAcceptedResponse(sourceId) ?? null, s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('batted response Source is frozen differently');
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted response original changed during retry');
        return original;
      }
      if (!s) throw new Error('accepted batted response Source is missing');
      const originalModel = readModel(s.responseModelSourceId), rawModel = authority?.readAcceptedModel(s.responseModelSourceId) ?? null;
      const m = rawModel === null ? originalModel : modelInput(rawModel, s.responseModelSourceId);
      if (!m) throw new Error('accepted batted response model is missing'); sameModel(m);
      const value = derive(s, m); current(value);
      const peer = touches.read(s.firstFielderTouchSourceId);
      if (!peer || json(peer) !== json(value.touch)) throw new Error('batted response peer first-fielder touch differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        sameModel(m); current(value);
        if (json(derive(s, m)) !== json(value)) throw new Error('batted response original changed before write');
        if (!readModel(m.sourceId)) db.prepare('INSERT INTO batted_contact_response_models VALUES (?,?,?,?)').run(m.sourceId, m.gameId, json(m), hash(m));
        const w = value.touch.worldContact;
        db.prepare('INSERT INTO batted_contact_responses VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, s.firstFielderTouchSourceId, w.source.sourceId,
          w.flight.source.physicalPitchSourceId, m.gameId, json(s), hash(s), json(value), hash(value));
        current(value); sameModel(m);
        const saved = read(sourceId);
        if (json(saved) !== json(value)) throw new Error('batted response original changed during write');
        db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
