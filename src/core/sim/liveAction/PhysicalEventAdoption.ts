import type { Vec3 } from '../../model/geometry';
import {
  createControlledRunnerTagFact,
  createRunnerBaseTouchFact,
  type ControlledRunnerTagFact,
  type RunnerBaseTouchFact,
  type BaseballBase,
} from '../../rules/PhysicalRuleFacts';
import {
  createCatchRetentionContactFromAcceleratedReception,
} from '../fielding/DefenderThrowReceptionContact';
import {
  resolveCatchRetention,
  type CatchRetentionContact,
  type CatchRetentionParameters,
  type CatchRetentionResolution,
} from '../fielding/CatchRetention';
import type { GloveWorldState, LiveBallState } from '../fielding/GloveBallContact';
import type { DefenderPhysicalPrimitiveSegment } from '../fielding/DefenderPhysicalPrimitive';
import {
  findTagContactTick,
  type TagContactPrimitiveState,
} from '../fielding/TagContact';
import type { BaseTouchRegion } from '../running/BaseTouch';
import type { RunnerBodyContactParameters } from '../running/RunnerBodyContact';
import {
  findRunnerBaseTouchTickOnTrajectory,
} from '../running/RunnerBaseTouch';
import {
  sampleRunnerMotionTrajectory,
  type RunnerMotionState,
  type RunnerMotionTrajectory,
} from '../running/RunnerMotion';
import type { RunnerRoute } from '../running/RunnerRoute';
import type { EventQueueSourceStatus } from './EventQueueWatermark';
import type { PendingPhysicalWork } from './ActionFrontier';

const EPSILON = 1e-9;

type PhysicalForecastBase = Readonly<{
  forecastId: string;
  actionKey: string;
  dueTick: number;
}>;

export type RunnerBaseTouchForecast = PhysicalForecastBase & Readonly<{
  kind: 'RUNNER_BASE_TOUCH';
  runnerId: string;
  base: BaseballBase;
  trajectory: RunnerMotionTrajectory;
  expectedBody: RunnerMotionState;
}>;

export type ThrowReceptionForecast = PhysicalForecastBase & Readonly<{
  kind: 'THROW_RECEPTION';
  ballId: string;
  receiverId: string;
  contact: CatchRetentionContact;
  retention: CatchRetentionResolution;
}>;

export type ControlledTagForecast = PhysicalForecastBase & Readonly<{
  kind: 'CONTROLLED_TAG';
  defenderId: string;
  runnerId: string;
  possessionReadyTick: number;
  expectedTagger: TagContactPrimitiveState;
  expectedRunner: TagContactPrimitiveState;
}>;

export type PhysicalEventForecast =
  | RunnerBaseTouchForecast
  | ThrowReceptionForecast
  | ControlledTagForecast;

export type PhysicalEventProjection = Readonly<{
  queue: EventQueueSourceStatus;
  physical: readonly PendingPhysicalWork[];
}>;

export type GloveBallContactOccurred = Readonly<{
  kind: 'GloveBallContactOccurred';
  tick: number;
  ballId: string;
  receiverId: string;
  contact: CatchRetentionContact;
}>;

export type CatchRetentionFailed = Readonly<{
  kind: 'CatchRetentionFailed';
  tick: number;
  ballId: string;
  receiverId: string;
  ball: LiveBallState;
}>;

export type SecurePossessionEstablished = Readonly<{
  kind: 'SecurePossessionEstablished';
  tick: number;
  ballId: string;
  receiverId: string;
  gloveContactTick: number;
}>;

export type AdoptedPhysicalEvent =
  | RunnerBaseTouchFact
  | ControlledRunnerTagFact
  | GloveBallContactOccurred
  | CatchRetentionFailed
  | SecurePossessionEstablished;

export type PhysicalEventInvalidationReason =
  | 'PHYSICAL_STATE_CHANGED'
  | 'POSSESSION_CHANGED';

export type PhysicalEventAdoption =
  | Readonly<{ status: 'WAITING'; dueTick: number }>
  | Readonly<{
      status: 'MISSED_EVENT';
      dueTick: number;
      queueAfter: EventQueueSourceStatus;
    }>
  | Readonly<{
      status: 'INVALIDATED';
      reason: PhysicalEventInvalidationReason;
      dueTick: number;
      queueAfter: EventQueueSourceStatus;
    }>
  | Readonly<{
      status: 'ADOPTED';
      dueTick: number;
      events: readonly AdoptedPhysicalEvent[];
      queueAfter: EventQueueSourceStatus;
      physicalAfter: readonly PendingPhysicalWork[];
    }>;

export type RunnerBaseTouchForecastInput = Readonly<{
  forecastId: string;
  actionKey: string;
  runnerId: string;
  base: BaseballBase;
  trajectory: RunnerMotionTrajectory;
  route: RunnerRoute;
  baseRegion: BaseTouchRegion;
  bodyParameters: RunnerBodyContactParameters;
}>;

export type ThrowReceptionForecastInput = Readonly<{
  forecastId: string;
  actionKey: string;
  ballId: string;
  receiverId: string;
  ball: LiveBallState;
  ballAcceleration: Vec3;
  glovePrimitive: DefenderPhysicalPrimitiveSegment;
  ballRadiusMeters: number;
  pocketOffsetMeters: number;
  bodyStability: number;
  retentionParameters: CatchRetentionParameters;
}>;

export type ControlledTagForecastInput = Readonly<{
  forecastId: string;
  actionKey: string;
  defenderId: string;
  runnerId: string;
  possessionReadyTick: number;
  tagActionStartTick: number;
  taggerPrimitive: TagContactPrimitiveState;
  runnerPrimitive: TagContactPrimitiveState;
  deltaTicks: number;
  ticksPerSecond: number;
}>;

const cloneInertData = <T>(input: T, path = 'physicalEvent'): T => {
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, currentPath: string, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error(`${currentPath} exceeds inert-data depth or size limits`);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${currentPath} must be finite`);
      return value === 0 ? 0 : value;
    }
    if (typeof value !== 'object') {
      throw new Error(`${currentPath} must contain inert data only`);
    }
    if (ancestors.has(value)) throw new Error(`${currentPath} must not contain cycles`);
    ancestors.add(value);

    let result: unknown;
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new Error(`${currentPath} must be a dense inert array`);
      }
      const array: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active array properties`);
        }
        array.push(visit(descriptor.value, `${currentPath}[${index}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`${currentPath} must be a plain inert object`);
      }
      const record: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new Error(`${currentPath} must not contain symbol properties`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active properties`);
        }
        Object.defineProperty(record, key, {
          value: visit(descriptor.value, `${currentPath}.${key}`, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      result = record;
    }

    ancestors.delete(value);
    return result;
  };

  return visit(input, path, 0) as T;
};

const validateTick = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
  return value;
};

const validateId = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  return value;
};

const validateBase = (base: BaseballBase): BaseballBase => {
  if (base !== 1 && base !== 2 && base !== 3 && base !== 4) {
    throw new Error('base must be 1, 2, 3, or 4');
  }
  return base;
};

const sourceId = (forecast: Pick<PhysicalForecastBase, 'forecastId'>): string =>
  `physical-event:${forecast.forecastId}`;

const closedQueue = (
  forecast: Pick<PhysicalForecastBase, 'forecastId'>,
  settledThroughTick: number,
): EventQueueSourceStatus => Object.freeze({
  sourceId: sourceId(forecast),
  settledThroughTick,
  nextPendingTick: null,
});

const pendingQueue = (
  forecast: Pick<PhysicalForecastBase, 'forecastId' | 'dueTick'>,
  currentTick: number,
): EventQueueSourceStatus => Object.freeze({
  sourceId: sourceId(forecast),
  settledThroughTick: currentTick < forecast.dueTick
    ? currentTick
    : forecast.dueTick - 1,
  nextPendingTick: forecast.dueTick,
});

const timing = (
  currentTickInput: number,
  dueTick: number,
): 'WAITING' | 'DUE' | 'MISSED_EVENT' => {
  const currentTick = validateTick(currentTickInput, 'currentTick');
  validateTick(dueTick, 'dueTick');
  if (currentTick < dueTick) return 'WAITING';
  if (currentTick > dueTick) return 'MISSED_EVENT';
  return 'DUE';
};

const beforeOrAfter = (
  forecast: Pick<PhysicalForecastBase, 'forecastId' | 'dueTick'>,
  currentTick: number,
): PhysicalEventAdoption | null => {
  const relation = timing(currentTick, forecast.dueTick);
  if (relation === 'WAITING') {
    return Object.freeze({ status: 'WAITING', dueTick: forecast.dueTick });
  }
  if (relation === 'MISSED_EVENT') {
    return Object.freeze({
      status: 'MISSED_EVENT',
      dueTick: forecast.dueTick,
      queueAfter: closedQueue(forecast, currentTick),
    });
  }
  return null;
};

const invalidated = (
  forecast: Pick<PhysicalForecastBase, 'forecastId' | 'dueTick'>,
  currentTick: number,
  reason: PhysicalEventInvalidationReason,
): PhysicalEventAdoption => Object.freeze({
  status: 'INVALIDATED',
  reason,
  dueTick: forecast.dueTick,
  queueAfter: closedQueue(forecast, currentTick),
});

const closeNumber = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPSILON;

const vec3Matches = (a: Vec3, b: Vec3): boolean =>
  closeNumber(a.x, b.x) && closeNumber(a.y, b.y) && closeNumber(a.z, b.z);

const runnerMatches = (a: RunnerMotionState, b: RunnerMotionState): boolean =>
  a.tick === b.tick
  && closeNumber(a.routeDistanceMeters, b.routeDistanceMeters)
  && closeNumber(a.speedMps, b.speedMps)
  && a.driveDirection === b.driveDirection
  && a.bodyMode === b.bodyMode;

const ballMatches = (a: LiveBallState, b: LiveBallState): boolean =>
  a.tick === b.tick
  && vec3Matches(a.position, b.position)
  && vec3Matches(a.velocity, b.velocity)
  && vec3Matches(a.spin, b.spin);

const gloveMatches = (a: GloveWorldState, b: GloveWorldState): boolean =>
  a.tick === b.tick
  && vec3Matches(a.position, b.position)
  && vec3Matches(a.velocity, b.velocity);

const contactMatches = (a: CatchRetentionContact, b: CatchRetentionContact): boolean =>
  a.contactTick === b.contactTick
  && ballMatches(a.ball, b.ball)
  && gloveMatches(a.glove, b.glove)
  && vec3Matches(a.contactNormal, b.contactNormal)
  && closeNumber(a.pocketOffsetMeters, b.pocketOffsetMeters)
  && closeNumber(a.bodyStability, b.bodyStability);

const tagPrimitiveMatches = (
  a: TagContactPrimitiveState,
  b: TagContactPrimitiveState,
): boolean =>
  a.tick === b.tick
  && closeNumber(a.radius, b.radius)
  && vec3Matches(a.center, b.center)
  && vec3Matches(a.velocity, b.velocity);

const sampleTagPrimitive = (
  primitive: TagContactPrimitiveState,
  tick: number,
  ticksPerSecond: number,
): TagContactPrimitiveState => {
  validateTick(tick, 'tag sample tick');
  if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (tick < primitive.tick) {
    throw new Error('tag sample tick must not precede primitive tick');
  }
  const dt = (tick - primitive.tick) / ticksPerSecond;
  return Object.freeze({
    tick,
    center: Object.freeze({
      x: primitive.center.x + primitive.velocity.x * dt,
      y: primitive.center.y + primitive.velocity.y * dt,
      z: primitive.center.z + primitive.velocity.z * dt,
    }),
    velocity: Object.freeze({ ...primitive.velocity }),
    radius: primitive.radius,
  });
};

export const forecastRunnerBaseTouch = (
  input: RunnerBaseTouchForecastInput,
): RunnerBaseTouchForecast | null => {
  validateId(input.forecastId, 'forecastId');
  validateId(input.actionKey, 'actionKey');
  validateId(input.runnerId, 'runnerId');
  validateBase(input.base);
  const dueTick = findRunnerBaseTouchTickOnTrajectory(
    input.trajectory,
    input.route,
    input.baseRegion,
    input.bodyParameters,
  );
  if (dueTick === null) return null;
  return Object.freeze({
    kind: 'RUNNER_BASE_TOUCH',
    forecastId: input.forecastId,
    actionKey: input.actionKey,
    dueTick,
    runnerId: input.runnerId,
    base: input.base,
    trajectory: input.trajectory,
    expectedBody: Object.freeze(sampleRunnerMotionTrajectory(input.trajectory, dueTick)),
  });
};

export const forecastThrowReception = (
  input: ThrowReceptionForecastInput,
): ThrowReceptionForecast | null => {
  validateId(input.forecastId, 'forecastId');
  validateId(input.actionKey, 'actionKey');
  validateId(input.ballId, 'ballId');
  validateId(input.receiverId, 'receiverId');
  const contact = createCatchRetentionContactFromAcceleratedReception({
    ball: input.ball,
    ballAcceleration: input.ballAcceleration,
    glovePrimitive: input.glovePrimitive,
    ballRadiusMeters: input.ballRadiusMeters,
    pocketOffsetMeters: input.pocketOffsetMeters,
    bodyStability: input.bodyStability,
  });
  if (contact === null) return null;
  const retention = resolveCatchRetention(contact, input.retentionParameters);
  return Object.freeze({
    kind: 'THROW_RECEPTION',
    forecastId: input.forecastId,
    actionKey: input.actionKey,
    dueTick: contact.contactTick,
    ballId: input.ballId,
    receiverId: input.receiverId,
    contact,
    retention,
  });
};

export const forecastControlledTag = (
  input: ControlledTagForecastInput,
): ControlledTagForecast | null => {
  validateId(input.forecastId, 'forecastId');
  validateId(input.actionKey, 'actionKey');
  validateId(input.defenderId, 'defenderId');
  validateId(input.runnerId, 'runnerId');
  validateTick(input.possessionReadyTick, 'possessionReadyTick');
  validateTick(input.tagActionStartTick, 'tagActionStartTick');
  if (input.taggerPrimitive.tick !== input.runnerPrimitive.tick) {
    throw new Error('tag primitives must share the same start tick');
  }
  if (input.taggerPrimitive.tick < input.tagActionStartTick) {
    throw new Error('tag search must not begin before tag action start');
  }
  const dueTick = findTagContactTick(
    input.taggerPrimitive,
    input.runnerPrimitive,
    input.deltaTicks,
    { ticksPerSecond: input.ticksPerSecond },
  );
  if (dueTick === null) return null;
  if (dueTick < input.possessionReadyTick) {
    throw new Error('controlled tag cannot precede secure possession');
  }
  return Object.freeze({
    kind: 'CONTROLLED_TAG',
    forecastId: input.forecastId,
    actionKey: input.actionKey,
    dueTick,
    defenderId: input.defenderId,
    runnerId: input.runnerId,
    possessionReadyTick: input.possessionReadyTick,
    expectedTagger: sampleTagPrimitive(input.taggerPrimitive, dueTick, input.ticksPerSecond),
    expectedRunner: sampleTagPrimitive(input.runnerPrimitive, dueTick, input.ticksPerSecond),
  });
};

export const projectPhysicalEventForecast = (
  forecast: PhysicalEventForecast,
  currentTickInput: number,
): PhysicalEventProjection => {
  const currentTick = validateTick(currentTickInput, 'projection tick');
  const kind: PendingPhysicalWork['kind'] = forecast.kind === 'RUNNER_BASE_TOUCH'
    ? 'runner_motion'
    : forecast.kind === 'THROW_RECEPTION'
      ? 'reception'
      : 'tag';
  const actorId = forecast.kind === 'RUNNER_BASE_TOUCH'
    ? forecast.runnerId
    : forecast.kind === 'THROW_RECEPTION'
      ? forecast.receiverId
      : forecast.defenderId;
  const physical: PendingPhysicalWork[] = currentTick <= forecast.dueTick
    ? [{
        workId: `physical-event:${forecast.forecastId}`,
        kind,
        actorId,
        throughTick: forecast.dueTick,
        actionKey: forecast.actionKey,
      }]
    : [];
  return Object.freeze({
    queue: pendingQueue(forecast, currentTick),
    physical: Object.freeze(physical.map((work) => Object.freeze(work))),
  });
};

export const adoptRunnerBaseTouchAtTick = (input: Readonly<{
  forecast: RunnerBaseTouchForecast;
  currentTick: number;
  currentBody: RunnerMotionState;
}>): PhysicalEventAdoption => {
  const request = cloneInertData(input, 'runnerBaseTouchAdoption');
  const earlyOrLate = beforeOrAfter(request.forecast, request.currentTick);
  if (earlyOrLate !== null) return earlyOrLate;
  if (!runnerMatches(request.currentBody, request.forecast.expectedBody)) {
    return invalidated(request.forecast, request.currentTick, 'PHYSICAL_STATE_CHANGED');
  }
  const event = createRunnerBaseTouchFact(
    request.forecast.runnerId,
    request.forecast.base,
    request.forecast.dueTick,
  );
  return Object.freeze({
    status: 'ADOPTED',
    dueTick: request.forecast.dueTick,
    events: Object.freeze([event]),
    queueAfter: closedQueue(request.forecast, request.forecast.dueTick),
    physicalAfter: Object.freeze([]),
  });
};

export const adoptThrowReceptionContactAtTick = (input: Readonly<{
  forecast: ThrowReceptionForecast;
  currentTick: number;
  currentBall: LiveBallState;
  currentGlove: GloveWorldState;
}>): PhysicalEventAdoption => {
  const request = cloneInertData(input, 'throwReceptionAdoption');
  const earlyOrLate = beforeOrAfter(request.forecast, request.currentTick);
  if (earlyOrLate !== null) return earlyOrLate;
  if (
    !ballMatches(request.currentBall, request.forecast.contact.ball)
    || !gloveMatches(request.currentGlove, request.forecast.contact.glove)
  ) {
    return invalidated(request.forecast, request.currentTick, 'PHYSICAL_STATE_CHANGED');
  }

  const contactEvent: GloveBallContactOccurred = Object.freeze({
    kind: 'GloveBallContactOccurred',
    tick: request.forecast.dueTick,
    ballId: request.forecast.ballId,
    receiverId: request.forecast.receiverId,
    contact: request.forecast.contact,
  });

  if (request.forecast.retention.outcome.kind === 'live-ball') {
    const failed: CatchRetentionFailed = Object.freeze({
      kind: 'CatchRetentionFailed',
      tick: request.forecast.dueTick,
      ballId: request.forecast.ballId,
      receiverId: request.forecast.receiverId,
      ball: request.forecast.retention.outcome.ball,
    });
    const handoff: PendingPhysicalWork = Object.freeze({
      workId: `post-catch-ball-handoff:${request.forecast.forecastId}`,
      kind: 'ball_motion',
      throughTick: request.forecast.dueTick,
      actionKey: request.forecast.actionKey,
    });
    return Object.freeze({
      status: 'ADOPTED',
      dueTick: request.forecast.dueTick,
      events: Object.freeze([contactEvent, failed]),
      queueAfter: closedQueue(request.forecast, request.forecast.dueTick),
      physicalAfter: Object.freeze([handoff]),
    });
  }

  const secureTick = request.forecast.retention.outcome.secureTick;
  if (secureTick === request.forecast.dueTick) {
    const secure: SecurePossessionEstablished = Object.freeze({
      kind: 'SecurePossessionEstablished',
      tick: secureTick,
      ballId: request.forecast.ballId,
      receiverId: request.forecast.receiverId,
      gloveContactTick: request.forecast.dueTick,
    });
    return Object.freeze({
      status: 'ADOPTED',
      dueTick: request.forecast.dueTick,
      events: Object.freeze([contactEvent, secure]),
      queueAfter: closedQueue(request.forecast, secureTick),
      physicalAfter: Object.freeze([]),
    });
  }

  const transition: PendingPhysicalWork = Object.freeze({
    workId: `possession-transition:${request.forecast.forecastId}`,
    kind: 'possession_transition',
    actorId: request.forecast.receiverId,
    throughTick: secureTick,
    actionKey: request.forecast.actionKey,
  });
  return Object.freeze({
    status: 'ADOPTED',
    dueTick: request.forecast.dueTick,
    events: Object.freeze([contactEvent]),
    queueAfter: Object.freeze({
      sourceId: sourceId(request.forecast),
      settledThroughTick: request.forecast.dueTick,
      nextPendingTick: secureTick,
    }),
    physicalAfter: Object.freeze([transition]),
  });
};

export const adoptSecurePossessionAtTick = (input: Readonly<{
  forecast: ThrowReceptionForecast;
  currentTick: number;
  stillRetained: boolean;
  contactEvent: GloveBallContactOccurred;
}>): PhysicalEventAdoption => {
  const request = cloneInertData(input, 'securePossessionAdoption');
  if (request.forecast.retention.outcome.kind !== 'secured') {
    throw new Error('secure-possession adoption requires a secured retention forecast');
  }
  if (
    request.contactEvent === null
    || request.contactEvent === undefined
    || request.contactEvent.kind !== 'GloveBallContactOccurred'
  ) {
    throw new Error('secure possession requires its adopted glove contact');
  }
  if (
    request.contactEvent.tick !== request.forecast.contact.contactTick
    || request.contactEvent.ballId !== request.forecast.ballId
    || request.contactEvent.receiverId !== request.forecast.receiverId
    || !contactMatches(request.contactEvent.contact, request.forecast.contact)
  ) {
    return invalidated(
      { forecastId: request.forecast.forecastId, dueTick: request.forecast.retention.outcome.secureTick },
      request.currentTick,
      'PHYSICAL_STATE_CHANGED',
    );
  }
  const secureTick = request.forecast.retention.outcome.secureTick;
  const secureForecast = {
    forecastId: request.forecast.forecastId,
    dueTick: secureTick,
  };
  const earlyOrLate = beforeOrAfter(secureForecast, request.currentTick);
  if (earlyOrLate !== null) return earlyOrLate;
  if (!request.stillRetained) {
    return invalidated(secureForecast, request.currentTick, 'POSSESSION_CHANGED');
  }
  const event: SecurePossessionEstablished = Object.freeze({
    kind: 'SecurePossessionEstablished',
    tick: secureTick,
    ballId: request.forecast.ballId,
    receiverId: request.forecast.receiverId,
    gloveContactTick: request.forecast.contact.contactTick,
  });
  return Object.freeze({
    status: 'ADOPTED',
    dueTick: secureTick,
    events: Object.freeze([event]),
    queueAfter: closedQueue(secureForecast, secureTick),
    physicalAfter: Object.freeze([]),
  });
};

export const adoptControlledTagAtTick = (input: Readonly<{
  forecast: ControlledTagForecast;
  currentTick: number;
  stillPossessed: boolean;
  currentTagger: TagContactPrimitiveState;
  currentRunner: TagContactPrimitiveState;
}>): PhysicalEventAdoption => {
  const request = cloneInertData(input, 'controlledTagAdoption');
  const earlyOrLate = beforeOrAfter(request.forecast, request.currentTick);
  if (earlyOrLate !== null) return earlyOrLate;
  if (!request.stillPossessed) {
    return invalidated(request.forecast, request.currentTick, 'POSSESSION_CHANGED');
  }
  if (
    !tagPrimitiveMatches(request.currentTagger, request.forecast.expectedTagger)
    || !tagPrimitiveMatches(request.currentRunner, request.forecast.expectedRunner)
  ) {
    return invalidated(request.forecast, request.currentTick, 'PHYSICAL_STATE_CHANGED');
  }
  const event = createControlledRunnerTagFact(
    request.forecast.defenderId,
    request.forecast.runnerId,
    request.forecast.dueTick,
  );
  return Object.freeze({
    status: 'ADOPTED',
    dueTick: request.forecast.dueTick,
    events: Object.freeze([event]),
    queueAfter: closedQueue(request.forecast, request.forecast.dueTick),
    physicalAfter: Object.freeze([]),
  });
};
