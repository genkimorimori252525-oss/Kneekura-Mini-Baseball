import { ownedScheduledMotionMotorCutProof } from './OwnedScheduledMotionMotorCut';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { DurableActualLocomotion } from './SqliteActualLocomotionStore';
import type { DurableActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
type Prefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];

export const deriveOwnedScheduledMotionComposition = (source: Readonly<{ sourceId: string; sourceVersion: string; baseFieldSourceId: string;
  previousExecutionSourceId: string | null; action: OwnedMotionV2Action }>, prefix: Prefix,
  motors: readonly DurableActualLocomotion[], decisions: readonly DurableActualDefensiveDecision[]) => {
  const action = source.action;
  const retainedQuantizer = action.checkpoint.kind === 'retained_quantizer_bucket_v1';
  if (retainedQuantizer && action.contributions.some(c => c.kind !== 'retained')) {
    throw new Error('retained quantizer checkpoint admits no motor adoption');
  }
  const world = prefix.baseField.response.touch.worldContact, batter = world.flight.physicalPitch.frame.batterActor!;
  const bindings = [batter.binding, ...batter.defenderBindings], playerIds = bindings.map(b => b.playerId);
  if (bindings.length !== 10 || new Set(playerIds).size !== 10
    || action.contributions.some(c => !playerIds.includes(c.playerId)) || action.knownWork.some(w => !playerIds.includes(w.playerId))) {
    throw new Error('owned motion requires exactly the original ten Player bindings');
  }
  const previousAdoptions = prefix.executions.flatMap(v => (v.execution.kind === 'owned_motion_v1' || v.execution.kind === 'owned_motion_v2')
    ? v.execution.adoption.contributors.filter(c => c.motorSourceId !== null).map(c => ({ playerId: c.playerId, motorSourceId: c.motorSourceId! })) : []);
  const selectedMotorIds = action.contributions.flatMap(c => c.kind === 'motor' ? [c.motorSourceId] : []);
  if (new Set(selectedMotorIds).size !== selectedMotorIds.length || selectedMotorIds.some(s => previousAdoptions.some(a => a.motorSourceId === s))) {
    throw new Error('owned motor issuance is already adopted');
  }
  const selves = actualPlayersKinematicsFromPrefix(playerIds, prefix);
  const contributors = bindings.map(binding => {
    const c = action.contributions.find(c => c.playerId === binding.playerId)!, self = selves.find(s => s.playerId === binding.playerId)!;
    const known = action.knownWork.find(w => w.playerId === binding.playerId)!;
    if (!c || !known || self.personId !== binding.personId || self.personLinkSourceId !== binding.personLinkSourceId
      || self.gameDay !== binding.gameDay || self.gameId !== binding.gameId || self.roles.length !== 5
      || new Set(self.roles.map(p => p.role)).size !== 5) throw new Error('owned motion original Player/Person/role scope differs');
    const retainedRoles = self.roles.map(p => ({ role: p.role, radiusMeters: p.radiusMeters, command: self.activeCommand,
      acceptedThroughTick: Math.min(p.canonicalActor.primitive.endTick, self.activeCommand.acceptedThroughTick),
      offsetAcceleration: p.declaredPose.relativeAcceleration }));
    if (retainedQuantizer && self.ownedMotionCoverage && (self.ownedMotionCoverage.roleAuthorities.length !== 5
      || new Set(self.ownedMotionCoverage.roleAuthorities.map(p => p.role)).size !== 5
      || retainedRoles.some(p => !self.ownedMotionCoverage!.roleAuthorities.some(a => a.role === p.role)))) {
      throw new Error('retained quantizer checkpoint relative authority scope differs');
    }
    const coverage = Math.min(self.activeCommand.acceptedThroughTick, self.ownedMotionCoverage?.rootAuthority.acceptedThroughTick ?? Infinity,
      ...retainedRoles.map(p => p.acceptedThroughTick),
      ...(retainedQuantizer ? self.ownedMotionCoverage?.roleAuthorities.map(p => p.acceptedThroughTick) ?? [] : []));
    // Retained exact execution must remain replayable by the unchanged original
    // kinematics owner. It cannot silently shorten a physical curve to repair
    // an inconsistent root/relative authority or manufacture a common horizon.
    const physicalCoverage = self.ownedMotionCoverage?.physicalThroughTick ?? self.activeCommand.acceptedThroughTick;
    if (retainedQuantizer && (coverage !== physicalCoverage
      || self.roles.some(p => p.canonicalActor.primitive.endTick !== physicalCoverage))) {
      throw new Error('retained quantizer checkpoint authority/physical coverage differs');
    }
    if ((coverage - self.at.originTick) / self.ticksPerSecond < self.at.elapsedSeconds) throw new Error('owned motion retained command coverage exhausted');
    const retained = { playerId: self.playerId, bodyAcceleration: self.root.acceleration,
      primitiveMotions: retainedRoles.map(p => ({ role: p.role, offsetAcceleration: p.offsetAcceleration })) };
    const command = c.kind === 'motor' ? motors.find(m => m.source.sourceId === c.motorSourceId) : null;
    if (c.kind === 'retained' && json(c.command) !== json(self.activeCommand)) throw new Error('owned motion retained command/adoption reference is stale');
    if (c.kind === 'motor') {
      if (!command || known.motorSourceId !== command.source.sourceId || known.decisionSourceId !== command.source.decisionSourceId
        || command.source.playerId !== self.playerId || command.source.physicalPitchSourceId !== self.physicalPitchSourceId
        || command.source.baseFieldSourceId !== prefix.baseField.source.sourceId) throw new Error('owned motion selected motor original cut or known work differs');
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
    const motorCutProof = command ? ownedScheduledMotionMotorCutProof(command, prefix, selves) : null;
    return { playerId: self.playerId, personId: self.personId, selfHash: hash(self), at: self.at, motorCutProof,
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
  const quantizerBoundary = action.checkpoint.kind === 'retained_quantizer_bucket_v1' ? deriveQuantizerClosedGenerationBoundary({
    originTick: at.originTick, throughTick: action.checkpoint.throughTick, ticksPerSecond }) : null;
  const requestedElapsedSeconds = action.checkpoint.kind === 'operation' ? action.checkpoint.throughElapsedSeconds
    : quantizerBoundary?.lastIncludedElapsedSeconds ?? (action.checkpoint.throughTick - at.originTick) / ticksPerSecond;
  if (retainedQuantizer && requestedElapsedSeconds <= at.elapsedSeconds) {
    throw new Error('retained quantizer checkpoint exact endpoint is already reached or past; no segment executed');
  }
  if (!Number.isFinite(requestedElapsedSeconds) || requestedElapsedSeconds < at.elapsedSeconds) throw new Error('owned operation checkpoint precedes actual cut');
  if (action.checkpoint.kind === 'operation') quantizeEventTick(at.originTick, requestedElapsedSeconds, ticksPerSecond);
  const positive = requestedElapsedSeconds > at.elapsedSeconds;
  const knownWork = action.knownWork.map(w => {
    const decision = w.decisionSourceId === null ? null : decisions.find(d => d.source.sourceId === w.decisionSourceId);
    if (w.decisionSourceId !== null && (!decision || decision.source.playerId !== w.playerId
      || decision.source.physicalPitchSourceId !== world.flight.source.physicalPitchSourceId)) throw new Error('owned motion known decision scope differs');
    const adopted = w.motorSourceId !== null && previousAdoptions.some(a => a.playerId === w.playerId && a.motorSourceId === w.motorSourceId);
    const selected = w.motorSourceId !== null && selectedMotorIds.includes(w.motorSourceId);
    if ((positive || selectedMotorIds.length > 0) && w.motorSourceId !== null && !adopted && !selected) throw new Error('owned motion due motor must be atomically adopted');
    if (w.motorSourceId !== null && !decision) throw new Error('owned motion motor lacks its known decision');
    const d = decision?.receipt;
    if (d && (d.observedThrough.originTick !== at.originTick || d.observedThrough.elapsedSeconds > at.elapsedSeconds)) {
      throw new Error('owned motion known decision is from a future cut');
    }
    if (positive && d?.lifecycle.status === 'issued' && !adopted && !selected) throw new Error('owned motion issued decision awaits motor adoption');
    const dueTick = d?.lifecycle.status === 'pending_decision' ? d.scheduling.decisionTick
      : d?.lifecycle.status === 'pending_first_step' ? d.scheduling.movementStartTick : null;
    if (positive && dueTick !== null && (dueTick - at.originTick) / ticksPerSecond <= at.elapsedSeconds) {
      throw new Error('owned motion due decision revision must be recorded before progress');
    }
    return { ...w, phase: d?.lifecycle.status ?? null, decisionHash: decision ? hash(decision) : null, motorAdoptedPreviously: adopted, dueTick };
  });
  const coverageThroughTick = Math.min(...contributors.map(c => c.coverageThroughTick));
  const checkpointThroughElapsedSeconds = Math.min(requestedElapsedSeconds, (coverageThroughTick - at.originTick) / ticksPerSecond,
    ...knownWork.flatMap(w => w.dueTick === null ? [] : [Math.max(at.elapsedSeconds, (w.dueTick - at.originTick) / ticksPerSecond)]));
  if (checkpointThroughElapsedSeconds < at.elapsedSeconds || positive && checkpointThroughElapsedSeconds === at.elapsedSeconds) {
    throw new Error('owned motion requires covered progress');
  }
  return freeze(cloneInert({ version: 'owned_motion_composition_v2' as const, mode: selectedMotorIds.length ? 'rebase' as const : 'retained' as const,
    physicalPitchSourceId: world.flight.source.physicalPitchSourceId, at, ticksPerSecond,
    requestedCheckpoint: action.checkpoint, checkpointThroughElapsedSeconds, coverageThroughTick,
    ...(quantizerBoundary ? { quantizerBoundary } : {}),
    contributors, commands: contributors.map(c => c.command), knownWork, sourceCoverage: 'explicit_known_sources_only' as const }));
};
