import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../model/CanonicalWorldSnapshot';
import {
  decideDefensiveIntent,
  type DefensiveDecisionInput,
} from '../fielding/DefensiveDecision';
import type { DefensiveDecisionTimingParameters } from '../fielding/DefensiveDecisionTiming';
import { decideRunnerMotionIntent, type RunnerDecisionInput } from '../running/RunnerDecision';
import type { ActorPlayDisposition, TerminalLiveActionCondition } from './ActionFrontier';
import {
  resolveLivePlayRegistry,
  type LivePlayRegistry,
  type LivePlayRegistryResolution,
} from './LivePlayRegistry';

export type RunnerActorPolicy = Readonly<{
  decisionEventId: string;
  input: RunnerDecisionInput;
}>;

export type DefenderActorPolicy = Readonly<{
  decisionEventId: string;
  input: DefensiveDecisionInput;
  situationalAwareness: number;
  timingParameters: DefensiveDecisionTimingParameters;
}>;

export type ResolveLivePlayFromActorPoliciesInput = Readonly<{
  match: CanonicalMatchState;
  world: CanonicalWorldSnapshot;
  registry: LivePlayRegistry;
  terminal: TerminalLiveActionCondition;
  runnerPolicies: readonly RunnerActorPolicy[];
  defenderPolicies: readonly DefenderActorPolicy[];
}>;

export type ActorPolicySettlementResolution = LivePlayRegistryResolution & Readonly<{
  actors: readonly ActorPlayDisposition[];
}>;

const nonEmpty = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
};

const stopped = (velocity: Readonly<{ x: number; z: number }>): boolean =>
  velocity.x === 0 && velocity.z === 0;

const policyMap = <T extends { decisionEventId: string }>(
  policies: readonly T[],
  actorIdOf: (policy: T) => string,
): Map<string, T> => {
  const result = new Map<string, T>();
  for (const policy of policies) {
    nonEmpty(policy.decisionEventId, 'policy decisionEventId');
    const actorId = nonEmpty(actorIdOf(policy), 'policy actorId');
    if (result.has(actorId)) throw new Error('policy decisions must cover every world actor exactly once');
    result.set(actorId, policy);
  }
  return result;
};

export const resolveLivePlayFromActorPolicies = (
  input: ResolveLivePlayFromActorPoliciesInput,
): ActorPolicySettlementResolution => {
  const request = cloneInert(input);
  const currentTick = request.world.tick;
  if (!Number.isSafeInteger(currentTick) || currentTick < 0) {
    throw new Error('world tick must be a non-negative safe integer');
  }
  if (request.match.playId !== request.registry.playId) {
    throw new Error('match playId must match live-play registry');
  }
  const runners = policyMap(request.runnerPolicies, (policy) => policy.input.runnerId);
  const defenders = policyMap(request.defenderPolicies, (policy) => policy.input.self.playerId);
  const worldRunnerIds = request.world.runners.map((actor) => nonEmpty(actor.playerId, 'world runnerId'));
  const worldDefenderIds = request.world.defenders.map((actor) => nonEmpty(actor.playerId, 'world defenderId'));
  if (new Set([...worldRunnerIds, ...worldDefenderIds]).size !== worldRunnerIds.length + worldDefenderIds.length
    || runners.size !== worldRunnerIds.length || defenders.size !== worldDefenderIds.length
    || worldRunnerIds.some((actorId) => !runners.has(actorId))
    || worldDefenderIds.some((actorId) => !defenders.has(actorId))) {
    throw new Error('policy decisions must cover every world actor exactly once');
  }
  const sourcesComplete = request.registry.sources.every((source) => source.completion !== undefined
    && source.completion.completedAtTick <= currentTick);
  if (request.terminal === 'none' && request.world.ball !== null
    && (request.world.ball.velocity.x !== 0 || request.world.ball.velocity.y !== 0
      || request.world.ball.velocity.z !== 0)
    && !request.registry.sources.some((source) => source.physical.some((work) => work.kind === 'ball_motion'))) {
    throw new Error('moving ball requires an active physical source');
  }
  const actors: ActorPlayDisposition[] = [];
  for (const actor of request.world.runners) {
    const policy = runners.get(actor.playerId)!;
    if (policy.input.perceivedWorld.observationTime > currentTick) {
      throw new Error('policy observation cannot be in the future');
    }
    const decision = decideRunnerMotionIntent(policy.input);
    if (decision.decisionTick > currentTick) {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'decision_pending', dueTick: decision.decisionTick }));
    } else if (decision.motionIntent.kind === 'hold' && decision.reason !== 'tag_up_wait'
      && sourcesComplete && stopped(actor.velocity)) {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'settled_for_play',
        settledAt: decision.decisionTick, basisEventId: policy.decisionEventId }));
    } else {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'acting' }));
    }
  }
  for (const actor of request.world.defenders) {
    const policy = defenders.get(actor.playerId)!;
    if (policy.input.perceivedWorld.observationTime > currentTick) {
      throw new Error('policy observation cannot be in the future');
    }
    if (policy.input.self.registeredPosition !== actor.registeredPosition
      || policy.input.self.position.x !== actor.position.x
      || policy.input.self.position.z !== actor.position.z) {
      throw new Error('defender policy self must match the canonical world');
    }
    const decision = decideDefensiveIntent(
      policy.input, policy.situationalAwareness, policy.timingParameters,
    );
    if (decision.decisionTick > currentTick) {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'decision_pending', dueTick: decision.decisionTick }));
    } else if (decision.intent.kind === 'hold' && actor.assignment.kind === 'hold'
      && sourcesComplete && stopped(actor.velocity)) {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'settled_for_play',
        settledAt: decision.decisionTick, basisEventId: policy.decisionEventId }));
    } else {
      actors.push(Object.freeze({ actorId: actor.playerId, kind: 'acting' }));
    }
  }
  const resolution = resolveLivePlayRegistry(request.registry, {
    tick: currentTick, actors, terminal: request.terminal,
  });
  return Object.freeze({ ...resolution, actors: Object.freeze(actors) });
};
