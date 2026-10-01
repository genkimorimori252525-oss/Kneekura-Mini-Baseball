import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';
import { createBattedBallFlightEvidence, type BattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { createFairTerritoryWedge, type FairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { classifyFirstGroundContactTerritory, type FirstGroundContactTerritory } from '../../core/sim/ball/FirstGroundContactTerritory';
import { DEFAULT_CONTACT_PARAMETERS } from '../../core/sim/contact/BatBallContact';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { captureClosurePitchRows, assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import type { DurablePhysicalPitch, SqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';

export type AcceptedBattedBallFlight = Readonly<{
  sourceId: string; sourceVersion: string; physicalPitchSourceId: string; previousFlightSourceId: string | null;
  searchDurationTicks: number;
  execution: Readonly<{ venueId: string; availableAtDay: number; field: FairTerritoryWedge;
    ballFlightParameters: Required<BallFlightParameters> }>;
}>;
export type DurableBattedBallFlight = Readonly<{
  source: AcceptedBattedBallFlight; revision: number; physicalPitch: DurablePhysicalPitch;
  originalPitchRows: Readonly<{ actions: readonly string[]; head: string }>;
  flight: BattedBallFlightEvidence; projectedGroundTerritory: FirstGroundContactTerritory | null;
}>;
export type SqliteBattedBallFlightStore = Readonly<{
  accept(sourceId: string): DurableBattedBallFlight;
  read(sourceId: string): DurableBattedBallFlight | null;
  close(): void;
}>;
type FlightRow = { source_id: string; physical_pitch_source_id: string; game_id: string; play_id: number; revision: number;
  previous_source_id: string | null; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]): v is object => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const input = (raw: AcceptedBattedBallFlight, sourceId: string): AcceptedBattedBallFlight => {
  const s = cloneInert(raw), p = s?.execution?.ballFlightParameters;
  if (!fields(s, ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'previousFlightSourceId', 'searchDurationTicks', 'execution'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId].every(id)
    || s.previousFlightSourceId !== null && (!id(s.previousFlightSourceId) || s.previousFlightSourceId === sourceId)
    || !integer(s.searchDurationTicks) || !fields(s.execution, ['venueId', 'availableAtDay', 'field', 'ballFlightParameters'])
    || !id(s.execution.venueId) || !integer(s.execution.availableAtDay)
    || !fields(p, ['ticksPerSecond', 'gravityY', 'ballRadius', 'groundRestitution', 'groundFriction', 'groundRollingDecelerationMps2', 'integrationStepTicks', 'restingVerticalSpeed'])
    || Object.values(p).some((v) => typeof v !== 'number' || !Number.isFinite(v))
    || p.ticksPerSecond !== 1_000_000 || !integer(p.integrationStepTicks) || p.integrationStepTicks === 0
    || p.ballRadius !== DEFAULT_CONTACT_PARAMETERS.ballRadius || p.groundRestitution < 0 || p.groundRestitution > 1
    || p.groundFriction < 0 || p.groundFriction > 1 || p.groundRollingDecelerationMps2 < 0 || p.restingVerticalSpeed < 0
    || !fields(s.execution.field, ['homePlate', 'firstBaseLineUnit', 'thirdBaseLineUnit'])
    || ![s.execution.field.homePlate, s.execution.field.firstBaseLineUnit, s.execution.field.thirdBaseLineUnit].every((v) => fields(v, ['x', 'z']))) {
    throw new Error('invalid accepted batted flight Source or physical parameters');
  }
  createFairTerritoryWedge(s.execution.field); return s;
};

/** Original free-flight evidence; projected ground never settles earlier actor contacts or baseball rules. */
export const openSqliteBattedBallFlightStore = (path: string,
  physicalPitches: Pick<SqlitePhysicalPitchProgressStore, 'readAcceptedPitch'>,
  authority?: Readonly<{ readAcceptedFlight(sourceId: string): AcceptedBattedBallFlight | null }>): SqliteBattedBallFlightStore => {
  if (!id(path) || typeof physicalPitches?.readAcceptedPitch !== 'function'
    || authority != null && typeof authority.readAcceptedFlight !== 'function') throw new Error('invalid batted flight sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_ball_flights (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
    game_id TEXT NOT NULL,play_id INTEGER NOT NULL,revision INTEGER NOT NULL,previous_source_id TEXT,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_ball_flight_heads (physical_pitch_source_id TEXT PRIMARY KEY,source_id TEXT NOT NULL,revision INTEGER NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted flight scope'); };
  const ownPitch = (sourceId: string) => {
    const row = db.prepare('SELECT game_id,play_id,snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?').get(sourceId) as {
      game_id: string; play_id: number; snapshot_json: string;
    } | undefined;
    if (!row) throw new Error('actual batted flight physical pitch is missing');
    const pitch = readPhysicalPitchProgressFromSqlite(db, row.game_id, row.play_id).at(-1);
    if (!pitch || pitch.source.sourceId !== sourceId || row.snapshot_json !== json(pitch)) throw new Error('batted flight original physical progress differs');
    return pitch;
  };
  const derive = (s: AcceptedBattedBallFlight, parent: DurableBattedBallFlight | null): DurableBattedBallFlight => {
    const physicalPitch = ownPitch(s.physicalPitchSourceId), timeline = physicalPitch.result.pitch.resolution.timeline;
    if (!physicalPitch.frame.batterActor) throw new Error('actual batted flight batter is missing');
    if (timeline.status.kind !== 'batted_ball_pending') throw new Error('batted flight requires actual pending contact');
    const contactTick = timeline.status.contactTick;
    const contact = [...timeline.events].reverse().find((e) => e.kind === 'BatBallContact' && e.tick === contactTick);
    if (!contact || contact.kind !== 'BatBallContact') throw new Error('actual bat contact is missing');
    const fixture = db.prepare('SELECT venue_id,fixture_event_id FROM official_fixtures WHERE game_id=?').get(physicalPitch.frame.gameId) as {
      venue_id: string; fixture_event_id: string;
    } | undefined;
    if (!fixture || fixture.venue_id !== s.execution.venueId || fixture.fixture_event_id !== physicalPitch.frame.batterActor.binding.fixtureEventId
      || s.execution.availableAtDay > physicalPitch.frame.batterActor.binding.gameDay) throw new Error('batted flight actual fixture/day differs');
    if (s.previousFlightSourceId === null ? parent !== null : !parent || parent.source.sourceId !== s.previousFlightSourceId
      || parent.source.physicalPitchSourceId !== s.physicalPitchSourceId || json(parent.source.execution) !== json(s.execution)
      || s.searchDurationTicks <= parent.source.searchDurationTicks) throw new Error('batted flight previous Source, execution or horizon differs');
    const flight = createBattedBallFlightEvidence({ contact: contact.payload.contact, searchDurationTicks: s.searchDurationTicks,
      parameters: s.execution.ballFlightParameters });
    const rows = captureClosurePitchRows(db, s.physicalPitchSourceId);
    return freeze({ source: s, revision: (parent?.revision ?? 0) + 1, physicalPitch,
      originalPitchRows: { actions: rows.actions, head: rows.head }, flight,
      projectedGroundTerritory: classifyFirstGroundContactTerritory(flight, s.execution.field) });
  };
  const read = (sourceId: string, seen = new Set<string>()): DurableBattedBallFlight | null => {
    check(sourceId); if (seen.has(sourceId)) throw new Error('cyclic batted flight archive'); seen.add(sourceId);
    const row = db.prepare('SELECT * FROM batted_ball_flights WHERE source_id=?').get(sourceId) as FlightRow | undefined;
    if (!row) return null;
    const s = input(JSON.parse(row.source_json) as AcceptedBattedBallFlight, sourceId);
    const parent = s.previousFlightSourceId === null ? null : read(s.previousFlightSourceId, seen);
    const value = derive(s, parent);
    if (row.physical_pitch_source_id !== s.physicalPitchSourceId || row.previous_source_id !== s.previousFlightSourceId
      || row.game_id !== value.physicalPitch.frame.gameId || row.play_id !== value.physicalPitch.frame.match.playId || row.revision !== value.revision
      || row.source_json !== json(s) || row.source_hash !== hash(s) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original batted flight archive');
    }
    return value;
  };
  const openFrame = (pitch: DurablePhysicalPitch) => {
    assertPriorPhysicalClosureCompleted(db, pitch.frame.activationApplicationId);
    assertPhysicalActorOpenFrame(db, pitch.frame.batterActor!);
    const workload = db.prepare('SELECT revision,state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
      .get(pitch.frame.workload.careerId, pitch.frame.workload.playerId) as { revision: number; state_json: string } | undefined;
    if (!workload || workload.revision !== pitch.frame.workload.revision || workload.state_json !== json(pitch.frame.workload)) throw new Error('batted flight current workload differs');
  };
  const currentHead = (physicalPitchSourceId: string) => {
    const head = db.prepare('SELECT source_id,revision FROM batted_ball_flight_heads WHERE physical_pitch_source_id=?')
      .get(physicalPitchSourceId) as { source_id: string; revision: number } | undefined;
    const last = db.prepare('SELECT source_id,revision FROM batted_ball_flights WHERE physical_pitch_source_id=? ORDER BY revision DESC LIMIT 1')
      .get(physicalPitchSourceId) as { source_id: string; revision: number } | undefined;
    const count = db.prepare('SELECT count(*) AS n,min(revision) AS first_revision FROM batted_ball_flights WHERE physical_pitch_source_id=?')
      .get(physicalPitchSourceId) as { n: number; first_revision: number | null };
    if (json(head ?? null) !== json(last ?? null) || count.n !== (head?.revision ?? 0)
      || head && (!integer(head.revision) || count.first_revision !== 1)) throw new Error('batted flight progress head or owned prefix differs');
    return head;
  };
  const predecessor = (s: AcceptedBattedBallFlight) => {
    const head = currentHead(s.physicalPitchSourceId);
    if (s.previousFlightSourceId !== (head?.source_id ?? null)) throw new Error('batted flight predecessor differs');
    return head ? read(head.source_id) : null;
  };
  return Object.freeze({
    read(sourceId) { return read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = read(sourceId), raw = authority?.readAcceptedFlight(sourceId) ?? null;
      const s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('batted flight Source is frozen differently');
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted flight original evidence changed during retry');
        return original;
      }
      if (!s) throw new Error('accepted batted flight Source is missing');
      const value = derive(s, predecessor(s)); openFrame(value.physicalPitch);
      const peer = physicalPitches.readAcceptedPitch(s.physicalPitchSourceId);
      if (!peer || json(peer) !== json(value.physicalPitch)) throw new Error('batted flight peer physical evidence differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        openFrame(value.physicalPitch);
        if (json(derive(s, predecessor(s))) !== json(value)) throw new Error('batted flight original evidence changed before write');
        db.prepare('INSERT INTO batted_ball_flights VALUES (?,?,?,?,?,?,?,?,?,?)').run(sourceId, s.physicalPitchSourceId,
          value.physicalPitch.frame.gameId, value.physicalPitch.frame.match.playId, value.revision, s.previousFlightSourceId,
          json(s), hash(s), json(value), hash(value));
        db.prepare('INSERT INTO batted_ball_flight_heads VALUES (?,?,?) ON CONFLICT(physical_pitch_source_id) DO UPDATE SET source_id=excluded.source_id,revision=excluded.revision')
          .run(s.physicalPitchSourceId, sourceId, value.revision);
        openFrame(value.physicalPitch);
        const saved = read(sourceId);
        const head = currentHead(s.physicalPitchSourceId);
        if (json(saved) !== json(value) || json(head) !== json({ source_id: sourceId, revision: value.revision })) throw new Error('batted flight changed during write');
        db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
