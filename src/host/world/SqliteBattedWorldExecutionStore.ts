import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldMotionAcquisition, type BattedWorldAcquisition } from '../../core/sim/ball/BattedWorldAcquisition';
import { deriveBattedWorldMotion, type BattedWorldMotion } from '../../core/sim/ball/BattedWorldMotion';
import { deriveBattedWorldThrow, type BattedWorldThrow } from '../../core/sim/ball/BattedWorldThrow';
import { findBattedWorldControlledBaseContact } from '../../core/sim/ball/BattedWorldControlledBaseContact';
import { findBattedWorldPlayerBaseContact } from '../../core/sim/ball/BattedWorldPlayerBaseContact';
import type { BallWorldFootBaseContact } from '../../core/sim/ball/BallWorldFootBaseContact';
import type { BallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import type { BallWorldControlledBaseContact } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { createRunnerBaseFactsFromBallWorldHistory, createControlledBaseFactsFromBallWorldContacts } from '../../core/rules/BallWorldBaseContactPhysicalAdapter';
import type { RunnerBaseTouchFact, RunnerBaseDepartureFact, ControlledBaseContactFact } from '../../core/rules/PhysicalRuleFacts';
import { battedWorldFirstBaseRuleFromPrefix, battedWorldFirstBaseRaceFromPrefix } from './BattedWorldFirstBaseRuleFromPrefix';
import type { BattedWorldBaseId } from '../../core/sim/ball/BattedWorldBaseGeometry';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldBaseTouchHistoryFromPrefix } from './BattedWorldBaseTouchHistoryFromPrefix';
import { assertNoBattedWorldFieldOwner } from './BattedWorldMotionOwnershipFence';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { battedWorldBaseGeometryEvidenceFromSqlite, battedWorldFrameBaseCenters, type DurableBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { battedWorldMotionEvidenceFromSqlite, battedWorldMotionCommandsInput, battedWorldMotionPrimitiveCommands,
  type AcceptedBattedWorldMotion, type DurableBattedWorldMotion, type SqliteBattedWorldMotionStore } from './SqliteBattedWorldMotionStore';

type Action = Readonly<{ kind: 'acquisition' }> | Readonly<{ kind: 'base_contact'; geometrySourceId: string; base: BattedWorldBaseId }>
  | Readonly<{ kind: 'runner_base_touch'; geometrySourceId: string; playerId: string; base: BattedWorldBaseId }>
  | Readonly<{ kind: 'base_touch_history'; geometrySourceId: string; playerId: string; base: BattedWorldBaseId }>
  | Readonly<{ kind: 'first_base_rule'; geometrySourceId: string }>
  | Readonly<{ kind: 'first_base_race'; geometrySourceId: string }>
  | Readonly<{ kind: 'motion'; availableAtTick: number; throughTick: number;
  commands: AcceptedBattedWorldMotion['commands'] }> | Readonly<{ kind: 'throw'; modelSourceId: string; receiverPlayerId: string;
  availableAtTick: number; throughTick: number; commands: AcceptedBattedWorldMotion['commands'] }>;
export type AcceptedBattedWorldExecution = Readonly<{
  sourceId: string; sourceVersion: string; baseMotionSourceId: string; previousExecutionSourceId: string | null; action: Action;
}>;
type Execution = Readonly<{ kind: 'motion'; motion: BattedWorldMotion }>
  | (Readonly<{ kind: 'first_base_rule'; geometry: DurableBattedWorldBaseGeometry; motion: BattedWorldMotion }>
    & ReturnType<typeof battedWorldFirstBaseRuleFromPrefix>)
  | (Readonly<{ kind: 'first_base_race'; geometry: DurableBattedWorldBaseGeometry; motion: BattedWorldMotion }>
    & ReturnType<typeof battedWorldFirstBaseRaceFromPrefix>)
  | Readonly<{ kind: 'base_touch_history'; geometry: DurableBattedWorldBaseGeometry; playerId: string; base: BattedWorldBaseId;
    history: BallWorldPlayerBaseContactHistory; controlledContacts: readonly BallWorldControlledBaseContact[];
    physicalRuleFacts: readonly (RunnerBaseTouchFact | RunnerBaseDepartureFact | ControlledBaseContactFact)[]; motion: BattedWorldMotion }>
  | Readonly<{ kind: 'base_contact'; geometry: DurableBattedWorldBaseGeometry; contact: BallWorldFootBaseContact | null; motion: BattedWorldMotion }>
  | Readonly<{ kind: 'runner_base_touch'; geometry: DurableBattedWorldBaseGeometry; playerId: string; base: BattedWorldBaseId;
    contact: BallWorldFootBaseContact | null; motion: BattedWorldMotion }>
  | Readonly<{ kind: 'acquisition'; acquisition: BattedWorldAcquisition; motion: BattedWorldMotion }>
  | Readonly<{ kind: 'throw'; model: DurablePlayerFieldingModel; throw: BattedWorldThrow; motion: BattedWorldMotion }>;
export type DurableBattedWorldExecution = Readonly<{
  source: AcceptedBattedWorldExecution; baseMotion: DurableBattedWorldMotion; revision: number;
  history: readonly AcceptedBattedWorldExecution[]; execution: Execution;
}>;
export type SqliteBattedWorldExecutionStore = Readonly<{
  accept(sourceId: string): DurableBattedWorldExecution; read(sourceId: string): DurableBattedWorldExecution | null; close(): void;
}>;
type Authority = Readonly<{ readAcceptedExecution(sourceId: string): AcceptedBattedWorldExecution | null }>;
type Row = { source_id: string; physical_pitch_source_id: string; base_motion_source_id: string; previous_source_id: string | null;
  revision: number; game_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; base_motion_source_id: string; source_id: string; revision: number };
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, expected: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const input = (raw: AcceptedBattedWorldExecution, sourceId: string): AcceptedBattedWorldExecution => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'baseMotionSourceId', 'previousExecutionSourceId', 'action'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.baseMotionSourceId].every(id)
    || source.previousExecutionSourceId !== null && (!id(source.previousExecutionSourceId) || source.previousExecutionSourceId === sourceId)) {
    throw new Error('invalid accepted batted execution Source');
  }
  const action = source.action;
  if (action?.kind === 'acquisition' && fields(action, ['kind'])) return source;
  if (action?.kind === 'first_base_rule' || action?.kind === 'first_base_race') {
    if (!fields(action, ['kind', 'geometrySourceId']) || !id(action.geometrySourceId)) throw new Error('invalid accepted first-base rule Source');
    return source;
  }
  if (action?.kind === 'base_contact' || action?.kind === 'runner_base_touch' || action?.kind === 'base_touch_history') {
    if (!fields(action, ['kind', 'geometrySourceId', 'base', ...(action.kind !== 'base_contact' ? ['playerId'] : [])]) || !id(action.geometrySourceId)
      || action.kind !== 'base_contact' && !id(action.playerId)
      || !['home', 'first', 'second', 'third'].includes(action.base)) throw new Error('invalid actual controlled base Source');
    return source;
  }
  if (action?.kind !== 'motion' && action?.kind !== 'throw'
    || !fields(action, ['kind', 'availableAtTick', 'throughTick', 'commands', ...(action.kind === 'throw' ? ['modelSourceId', 'receiverPlayerId'] : [])])
    || !tick(action.availableAtTick) || !tick(action.throughTick)
    || action.kind === 'throw' && (!id(action.modelSourceId) || !id(action.receiverPlayerId))) throw new Error('invalid accepted batted execution action');
  return { ...source, action: { ...action, commands: battedWorldMotionCommandsInput(action.commands) } };
};
const physicalId = (motion: DurableBattedWorldMotion) => motion.response.touch.worldContact.flight.source.physicalPitchSourceId;

/** Directed immutable replay: every new execution depends only on its earlier own motion/acquisition prefix. */
export const battedWorldExecutionEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const ownMotions = battedWorldMotionEvidenceFromSqlite(db), ownFielding = playerFieldingModelEvidenceFromSqlite(db),
    ownGeometry = battedWorldBaseGeometryEvidenceFromSqlite(db);
  const root = (source: AcceptedBattedWorldExecution): DurableBattedWorldMotion => {
    const value = ownMotions.read(source.baseMotionSourceId);
    if (!value) throw new Error('original batted execution motion is missing');
    return value;
  };
  const execute = (source: AcceptedBattedWorldExecution, baseMotion: DurableBattedWorldMotion,
    previous: DurableBattedWorldExecution | null, prefix: readonly DurableBattedWorldExecution[]): DurableBattedWorldExecution => {
    const response = battedWorldResponseInput(baseMotion.response), prior = previous?.execution;
    const physicalPrior = [...prefix].reverse().find((value) => value.execution.kind === 'motion'
      || value.execution.kind === 'throw' || value.execution.kind === 'acquisition')?.execution;
    const motion = prior?.motion ?? baseMotion.motion;
    let execution: Execution;
    if (source.action.kind === 'acquisition') {
      if (physicalPrior?.kind === 'acquisition') throw new Error('batted execution acquisition is already resolved');
      execution = { kind: 'acquisition', motion, acquisition: deriveBattedWorldMotionAcquisition({ response, motion }) };
    } else if (source.action.kind === 'first_base_rule' || source.action.kind === 'first_base_race') {
      const geometry = ownGeometry.read(source.action.geometrySourceId), world = baseMotion.response.touch.worldContact;
      const binding = world.flight.physicalPitch.frame.batterActor!.binding, centers = battedWorldFrameBaseCenters(db, world.flight);
      if (!geometry || geometry.fixture.game_id !== binding.gameId || geometry.fixture.fixture_event_id !== binding.fixtureEventId
        || geometry.fixture.venue_id !== world.flight.source.execution.venueId
        || geometry.flight.physicalPitch.frame.batterActor!.binding.careerId !== binding.careerId
        || geometry.source.availableAtDay > binding.gameDay || json(geometry.geometry.field) !== json(world.flight.source.execution.field)
        || (['first', 'second', 'third'] as const).some((base) => json(geometry.geometry.bases[base].region.center) !== json(centers[base]))) {
        throw new Error('actual first-base rule fixture geometry differs');
      }
      const prefixInput = { baseMotion, motions: ownMotions.scope(baseMotion), executions: prefix, geometry };
      execution = source.action.kind === 'first_base_rule'
        ? { kind: 'first_base_rule', geometry, motion, ...battedWorldFirstBaseRuleFromPrefix(prefixInput) }
        : { kind: 'first_base_race', geometry, motion, ...battedWorldFirstBaseRaceFromPrefix(prefixInput) };
    } else if (source.action.kind === 'base_contact' || source.action.kind === 'runner_base_touch' || source.action.kind === 'base_touch_history') {
      const geometry = ownGeometry.read(source.action.geometrySourceId), world = baseMotion.response.touch.worldContact;
      const batter = world.flight.physicalPitch.frame.batterActor!, binding = batter.binding;
      const centers = battedWorldFrameBaseCenters(db, world.flight);
      if ((source.action.kind !== 'base_touch_history' && physicalPrior?.kind === 'acquisition') || !geometry || geometry.fixture.game_id !== binding.gameId
        || geometry.fixture.fixture_event_id !== binding.fixtureEventId || geometry.fixture.venue_id !== world.flight.source.execution.venueId
        || geometry.flight.physicalPitch.frame.batterActor!.binding.careerId !== binding.careerId
        || geometry.source.availableAtDay > binding.gameDay || json(geometry.geometry.field) !== json(world.flight.source.execution.field)
        || (['first', 'second', 'third'] as const).some((base) => json(geometry.geometry.bases[base].region.center) !== json(centers[base]))) {
        throw new Error('actual base-contact fixture or motion scope differs');
      }
      const surface = geometry.geometry.bases[source.action.base];
      if (source.action.kind === 'base_contact') {
        if (!batter.defenderBindings.some((actor) => actor.playerId === motion.carrierPlayerId)) throw new Error('actual secured base-contact carrier scope differs');
        const contact = findBattedWorldControlledBaseContact({ motion, base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
        execution = { kind: 'base_contact', geometry, contact, motion };
      } else if (source.action.kind === 'base_touch_history') {
        const action = source.action, actor = world.modelActorEvidence.find((value) => value.binding.playerId === action.playerId);
        const registered = [binding, ...batter.defenderBindings].find((value) => value.playerId === action.playerId);
        if (!actor || !registered || json(actor.binding) !== json(registered)
          || action.playerId === binding.playerId && json(actor.person) !== json(batter.person)) {
          throw new Error('actual base history registered Player/Person scope differs');
        }
        const history = battedWorldBaseTouchHistoryFromPrefix({ baseMotion, motions: ownMotions.scope(baseMotion), executions: prefix,
          playerId: action.playerId, base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
        const physicalRuleFacts = action.playerId === binding.playerId
          ? createRunnerBaseFactsFromBallWorldHistory({ history: history.history, base: action.base })
          : createControlledBaseFactsFromBallWorldContacts({ ...history, base: action.base, contacts: history.controlledContacts });
        execution = { kind: 'base_touch_history', geometry, playerId: action.playerId, base: action.base, ...history, physicalRuleFacts, motion };
      } else {
        const action = source.action, actor = world.modelActorEvidence.find((value) => value.binding.playerId === action.playerId);
        if (action.playerId !== binding.playerId || !actor || json(actor.binding) !== json(binding) || json(actor.person) !== json(batter.person)) {
          throw new Error('actual runner base-contact registered batter scope differs');
        }
        const contact = findBattedWorldPlayerBaseContact({ motion, playerId: action.playerId, base: surface.region,
          baseSurfaceHeightMeters: surface.surfaceHeightMeters });
        execution = { kind: 'runner_base_touch', geometry, playerId: action.playerId, base: action.base, contact, motion };
      }
    } else {
      let cursor: BattedWorldBallCursor | null = motion.cursor, carrierPlayerId = motion.carrierPlayerId;
      if (physicalPrior?.kind === 'acquisition') {
        const acquired = physicalPrior.acquisition;
        if (acquired.kind !== 'secured') throw new Error('batted execution acquisition remains unresolved');
        carrierPlayerId = acquired.acquirerPlayerId;
        cursor = { moment: acquired.moment, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
      }
      if (!cursor) throw new Error('batted execution actual candidate or contact remains unresolved');
      const motionInput = { response, actors: motion.actors, cursor, carrierPlayerId,
        availableAtTick: source.action.availableAtTick, throughTick: source.action.throughTick,
        commands: battedWorldMotionPrimitiveCommands(baseMotion.response, source.action.commands) };
      if (source.action.kind === 'motion') execution = { kind: 'motion', motion: deriveBattedWorldMotion(motionInput) };
      else {
        const action = source.action;
        const world = baseMotion.response.touch.worldContact, frame = world.flight.physicalPitch.frame;
        const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrierPlayerId);
        const model = ownFielding.read(action.modelSourceId);
        if (!carrierPlayerId || !actor || !model || !frame.batterActor!.defenderBindings.some((binding) => binding.playerId === carrierPlayerId)
          || !frame.batterActor!.defenderBindings.some((binding) => binding.playerId === action.receiverPlayerId)
          || model.source.playerId !== carrierPlayerId || model.source.careerId !== actor.binding.careerId
          || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.person) !== json(actor.person)
          || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('actual batted throw Player model or active receiver scope differs');
        const result = deriveBattedWorldThrow({ ...motionInput, carrierPlayerId, receiverPlayerId: action.receiverPlayerId,
          ratings: model.source.ratings, transferParameters: model.source.transferParameters, throwCalibration: model.source.throwCalibration,
          seed: { matchSeed: frame.matchSeed, playId: frame.match.playId, streamKey: json(['batted_world_throw', source.sourceId, carrierPlayerId]) } });
        execution = { kind: 'throw', model, throw: result, motion: result.motion };
      }
    }
    return freeze({ source, baseMotion, revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source], execution });
  };
  const scope = (baseMotion: DurableBattedWorldMotion): readonly DurableBattedWorldExecution[] => {
    const pitchId = physicalId(baseMotion), baseId = baseMotion.source.sourceId;
    const rows = db.prepare("SELECT * FROM batted_world_executions WHERE physical_pitch_source_id=? OR base_motion_source_id=? OR json_extract(source_json,'$.baseMotionSourceId')=? ORDER BY revision")
      .all(pitchId, baseId, baseId) as Row[];
    const heads = db.prepare('SELECT * FROM batted_world_execution_heads WHERE physical_pitch_source_id=? OR base_motion_source_id=?').all(pitchId, baseId) as Head[];
    if (!rows.length) { if (heads.length) throw new Error('unowned batted execution head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.base_motion_source_id !== baseId
      || head.source_id !== rows.at(-1)!.source_id || head.revision !== rows.length) throw new Error('batted execution prefix head differs');
    const values: DurableBattedWorldExecution[] = [];
    for (const row of rows) {
      const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldExecution, row.source_id), previous = values.at(-1) ?? null;
      if (source.baseMotionSourceId !== baseId || source.previousExecutionSourceId !== (previous?.source.sourceId ?? null)
        || row.physical_pitch_source_id !== pitchId || row.base_motion_source_id !== baseId || row.previous_source_id !== source.previousExecutionSourceId
        || row.game_id !== baseMotion.response.model.gameId || row.revision !== values.length + 1
        || row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('corrupt original batted execution Source prefix');
      const value = execute(source, baseMotion, previous, values);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original batted execution snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableBattedWorldExecution | null => {
    if (!id(sourceId)) throw new Error('invalid batted execution scope');
    const row = db.prepare('SELECT * FROM batted_world_executions WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldExecution, sourceId), value = scope(root(source)).find((item) => item.source.sourceId === sourceId);
    if (!value) throw new Error('batted execution is outside its own original prefix');
    return value;
  };
  const derive = (source: AcceptedBattedWorldExecution): DurableBattedWorldExecution => {
    const baseMotion = root(source), values = scope(baseMotion), previous = values.at(-1) ?? null;
    if (source.previousExecutionSourceId !== (previous?.source.sourceId ?? null)) throw new Error('batted execution predecessor differs');
    return execute(source, baseMotion, previous, values);
  };
  const currentRoot = (value: DurableBattedWorldExecution) => {
    assertNoBattedWorldFieldOwner(db, physicalId(value.baseMotion));
    ownMotions.current(value.baseMotion);
    if (json(root(value.source)) !== json(value.baseMotion)) throw new Error('batted execution original changed during write');
  };
  const currentBefore = (value: DurableBattedWorldExecution) => {
    currentRoot(value); if (json(derive(value.source)) !== json(value)) throw new Error('batted execution prefix changed before write');
  };
  const current = (value: DurableBattedWorldExecution) => {
    currentRoot(value); const values = scope(value.baseMotion);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('batted execution current prefix changed during write');
  };
  return { read, derive, currentBefore, current, scope, ownMotions };
};

export const openSqliteBattedWorldExecutionStore = (path: string, motions: Pick<SqliteBattedWorldMotionStore, 'read'>,
  authority?: Authority): SqliteBattedWorldExecutionStore => {
  if (!id(path) || typeof motions?.read !== 'function' || authority != null && typeof authority.readAcceptedExecution !== 'function') throw new Error('invalid batted execution sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS batted_world_executions (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,base_motion_source_id TEXT NOT NULL,
    previous_source_id TEXT,revision INTEGER NOT NULL,game_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,revision));
    CREATE TABLE IF NOT EXISTS batted_world_execution_heads (physical_pitch_source_id TEXT PRIMARY KEY,base_motion_source_id TEXT NOT NULL,source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL);`);
  const own = battedWorldExecutionEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed batted execution scope'); };
  return Object.freeze({ read(sourceId) { check(sourceId); return own.read(sourceId); },
    accept(sourceId) {
      check(sourceId); const prior = own.read(sourceId), raw = authority?.readAcceptedExecution(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('batted execution Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('batted execution original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted batted execution Source is missing');
      const value = own.derive(source); own.currentBefore(value); const peer = motions.read(source.baseMotionSourceId);
      if (!peer || json(peer) !== json(value.baseMotion)) throw new Error('batted execution peer motion differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        own.currentBefore(value); const pitchId = physicalId(value.baseMotion);
        db.prepare('INSERT INTO batted_world_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(sourceId, pitchId, source.baseMotionSourceId,
          source.previousExecutionSourceId, value.revision, value.baseMotion.response.model.gameId, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO batted_world_execution_heads VALUES (?,?,?,?)').run(pitchId, source.baseMotionSourceId, sourceId, 1);
        else {
          const changed = db.prepare('UPDATE batted_world_execution_heads SET source_id=?,revision=? WHERE physical_pitch_source_id=? AND base_motion_source_id=? AND source_id=? AND revision=?')
            .run(sourceId, value.revision, pitchId, source.baseMotionSourceId, source.previousExecutionSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('batted execution predecessor changed during write');
        }
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('batted execution original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
