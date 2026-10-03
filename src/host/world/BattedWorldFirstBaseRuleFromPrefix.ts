import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleEvidenceInput, type BallWorldBattedRuleContact, type BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import { deriveBallWorldGroundFirstBaseRace } from '../../core/rules/BallWorldGroundFirstBaseRace';
import { createControlledBaseFactsFromBallWorldContacts, createRunnerBaseFactsFromBallWorldHistory } from '../../core/rules/BallWorldBaseContactPhysicalAdapter';
import { resolveGroundBallFirstBaseRule } from '../../core/rules/RuleEngine';
import type { BallWorldMoment, BallWorldBoundaryContact } from '../../core/sim/ball/BallWorldContinuation';
import type { BattedWorldAcquisition } from '../../core/sim/ball/BattedWorldAcquisition';
import type { BattedWorldContact } from '../../core/sim/ball/BattedBallWorldContacts';
import type { DurableBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import type { DurableBattedWorldExecution } from './SqliteBattedWorldExecutionStore';
import type { DurableBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { battedWorldBaseTouchHistoryFromPrefix } from './BattedWorldBaseTouchHistoryFromPrefix';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type PrefixInput = Readonly<{
  baseMotion: DurableBattedWorldMotion; motions: readonly DurableBattedWorldMotion[];
  executions: readonly DurableBattedWorldExecution[]; geometry: DurableBattedWorldBaseGeometry;
}>;
/** Consume only the execution owner's rederived complete original and actual physical prefixes. */
const physicalPrefix = (input: PrefixInput) => {
  const base = input.baseMotion, world = base.response.touch.worldContact, original = base.response.result;
  const originTick = world.flight.flight.initialBall.tick, ticksPerSecond = world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const frames: BallWorldBattedRuleContactFrame[] = [], acquisitions: BattedWorldAcquisition[] = [];
  const normalize = (contact: BattedWorldContact | BallWorldBoundaryContact): BallWorldBattedRuleContact => contact.kind === 'actor'
    ? { kind: 'actor', playerId: contact.playerId, role: contact.role } : contact.kind === 'surface'
      ? { kind: 'surface', surfaceId: contact.surfaceId } : { kind: contact.kind };
  const append = (moment: BallWorldMoment, contacts: readonly (BattedWorldContact | BallWorldBoundaryContact)[]) => {
    const existing = frames.at(-1), normalized = contacts.map(normalize);
    if (existing?.moment.elapsedSeconds === moment.elapsedSeconds) {
      if (existing.moment.originTick !== moment.originTick || json(existing.moment.ball.position) !== json(moment.ball.position)) {
        throw new Error('actual batted rule coincident contact positions differ');
      }
      const merged = [...existing.contacts];
      for (const contact of normalized) if (!merged.some((value) => json(value) === json(contact))) merged.push(contact);
      frames[frames.length - 1] = { moment: existing.moment, contacts: merged };
    } else frames.push({ moment, contacts: normalized });
  };
  if (world.result.kind === 'contact') {
    const moment = 'geometry' in original ? { originTick, elapsedSeconds: original.geometry.elapsedSeconds, ball: original.geometry.ball }
      : { originTick, elapsedSeconds: (world.result.tick - originTick) / ticksPerSecond, ball: world.result.ball };
    append(moment, world.result.contacts);
  }
  for (const step of base.continuation?.result.steps ?? []) if (step.world.kind === 'boundary') append(step.world.moment, step.world.contacts);
  const capture = (value: BattedWorldAcquisition) => {
    acquisitions.push(value);
    if (value.kind === 'interrupted') append(value.world.moment, value.world.contacts);
  };
  if (base.acquisition) capture(base.acquisition.result);
  const motions = input.motions.filter((value) => value.revision <= base.revision);
  if (motions.length !== base.revision || motions.at(-1)?.source.sourceId !== base.source.sourceId) throw new Error('actual batted rule motion prefix differs');
  let horizon = motions[0].motion.world.moment;
  for (const value of motions) {
    horizon = value.motion.world.moment;
    if (value.motion.world.kind === 'boundary') append(horizon, value.motion.world.contacts);
  }
  for (const value of input.executions) {
    if (value.execution.kind === 'motion' || value.execution.kind === 'throw') {
      const actual = value.execution.motion.world;
      horizon = actual.moment;
      if (actual.kind === 'boundary') append(horizon, actual.contacts);
    } else if (value.execution.kind === 'acquisition') {
      const acquired = value.execution.acquisition;
      capture(acquired);
      horizon = acquired.kind === 'secured' ? acquired.moment : acquired.world.moment;
    }
  }
  const batter = world.flight.physicalPitch.frame.batterActor!, surface = input.geometry.geometry.bases.first;
  for (const binding of [batter.binding, ...batter.defenderBindings]) {
    const actor = world.modelActorEvidence.find((value) => value.binding.playerId === binding.playerId);
    if (!actor || json(actor.binding) !== json(binding)) throw new Error('actual first-base rule active Player scope differs');
  }
  const ownHistory = (playerId: string) => battedWorldBaseTouchHistoryFromPrefix({ ...input, playerId,
    base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
  const batterFirstBase = ownHistory(batter.binding.playerId);
  const defendersFirstBase = batter.defenderBindings.map((binding) => ownHistory(binding.playerId));
  const ballInput: BallWorldBattedRuleEvidenceInput = { batterRunnerId: batter.binding.playerId,
    defenderIds: batter.defenderBindings.map((binding) => binding.playerId), field: input.geometry.geometry.field,
    bases: { homePlate: input.geometry.geometry.field.homePlate, firstBase: surface.region.center,
      secondBase: input.geometry.geometry.bases.second.region.center, thirdBase: input.geometry.geometry.bases.third.region.center },
    ballRadiusMeters: world.flight.source.execution.ballFlightParameters.ballRadius, originTick, ticksPerSecond, horizon,
    contacts: frames, acquisitions };
  return { ballInput, batterFirstBase, defendersFirstBase, world };
};

/** Preserve the existing archived tick-only interpretation and its exact output shape. */
export const battedWorldFirstBaseRuleFromPrefix = (input: PrefixInput) => {
  const { ballInput, batterFirstBase, defendersFirstBase, world } = physicalPrefix(input);
  const batter = world.flight.physicalPitch.frame.batterActor!, ballEvidence = deriveBallWorldBattedRuleEvidence(ballInput);
  const runnerFacts = createRunnerBaseFactsFromBallWorldHistory({ history: batterFirstBase.history, base: 'first' });
  const controlled = defendersFirstBase.flatMap((value) => value.controlledContacts.map((contact) => ({ contact, history: value.history })))
    .sort((left, right) => left.contact.elapsedSeconds - right.contact.elapsedSeconds);
  const firstControl = controlled[0];
  const defenderControl = firstControl ? createControlledBaseFactsFromBallWorldContacts({ history: firstControl.history,
    contacts: [firstControl.contact], base: 'first' })[0] : null;
  const runnerTouch = runnerFacts.find((fact) => fact.kind === 'runner_base_touch') ?? null;
  const groundRule = ballEvidence.kind === 'grounded' && ballEvidence.territory === 'fair'
    && ballEvidence.pendingContacts.length === 0 ? resolveGroundBallFirstBaseRule({
    outsAtStart: world.flight.physicalPitch.frame.match.outs, batterRunnerId: batter.binding.playerId,
    defenderControl, batterRunnerTouch: runnerTouch, homeTouches: [] }) : null;
  return { ballEvidence, batterFirstBase, defendersFirstBase, groundRule };
};

/** Additive actual-time race observation; no caller-supplied result or future touch is accepted. */
export const battedWorldFirstBaseRaceFromPrefix = (input: PrefixInput) => {
  const { ballInput, batterFirstBase, defendersFirstBase, world } = physicalPrefix(input);
  const result = deriveBallWorldGroundFirstBaseRace({ ball: ballInput, race: {
    outsAtStart: world.flight.physicalPitch.frame.match.outs, batterRunnerId: ballInput.batterRunnerId, defenderIds: ballInput.defenderIds,
    originTick: ballInput.originTick, ticksPerSecond: ballInput.ticksPerSecond, horizonElapsedSeconds: ballInput.horizon.elapsedSeconds,
    runnerHistory: batterFirstBase.history, defenders: defendersFirstBase } });
  return { ...result, batterFirstBase, defendersFirstBase };
};
