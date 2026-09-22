import type { EmotionState } from '../EmotionTypes';
import { same } from '../EmotionValidation';
import type { EmotionExecutionAcceptance, ExecutionFrame } from '../execution/ExecutionTypes';
import type { FieldingAcceptance } from '../fielding/FieldingTypes';
import type { EventQueueSourceStatus } from '../../../sim/liveAction/EventQueueWatermark';
import type { PendingIntentWork, PendingPhysicalWork } from '../../../sim/liveAction/ActionFrontier';
import {
  sampleRunnerMotionTrajectory,
  type RunnerMotionIntent,
  type RunnerMotionState,
} from '../../../sim/running/RunnerMotion';
import {
  sampleDefenderMotionSegment,
  type DefenderMotionSegment,
  type DefenderMotionState,
} from '../../../sim/fielding/DefenderMotion';
import type { ThrowLaunch } from '../../../sim/fielding/ThrowLaunch';
import type { DefensiveIntentCandidate } from '../../../sim/fielding/DefensiveDecision';
import type { Vec2, Vec3 } from '../../../model/geometry';

export type ConnectedActionKind =
  | 'RUNNER_CONTROL'
  | 'THROW_RELEASE'
  | 'DEFENSE_REPLAN';

export type ConnectedActionProjection = Readonly<{
  kind: ConnectedActionKind;
  actionKey: string;
  dueTick: number;
  queue: EventQueueSourceStatus;
  intents: readonly PendingIntentWork[];
  physical: readonly PendingPhysicalWork[];
}>;

export type RunnerControlActivatedEvent = Readonly<{
  kind: 'RunnerControlActivated';
  tick: number;
  actionKey: string;
  runnerId: string;
  intent: RunnerMotionIntent;
  state: RunnerMotionState;
}>;

export type ThrowReleasedEvent = Readonly<{
  kind: 'ThrowReleased';
  tick: number;
  actionKey: string;
  ballId: string;
  holderId: string;
  receiverId: string;
  launch: ThrowLaunch;
}>;

export type DefenderReplanActivatedEvent = Readonly<{
  kind: 'DefenderReplanActivated';
  tick: number;
  actionKey: string;
  playerId: string;
  body: DefenderMotionState;
  target: Vec2 | null;
  selected: DefensiveIntentCandidate;
  remainingSegments: readonly DefenderMotionSegment[];
}>;

export type ConnectedActionEvent =
  | RunnerControlActivatedEvent
  | ThrowReleasedEvent
  | DefenderReplanActivatedEvent;

export type ConnectedActionInvalidationReason =
  | 'SCOPE_CHANGED'
  | 'WORLD_STALE'
  | 'EMOTION_SUPERSEDED'
  | 'BODY_REBASED'
  | 'POSSESSION_CHANGED'
  | 'PHYSICAL_STATE_CHANGED';

export type ConnectedActionAdoption =
  | Readonly<{ status: 'WAITING'; dueTick: number }>
  | Readonly<{
      status: 'MISSED_EVENT';
      dueTick: number;
      queueAfter: EventQueueSourceStatus;
    }>
  | Readonly<{
      status: 'INVALIDATED';
      reason: ConnectedActionInvalidationReason;
      dueTick: number;
      queueAfter: EventQueueSourceStatus;
    }>
  | Readonly<{
      status: 'ADOPTED';
      dueTick: number;
      actionKey: string;
      event: ConnectedActionEvent;
      queueAfter: EventQueueSourceStatus;
      physicalAfter: readonly PendingPhysicalWork[];
    }>;

export type RunnerControlAdoptionInput = Readonly<{
  accepted: EmotionExecutionAcceptance;
  currentFrame: ExecutionFrame;
  currentEmotion: EmotionState;
  currentBody: RunnerMotionState;
}>;

export type ThrowReleaseCurrentPhysical = Readonly<{
  kind: 'THROW';
  tick: number;
  ballId: string;
  holderId: string | null;
  origin: Vec3;
  holderVelocity: Vec3;
}>;

export type DefensiveReplanCurrentPhysical = Readonly<{
  kind: 'REPLAN';
  body: DefenderMotionState;
}>;

export type FieldingActionAdoptionInput = Readonly<{
  accepted: FieldingAcceptance;
  currentFrame: ExecutionFrame;
  currentEmotion: EmotionState;
  currentPhysical: ThrowReleaseCurrentPhysical | DefensiveReplanCurrentPhysical;
}>;

const EPSILON = 1e-9;

const safeTick = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
  return value;
};

const safeTickSum = (first: number, second: number, name: string): number => {
  safeTick(first, name);
  safeTick(second, name);
  const value = first + second;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must remain a safe integer tick`);
  }
  return value;
};

const queueBeforeAdoption = (
  sourceId: string,
  currentTick: number,
  dueTick: number,
): EventQueueSourceStatus => Object.freeze({
  sourceId,
  settledThroughTick: currentTick < dueTick
    ? currentTick
    : dueTick - 1,
  nextPendingTick: dueTick,
});

const closedQueue = (
  sourceId: string,
  settledThroughTick: number,
): EventQueueSourceStatus => Object.freeze({
  sourceId,
  settledThroughTick,
  nextPendingTick: null,
});

const freezeItems = <T extends object>(items: readonly T[]): readonly T[] => (
  Object.freeze(items.map((item) => Object.freeze({ ...item })))
);

const timingStatus = (
  currentTick: number,
  dueTick: number,
): 'WAITING' | 'DUE' | 'MISSED_EVENT' => {
  safeTick(currentTick, 'current action tick');
  safeTick(dueTick, 'connected action due tick');
  if (currentTick < dueTick) return 'WAITING';
  if (currentTick > dueTick) return 'MISSED_EVENT';
  return 'DUE';
};

const runnerActionData = (accepted: EmotionExecutionAcceptance) => {
  const source = accepted.proposal.request.runner;
  const execution = accepted.proposal.runner;
  if (source === null || execution === null) {
    throw new Error('runner action adoption requires an accepted runner execution');
  }
  const dueTick = safeTickSum(
    execution.decision.motionIntent.issuedTick,
    source.parameters.reactionDelayTicks,
    'runner control activation tick',
  );
  const actionKey = JSON.stringify([
    'runner-control-v1',
    accepted.executionId,
    source.decision.runnerId,
  ]);
  return { source, execution, dueTick, actionKey };
};

const fieldingActionData = (accepted: FieldingAcceptance) => {
  if (accepted.proposal.status !== 'READY' || accepted.proposal.plan === null) {
    throw new Error('fielding action adoption requires a ready accepted physical plan');
  }
  if (accepted.proposal.plan.kind === 'THROW') {
    return {
      kind: 'THROW_RELEASE' as const,
      dueTick: safeTick(accepted.proposal.plan.launch.releaseTick, 'throw release tick'),
      actionKey: accepted.actionKey,
      plan: accepted.proposal.plan,
    };
  }
  return {
    kind: 'DEFENSE_REPLAN' as const,
    dueTick: safeTick(accepted.proposal.plan.movementStartTick, 'defensive replan movement tick'),
    actionKey: accepted.actionKey,
    plan: accepted.proposal.plan,
  };
};

export const projectRunnerActionFrontier = (
  accepted: EmotionExecutionAcceptance,
  currentTickInput: number,
): ConnectedActionProjection => {
  const currentTick = safeTick(currentTickInput, 'runner projection tick');
  const { source, execution, dueTick, actionKey } = runnerActionData(accepted);
  const sourceId = `runner-control:${actionKey}`;
  const intents: PendingIntentWork[] = [{
    workId: `runner-intent:${actionKey}`,
    kind: 'issued_intent',
    actorId: source.decision.runnerId,
    dueTick,
    actionKey,
  }];
  const physical: PendingPhysicalWork[] = execution.trajectory.endState.tick > currentTick
    ? [{
        workId: `runner-motion:${actionKey}`,
        kind: 'runner_motion',
        actorId: source.decision.runnerId,
        throughTick: execution.trajectory.endState.tick,
        actionKey,
      }]
    : [];
  return Object.freeze({
    kind: 'RUNNER_CONTROL',
    actionKey,
    dueTick,
    queue: queueBeforeAdoption(sourceId, currentTick, dueTick),
    intents: freezeItems(intents),
    physical: freezeItems(physical),
  });
};

export const projectFieldingActionFrontier = (
  accepted: FieldingAcceptance,
  currentTickInput: number,
): ConnectedActionProjection => {
  const currentTick = safeTick(currentTickInput, 'fielding projection tick');
  const action = fieldingActionData(accepted);
  const actorId = accepted.expectedFrame.scope.playerId;
  const sourceId = `fielding-action:${action.actionKey}`;
  const intents: PendingIntentWork[] = [{
    workId: `fielding-intent:${action.actionKey}`,
    kind: 'issued_intent',
    actorId,
    dueTick: action.dueTick,
    actionKey: action.actionKey,
  }];
  const throughTick = action.kind === 'THROW_RELEASE'
    ? action.dueTick
    : action.plan.endState.tick;
  const physical: PendingPhysicalWork[] = throughTick > currentTick
    ? [{
        workId: `fielding-physical:${action.actionKey}`,
        kind: action.kind === 'THROW_RELEASE' ? 'throw' : 'defender_motion',
        actorId,
        throughTick,
        actionKey: action.actionKey,
      }]
    : [];
  return Object.freeze({
    kind: action.kind,
    actionKey: action.actionKey,
    dueTick: action.dueTick,
    queue: queueBeforeAdoption(sourceId, currentTick, action.dueTick),
    intents: freezeItems(intents),
    physical: freezeItems(physical),
  });
};

const frameInvalidation = (
  currentFrame: ExecutionFrame,
  expectedFrame: ExecutionFrame,
  minimumWorldRevision: number,
): ConnectedActionInvalidationReason | null => {
  if (
    !same(currentFrame.scope, expectedFrame.scope)
    || currentFrame.contextId !== expectedFrame.contextId
  ) {
    return 'SCOPE_CHANGED';
  }
  if (
    !Number.isSafeInteger(currentFrame.worldRevision)
    || currentFrame.worldRevision < minimumWorldRevision
  ) {
    return 'WORLD_STALE';
  }
  return null;
};

const close = (first: number, second: number): boolean => (
  Number.isFinite(first)
  && Number.isFinite(second)
  && Math.abs(first - second) <= EPSILON
);

const runnerKinematicsMatch = (
  current: RunnerMotionState,
  expected: RunnerMotionState,
): boolean => (
  current.tick === expected.tick
  && close(current.routeDistanceMeters, expected.routeDistanceMeters)
  && close(current.speedMps, expected.speedMps)
  && current.driveDirection === expected.driveDirection
  && current.bodyMode === expected.bodyMode
);

const vec3Match = (first: Vec3, second: Vec3): boolean => (
  close(first.x, second.x)
  && close(first.y, second.y)
  && close(first.z, second.z)
);

const defenderStateMatch = (
  current: DefenderMotionState,
  expected: DefenderMotionState,
): boolean => (
  current.tick === expected.tick
  && close(current.position.x, expected.position.x)
  && close(current.position.z, expected.position.z)
  && close(current.velocity.x, expected.velocity.x)
  && close(current.velocity.z, expected.velocity.z)
);

const beforeOrAfter = (
  currentTick: number,
  dueTick: number,
  sourceId: string,
): ConnectedActionAdoption | null => {
  const relation = timingStatus(currentTick, dueTick);
  if (relation === 'WAITING') {
    return Object.freeze({ status: 'WAITING', dueTick });
  }
  if (relation === 'MISSED_EVENT') {
    return Object.freeze({
      status: 'MISSED_EVENT',
      dueTick,
      queueAfter: closedQueue(sourceId, currentTick),
    });
  }
  return null;
};

const invalidated = (
  dueTick: number,
  currentTick: number,
  sourceId: string,
  reason: ConnectedActionInvalidationReason,
): ConnectedActionAdoption => Object.freeze({
  status: 'INVALIDATED',
  reason,
  dueTick,
  queueAfter: closedQueue(sourceId, currentTick),
});

export const adoptRunnerControlAtTick = (
  input: RunnerControlAdoptionInput,
): ConnectedActionAdoption => {
  const { source, execution, dueTick, actionKey } = runnerActionData(input.accepted);
  const sourceId = `runner-control:${actionKey}`;
  const currentTick = input.currentFrame.time.tick;
  const timing = beforeOrAfter(currentTick, dueTick, sourceId);
  if (timing !== null) return timing;
  const frameReason = frameInvalidation(
    input.currentFrame,
    input.accepted.expectedFrame,
    input.accepted.afterWorldRevision,
  );
  if (frameReason !== null) return invalidated(dueTick, currentTick, sourceId, frameReason);
  if (!same(input.currentEmotion, input.accepted.proposal.appraisal.state)) {
    return invalidated(dueTick, currentTick, sourceId, 'EMOTION_SUPERSEDED');
  }
  const expected = sampleRunnerMotionTrajectory(execution.trajectory, dueTick);
  if (!runnerKinematicsMatch(input.currentBody, expected)) {
    return invalidated(dueTick, currentTick, sourceId, 'BODY_REBASED');
  }
  const physicalAfter: PendingPhysicalWork[] = execution.trajectory.endState.tick > dueTick
    ? [{
        workId: `runner-motion:${actionKey}`,
        kind: 'runner_motion',
        actorId: source.decision.runnerId,
        throughTick: execution.trajectory.endState.tick,
        actionKey,
      }]
    : [];
  const event: RunnerControlActivatedEvent = Object.freeze({
    kind: 'RunnerControlActivated',
    tick: dueTick,
    actionKey,
    runnerId: source.decision.runnerId,
    intent: Object.freeze({ ...execution.decision.motionIntent }),
    state: Object.freeze({ ...expected }),
  });
  return Object.freeze({
    status: 'ADOPTED',
    dueTick,
    actionKey,
    event,
    queueAfter: closedQueue(sourceId, dueTick),
    physicalAfter: freezeItems(physicalAfter),
  });
};

const defenderAtTick = (
  accepted: FieldingAcceptance,
  dueTick: number,
): DefenderMotionState => {
  if (
    accepted.proposal.plan?.kind !== 'REPLAN'
    || accepted.proposal.request.source.kind !== 'REPLAN'
  ) {
    throw new Error('defender state requires an accepted replan');
  }
  const segment = [...accepted.proposal.plan.segments]
    .reverse()
    .find((item) => item.startTick <= dueTick && dueTick <= item.endTick);
  return segment === undefined
    ? accepted.proposal.request.source.body
    : sampleDefenderMotionSegment(segment, dueTick);
};

export const adoptFieldingActionAtTick = (
  input: FieldingActionAdoptionInput,
): ConnectedActionAdoption => {
  const action = fieldingActionData(input.accepted);
  const sourceId = `fielding-action:${action.actionKey}`;
  const currentTick = input.currentFrame.time.tick;
  const timing = beforeOrAfter(currentTick, action.dueTick, sourceId);
  if (timing !== null) return timing;
  const frameReason = frameInvalidation(
    input.currentFrame,
    input.accepted.expectedFrame,
    input.accepted.afterWorldRevision,
  );
  if (frameReason !== null) return invalidated(action.dueTick, currentTick, sourceId, frameReason);
  if (!same(input.currentEmotion, input.accepted.proposal.request.currentEmotion)) {
    return invalidated(action.dueTick, currentTick, sourceId, 'EMOTION_SUPERSEDED');
  }
  if (action.kind === 'THROW_RELEASE') {
    if (
      input.currentPhysical.kind !== 'THROW'
      || input.accepted.proposal.request.source.kind !== 'THROW'
    ) {
      return invalidated(action.dueTick, currentTick, sourceId, 'PHYSICAL_STATE_CHANGED');
    }
    const source = input.accepted.proposal.request.source;
    const current = input.currentPhysical;
    if (
      current.tick !== action.dueTick
      || current.ballId !== source.ballId
      || current.holderId !== source.holderId
    ) {
      return invalidated(action.dueTick, currentTick, sourceId, 'POSSESSION_CHANGED');
    }
    if (
      !vec3Match(current.origin, action.plan.launch.origin)
      || !vec3Match(current.holderVelocity, source.holderVelocity)
    ) {
      return invalidated(action.dueTick, currentTick, sourceId, 'BODY_REBASED');
    }
    if (source.holderId === null) {
      return invalidated(action.dueTick, currentTick, sourceId, 'POSSESSION_CHANGED');
    }
    const event: ThrowReleasedEvent = Object.freeze({
      kind: 'ThrowReleased',
      tick: action.dueTick,
      actionKey: action.actionKey,
      ballId: source.ballId,
      holderId: source.holderId,
      receiverId: action.plan.receiverId,
      launch: action.plan.launch,
    });
    const physicalAfter: PendingPhysicalWork[] = [{
      workId: `throw-flight-handoff:${action.actionKey}`,
      kind: 'throw',
      actorId: source.holderId,
      throughTick: action.dueTick,
      actionKey: action.actionKey,
    }];
    return Object.freeze({
      status: 'ADOPTED',
      dueTick: action.dueTick,
      actionKey: action.actionKey,
      event,
      queueAfter: closedQueue(sourceId, action.dueTick),
      physicalAfter: freezeItems(physicalAfter),
    });
  }

  if (
    input.currentPhysical.kind !== 'REPLAN'
    || input.accepted.proposal.request.source.kind !== 'REPLAN'
  ) {
    return invalidated(action.dueTick, currentTick, sourceId, 'PHYSICAL_STATE_CHANGED');
  }
  const expected = defenderAtTick(input.accepted, action.dueTick);
  if (!defenderStateMatch(input.currentPhysical.body, expected)) {
    return invalidated(action.dueTick, currentTick, sourceId, 'BODY_REBASED');
  }
  const remainingSegments = action.plan.segments.filter(
    (segment) => segment.endTick > action.dueTick,
  );
  const physicalAfter: PendingPhysicalWork[] = action.plan.endState.tick > action.dueTick
    ? [{
        workId: `fielding-physical:${action.actionKey}`,
        kind: 'defender_motion',
        actorId: input.accepted.expectedFrame.scope.playerId,
        throughTick: action.plan.endState.tick,
        actionKey: action.actionKey,
      }]
    : [];
  const event: DefenderReplanActivatedEvent = Object.freeze({
    kind: 'DefenderReplanActivated',
    tick: action.dueTick,
    actionKey: action.actionKey,
    playerId: input.accepted.expectedFrame.scope.playerId,
    body: Object.freeze({ ...expected }),
    target: action.plan.target === null
      ? null
      : Object.freeze({ ...action.plan.target }),
    selected: action.plan.selected,
    remainingSegments: Object.freeze([...remainingSegments]),
  });
  return Object.freeze({
    status: 'ADOPTED',
    dueTick: action.dueTick,
    actionKey: action.actionKey,
    event,
    queueAfter: closedQueue(sourceId, action.dueTick),
    physicalAfter: freezeItems(physicalAfter),
  });
};
