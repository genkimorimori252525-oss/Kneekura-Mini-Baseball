import { prePitchRunnerContactPrimitives } from './PrePitchRunnerExecution';
import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { deriveFirstBattedWorldContact, type BattedWorldActorPrimitive, type BattedWorldSurface, type BattedWorldContactResult } from '../../core/sim/ball/BattedBallWorldContacts';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { projectDefenderBodyKinematicsSegment, sampleDefenderBodyKinematicsSegment, type DefenderBodyKinematicsSegment } from '../../core/sim/fielding/DefenderBodyKinematics';
import { composeDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedBallFlightEvidenceFromSqlite, type DurableBattedBallFlight, type SqliteBattedBallFlightStore } from './SqliteBattedBallFlightStore';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { deriveAndRecordFirstGroundContactEvidence } from '../../core/sim/plateAppearance/BattedBallTimelinePhysicalAdapter';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { assertNoBattedWorldMotionOwner } from './BattedWorldMotionOwnershipFence';

type Shape = Readonly<{ role: DefenderPhysicalPrimitiveRole; radius: number; offset: Vec3 }>;
export type AcceptedBattedWorldModel = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; careerId: string; fixtureEventId: string; venueId: string; availableAtDay: number;
  actors: readonly Readonly<{ playerId: string; personId: string; heightMeters: number; bodyOriginHeightMeters: number; primitives: readonly Shape[] }>[];
  batterGripOffset: Vec3; surfaces: readonly BattedWorldSurface[];
}>;
type BattedWorldContactCommandSource = Readonly<{
  sourceId: string; sourceVersion: string; flightSourceId: string; modelSourceId: string; previousContactSourceId: string | null;
  commands: readonly Readonly<{ playerId: string; bodyAcceleration: Vec3;
    primitiveMotions: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole; offsetVelocity: Vec3; offsetAcceleration: Vec3 }>[] }>[];
}>;
export type AcceptedBattedWorldContact = BattedWorldContactCommandSource & (Readonly<{ kind?: never; prePitchRunnerSourceId?: never }>
  | Readonly<{ kind: 'owned_runner_contact_v1'; prePitchRunnerSourceId: string }>);
export type DurableBattedWorldContact = Readonly<{
  source: AcceptedBattedWorldContact; revision: number; model: AcceptedBattedWorldModel; flight: DurableBattedBallFlight;
  modelActorEvidence: readonly Readonly<{ binding: OfficialParticipantBinding; person: ReturnType<typeof readOfficialActorPersonLink> }>[];
  actors: readonly BattedWorldActorPrimitive[]; result: BattedWorldContactResult; timeline: CanonicalPlateAppearanceTimeline;
}>;
export type SqliteBattedWorldContactStore = Readonly<{
  accept(sourceId: string): DurableBattedWorldContact; read(sourceId: string): DurableBattedWorldContact | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedContact(sourceId: string): AcceptedBattedWorldContact | null;
  readAcceptedModel(sourceId: string): AcceptedBattedWorldModel | null }>;
type Row = { source_id: string; physical_pitch_source_id: string; game_id: string; revision: number; previous_source_id: string | null;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: Vec3): boolean => fields(v, ['x', 'y', 'z']) && [v.x, v.y, v.z].every(finite);
const allRoles = (p: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole }>[]) => Array.isArray(p) && p.length === roles.length
  && new Set(p.map((v) => v?.role)).size === roles.length && p.every((v) => roles.includes(v?.role));
const input = (raw: AcceptedBattedWorldContact, sourceId: string): AcceptedBattedWorldContact => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'flightSourceId', 'modelSourceId', 'previousContactSourceId', 'commands', ...('kind' in s ? ['kind', 'prePitchRunnerSourceId'] : [])])
    || 'kind' in s && (s.kind !== 'owned_runner_contact_v1' || !id(s.prePitchRunnerSourceId))
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.flightSourceId, s.modelSourceId].every(id)
    || s.previousContactSourceId !== null && (!id(s.previousContactSourceId) || s.previousContactSourceId === sourceId)
    || !Array.isArray(s.commands) || s.commands.length !== 10 || new Set(s.commands.map((c) => c?.playerId)).size !== 10
    || s.commands.some((c) => !fields(c, ['playerId', 'bodyAcceleration', 'primitiveMotions']) || !id(c.playerId)
      || !vector(c.bodyAcceleration) || !allRoles(c.primitiveMotions) || c.primitiveMotions.some((m: AcceptedBattedWorldContact['commands'][number]['primitiveMotions'][number]) =>
        !fields(m, ['role', 'offsetVelocity', 'offsetAcceleration']) || !vector(m.offsetVelocity) || !vector(m.offsetAcceleration)))) {
    throw new Error('invalid accepted batted World commands');
  }
  return s;
};
const modelInput = (raw: AcceptedBattedWorldModel, sourceId: string): AcceptedBattedWorldModel => {
  const m = cloneInert(raw);
  if (!fields(m, ['sourceId', 'sourceVersion', 'gameId', 'careerId', 'fixtureEventId', 'venueId', 'availableAtDay', 'actors', 'batterGripOffset', 'surfaces'])
    || m.sourceId !== sourceId || ![sourceId, m.sourceVersion, m.gameId, m.careerId, m.fixtureEventId, m.venueId].every(id)
    || !integer(m.availableAtDay) || !vector(m.batterGripOffset) || !Array.isArray(m.actors) || m.actors.length < 10
    || new Set(m.actors.map((a) => a?.playerId)).size !== m.actors.length || new Set(m.actors.map((a) => a?.personId)).size !== m.actors.length
    || m.actors.some((a) => !fields(a, ['playerId', 'personId', 'heightMeters', 'bodyOriginHeightMeters', 'primitives'])
      || !id(a.playerId) || !id(a.personId) || !finite(a.heightMeters) || a.heightMeters <= 0
      || !finite(a.bodyOriginHeightMeters) || a.bodyOriginHeightMeters < 0 || a.bodyOriginHeightMeters > a.heightMeters
      || !allRoles(a.primitives) || a.primitives.some((p: Shape) => !fields(p, ['role', 'radius', 'offset'])
        || !finite(p.radius) || p.radius <= 0 || !vector(p.offset)))
    || !Array.isArray(m.surfaces) || m.surfaces.some((s) => !fields(s, ['surfaceId', 'start', 'end', 'minimumHeight', 'maximumHeight'])
      || !fields(s.start, ['x', 'z']) || !fields(s.end, ['x', 'z']))) throw new Error('invalid accepted batted World model');
  return m;
};

export const battedWorldContactEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownFlights = battedBallFlightEvidenceFromSqlite(db);
  const readModel = (sourceId: string): AcceptedBattedWorldModel | null => {
    const row = db.prepare('SELECT * FROM batted_world_models WHERE source_id=?').get(sourceId) as {
      source_id: string; game_id: string; source_json: string; source_hash: string;
    } | undefined;
    if (!row) return null;
    const m = modelInput(JSON.parse(row.source_json) as AcceptedBattedWorldModel, sourceId);
    if (row.game_id !== m.gameId || row.source_json !== json(m) || row.source_hash !== hash(m)) throw new Error('corrupt batted World model');
    return m;
  };
  const derive = (s: AcceptedBattedWorldContact, m: AcceptedBattedWorldModel, parent: DurableBattedWorldContact | null): DurableBattedWorldContact => {
    const flight = ownFlights.read(s.flightSourceId);
    if (!flight) throw new Error('actual batted World flight is missing');
    const { frame } = flight.physicalPitch, batter = frame.batterActor!, world = frame.world, at = flight.flight.contact.tick;
    const throughTick = at + flight.source.searchDurationTicks, tps = flight.source.execution.ballFlightParameters.ticksPerSecond;
    const ownedRunner = s.kind === 'owned_runner_contact_v1' ? frame.prePitchRunner : undefined;
    const occupied = Object.values(frame.match.bases).filter(v => v !== null);
    if (s.kind === 'owned_runner_contact_v1' ? !ownedRunner || ownedRunner.source.sourceId !== s.prePitchRunnerSourceId
      || ownedRunner.source.physicalActorSourceId !== batter.source.sourceId || occupied.length !== 1 || occupied[0] !== ownedRunner.binding.playerId
      || world.runners.length !== 1 || world.runners[0].playerId !== ownedRunner.binding.playerId
      : world.runners.length || occupied.length) throw new Error('batted World pre-pitch runner body execution is unsupported or differs');
    const commandedBindings = [...batter.defenderBindings, batter.binding];
    const bindings = [...commandedBindings, ...(ownedRunner ? [ownedRunner.binding] : [])];
    if (s.commands.length !== 10 || new Set(s.commands.map(c => c.playerId)).size !== 10) throw new Error('batted World ten original commands differ');
    if (m.gameId !== frame.gameId || m.careerId !== batter.binding.careerId || m.fixtureEventId !== batter.binding.fixtureEventId
      || m.venueId !== flight.source.execution.venueId || m.availableAtDay > batter.binding.gameDay
      || bindings.some((b) => !m.actors.some((a) => b.playerId === a.playerId && b.personId === a.personId))
      || s.commands.some((c) => !commandedBindings.some((b) => b.playerId === c.playerId))) throw new Error('batted World actual Player/Person/fixture scope differs');
    const modelActorEvidence = m.actors.map((a) => {
      const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
        .get(m.gameId, a.playerId) as { binding_json: string } | undefined;
      const binding = row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
      if (!binding || JSON.stringify(binding) !== row!.binding_json || binding.gameId !== m.gameId || binding.careerId !== m.careerId
        || !integer(binding.rosterRevision) || !id(binding.personLinkSourceId)
        || binding.playerId !== a.playerId || binding.personId !== a.personId || binding.gameDay !== batter.binding.gameDay
        || binding.fixtureEventId !== m.fixtureEventId || binding.competitionEditionId !== batter.binding.competitionEditionId
        || !['HOME', 'AWAY'].includes(binding.side) || binding.clubId !== (binding.side === 'HOME'
          ? batter.worldFixture.game.homeClubId : batter.worldFixture.game.awayClubId)) throw new Error('batted World model actor binding differs');
      const person = readOfficialActorPersonLink(db, binding);
      if (person.acceptedAtDay > binding.gameDay || person.rosterRevision > binding.rosterRevision) throw new Error('batted World model Person was unavailable at registration');
      return { binding, person };
    });
    if (!integer(throughTick) || at < world.tick || world.defenders.length !== 9
      || m.actors.find((a) => a.playerId === frame.workload.playerId)?.heightMeters !== frame.release.body.heightMeters) throw new Error('batted World clock or actual pitcher body differs');
    if (s.previousContactSourceId === null ? parent !== null : !parent || parent.source.sourceId !== s.previousContactSourceId
      || parent.result.kind !== 'airborne' || parent.flight.source.physicalPitchSourceId !== flight.source.physicalPitchSourceId
      || parent.flight.source.searchDurationTicks >= flight.source.searchDurationTicks || json(parent.flight.source.execution) !== json(flight.source.execution)
      || json(parent.model) !== json(m) || json(parent.source.commands) !== json(s.commands)
      || parent.source.kind !== s.kind || parent.source.prePitchRunnerSourceId !== s.prePitchRunnerSourceId) throw new Error('batted World original predecessor/model/commands differ');
    const action = flight.physicalPitch.source.request.batter.action;
    if (action.kind !== 'swing') throw new Error('actual batted World swing is missing');
    const swing = sampleBatterSwingState(action.swing.stateAtStart, at - action.swing.startTick, action.swing.ticksPerSecond);
    const actors: BattedWorldActorPrimitive[] = [];
    for (const a of m.actors.filter((v) => bindings.some((b) => b.playerId === v.playerId))) {
      if (ownedRunner && a.playerId === ownedRunner.binding.playerId) {
        actors.push(...prePitchRunnerContactPrimitives(ownedRunner.source, ownedRunner.canonical, ownedRunner.controller,
          a.primitives, a.bodyOriginHeightMeters, at, throughTick, tps));
        continue;
      }
      const command = s.commands.find((c) => c.playerId === a.playerId)!;
      let body: DefenderBodyKinematicsSegment;
      if (a.playerId === batter.binding.playerId) {
        body = { startTick: at, endTick: throughTick, ticksPerSecond: tps,
          startPosition: { x: swing.pose.grip.x - m.batterGripOffset.x, y: swing.pose.grip.y - m.batterGripOffset.y, z: swing.pose.grip.z - m.batterGripOffset.z },
          startVelocity: swing.linearVelocity, acceleration: command.bodyAcceleration };
      } else {
        const d = world.defenders.find((v) => v.playerId === a.playerId);
        if (!d || command.bodyAcceleration.y !== 0) throw new Error('batted World actual defender motion differs');
        const original = projectDefenderBodyKinematicsSegment({ startTick: world.tick, endTick: throughTick, ticksPerSecond: tps,
          startPosition: d.position, startVelocity: d.velocity, acceleration: { x: command.bodyAcceleration.x, z: command.bodyAcceleration.z }, target: null }, a.bodyOriginHeightMeters);
        const sample = sampleDefenderBodyKinematicsSegment(original, at);
        body = { startTick: at, endTick: throughTick, ticksPerSecond: tps,
          startPosition: sample.position, startVelocity: sample.velocity, acceleration: sample.acceleration };
      }
      for (const p of a.primitives) {
        const motion = command.primitiveMotions.find((v) => v.role === p.role)!;
        actors.push({ playerId: a.playerId, primitive: composeDefenderPhysicalPrimitiveSegment(body, {
          role: p.role, radius: p.radius, startTick: at, endTick: throughTick, ticksPerSecond: tps,
          startOffset: p.offset, offsetVelocity: motion.offsetVelocity, offsetAcceleration: motion.offsetAcceleration }) });
      }
    }
    const result = deriveFirstBattedWorldContact({ flight: flight.flight, parameters: flight.source.execution.ballFlightParameters, throughTick, actors, surfaces: m.surfaces });
    let timeline = flight.physicalPitch.result.pitch.resolution.timeline;
    if (result.kind === 'contact' && result.contacts.length === 1 && result.contacts[0].kind === 'ground') {
      const ground = deriveAndRecordFirstGroundContactEvidence({ timeline, field: flight.source.execution.field,
        searchDurationTicks: result.tick - at, ballFlightParameters: flight.source.execution.ballFlightParameters });
      if (ground.kind !== 'recorded' || ground.territory.tick !== result.tick) throw new Error('batted World first ground timeline differs');
      timeline = ground.timeline;
    }
    return freeze({ source: s, revision: (parent?.revision ?? 0) + 1, model: m, modelActorEvidence, flight, actors, result, timeline });
  };
  const read = (sourceId: string, seen = new Set<string>()): DurableBattedWorldContact | null => {
    if (!id(sourceId)) throw new Error('invalid batted World scope'); if (seen.has(sourceId)) throw new Error('cyclic batted World contact archive'); seen.add(sourceId);
    const row = db.prepare('SELECT * FROM batted_world_contacts WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const s = input(JSON.parse(row.source_json) as AcceptedBattedWorldContact, sourceId), m = readModel(s.modelSourceId);
    if (!m) throw new Error('original batted World model is missing');
    const parent = s.previousContactSourceId === null ? null : read(s.previousContactSourceId, seen), value = derive(s, m, parent);
    if (row.physical_pitch_source_id !== value.flight.source.physicalPitchSourceId || row.game_id !== m.gameId || row.revision !== value.revision
      || row.previous_source_id !== s.previousContactSourceId || row.source_json !== json(s) || row.source_hash !== hash(s)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original batted World archive');
    return value;
  };
  const head = (physicalPitchSourceId: string) => {
    const current = db.prepare('SELECT source_id,revision FROM batted_world_contact_heads WHERE physical_pitch_source_id=?').get(physicalPitchSourceId);
    const last = db.prepare('SELECT source_id,revision FROM batted_world_contacts WHERE physical_pitch_source_id=? ORDER BY revision DESC LIMIT 1').get(physicalPitchSourceId);
    const count = db.prepare('SELECT count(*) AS n,min(revision) AS first_revision FROM batted_world_contacts WHERE physical_pitch_source_id=?').get(physicalPitchSourceId)!;
    if (json(current ?? null) !== json(last ?? null) || count.n !== (current?.revision ?? 0)
      || current && (!integer(current.revision) || count.first_revision !== 1)) throw new Error('batted World head or prefix differs');
    return current as { source_id: string; revision: number } | undefined;
  };
  const predecessor = (s: AcceptedBattedWorldContact, physicalId: string) => {
    const current = head(physicalId);
    if ((current?.source_id ?? null) !== s.previousContactSourceId) throw new Error('batted World current predecessor differs');
    return current ? read(current.source_id) : null;
  };
  const sameModel = (m: AcceptedBattedWorldModel) => {
    const current = db.prepare('SELECT source_id FROM batted_world_models WHERE game_id=?').get(m.gameId) as { source_id: string } | undefined;
    if (current && (current.source_id !== m.sourceId || json(readModel(current.source_id)) !== json(m))) throw new Error('batted World game model is frozen differently');
  };
  return { read, readModel, derive, head, predecessor, sameModel, ownFlights };
};

/** Legacy ten actors, or a versioned eleventh original runner within its prospectively owned analytic interval. Rules remain separate. */
export const openSqliteBattedWorldContactStore = (path: string, flights: Pick<SqliteBattedBallFlightStore, 'read'>,
  authority?: Authority): SqliteBattedWorldContactStore => {
  if (!id(path) || typeof flights?.read !== 'function' || authority != null
    && (typeof authority.readAcceptedContact !== 'function' || typeof authority.readAcceptedModel !== 'function')) throw new Error('invalid batted World sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_models (source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS batted_world_contacts (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,game_id TEXT NOT NULL,
    revision INTEGER NOT NULL,previous_source_id TEXT,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_contact_heads (physical_pitch_source_id TEXT PRIMARY KEY,source_id TEXT NOT NULL,revision INTEGER NOT NULL);`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted World scope'); };
  const { read, readModel, derive, head, predecessor, sameModel, ownFlights } = battedWorldContactEvidenceFromSqlite(db);
  return Object.freeze({
    read(sourceId) { check(sourceId); return read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = read(sourceId), raw = authority?.readAcceptedContact(sourceId) ?? null, s = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (s && json(s) !== json(prior.source)) throw new Error('batted World commands are frozen differently');
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted World original evidence changed during retry');
        return original;
      }
      if (!s) throw new Error('accepted batted World commands are missing');
      const originalModel = readModel(s.modelSourceId), rawModel = authority?.readAcceptedModel(s.modelSourceId) ?? null;
      const m = rawModel === null ? originalModel : modelInput(rawModel, s.modelSourceId);
      if (!m) throw new Error('accepted batted World model is missing');
      sameModel(m);
      const flight = ownFlights.read(s.flightSourceId);
      if (!flight) throw new Error('actual batted World flight is missing');
      assertNoBattedWorldMotionOwner(db, flight.source.physicalPitchSourceId);
      const value = derive(s, m, predecessor(s, flight.source.physicalPitchSourceId)); ownFlights.openFrame(value.flight.physicalPitch);
      const peer = flights.read(s.flightSourceId);
      if (!peer || json(peer) !== json(value.flight)) throw new Error('batted World peer flight differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, flight.source.physicalPitchSourceId, { owner: 'batted_world_contacts', sourceId });
        sameModel(m); ownFlights.openFrame(value.flight.physicalPitch);
        assertNoBattedWorldMotionOwner(db, flight.source.physicalPitchSourceId);
        if (json(derive(s, m, predecessor(s, flight.source.physicalPitchSourceId))) !== json(value)) throw new Error('batted World original evidence changed before write');
        if (!readModel(m.sourceId)) db.prepare('INSERT INTO batted_world_models VALUES (?,?,?,?)').run(m.sourceId, m.gameId, json(m), hash(m));
        db.prepare('INSERT INTO batted_world_contacts VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, flight.source.physicalPitchSourceId, m.gameId,
          value.revision, s.previousContactSourceId, json(s), hash(s), json(value), hash(value));
        db.prepare('INSERT INTO batted_world_contact_heads VALUES (?,?,?) ON CONFLICT(physical_pitch_source_id) DO UPDATE SET source_id=excluded.source_id,revision=excluded.revision')
          .run(flight.source.physicalPitchSourceId, sourceId, value.revision);
        recordActualLivePlayAdmission(db, liveFence);
        ownFlights.openFrame(value.flight.physicalPitch); sameModel(m);
        assertNoBattedWorldMotionOwner(db, flight.source.physicalPitchSourceId);
        const saved = read(sourceId);
        if (json(saved) !== json(value) || json(head(flight.source.physicalPitchSourceId)) !== json({ source_id: sourceId, revision: value.revision })) throw new Error('batted World evidence changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved!;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
