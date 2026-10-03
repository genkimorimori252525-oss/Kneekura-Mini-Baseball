import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { deriveBattedWorldMotion, type BattedWorldMotion } from '../../core/sim/ball/BattedWorldMotion';
import { deriveBattedWorldContinuation, type BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite, type DurableBattedContactResponse, type SqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { battedWorldContinuationEvidenceFromSqlite, battedWorldResponseInput, type DurableBattedWorldContinuation } from './SqliteBattedWorldContinuationStore';
import { battedWorldAcquisitionEvidenceFromSqlite, type DurableBattedWorldAcquisition } from './SqliteBattedWorldAcquisitionStore';
import { assertNoBattedWorldExecutionOwner } from './BattedWorldMotionOwnershipFence';

type Command = Readonly<{ playerId: string; bodyAcceleration: Vec3;
  primitiveMotions: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole; offsetAcceleration: Vec3 }>[] }>;
export type AcceptedBattedWorldMotion = Readonly<{
  sourceId: string; sourceVersion: string; responseSourceId: string; continuationSourceId: string | null;
  acquisitionSourceId: string | null; previousMotionSourceId: string | null; availableAtTick: number; throughTick: number;
  commands: readonly Command[];
}>;
type Root = Readonly<{ response: DurableBattedContactResponse; continuation: DurableBattedWorldContinuation | null; acquisition: DurableBattedWorldAcquisition | null }>;
export type DurableBattedWorldMotion = Root & Readonly<{
  source: AcceptedBattedWorldMotion; revision: number; history: readonly AcceptedBattedWorldMotion[]; motion: BattedWorldMotion;
}>;
export type SqliteBattedWorldMotionStore = Readonly<{
  accept(sourceId: string): DurableBattedWorldMotion; read(sourceId: string): DurableBattedWorldMotion | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedMotion(sourceId: string): AcceptedBattedWorldMotion | null }>;
type Row = { source_id: string; physical_pitch_source_id: string; response_source_id: string; continuation_source_id: string | null;
  acquisition_source_id: string | null; previous_source_id: string | null; revision: number; game_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; response_source_id: string; source_id: string; revision: number };
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, expected: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const vector = (value: Vec3) => fields(value, ['x', 'y', 'z']) && [value.x, value.y, value.z].every(Number.isFinite);
export const battedWorldMotionCommandsInput = (raw: AcceptedBattedWorldMotion['commands']): AcceptedBattedWorldMotion['commands'] => {
  const commands = cloneInert(raw);
  if (!Array.isArray(commands) || commands.length !== 10 || new Set(commands.map((command) => command?.playerId)).size !== 10
    || commands.some((command) => !fields(command, ['playerId', 'bodyAcceleration', 'primitiveMotions']) || !id(command.playerId) || !vector(command.bodyAcceleration)
      || !Array.isArray(command.primitiveMotions) || command.primitiveMotions.length !== roles.length
      || new Set(command.primitiveMotions.map((motion: Command['primitiveMotions'][number]) => motion?.role)).size !== roles.length
      || command.primitiveMotions.some((motion: Command['primitiveMotions'][number]) => !fields(motion, ['role', 'offsetAcceleration']) || !roles.includes(motion.role) || !vector(motion.offsetAcceleration)))) {
    throw new Error('invalid accepted batted World motion commands');
  }
  return commands;
};
export const battedWorldMotionPrimitiveCommands = (response: DurableBattedContactResponse, commands: AcceptedBattedWorldMotion['commands']) => {
  const world = response.touch.worldContact, batterId = world.flight.physicalPitch.frame.batterActor!.binding.playerId;
  if (commands.some((command) => !world.actors.some((actor) => actor.playerId === command.playerId)
    || command.playerId !== batterId && command.bodyAcceleration.y !== 0)) throw new Error('actual batted motion actor command scope differs');
  return commands.flatMap((command) => command.primitiveMotions.map((motion) => ({ playerId: command.playerId, role: motion.role,
    acceleration: { x: command.bodyAcceleration.x + motion.offsetAcceleration.x, y: command.bodyAcceleration.y + motion.offsetAcceleration.y,
      z: command.bodyAcceleration.z + motion.offsetAcceleration.z } })));
};
const input = (raw: AcceptedBattedWorldMotion, sourceId: string): AcceptedBattedWorldMotion => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'responseSourceId', 'continuationSourceId', 'acquisitionSourceId', 'previousMotionSourceId', 'availableAtTick', 'throughTick', 'commands'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.responseSourceId].every(id)
    || [source.continuationSourceId, source.acquisitionSourceId, source.previousMotionSourceId].some((value) => value !== null && !id(value))
    || source.previousMotionSourceId === sourceId || !tick(source.availableAtTick) || !tick(source.throughTick)) {
    throw new Error('invalid accepted batted World motion Source');
  }
  return { ...source, commands: battedWorldMotionCommandsInput(source.commands) };
};
const physicalId = (response: DurableBattedContactResponse) => response.touch.worldContact.flight.source.physicalPitchSourceId;
const sameRoot = (left: AcceptedBattedWorldMotion, right: AcceptedBattedWorldMotion) => left.responseSourceId === right.responseSourceId
  && left.continuationSourceId === right.continuationSourceId && left.acquisitionSourceId === right.acquisitionSourceId;

/** Actual future execution is reconstructed from immutable own Sources, never from a transported World or controller snapshot. */
export const battedWorldMotionEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownResponses = battedContactResponseEvidenceFromSqlite(db), ownContinuations = battedWorldContinuationEvidenceFromSqlite(db),
    ownAcquisitions = battedWorldAcquisitionEvidenceFromSqlite(db);
  const has = (table: string) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const root = (source: AcceptedBattedWorldMotion): Root => {
    const response = ownResponses.read(source.responseSourceId);
    if (!response) throw new Error('original batted motion response is missing');
    const prefixes = has('batted_world_continuations') ? ownContinuations.scope(response) : [];
    const continuation = source.continuationSourceId === null ? null : prefixes.find((value) => value.source.sourceId === source.continuationSourceId) ?? null;
    if (source.continuationSourceId !== null && !continuation) throw new Error('original batted motion continuation is missing');
    const acquisition = source.acquisitionSourceId === null ? null : has('batted_world_acquisitions') ? ownAcquisitions.read(source.acquisitionSourceId) : null;
    if (source.acquisitionSourceId !== null && (!acquisition || acquisition.source.continuationSourceId !== source.continuationSourceId
      || json(acquisition.response) !== json(response))) throw new Error('original batted motion acquisition scope differs');
    return { response, continuation, acquisition };
  };
  const execute = (source: AcceptedBattedWorldMotion, original: Root, previous: DurableBattedWorldMotion | null): DurableBattedWorldMotion => {
    const response = battedWorldResponseInput(original.response), originalWorld = original.response.touch.worldContact;
    let cursor: BattedWorldBallCursor | null, carrierPlayerId: string | null = null;
    if (previous) { cursor = previous.motion.cursor; carrierPlayerId = previous.motion.carrierPlayerId; }
    else if (original.acquisition) {
      const acquired = original.acquisition.result;
      if (acquired.kind !== 'secured') throw new Error('actual batted motion acquisition is unresolved');
      carrierPlayerId = acquired.acquirerPlayerId;
      cursor = { moment: acquired.moment, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
    } else cursor = deriveBattedWorldContinuation({ response, throughTicks: original.continuation?.history.map((value) => value.throughTick) ?? [] }).cursor;
    if (!cursor) throw new Error('actual batted motion candidate or contact is unresolved');
    const commands = battedWorldMotionPrimitiveCommands(original.response, source.commands);
    const motion = deriveBattedWorldMotion({ response, cursor, actors: previous?.motion.actors ?? originalWorld.actors, carrierPlayerId,
      commands, availableAtTick: source.availableAtTick, throughTick: source.throughTick });
    return freeze({ ...original, source, revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source], motion });
  };
  const scope = (original: Root): readonly DurableBattedWorldMotion[] => {
    const pitchId = physicalId(original.response), responseId = original.response.source.sourceId;
    const rows = db.prepare("SELECT * FROM batted_world_motions WHERE physical_pitch_source_id=? OR response_source_id=? OR json_extract(source_json,'$.responseSourceId')=? ORDER BY revision")
      .all(pitchId, responseId, responseId) as Row[];
    const heads = db.prepare('SELECT * FROM batted_world_motion_heads WHERE physical_pitch_source_id=? OR response_source_id=?').all(pitchId, responseId) as Head[];
    if (!rows.length) { if (heads.length) throw new Error('unowned batted motion head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.response_source_id !== responseId
      || head.source_id !== rows.at(-1)!.source_id || head.revision !== rows.length) throw new Error('batted motion original prefix head differs');
    const values: DurableBattedWorldMotion[] = [];
    for (const row of rows) {
      const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldMotion, row.source_id), previous = values.at(-1) ?? null;
      if (source.responseSourceId !== responseId || previous && !sameRoot(source, previous.source)
        || source.continuationSourceId !== (original.continuation?.source.sourceId ?? null) || source.acquisitionSourceId !== (original.acquisition?.source.sourceId ?? null)
        || source.previousMotionSourceId !== (previous?.source.sourceId ?? null) || row.physical_pitch_source_id !== pitchId
        || row.response_source_id !== responseId || row.continuation_source_id !== source.continuationSourceId || row.acquisition_source_id !== source.acquisitionSourceId
        || row.previous_source_id !== source.previousMotionSourceId || row.game_id !== original.response.model.gameId
        || row.revision !== values.length + 1 || row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('corrupt original batted motion Source prefix');
      const value = execute(source, original, previous);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original batted motion snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableBattedWorldMotion | null => {
    if (!id(sourceId)) throw new Error('invalid batted motion scope');
    const row = db.prepare('SELECT * FROM batted_world_motions WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldMotion, sourceId), value = scope(root(source)).find((item) => item.source.sourceId === sourceId);
    if (!value) throw new Error('batted motion Source is outside its own original prefix');
    return value;
  };
  const derive = (source: AcceptedBattedWorldMotion): DurableBattedWorldMotion => {
    const original = root(source), values = scope(original), previous = values.at(-1) ?? null;
    if (source.previousMotionSourceId !== (previous?.source.sourceId ?? null) || previous && !sameRoot(source, previous.source)) {
      throw new Error('batted motion predecessor or original scope differs');
    }
    return execute(source, original, previous);
  };
  const currentRoot = (value: DurableBattedWorldMotion) => {
    ownResponses.current(value.response);
    const latest = has('batted_world_continuations') ? ownContinuations.scope(value.response).at(-1) : null;
    if ((latest?.source.sourceId ?? null) !== value.source.continuationSourceId) throw new Error('batted motion original continuation is no longer current');
    if (json(root(value.source)) !== json({ response: value.response, continuation: value.continuation, acquisition: value.acquisition })) {
      throw new Error('batted motion original evidence changed during write');
    }
  };
  const currentBefore = (value: DurableBattedWorldMotion) => { assertNoBattedWorldExecutionOwner(db, physicalId(value.response)); currentRoot(value);
    if (json(derive(value.source)) !== json(value)) throw new Error('batted motion original changed before write'); };
  const current = (value: DurableBattedWorldMotion) => { currentRoot(value); const values = scope(value);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('batted motion current prefix changed during write'); };
  return { read, derive, scope, currentBefore, current, ownResponses, ownContinuations, ownAcquisitions };
};

export const openSqliteBattedWorldMotionStore = (path: string, responses: Pick<SqliteBattedContactResponseStore, 'read'>,
  authority?: Authority): SqliteBattedWorldMotionStore => {
  if (!id(path) || typeof responses?.read !== 'function' || authority != null && typeof authority.readAcceptedMotion !== 'function') throw new Error('invalid batted motion sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_motions (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,response_source_id TEXT NOT NULL,
    continuation_source_id TEXT,acquisition_source_id TEXT,previous_source_id TEXT,revision INTEGER NOT NULL,game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_motion_heads (physical_pitch_source_id TEXT PRIMARY KEY,response_source_id TEXT NOT NULL,source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  const own = battedWorldMotionEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted motion scope'); };
  return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedMotion(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('batted motion Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted motion original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted batted motion Source is missing');
      const value = own.derive(source); own.currentBefore(value); const peer = responses.read(source.responseSourceId);
      if (!peer || json(peer) !== json(value.response)) throw new Error('batted motion peer response differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        own.currentBefore(value); const pitchId = physicalId(value.response);
        db.prepare('INSERT INTO batted_world_motions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, pitchId, source.responseSourceId,
          source.continuationSourceId, source.acquisitionSourceId, source.previousMotionSourceId, value.revision, value.response.model.gameId,
          json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_motion_heads VALUES (?,?,?,?)').run(pitchId, source.responseSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_motion_heads SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND response_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, source.responseSourceId, source.previousMotionSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('batted motion predecessor changed during write');
        }
        assertNoBattedWorldExecutionOwner(db, pitchId); own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('batted motion original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
