import { createPlayEndFact, type PlayEndFact } from '../../rules/PhysicalRuleFacts';

export type PendingPhysicalWork = Readonly<{
  workId: string;
  kind: 'ball_motion' | 'runner_motion' | 'defender_motion' | 'throw' | 'reception' | 'tag' | 'possession_transition';
  actorId?: string;
  throughTick: number;
  actionKey: string;
}>;

export type PendingIntentWork = Readonly<{
  workId: string;
  kind: 'issued_intent';
  actorId: string;
  dueTick: number;
  actionKey: string;
}>;

export type PendingInformationWork = Readonly<{
  workId: string;
  kind: 'in_flight_information';
  actorId?: string;
  dueTick: number;
  causeEventId: string;
}>;

export type PendingDecisionWork = Readonly<{
  workId: string;
  kind: 'actor_decision';
  actorId: string;
  dueTick: number;
}>;

export type PendingRuleWindow = Readonly<{
  workId: string;
  kind: 'live_rule_window';
  windowId: string;
  openedAtTick: number;
}>;

export type ActorPlayDisposition =
  | Readonly<{ actorId: string; kind: 'acting' }>
  | Readonly<{ actorId: string; kind: 'decision_pending'; dueTick: number }>
  | Readonly<{ actorId: string; kind: 'waiting_on_pending_trigger'; triggerId: string }>
  | Readonly<{ actorId: string; kind: 'settled_for_play'; settledAt: number; basisEventId: string }>;

export type LiveActionFrontierInput = {
  tick: number;
  physical: PendingPhysicalWork[];
  intents: PendingIntentWork[];
  information: PendingInformationWork[];
  decisions: PendingDecisionWork[];
  ruleWindows: PendingRuleWindow[];
  actors: ActorPlayDisposition[];
  eventQueueSettledThroughTick: number;
};

export type LiveActionFrontier = Readonly<{
  tick: number;
  physical: readonly PendingPhysicalWork[];
  intents: readonly PendingIntentWork[];
  information: readonly PendingInformationWork[];
  decisions: readonly PendingDecisionWork[];
  ruleWindows: readonly PendingRuleWindow[];
  actors: readonly ActorPlayDisposition[];
  eventQueueSettledThroughTick: number;
}>;

export type PlayEndBlocker =
  | Readonly<{ kind: 'pending_physical'; workId: string }>
  | Readonly<{ kind: 'pending_intent'; workId: string }>
  | Readonly<{ kind: 'pending_information'; workId: string }>
  | Readonly<{ kind: 'pending_decision'; workId: string }>
  | Readonly<{ kind: 'pending_rule_window'; workId: string }>
  | Readonly<{ kind: 'actor_not_settled'; actorId: string }>
  | Readonly<{ kind: 'event_queue_unsettled'; settledThroughTick: number; requiredThroughTick: number }>;

export type PlayEndResolution =
  | Readonly<{
      kind: 'ended';
      playEnd: PlayEndFact;
      frontier: LiveActionFrontier;
      reason: 'dead_ball' | 'all_offense_terminal' | 'terminal_rule_event' | 'action_frontier_empty';
    }>
  | Readonly<{
      kind: 'continues';
      frontier: LiveActionFrontier;
      blockers: readonly PlayEndBlocker[];
    }>;

export type TerminalLiveActionCondition = 'none' | 'dead_ball' | 'all_offense_terminal' | 'terminal_rule_event';

const tick = (value: number, name: string, allowMinusOne = false): number => {
  if (!Number.isSafeInteger(value) || value < (allowMinusOne ? -1 : 0)) {
    throw new Error(`${name} must be ${allowMinusOne ? 'a safe integer >= -1' : 'a non-negative safe integer'}`);
  }
  return value;
};

const id = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
};

const freezeArray = <T extends object>(items: readonly T[]): readonly T[] =>
  Object.freeze(items.map((item) => Object.freeze({ ...item })));

export const createLiveActionFrontier = (input: LiveActionFrontierInput): LiveActionFrontier => {
  const currentTick = tick(input.tick, 'frontier tick');
  const settled = tick(input.eventQueueSettledThroughTick, 'event queue watermark', true);
  if (settled > currentTick) throw new Error('event queue watermark cannot exceed the frontier tick');

  const workIds = new Set<string>();
  const takeWorkId = (workId: string): void => {
    id(workId, 'workId');
    if (workIds.has(workId)) throw new Error('live-action work ids must be unique across frontier categories');
    workIds.add(workId);
  };

  for (const work of input.physical) {
    takeWorkId(work.workId);
    id(work.actionKey, 'actionKey');
    tick(work.throughTick, 'physical throughTick');
    if (work.actorId !== undefined) id(work.actorId, 'actorId');
  }
  for (const work of input.intents) {
    takeWorkId(work.workId);
    id(work.actorId, 'actorId');
    id(work.actionKey, 'actionKey');
    tick(work.dueTick, 'intent dueTick');
  }
  for (const work of input.information) {
    takeWorkId(work.workId);
    id(work.causeEventId, 'causeEventId');
    tick(work.dueTick, 'information dueTick');
    if (work.actorId !== undefined) id(work.actorId, 'actorId');
  }
  for (const work of input.decisions) {
    takeWorkId(work.workId);
    id(work.actorId, 'actorId');
    tick(work.dueTick, 'decision dueTick');
  }
  for (const work of input.ruleWindows) {
    takeWorkId(work.workId);
    id(work.windowId, 'windowId');
    if (tick(work.openedAtTick, 'rule window openedAtTick') > currentTick) {
      throw new Error('live rule window cannot open after the frontier tick');
    }
  }

  const actorIds = new Set<string>();
  for (const actor of input.actors) {
    id(actor.actorId, 'actorId');
    if (actorIds.has(actor.actorId)) throw new Error('live-action actor ids must be unique');
    actorIds.add(actor.actorId);
    if (actor.kind === 'decision_pending') tick(actor.dueTick, 'actor dueTick');
    if (actor.kind === 'waiting_on_pending_trigger') id(actor.triggerId, 'triggerId');
    if (actor.kind === 'settled_for_play') {
      id(actor.basisEventId, 'basisEventId');
      if (tick(actor.settledAt, 'actor settledAt') > currentTick) {
        throw new Error('actor cannot settle in the future');
      }
    }
  }

  return Object.freeze({
    tick: currentTick,
    physical: freezeArray(input.physical),
    intents: freezeArray(input.intents),
    information: freezeArray(input.information),
    decisions: freezeArray(input.decisions),
    ruleWindows: freezeArray(input.ruleWindows),
    actors: freezeArray(input.actors),
    eventQueueSettledThroughTick: settled,
  });
};

const closureBlockers = (frontier: LiveActionFrontier): PlayEndBlocker[] => {
  const blockers: PlayEndBlocker[] = [];
  if (frontier.eventQueueSettledThroughTick < frontier.tick) {
    blockers.push(Object.freeze({
      kind: 'event_queue_unsettled',
      settledThroughTick: frontier.eventQueueSettledThroughTick,
      requiredThroughTick: frontier.tick,
    }));
  }
  for (const work of frontier.ruleWindows) {
    blockers.push(Object.freeze({ kind: 'pending_rule_window', workId: work.workId }));
  }
  return blockers;
};

export const resolvePlayEndFromFrontier = (
  frontier: LiveActionFrontier,
  terminal: TerminalLiveActionCondition = 'none',
): PlayEndResolution => {
  const blockers = closureBlockers(frontier);
  if (terminal === 'none') {
    for (const work of frontier.physical) blockers.push(Object.freeze({ kind: 'pending_physical', workId: work.workId }));
    for (const work of frontier.intents) blockers.push(Object.freeze({ kind: 'pending_intent', workId: work.workId }));
    for (const work of frontier.information) blockers.push(Object.freeze({ kind: 'pending_information', workId: work.workId }));
    for (const work of frontier.decisions) blockers.push(Object.freeze({ kind: 'pending_decision', workId: work.workId }));
    for (const actor of frontier.actors) {
      if (actor.kind !== 'settled_for_play') {
        blockers.push(Object.freeze({ kind: 'actor_not_settled', actorId: actor.actorId }));
      }
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({ kind: 'continues', frontier, blockers: Object.freeze(blockers) });
  }

  const reason = terminal === 'none' ? 'action_frontier_empty' : terminal;
  const playEnd = createPlayEndFact(
    frontier.tick,
    terminal === 'dead_ball' ? 'dead_ball' : 'live_action_complete',
  );
  return Object.freeze({ kind: 'ended', playEnd, frontier, reason });
};
