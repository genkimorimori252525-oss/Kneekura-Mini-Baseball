import { describe, expect, it } from 'vitest';
import type { CanonicalWorldSnapshot } from '../../model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { DefensiveDecisionInput } from '../fielding/DefensiveDecision';
import type { RunnerDecisionInput } from '../running/RunnerDecision';
import { createLivePlayRegistry, type LivePlayRegistry } from './LivePlayRegistry';
import { resolveLivePlayFromActorPolicies } from './ActorPolicySettlement';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('test-rules'), inning: 1, half: 'top', outs: 0,
  balls: 0, strikes: 0, bases: { first: 'runner', second: null, third: null },
  score: { away: 0, home: 0 }, playId: 7,
};
const world = (tick = 1_500_000): CanonicalWorldSnapshot => ({
  tick,
  runners: [{ playerId: 'runner', position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }],
  defenders: [{ playerId: 'pitcher', registeredPosition: 'P', position: { x: 1, z: 0 },
    velocity: { x: 0, z: 0 }, assignment: { kind: 'hold' } }],
  ball: null,
});
const runner = (tagUp: RunnerDecisionInput['perceivedWorld']['knownContext']['tagUp'] = { kind: 'none' }): RunnerDecisionInput => ({
  runnerId: 'runner',
  perceivedWorld: {
    observerId: 'runner', observationTime: 1_000_000,
    attention: { target: { kind: 'base', base: 2 }, focusedSinceTick: 900_000 },
    ball: null, players: [], communications: [],
    knownContext: { currentBase: 1, nextBase: 2, forcedToAdvance: false, tagUp },
  },
  perceivedCues: [], minimumCueConfidence: 0.5, coachTrust: 1,
  minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
  timingParameters: {
    minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000,
    fixedRecognitionOffsetTicks: 10_000,
  },
});
const defender = (perceivedCues: DefensiveDecisionInput['perceivedCues'] = []): DefensiveDecisionInput => ({
  perceivedWorld: {
    observerId: 'pitcher', observationTime: 1_200_000,
    attention: { target: { kind: 'base', base: 1 }, focusedSinceTick: 1_100_000 },
    ball: null, players: [], communications: [], knownContext: { outs: 0, occupiedBases: [1] },
  },
  self: { playerId: 'pitcher', registeredPosition: 'P', position: { x: 1, z: 0 } },
  prePlayPlan: {
    ballPursuitPriority: 0.3, baseCoverPriorities: [{ base: 1, priority: 0.8 }],
    relayPriority: 0.4, backupPriority: 0.4, deepCoveragePriority: 0.2, holdPriority: 0.1,
  },
  perceivedCues, minimumCueConfidence: 0.5, communicationTrust: 1,
});
const input = (registry: LivePlayRegistry, snapshot = world(), runnerInput = runner(),
  defenderInput = defender()) => ({
  match, world: snapshot, registry, terminal: 'none' as const,
  runnerPolicies: [{ decisionEventId: 'runner-decision', input: runnerInput }],
  defenderPolicies: [{ decisionEventId: 'defender-decision', input: defenderInput,
    situationalAwareness: 0.8,
    timingParameters: { minimumDecisionDelayTicks: 40_000, maximumDecisionDelayTicks: 240_000,
      fixedProcessingOffsetTicks: 10_000 } }],
});
const empty = () => createLivePlayRegistry({ playId: 7, revision: 0, sources: [] });

describe('actor settlement from accepted policy decisions', () => {
  it('settles quiescent hold decisions after their decision ticks and permits PlayEnd', () => {
    const result = resolveLivePlayFromActorPolicies(input(empty()));
    expect(result.actors).toMatchObject([
      { actorId: 'runner', kind: 'settled_for_play', basisEventId: 'runner-decision' },
      { actorId: 'pitcher', kind: 'settled_for_play', basisEventId: 'defender-decision' },
    ]);
    expect(result.resolution.kind).toBe('ended');
  });

  it('keeps tag-up waiting and actionable advance decisions active', () => {
    const waiting = resolveLivePlayFromActorPolicies(input(empty(), world(), runner({ kind: 'awaiting_first_touch' })));
    expect(waiting.actors[0].kind).toBe('acting');
    expect(waiting.resolution.kind).toBe('continues');
    const forced = runner();
    const advancing = resolveLivePlayFromActorPolicies(input(empty(), world(), {
      ...forced, perceivedWorld: { ...forced.perceivedWorld,
        knownContext: { ...forced.perceivedWorld.knownContext, forcedToAdvance: true } },
    }));
    expect(advancing.actors[0].kind).toBe('acting');
  });

  it('keeps actors moving or awaiting an incomplete source active despite a hold decision', () => {
    const moving = world();
    const result = resolveLivePlayFromActorPolicies(input(empty(), {
      ...moving, runners: [{ ...moving.runners[0], velocity: { x: 0.1, z: 0 } }],
    }));
    expect(result.actors[0].kind).toBe('acting');
    const pending = createLivePlayRegistry({ playId: 7, revision: 0, sources: [{
      sourceId: 'ball', revision: 1, queue: null,
      physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
    }] });
    const unresolved = resolveLivePlayFromActorPolicies(input(pending));
    expect(unresolved.actors.every((actor) => actor.kind === 'acting')).toBe(true);
    expect(unresolved.resolution.kind).toBe('continues');
  });

  it('keeps a decision pending until its actual policy decision tick', () => {
    const result = resolveLivePlayFromActorPolicies(input(empty(), world(1_210_000)));
    expect(result.actors.some((actor) => actor.kind === 'decision_pending')).toBe(true);
    expect(result.resolution.kind).toBe('continues');
  });

  it('requires exactly one policy decision per world actor and rejects future observations', () => {
    expect(() => resolveLivePlayFromActorPolicies({ ...input(empty()), defenderPolicies: [] }))
      .toThrow('policy decisions must cover every world actor exactly once');
    expect(() => resolveLivePlayFromActorPolicies(input(empty(), world(1_100_000))))
      .toThrow('policy observation cannot be in the future');
  });

  it('rejects quiescence claims while an untracked ball is still moving', () => {
    expect(() => resolveLivePlayFromActorPolicies(input(empty(), {
      ...world(), ball: { position: { x: 0, y: 1, z: 0 },
        velocity: { x: 0, y: -2, z: 0 }, spin: { x: 0, y: 0, z: 0 } },
    }))).toThrow('moving ball requires an active physical source');
  });
});
