import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldFieldMotion, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBattedWorldFieldAcquisition, type BattedWorldFieldAcquisition } from '../../core/sim/ball/BattedWorldFieldAcquisition';
import { deriveBattedWorldFieldThrow, type BattedWorldFieldThrow } from '../../core/sim/ball/BattedWorldFieldThrow';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionCommandsInput, battedWorldMotionPrimitiveCommands, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction, type SqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

type Action = Readonly<{ kind: 'acquisition' }>
  | Readonly<{ kind: 'motion'; availableAtTick: number; throughTick: number; commands: AcceptedBattedWorldMotion['commands'] }>
  | Readonly<{ kind: 'throw'; availableAtTick: number; throughTick: number; commands: AcceptedBattedWorldMotion['commands'];
    modelSourceId: string; receiverPlayerId: string }>;
export type AcceptedBattedWorldFieldExecution = Readonly<{ sourceId: string; sourceVersion: string;
  baseFieldSourceId: string; previousExecutionSourceId: string | null; action: Action }>;
type Execution = Readonly<{ kind: 'motion'; field: BattedWorldFieldMotion }>
  | Readonly<{ kind: 'acquisition'; field: BattedWorldFieldMotion; acquisition: BattedWorldFieldAcquisition }>
  | Readonly<{ kind: 'throw'; field: BattedWorldFieldMotion; model: DurablePlayerFieldingModel; throw: BattedWorldFieldThrow }>;
export type DurableBattedWorldFieldExecution = Readonly<{ source: AcceptedBattedWorldFieldExecution; baseField: DurableBattedWorldFieldAction;
  revision: number; history: readonly AcceptedBattedWorldFieldExecution[]; execution: Execution }>;
export type SqliteBattedWorldFieldExecutionStore = Readonly<{ accept(sourceId: string): DurableBattedWorldFieldExecution;
  read(sourceId: string): DurableBattedWorldFieldExecution | null; close(): void }>;
type Authority = Readonly<{ readAcceptedExecution(sourceId: string): AcceptedBattedWorldFieldExecution | null }>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Row = { source_id: string; physical_pitch_source_id: string; base_field_source_id: string; previous_source_id: string | null;
  revision: number; game_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; base_field_source_id: string; source_id: string; revision: number };
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const input = (raw: AcceptedBattedWorldFieldExecution, sourceId: string): AcceptedBattedWorldFieldExecution => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'baseFieldSourceId', 'previousExecutionSourceId', 'action'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.baseFieldSourceId].every(id)
    || source.previousExecutionSourceId !== null && (!id(source.previousExecutionSourceId) || source.previousExecutionSourceId === sourceId)) {
    throw new Error('invalid accepted actual field execution Source');
  }
  const action = source.action;
  if (action?.kind === 'acquisition' && fields(action, ['kind'])) return source;
  if (action?.kind !== 'motion' && action?.kind !== 'throw'
    || !fields(action, ['kind', 'availableAtTick', 'throughTick', 'commands', ...(action.kind === 'throw' ? ['modelSourceId', 'receiverPlayerId'] : [])])
    || !tick(action.availableAtTick) || !tick(action.throughTick)
    || action.kind === 'throw' && (!id(action.modelSourceId) || !id(action.receiverPlayerId))) throw new Error('invalid accepted actual field execution action');
  return { ...source, action: { ...action, commands: battedWorldMotionCommandsInput(action.commands) } };
};
const physicalId = (field: DurableBattedWorldFieldAction) => field.response.touch.worldContact.flight.source.physicalPitchSourceId;

/** One directed execution owner; historical reads replay only their original causal payload prefix. */
export const battedWorldFieldExecutionEvidenceFromSqlite = (db: Db) => {
  const ownFields = battedWorldFieldEvidenceFromSqlite(db), ownFielding = playerFieldingModelEvidenceFromSqlite(db);
  const root = (source: AcceptedBattedWorldFieldExecution) => {
    const value = ownFields.read(source.baseFieldSourceId);
    if (!value) throw new Error('actual field execution original field is missing');
    return value;
  };
  const execute = (source: AcceptedBattedWorldFieldExecution, baseField: DurableBattedWorldFieldAction,
    previous: DurableBattedWorldFieldExecution | null): DurableBattedWorldFieldExecution => {
    const prior = previous?.execution, original = prior?.field ?? baseField.field, motion = original.motion;
    const response = battedWorldResponseInput(baseField.response), geometry = baseField.geometry.geometry;
    let execution: Execution;
    if (source.action.kind === 'acquisition') {
      if (prior?.kind === 'acquisition') throw new Error('actual field acquisition is already resolved');
      execution = { kind: 'acquisition', field: original, acquisition: deriveBattedWorldFieldAcquisition({ response, geometry, field: original }) };
    } else {
      let cursor: BattedWorldBallCursor | null = motion.cursor, carrierPlayerId = motion.carrierPlayerId;
      if (prior?.kind === 'acquisition') {
        const acquired = prior.acquisition;
        if (acquired.kind !== 'secured') throw new Error('actual field acquisition remains unresolved');
        carrierPlayerId = acquired.acquirerPlayerId;
        cursor = { moment: acquired.moment, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
      }
      if (!cursor) throw new Error('actual field execution capture or contact remains unresolved');
      const motionInput = { response, geometry, actors: motion.actors, cursor, carrierPlayerId,
        availableAtTick: source.action.availableAtTick, throughTick: source.action.throughTick,
        commands: battedWorldMotionPrimitiveCommands(baseField.response, source.action.commands) };
      if (source.action.kind === 'motion') execution = { kind: 'motion', field: deriveBattedWorldFieldMotion(motionInput) };
      else {
        const action = source.action, world = baseField.response.touch.worldContact, frame = world.flight.physicalPitch.frame;
        const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrierPlayerId), model = ownFielding.read(action.modelSourceId);
        if (!carrierPlayerId || !actor || !model || !frame.batterActor!.defenderBindings.some((binding) => binding.playerId === carrierPlayerId)
          || !frame.batterActor!.defenderBindings.some((binding) => binding.playerId === action.receiverPlayerId)
          || model.source.playerId !== carrierPlayerId || model.source.careerId !== actor.binding.careerId
          || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.person) !== json(actor.person)
          || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('actual field throw Player model or active receiver scope differs');
        const result = deriveBattedWorldFieldThrow({ ...motionInput, carrierPlayerId, receiverPlayerId: action.receiverPlayerId,
          ratings: model.source.ratings, transferParameters: model.source.transferParameters, throwCalibration: model.source.throwCalibration,
          seed: { matchSeed: frame.matchSeed, playId: frame.match.playId, streamKey: json(['batted_world_field_throw', source.sourceId, carrierPlayerId]) } });
        execution = { kind: 'throw', field: result.field, model, throw: result };
      }
    }
    return freeze({ source, baseField, revision: (previous?.revision ?? 0) + 1,
      history: [...(previous?.history ?? []), source], execution });
  };
  const scope = (baseField: DurableBattedWorldFieldAction, throughSourceId?: string): readonly DurableBattedWorldFieldExecution[] => {
    const pitchId = physicalId(baseField), baseId = baseField.source.sourceId;
    const owners = `physical_pitch_source_id=? OR base_field_source_id=?
      OR CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.baseFieldSourceId') END=?
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId') END=?`;
    const rows = db.prepare(`SELECT * FROM batted_world_field_executions WHERE ${owners} ORDER BY revision`).all(pitchId, baseId, baseId, pitchId) as Row[];
    const heads = db.prepare(`SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=? OR base_field_source_id=?
      OR source_id IN (SELECT source_id FROM batted_world_field_executions WHERE ${owners})`).all(pitchId, baseId, pitchId, baseId, baseId, pitchId) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual field execution head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.base_field_source_id !== baseId
      || head.source_id !== rows.at(-1)!.source_id || !tick(head.revision) || head.revision !== rows.length) throw new Error('actual field execution prefix head differs');
    const unique = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!id(row.source_id) || unique.has(row.source_id) || !tick(row.revision) || row.revision !== index + 1
        || row.physical_pitch_source_id !== pitchId || row.base_field_source_id !== baseId
        || row.previous_source_id !== (rows[index - 1]?.source_id ?? null) || row.game_id !== baseField.response.model.gameId) {
        throw new Error('corrupt actual field execution prefix metadata');
      }
      unique.add(row.source_id);
    }
    const bound = throughSourceId === undefined ? rows.length - 1 : rows.findIndex((row) => row.source_id === throughSourceId);
    if (bound < 0) throw new Error('actual field execution Source is outside original prefix');
    const values: DurableBattedWorldFieldExecution[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldFieldExecution, row.source_id);
      if (source.baseFieldSourceId !== baseId || source.previousExecutionSourceId !== row.previous_source_id
        || row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('corrupt original actual field execution Source');
      const value = execute(source, baseField, values.at(-1) ?? null);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt actual field execution snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableBattedWorldFieldExecution | null => {
    if (!id(sourceId)) throw new Error('invalid actual field execution scope');
    const row = db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldFieldExecution, sourceId);
    return scope(root(source), sourceId).at(-1)!;
  };
  const derive = (source: AcceptedBattedWorldFieldExecution) => {
    const baseField = root(source), previous = scope(baseField).at(-1) ?? null;
    if (source.previousExecutionSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual field execution predecessor differs');
    return execute(source, baseField, previous);
  };
  const currentRoot = (value: DurableBattedWorldFieldExecution) => {
    ownFields.current(value.baseField);
    if (json(root(value.source)) !== json(value.baseField)) throw new Error('actual field execution original changed during write');
  };
  const currentBefore = (value: DurableBattedWorldFieldExecution) => {
    currentRoot(value); if (json(derive(value.source)) !== json(value)) throw new Error('actual field execution prefix changed before write');
  };
  const current = (value: DurableBattedWorldFieldExecution) => {
    currentRoot(value); const values = scope(value.baseField);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('actual field execution prefix changed during write');
  };
  return { read, derive, scope, currentBefore, current };
};

export const openSqliteBattedWorldFieldExecutionStore = (path: string, fieldsOwner: Pick<SqliteBattedWorldFieldStore, 'read'>,
  authority?: Authority): SqliteBattedWorldFieldExecutionStore => {
  if (!id(path) || typeof fieldsOwner?.read !== 'function' || authority != null && typeof authority.readAcceptedExecution !== 'function') {
    throw new Error('invalid actual field execution owners');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_field_executions (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
    base_field_source_id TEXT NOT NULL,previous_source_id TEXT,revision INTEGER NOT NULL,game_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_field_execution_heads (physical_pitch_source_id TEXT PRIMARY KEY,base_field_source_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  const own = battedWorldFieldExecutionEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual field execution scope'); };
  return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedExecution(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual field execution Source is frozen differently');
        const saved = own.read(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('actual field execution original changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual field execution Source is missing');
      const value = own.derive(source); own.currentBefore(value); const peer = fieldsOwner.read(source.baseFieldSourceId);
      if (!peer || json(peer) !== json(value.baseField)) throw new Error('actual field execution peer original differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        own.currentBefore(value); const pitchId = physicalId(value.baseField);
        db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(sourceId, pitchId, source.baseFieldSourceId,
          source.previousExecutionSourceId, value.revision, value.baseField.response.model.gameId, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,?)').run(pitchId, source.baseFieldSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_field_execution_heads SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND base_field_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, source.baseFieldSourceId, source.previousExecutionSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('actual field execution predecessor changed during write');
        }
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual field execution original changed during write'); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
