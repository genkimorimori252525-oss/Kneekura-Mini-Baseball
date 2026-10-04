import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldFieldMotionCheckpoint, advanceBattedWorldFieldMotionCheckpoint, deriveBattedWorldFieldMotion, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBattedWorldFieldAcquisition, type BattedWorldFieldAcquisition } from '../../core/sim/ball/BattedWorldFieldAcquisition';
import { deriveBattedWorldFieldThrow, type BattedWorldFieldThrow } from '../../core/sim/ball/BattedWorldFieldThrow';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow, type BattedWorldScheduledFieldThrowPlan, type BattedWorldScheduledFieldThrowAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import { deriveScheduledFieldThrowLiveWork } from '../../core/sim/liveAction/ScheduledFieldThrowLiveWork';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition,
  type BattedWorldScheduledFieldAcquisitionPlan, type BattedWorldScheduledFieldAcquisitionAdvance } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { deriveScheduledFieldAcquisitionLiveWork } from '../../core/sim/liveAction/ScheduledFieldAcquisitionLiveWork';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import type { BattedWorldBaseId } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { createRunnerBaseFactsFromBallWorldHistory, createControlledBaseFactsFromBallWorldContacts } from '../../core/rules/BallWorldBaseContactPhysicalAdapter';
import { deriveBallWorldFieldFirstBaseRace } from '../../core/rules/BallWorldFieldFirstBaseRace';
import { deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence } from '../../core/rules/BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionCommandsInput, battedWorldMotionPrimitiveCommands, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction, type SqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { battedWorldFieldPhysicalPrefix, battedWorldFieldBaseTouchHistoryFromPrefix, type BattedWorldFieldCustodyPolicy } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';

type Action = Readonly<{ kind: 'acquisition' }>
  | Readonly<{ kind: 'acquisition_plan' }>
  | Readonly<{ kind: 'base_touch_history'; playerId: string; base: BattedWorldBaseId; custodyPolicy?: BattedWorldFieldCustodyPolicy }>
  | Readonly<{ kind: 'first_base_race'; custodyPolicy?: BattedWorldFieldCustodyPolicy }>
  | Readonly<{ kind: 'whole_play_history' }>
  | Readonly<{ kind: 'motion_checkpoint_v1'; availableAtTick: number; coverageThroughTick: number; checkpointThroughTick: number; commands: AcceptedBattedWorldMotion['commands'] }>
  | Readonly<{ kind: 'retained_motion_checkpoint_v1'; checkpointThroughTick: number }>
  | Readonly<{ kind: 'motion'; availableAtTick: number; throughTick: number; commands: AcceptedBattedWorldMotion['commands'] }>
  | Readonly<{ kind: 'throw_advance'; planSourceId: string; throughElapsedSeconds: number }>
  | Readonly<{ kind: 'acquisition_advance'; planSourceId: string; throughElapsedSeconds: number }>
  | Readonly<{ kind: 'throw' | 'throw_plan'; availableAtTick: number; throughTick: number; commands: AcceptedBattedWorldMotion['commands'];
    modelSourceId: string; receiverPlayerId: string }>;
export type AcceptedBattedWorldFieldExecution = Readonly<{ sourceId: string; sourceVersion: string;
  baseFieldSourceId: string; previousExecutionSourceId: string | null; action: Action }>;
type Execution = Readonly<{ kind: 'motion' | 'motion_checkpoint_v1' | 'retained_motion_checkpoint_v1'; field: BattedWorldFieldMotion }>
  | Readonly<{ kind: 'whole_play_history'; field: BattedWorldFieldMotion; physicalHistory: ReturnType<typeof wholePlayPhysicalHistoryFromPrefix> }>
  | Readonly<{ kind: 'acquisition'; field: BattedWorldFieldMotion; acquisition: BattedWorldFieldAcquisition }>
  | Readonly<{ kind: 'acquisition_plan'; field: BattedWorldFieldMotion; plan: BattedWorldScheduledFieldAcquisitionPlan;
    liveWork: ReturnType<typeof deriveScheduledFieldAcquisitionLiveWork> }>
  | Readonly<{ kind: 'acquisition_advance'; field: BattedWorldFieldMotion; planSourceId: string;
    progress: BattedWorldScheduledFieldAcquisitionAdvance; liveWork: ReturnType<typeof deriveScheduledFieldAcquisitionLiveWork> }>
  | Readonly<{ kind: 'throw_plan'; field: BattedWorldFieldMotion; model: DurablePlayerFieldingModel; plan: BattedWorldScheduledFieldThrowPlan; liveWork: ReturnType<typeof deriveScheduledFieldThrowLiveWork> }>
  | Readonly<{ kind: 'throw_advance'; field: BattedWorldFieldMotion; planSourceId: string; progress: BattedWorldScheduledFieldThrowAdvance; liveWork: ReturnType<typeof deriveScheduledFieldThrowLiveWork> }>
  | Readonly<{ kind: 'throw'; field: BattedWorldFieldMotion; model: DurablePlayerFieldingModel; throw: BattedWorldFieldThrow }>
  | (Readonly<{ kind: 'base_touch_history'; field: BattedWorldFieldMotion; playerId: string; base: BattedWorldBaseId;
    physicalRuleFacts: readonly (ReturnType<typeof createRunnerBaseFactsFromBallWorldHistory>[number] | ReturnType<typeof createControlledBaseFactsFromBallWorldContacts>[number])[] }>
    & ReturnType<typeof battedWorldFieldBaseTouchHistoryFromPrefix>)
  | (Readonly<{ kind: 'first_base_race'; field: BattedWorldFieldMotion;
    batterFirstBase: ReturnType<typeof battedWorldFieldBaseTouchHistoryFromPrefix>;
    defendersFirstBase: readonly ReturnType<typeof battedWorldFieldBaseTouchHistoryFromPrefix>[] }>
    & ReturnType<typeof deriveBallWorldFieldFirstBaseRace>
    & Partial<Pick<ReturnType<typeof deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence>, 'possessionEvidence' | 'possessionGuard'>>);
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
  if ((action?.kind === 'acquisition' || action?.kind === 'acquisition_plan' || action?.kind === 'whole_play_history') && fields(action, ['kind'])) return source;
  if (action?.kind === 'base_touch_history' || action?.kind === 'first_base_race') {
    const policyFields = 'custodyPolicy' in action ? ['custodyPolicy'] : [];
    if (!fields(action, ['kind', ...(action.kind === 'base_touch_history' ? ['playerId', 'base'] : []), ...policyFields])
      || policyFields.length && action.custodyPolicy !== 'release_exclusive_v1'
      || action.kind === 'base_touch_history' && (!id(action.playerId) || !['home', 'first', 'second', 'third'].includes(action.base))) {
      throw new Error('invalid actual field observation Source or custody policy');
    }
    return source;
  }
  if (action?.kind === 'throw_advance' || action?.kind === 'acquisition_advance') {
    if (!fields(action, ['kind', 'planSourceId', 'throughElapsedSeconds']) || !id(action.planSourceId)
      || !Number.isFinite(action.throughElapsedSeconds) || action.throughElapsedSeconds < 0) throw new Error('invalid scheduled field advancement');
    return source;
  }
  if (action?.kind === 'retained_motion_checkpoint_v1') {
    if (!fields(action, ['kind', 'checkpointThroughTick']) || !tick(action.checkpointThroughTick)) throw new Error('invalid retained actual field checkpoint');
    return source;
  }
  if (action?.kind === 'motion_checkpoint_v1') {
    if (!fields(action, ['kind', 'availableAtTick', 'coverageThroughTick', 'checkpointThroughTick', 'commands'])
      || !tick(action.availableAtTick) || !tick(action.coverageThroughTick) || !tick(action.checkpointThroughTick)) {
      throw new Error('invalid accepted actual field command checkpoint');
    }
    return { ...source, action: { ...action, commands: battedWorldMotionCommandsInput(action.commands) } };
  }
  if (action?.kind !== 'motion' && action?.kind !== 'throw' && action?.kind !== 'throw_plan'
    || !fields(action, ['kind', 'availableAtTick', 'throughTick', 'commands', ...(action.kind !== 'motion' ? ['modelSourceId', 'receiverPlayerId'] : [])])
    || !tick(action.availableAtTick) || !tick(action.throughTick)
    || action.kind !== 'motion' && (!id(action.modelSourceId) || !id(action.receiverPlayerId))) throw new Error('invalid accepted actual field execution action');
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
    previous: DurableBattedWorldFieldExecution | null, prefix: readonly DurableBattedWorldFieldExecution[]): DurableBattedWorldFieldExecution => {
    const prior = previous?.execution, original = prior?.field ?? baseField.field, motion = original.motion;
    const response = battedWorldResponseInput(baseField.response), geometry = baseField.geometry.geometry;
    const physicalPrior = [...prefix].reverse().find((value) => value.execution.kind === 'motion'
      || value.execution.kind === 'motion_checkpoint_v1' || value.execution.kind === 'retained_motion_checkpoint_v1'
      || value.execution.kind === 'acquisition' || value.execution.kind === 'acquisition_advance'
      || value.execution.kind === 'throw' || value.execution.kind === 'throw_advance')?.execution;
    const planned = [...prefix].reverse().find((value) => value.execution.kind === 'throw_plan');
    const lastAdvance = planned && [...prefix].reverse().find((value) => value.execution.kind === 'throw_advance'
      && value.execution.planSourceId === planned.source.sourceId);
    const pending = planned && (!lastAdvance || lastAdvance.execution.kind === 'throw_advance' && lastAdvance.execution.progress.kind === 'transfer');
    const capturePlan = [...prefix].reverse().find((value) => value.execution.kind === 'acquisition_plan');
    const captureAdvance = capturePlan && [...prefix].reverse().find((value) => value.execution.kind === 'acquisition_advance'
      && value.execution.planSourceId === capturePlan.source.sourceId);
    const pendingCapture = capturePlan && (!captureAdvance || captureAdvance.execution.kind === 'acquisition_advance'
      && (captureAdvance.execution.progress.kind === 'capturing' || captureAdvance.execution.progress.kind === 'fence_pending'));
    const observation = ['whole_play_history', 'base_touch_history', 'first_base_race'].includes(source.action.kind);
    if (pending && source.action.kind !== 'throw_advance' && !observation) throw new Error('scheduled field transfer owns pending physical execution');
    if (pendingCapture && source.action.kind !== 'acquisition_advance' && !observation) throw new Error('scheduled field acquisition owns pending physical execution');
    let execution: Execution;
    if (source.action.kind === 'acquisition_advance') {
      if (!pendingCapture || !capturePlan || capturePlan.execution.kind !== 'acquisition_plan'
        || capturePlan.source.sourceId !== source.action.planSourceId) throw new Error('scheduled field acquisition plan is missing, superseded or terminal');
      const progress = advanceBattedWorldScheduledFieldAcquisition({ plan: capturePlan.execution.plan,
        previous: captureAdvance?.execution.kind === 'acquisition_advance' ? captureAdvance.execution.progress : null,
        throughElapsedSeconds: source.action.throughElapsedSeconds });
      const liveWork = deriveScheduledFieldAcquisitionLiveWork({ physicalPitchSourceId: physicalId(baseField), planSourceId: capturePlan.source.sourceId,
        executionSourceId: source.sourceId, revision: (previous?.revision ?? 0) + 1, plan: capturePlan.execution.plan, progress });
      // The field is the original candidate basis. Actual time/state belongs to
      // progress; its confirmed cursor is at the fence, not the earlier secure evidence.
      execution = { kind: 'acquisition_advance', field: capturePlan.execution.field, planSourceId: capturePlan.source.sourceId, progress, liveWork };
    } else if (source.action.kind === 'throw_advance') {
      if (!pending || !planned || planned.execution.kind !== 'throw_plan' || planned.source.sourceId !== source.action.planSourceId) {
        throw new Error('scheduled field throw plan is missing, superseded or terminal');
      }
      const priorProgress = lastAdvance?.execution.kind === 'throw_advance' ? lastAdvance.execution.progress : null;
      const progress = advanceBattedWorldScheduledFieldThrow({ plan: planned.execution.plan, previous: priorProgress,
        throughElapsedSeconds: source.action.throughElapsedSeconds });
      const liveWork = deriveScheduledFieldThrowLiveWork({ physicalPitchSourceId: physicalId(baseField), planSourceId: planned.source.sourceId,
        executionSourceId: source.sourceId, revision: (previous?.revision ?? 0) + 1, plan: planned.execution.plan, progress });
      execution = { kind: 'throw_advance', field: progress.field, planSourceId: planned.source.sourceId, progress, liveWork };
    } else if (source.action.kind === 'acquisition' || source.action.kind === 'acquisition_plan') {
      if (physicalPrior?.kind === 'acquisition' || physicalPrior?.kind === 'acquisition_advance') throw new Error('actual field acquisition is already resolved');
      if (source.action.kind === 'acquisition') {
        execution = { kind: 'acquisition', field: original, acquisition: deriveBattedWorldFieldAcquisition({ response, geometry, field: original }) };
      } else {
        const plan = prepareBattedWorldScheduledFieldAcquisition({ response, geometry, field: original });
        const frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
        if (!frame.batterActor!.defenderBindings.some((binding) => binding.playerId === plan.acquirerPlayerId)) {
          throw new Error('scheduled field acquisition requires an original active defender');
        }
        const liveWork = deriveScheduledFieldAcquisitionLiveWork({ physicalPitchSourceId: physicalId(baseField), planSourceId: source.sourceId,
          executionSourceId: source.sourceId, revision: (previous?.revision ?? 0) + 1, plan, progress: null });
        execution = { kind: 'acquisition_plan', field: original, plan, liveWork };
      }
    } else if (source.action.kind === 'whole_play_history') {
      execution = { kind: 'whole_play_history', field: original, physicalHistory: wholePlayPhysicalHistoryFromPrefix({ baseField,
        fields: ownFields.scope(baseField, baseField.source.sourceId), executions: prefix }) };
    } else if (source.action.kind === 'base_touch_history' || source.action.kind === 'first_base_race') {
      const world = baseField.response.touch.worldContact, batter = world.flight.physicalPitch.frame.batterActor!;
      const prefixInput = { baseField, fields: ownFields.scope(baseField, baseField.source.sourceId), executions: prefix,
        custodyPolicy: source.action.custodyPolicy };
      if (source.action.kind === 'base_touch_history') {
        const action = source.action, registered = [batter.binding, ...batter.defenderBindings].find((value) => value.playerId === action.playerId);
        const actor = world.modelActorEvidence.find((value) => value.binding.playerId === action.playerId);
        if (!registered || !actor || json(actor.binding) !== json(registered)
          || action.playerId === batter.binding.playerId && json(actor.person) !== json(batter.person)) throw new Error('actual field base history Player/Person scope differs');
        const surface = geometry.baseGeometry.bases[action.base];
        const history = battedWorldFieldBaseTouchHistoryFromPrefix({ ...prefixInput, playerId: action.playerId,
          base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
        const physicalRuleFacts = action.playerId === batter.binding.playerId
          ? createRunnerBaseFactsFromBallWorldHistory({ history: history.history, base: action.base })
          : createControlledBaseFactsFromBallWorldContacts({ history: history.history, contacts: history.controlledContacts, base: action.base });
        execution = { kind: 'base_touch_history', field: original, playerId: action.playerId, base: action.base, ...history, physicalRuleFacts };
      } else {
        const physical = battedWorldFieldPhysicalPrefix(prefixInput), surface = geometry.baseGeometry.bases.first;
        const historyFor = (playerId: string) => {
          const history = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId,
            base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
          const controlWindows = physical.controlWindows.filter((value) => value.playerId === playerId)
            .map(({ playerId: _, ...window }) => window);
          return { history, controlledContacts: findBallWorldControlledBaseContacts({ history, controlWindows }) };
        };
        const batterFirstBase = historyFor(batter.binding.playerId), defendersFirstBase = batter.defenderBindings.map((binding) => historyFor(binding.playerId));
        const ball = physical.field.evidence;
        const raceInput = { field: physical.field, race: { outsAtStart: world.flight.physicalPitch.frame.match.outs,
          batterRunnerId: ball.batterRunnerId, defenderIds: ball.defenderIds, originTick: ball.originTick, ticksPerSecond: ball.ticksPerSecond,
          horizonElapsedSeconds: ball.horizon.elapsedSeconds, runnerHistory: batterFirstBase.history, defenders: defendersFirstBase } };
        const result = physical.possessionEvidence
          ? deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence({ ...raceInput, possessionEvidence: physical.possessionEvidence })
          : deriveBallWorldFieldFirstBaseRace(raceInput);
        execution = { kind: 'first_base_race', field: original, ...result, batterFirstBase, defendersFirstBase };
      }
    } else {
      let cursor: BattedWorldBallCursor | null = motion.cursor, carrierPlayerId = motion.carrierPlayerId;
      if (physicalPrior?.kind === 'acquisition') {
        const acquired = physicalPrior.acquisition;
        if (acquired.kind !== 'secured') throw new Error('actual field acquisition remains unresolved');
        carrierPlayerId = acquired.acquirerPlayerId;
        cursor = { moment: acquired.moment, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
      } else if (physicalPrior?.kind === 'acquisition_advance') {
        const progress = physicalPrior.progress;
        if (progress.kind !== 'secured') throw new Error('actual scheduled field acquisition remains unresolved');
        carrierPlayerId = progress.acquisition.acquirerPlayerId;
        cursor = progress.cursor;
      }
      if (!cursor) throw new Error('actual field execution capture or contact remains unresolved');
      const basis = { response, geometry, actors: motion.actors, cursor, carrierPlayerId };
      if (source.action.kind === 'retained_motion_checkpoint_v1') {
        execution = { kind: source.action.kind, field: advanceBattedWorldFieldMotionCheckpoint({ ...basis,
          checkpointThroughTick: source.action.checkpointThroughTick }) };
      } else if (source.action.kind === 'motion_checkpoint_v1') {
        execution = { kind: source.action.kind, field: deriveBattedWorldFieldMotionCheckpoint({ ...basis,
          availableAtTick: source.action.availableAtTick, coverageThroughTick: source.action.coverageThroughTick,
          checkpointThroughTick: source.action.checkpointThroughTick,
          commands: battedWorldMotionPrimitiveCommands(baseField.response, source.action.commands) }) };
      } else {
        const motionInput = { ...basis,
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
          const throwInput = { ...motionInput, carrierPlayerId, receiverPlayerId: action.receiverPlayerId,
            ratings: model.source.ratings, transferParameters: model.source.transferParameters, throwCalibration: model.source.throwCalibration,
            seed: { matchSeed: frame.matchSeed, playId: frame.match.playId, streamKey: json(['batted_world_field_throw', source.sourceId, carrierPlayerId]) } };
          if (action.kind === 'throw_plan') {
            const plan = prepareBattedWorldScheduledFieldThrow(throwInput);
            const liveWork = deriveScheduledFieldThrowLiveWork({ physicalPitchSourceId: physicalId(baseField), planSourceId: source.sourceId,
              executionSourceId: source.sourceId, revision: (previous?.revision ?? 0) + 1, plan, progress: null });
            execution = { kind: 'throw_plan', field: original, model, plan, liveWork };
          } else {
            const result = deriveBattedWorldFieldThrow(throwInput);
            execution = { kind: 'throw', field: result.field, model, throw: result };
          }
        }
      }
    }
    return freeze({ source, baseField, revision: (previous?.revision ?? 0) + 1,
      history: [...(previous?.history ?? []), source], execution });
  };
  const scope = (baseField: DurableBattedWorldFieldAction, throughSourceId?: string | null): readonly DurableBattedWorldFieldExecution[] => {
    const pitchId = physicalId(baseField), baseId = baseField.source.sourceId;
    const owners = `physical_pitch_source_id=? OR base_field_source_id=?
      OR CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.baseFieldSourceId') END
        IN (SELECT source_id FROM batted_world_field_actions WHERE physical_pitch_source_id=?)
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId') END=?`;
    const rows = db.prepare(`SELECT * FROM batted_world_field_executions WHERE ${owners} ORDER BY revision`).all(pitchId, baseId, pitchId, pitchId) as Row[];
    const heads = db.prepare(`SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=? OR base_field_source_id=?
      OR source_id IN (SELECT source_id FROM batted_world_field_executions WHERE ${owners})`).all(pitchId, baseId, pitchId, baseId, pitchId, pitchId) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual field execution head'); return []; }
    const head = heads[0];
    if (heads.length !== 1) throw new Error('actual field execution prefix head differs');
    // A zero-payload historical bound may predate later field actions and their
    // execution owner. Validate that later anchor from field metadata only;
    // neither the future field nor execution payload is observation evidence.
    const anchorId = throughSourceId === null ? head.base_field_source_id : baseId;
    if (throughSourceId === null) {
      ownFields.scope(baseField, baseId);
      const anchor = db.prepare('SELECT * FROM batted_world_field_actions WHERE source_id=?').get(anchorId) as {
        physical_pitch_source_id: string; response_source_id: string; geometry_source_id: string; revision: number; game_id: string;
      } | undefined;
      const fieldHead = db.prepare('SELECT * FROM batted_world_field_heads WHERE physical_pitch_source_id=?').get(pitchId) as {
        source_id: string; revision: number;
      } | undefined;
      if (!anchor || anchor.physical_pitch_source_id !== pitchId || anchor.response_source_id !== baseField.response.source.sourceId
        || anchor.geometry_source_id !== baseField.geometry.source.sourceId || anchor.game_id !== baseField.response.model.gameId
        || anchor.revision < baseField.revision || fieldHead?.source_id !== anchorId || fieldHead.revision !== anchor.revision) {
        throw new Error('actual field execution future anchor metadata differs');
      }
    }
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.base_field_source_id !== anchorId
      || head.source_id !== rows.at(-1)!.source_id || !tick(head.revision) || head.revision !== rows.length) throw new Error('actual field execution prefix head differs');
    const unique = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!id(row.source_id) || unique.has(row.source_id) || !tick(row.revision) || row.revision !== index + 1
        || row.physical_pitch_source_id !== pitchId || row.base_field_source_id !== anchorId
        || row.previous_source_id !== (rows[index - 1]?.source_id ?? null) || row.game_id !== baseField.response.model.gameId) {
        throw new Error('corrupt actual field execution prefix metadata');
      }
      unique.add(row.source_id);
    }
    const bound = throughSourceId === null ? -1 : throughSourceId === undefined ? rows.length - 1 : rows.findIndex((row) => row.source_id === throughSourceId);
    if (bound < 0 && throughSourceId !== null) throw new Error('actual field execution Source is outside original prefix');
    const values: DurableBattedWorldFieldExecution[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = input(JSON.parse(row.source_json) as AcceptedBattedWorldFieldExecution, row.source_id);
      if (source.baseFieldSourceId !== baseId || source.previousExecutionSourceId !== row.previous_source_id
        || row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('corrupt original actual field execution Source');
      const value = execute(source, baseField, values.at(-1) ?? null, values);
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
    const baseField = root(source), prefix = scope(baseField), previous = prefix.at(-1) ?? null;
    if (source.previousExecutionSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual field execution predecessor differs');
    // New ambiguous observations must opt into release-exclusive custody. Stored
    // scope/read and immutable retries continue their original Source semantics.
    if ((source.action.kind === 'base_touch_history' || source.action.kind === 'first_base_race') && source.action.custodyPolicy === undefined) {
      const original = { baseField, fields: ownFields.scope(baseField, baseField.source.sourceId), executions: prefix };
      const legacy = battedWorldFieldPhysicalPrefix(original);
      const exclusive = battedWorldFieldPhysicalPrefix({ ...original, custodyPolicy: 'release_exclusive_v1' });
      if (json(legacy.controlWindows) !== json(exclusive.controlWindows)) throw new Error('explicit release-exclusive custody policy is required for a new observation');
    }
    return execute(source, baseField, previous, prefix);
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
