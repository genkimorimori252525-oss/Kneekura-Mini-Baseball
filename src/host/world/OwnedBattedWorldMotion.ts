import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualPlayerKinematicsFromPrefix, type ActualPlayerCommandAdoption } from './ActualPlayerKinematicsFromPrefix';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { DurableActualLocomotion } from './SqliteActualLocomotionStore';
import type { DurableActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';
import type { OwnedMotionKnownWork } from './OwnedMotionKnownWorkFromSqlite';

export type OwnedMotionContribution = Readonly<{ kind: 'motor'; playerId: string; motorSourceId: string }>
  | Readonly<{ kind: 'retained'; playerId: string; command: ActualPlayerCommandAdoption }>;
export type OwnedMotionAction = Readonly<{ kind: 'owned_motion_v1'; checkpointThroughTick: number;
  contributions: readonly OwnedMotionContribution[]; knownWork: readonly OwnedMotionKnownWork[] }>;
const id = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s === s.trim();
const tick = (t: unknown): t is number => typeof t === 'number' && Number.isSafeInteger(t) && t >= 0;
const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && JSON.stringify(Object.keys(v).sort()) === JSON.stringify([...keys].sort());
const moment = (v: ActualPlayerCommandAdoption['adoptedAt']) => fields(v, ['originTick', 'elapsedSeconds', 'tick'])
  && tick(v.originTick) && tick(v.tick) && Number.isFinite(v.elapsedSeconds) && v.elapsedSeconds >= 0;
const ownedMotionInput = (raw: OwnedMotionAction, includeV2: boolean): OwnedMotionAction => {
  const s = cloneInert(raw);
  if (!fields(s, ['kind', 'checkpointThroughTick', 'contributions', 'knownWork']) || s.kind !== 'owned_motion_v1'
    || !tick(s.checkpointThroughTick) || !Array.isArray(s.contributions) || s.contributions.length !== 10
    || !Array.isArray(s.knownWork) || s.knownWork.length !== 10
    || new Set(s.contributions.map(c => c.playerId)).size !== 10 || new Set(s.knownWork.map(w => w.playerId)).size !== 10) {
    throw new Error('invalid owned motion complete contribution/known-work Source');
  }
  for (const c of s.contributions) {
    if (!id(c.playerId)) throw new Error('invalid owned motion Player identity');
    if (c.kind === 'motor') {
      if (!fields(c, ['kind', 'playerId', 'motorSourceId']) || !id(c.motorSourceId)) throw new Error('invalid owned motor contribution');
    } else if (c.kind === 'retained') {
      const r = c.command;
      if (!fields(c, ['kind', 'playerId', 'command']) || !fields(r, ['kind', 'owner', 'sourceId', 'sourceVersion', 'sourceHash',
        'adoptionSourceId', 'adoptionSourceHash', 'adoptedAt', 'executedThrough', 'acceptedThroughTick'])
        || !['contact', 'field', 'motion', 'motion_checkpoint_v1', 'owned_motion_v1', 'throw', 'throw_advance', ...(includeV2 ? ['owned_motion_v2','received_renewal_adoption_v1'] : [])].includes(r.kind)
        || !['batted_world_contacts', 'batted_world_field_actions', 'batted_world_field_executions'].includes(r.owner)
        || ![r.sourceId, r.sourceVersion, r.sourceHash, r.adoptionSourceId, r.adoptionSourceHash].every(id)
        || !moment(r.adoptedAt) || !moment(r.executedThrough) || !tick(r.acceptedThroughTick)) throw new Error('invalid retained motion command reference');
    } else throw new Error('unsupported owned motion contributor');
  }
  for (const w of s.knownWork) if (!fields(w, ['playerId', 'decisionSourceId', 'motorSourceId']) || !id(w.playerId)
    || w.decisionSourceId !== null && !id(w.decisionSourceId) || w.motorSourceId !== null && !id(w.motorSourceId)) {
    throw new Error('invalid owned motion known-work reference');
  }
  return freeze(s);
};
export const ownedMotionActionInput = (raw: OwnedMotionAction): OwnedMotionAction => ownedMotionInput(raw, false);
/** Explicit versioned reference parser; v1's original allowlist remains unchanged. */
export const ownedMotionV2ContributionsInput = (raw: Pick<OwnedMotionAction, 'contributions' | 'knownWork'>) => {
  const value = cloneInert(raw);
  if (!fields(value, ['contributions', 'knownWork'])) throw new Error('invalid owned motion v2 contribution container');
  const checked = ownedMotionInput({ kind: 'owned_motion_v1', checkpointThroughTick: 0, ...value }, true);
  return freeze({ contributions: checked.contributions, knownWork: checked.knownWork });
};
type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
/** Mechanical composition only. The physical owner first proves dependency rank, rederives
 * immutable receipts on its own connection, then supplies its already validated predecessor. */
export const deriveOwnedMotionComposition = (source: Readonly<{ sourceId: string; sourceVersion: string; baseFieldSourceId: string;
  previousExecutionSourceId: string | null; action: OwnedMotionAction }>, prefix: Prefix,
  motors: readonly DurableActualLocomotion[], decisions: readonly DurableActualDefensiveDecision[]) => {
  const action = source.action;
  const world = prefix.baseField.response.touch.worldContact, batter = world.flight.physicalPitch.frame.batterActor!;
  const bindings = [batter.binding, ...batter.defenderBindings], playerIds = bindings.map(b => b.playerId);
  if (bindings.length !== 10 || new Set(playerIds).size !== 10
    || action.contributions.some(c => !playerIds.includes(c.playerId)) || action.knownWork.some(w => !playerIds.includes(w.playerId))) {
    throw new Error('owned motion requires exactly the original ten Player bindings');
  }
  const previousAdoptions = prefix.executions.flatMap(v => v.execution.kind === 'owned_motion_v1'
    ? v.execution.adoption.contributors.filter(c => c.motorSourceId !== null).map(c => ({ playerId: c.playerId, motorSourceId: c.motorSourceId! })) : []);
  const selectedMotorIds = action.contributions.flatMap(c => c.kind === 'motor' ? [c.motorSourceId] : []);
  if (new Set(selectedMotorIds).size !== selectedMotorIds.length || selectedMotorIds.some(s => previousAdoptions.some(a => a.motorSourceId === s))) {
    throw new Error('owned motor issuance is already adopted');
  }
  const contributors = bindings.map(binding => {
    const c = action.contributions.find(c => c.playerId === binding.playerId)!, self = actualPlayerKinematicsFromPrefix(binding.playerId, prefix);
    const known = action.knownWork.find(w => w.playerId === binding.playerId)!;
    if (!c || !known || self.personId !== binding.personId || self.personLinkSourceId !== binding.personLinkSourceId
      || self.gameDay !== binding.gameDay || self.gameId !== binding.gameId || self.roles.length !== 5
      || new Set(self.roles.map(p => p.role)).size !== 5) throw new Error('owned motion original Player/Person/role scope differs');
    const retainedRoles = self.roles.map(p => ({ role: p.role, radiusMeters: p.radiusMeters, command: self.activeCommand,
      acceptedThroughTick: Math.min(p.canonicalActor.primitive.endTick, self.activeCommand.acceptedThroughTick),
      offsetAcceleration: p.declaredPose.relativeAcceleration }));
    const coverage = Math.min(self.activeCommand.acceptedThroughTick, ...retainedRoles.map(p => p.acceptedThroughTick));
    if ((coverage - self.at.originTick) / self.ticksPerSecond <= self.at.elapsedSeconds) throw new Error('owned motion retained command coverage exhausted');
    const retained = { playerId: self.playerId, bodyAcceleration: self.root.acceleration,
      primitiveMotions: retainedRoles.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) };
    const command = c.kind === 'motor' ? motors.find(m => m.source.sourceId === c.motorSourceId) : null;
    if (c.kind === 'retained' && json(c.command) !== json(self.activeCommand)) throw new Error('owned motion retained command/adoption reference is stale');
    if (c.kind === 'motor') {
      if (!command || known.motorSourceId !== command.source.sourceId || known.decisionSourceId !== command.source.decisionSourceId
        || command.source.playerId !== self.playerId || command.source.physicalPitchSourceId !== self.physicalPitchSourceId
        || command.source.baseFieldSourceId !== prefix.baseField.source.sourceId
        || command.source.executionSourceId !== (prefix.executions.at(-1)?.source.sourceId ?? null)) throw new Error('owned motion selected motor original cut or known work differs');
      const { cut: _, dependencyHashes: __, ...motorSelf } = command.receipt.self;
      if (json(motorSelf) !== json(self) || json(command.receipt.retainedRoles) !== json(retainedRoles)
        || json(command.receipt.startAt) !== json(self.at)
        || command.receipt.issuedAt.originTick !== self.at.originTick || command.receipt.issuedAt.elapsedSeconds > self.at.elapsedSeconds) {
        throw new Error('owned motion motor self/retained role/issuance differs');
      }
    }
    // A mixed rebase must retain every canonical acceleration. No cleanup residual may be discarded.
    if (selectedMotorIds.length && self.roles.some(p => Object.values(p.canonicalRoundingResidual.acceleration).some(n => n !== 0))) {
      throw new Error('owned motion cannot rebase an unsupported canonical acceleration residual');
    }
    return { playerId: self.playerId, personId: self.personId, selfHash: hash(self), at: self.at,
      kind: c.kind, motorSourceId: command?.source.sourceId ?? null, motorHash: command ? hash(command) : null,
      rootAuthority: command ? { owner: 'actual_locomotion_receipts' as const, sourceId: command.source.sourceId,
        sourceHash: hash(command.source), adoptionOwner: 'batted_world_field_executions' as const,
        adoptionSourceId: source.sourceId, adoptionSourceHash: hash(source),
        acceptedThroughTick: command.receipt.coverageEndTick } : self.ownedMotionCoverage?.rootAuthority ?? {
        owner: self.activeCommand.owner, sourceId: self.activeCommand.sourceId, sourceHash: self.activeCommand.sourceHash,
        adoptionOwner: self.activeCommand.owner, adoptionSourceId: self.activeCommand.adoptionSourceId, adoptionSourceHash: self.activeCommand.adoptionSourceHash,
        acceptedThroughTick: self.activeCommand.acceptedThroughTick },
      roleAuthorities: self.ownedMotionCoverage?.roleAuthorities ?? retainedRoles.map(p => ({ role: p.role, command: p.command,
        acceptedThroughTick: p.acceptedThroughTick })),
      retainedCommand: self.activeCommand, retainedRoles, command: command?.receipt.command ?? retained,
      coverageThroughTick: Math.min(coverage, command?.receipt.coverageEndTick ?? coverage) };
  });
  const at = contributors[0].at, ticksPerSecond = world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  if (contributors.some(c => json(c.at) !== json(at))) throw new Error('owned motion contributions do not share one exact predecessor');
  const knownWork = action.knownWork.map(w => {
    const decision = w.decisionSourceId === null ? null : decisions.find(d => d.source.sourceId === w.decisionSourceId);
    if (w.decisionSourceId !== null && (!decision || decision.source.playerId !== w.playerId
      || decision.source.physicalPitchSourceId !== world.flight.source.physicalPitchSourceId)) throw new Error('owned motion known decision scope differs');
    const adopted = w.motorSourceId !== null && previousAdoptions.some(a => a.playerId === w.playerId && a.motorSourceId === w.motorSourceId);
    const selected = w.motorSourceId !== null && selectedMotorIds.includes(w.motorSourceId);
    if (w.motorSourceId !== null && !adopted && !selected) throw new Error('owned motion due motor must be atomically adopted');
    if (w.motorSourceId !== null && !decision) throw new Error('owned motion motor lacks its known decision');
    const d = decision?.receipt;
    if (d && (d.observedThrough.originTick !== at.originTick || d.observedThrough.elapsedSeconds > at.elapsedSeconds)) {
      throw new Error('owned motion known decision is from a future cut');
    }
    if (d?.lifecycle.status === 'issued' && !adopted && !selected) throw new Error('owned motion issued decision awaits motor adoption');
    const dueTick = d?.lifecycle.status === 'pending_decision' ? d.scheduling.decisionTick
      : d?.lifecycle.status === 'pending_first_step' ? d.scheduling.movementStartTick : null;
    if (dueTick !== null && (dueTick - at.originTick) / ticksPerSecond <= at.elapsedSeconds) {
      throw new Error('owned motion due decision revision must be recorded before progress');
    }
    return { ...w, phase: d?.lifecycle.status ?? null, decisionHash: decision ? hash(decision) : null, motorAdoptedPreviously: adopted, dueTick };
  });
  const coverageThroughTick = Math.min(...contributors.map(c => c.coverageThroughTick));
  const checkpointThroughTick = Math.min(action.checkpointThroughTick, coverageThroughTick,
    ...knownWork.flatMap(w => w.dueTick === null ? [] : [w.dueTick]));
  if ((checkpointThroughTick - at.originTick) / ticksPerSecond <= at.elapsedSeconds) throw new Error('owned motion requires positive covered progress');
  return freeze(cloneInert({ version: 'owned_motion_composition_v1' as const, mode: selectedMotorIds.length ? 'rebase' as const : 'retained' as const,
    physicalPitchSourceId: world.flight.source.physicalPitchSourceId, at, ticksPerSecond,
    requestedCheckpointThroughTick: action.checkpointThroughTick, checkpointThroughTick, coverageThroughTick,
    contributors, commands: contributors.map(c => c.command), knownWork, sourceCoverage: 'explicit_known_sources_only' as const }));
};
export type OwnedMotionComposition = ReturnType<typeof deriveOwnedMotionComposition>;

export type OwnedMotionAdoption = Readonly<{
  version: 'owned_motion_adoption_v1'; physicalPitchSourceId: string; executionSourceId: string; executionRevision: number;
  predecessor: Readonly<{ baseFieldSourceId: string; executionSourceId: string | null }>;
  compositionHash: string; adoptedAt: ActualPlayerCommandAdoption['adoptedAt']; executedThrough: ActualPlayerCommandAdoption['adoptedAt'];
  requestedCheckpointThroughTick: number; acceptedCoverageThroughTick: number; checkpointThroughTick: number;
  status: 'checkpoint_reached' | 'physical_boundary' | 'coverage_exhausted';
  physicalBoundary: Readonly<{ responseKind: import('../../core/sim/ball/BattedWorldFieldMotion').BattedWorldFieldMotion['motion']['response']['kind'];
    cursorAvailable: boolean }> | null;
  contributors: readonly Readonly<{ playerId: string; motorSourceId: string | null; motorAdoptionEventId: string | null;
    executedThrough: ActualPlayerCommandAdoption['adoptedAt'] }>[];
}>;
export const ownedMotionAdoption = (composition: OwnedMotionComposition, source: Readonly<{ sourceId: string;
  baseFieldSourceId: string; previousExecutionSourceId: string | null }>, revision: number,
  result: import('../../core/sim/ball/BattedWorldFieldMotion').BattedWorldFieldMotion): OwnedMotionAdoption => {
  const end = result.motion.world.moment, executedThrough = { originTick: end.originTick, elapsedSeconds: end.elapsedSeconds, tick: end.ball.tick };
  return freeze({ version: 'owned_motion_adoption_v1', physicalPitchSourceId: composition.physicalPitchSourceId,
    executionSourceId: source.sourceId, executionRevision: revision,
    predecessor: { baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.previousExecutionSourceId },
    compositionHash: hash(composition), adoptedAt: composition.at, executedThrough,
    requestedCheckpointThroughTick: composition.requestedCheckpointThroughTick, acceptedCoverageThroughTick: composition.coverageThroughTick,
    checkpointThroughTick: composition.checkpointThroughTick,
    status: result.motion.world.kind === 'boundary' ? 'physical_boundary'
      : composition.checkpointThroughTick === composition.coverageThroughTick ? 'coverage_exhausted' : 'checkpoint_reached',
    physicalBoundary: result.motion.world.kind === 'boundary'
      ? { responseKind: result.motion.response.kind, cursorAvailable: result.motion.cursor !== null } : null,
    contributors: composition.contributors.map(c => ({ playerId: c.playerId, motorSourceId: c.motorSourceId,
      motorAdoptionEventId: c.motorSourceId === null ? null : json(['owned_motion_adoption_v1', composition.physicalPitchSourceId,
        c.playerId, 'actual_locomotion_receipts', c.motorSourceId, 'batted_world_field_executions', source.sourceId]), executedThrough })),
  });
};
