import { quantizeEventTick } from '../ExactEventTime';

export type RunnerDriveDirection = -1 | 0 | 1;
export type RunnerBodyMode = 'upright' | 'sliding';

export type RunnerMotionState = Readonly<{
  tick: number;
  routeDistanceMeters: number;
  /** Signed speed along the runner route. Positive advances, negative retreats. */
  speedMps: number;
  /** Motor command currently active in the body, before any newly issued intent reacts. */
  driveDirection: RunnerDriveDirection;
  bodyMode: RunnerBodyMode;
}>;

export type RunnerMotionIntent = Readonly<{
  kind: 'advance' | 'retreat' | 'hold' | 'slide';
  issuedTick: number;
}>;

export type RunnerMotionParameters = Readonly<{
  ticksPerSecond: number;
  reactionDelayTicks: number;
  accelerationMps2: number;
  brakingMps2: number;
  slideDecelerationMps2: number;
  topSpeedMps: number;
}>;

export type RunnerMotionTrajectorySegment = Readonly<{
  /** Continuous elapsed seconds from the input state's authoritative tick. */
  startElapsedSeconds: number;
  endElapsedSeconds: number;
  startRouteDistanceMeters: number;
  startSpeedMps: number;
  /** Constant signed acceleration over this analytic segment. */
  accelerationMps2: number;
  driveDirection: RunnerDriveDirection;
  bodyMode: RunnerBodyMode;
}>;

export type RunnerMotionTrajectory = Readonly<{
  startTick: number;
  ticksPerSecond: number;
  segments: readonly RunnerMotionTrajectorySegment[];
  endState: RunnerMotionState;
}>;

export type ExactRunnerMotionTrajectory = Readonly<{
  origin: Readonly<{originTick:number;elapsedSeconds:number;tick:number}>;
  ticksPerSecond: number;
  durationSeconds: number;
  segments: readonly RunnerMotionTrajectorySegment[];
  endState: RunnerMotionState;
}>;

type ActiveRunnerControl = Readonly<{
  driveDirection: RunnerDriveDirection;
  bodyMode: RunnerBodyMode;
}>;

type MutableTrajectoryCursor = {
  elapsedSeconds: number;
  routeDistanceMeters: number;
  speedMps: number;
  control: ActiveRunnerControl;
  exactIntervals?: true;
};

const EPSILON = 1e-12;
const durationTolerance = (cursor: MutableTrajectoryCursor) => cursor.exactIntervals ? 0 : EPSILON;

const isDriveDirection = (value: number): value is RunnerDriveDirection => (
  value === -1 || value === 0 || value === 1
);

const canonicalZero = (value: number): number => value === 0 || Math.abs(value) <= EPSILON ? 0 : value;

const validateFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

const validateState = (
  state: RunnerMotionState,
  parameters: RunnerMotionParameters,
): void => {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new Error('state.tick must be a non-negative safe integer tick');
  }
  validateFinite('state.routeDistanceMeters', state.routeDistanceMeters);
  validateFinite('state.speedMps', state.speedMps);
  if (!isDriveDirection(state.driveDirection)) {
    throw new Error('state.driveDirection must be -1, 0, or 1');
  }
  if (state.bodyMode !== 'upright' && state.bodyMode !== 'sliding') {
    throw new Error("state.bodyMode must be 'upright' or 'sliding'");
  }
  if (state.bodyMode === 'sliding' && state.driveDirection !== 0) {
    throw new Error('sliding runner state must not have an active drive direction');
  }
  if (Math.abs(state.speedMps) - parameters.topSpeedMps > EPSILON) {
    throw new Error('state.speedMps must not exceed topSpeedMps');
  }
};

const validateIntent = (intent: RunnerMotionIntent): void => {
  if (!Number.isSafeInteger(intent.issuedTick) || intent.issuedTick < 0) {
    throw new Error('intent.issuedTick must be a non-negative safe integer tick');
  }
};

const validateParameters = (parameters: RunnerMotionParameters): void => {
  if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (!Number.isSafeInteger(parameters.reactionDelayTicks) || parameters.reactionDelayTicks < 0) {
    throw new Error('reactionDelayTicks must be a non-negative safe integer');
  }
  for (const [name, value] of [
    ['accelerationMps2', parameters.accelerationMps2],
    ['brakingMps2', parameters.brakingMps2],
    ['slideDecelerationMps2', parameters.slideDecelerationMps2],
    ['topSpeedMps', parameters.topSpeedMps],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be finite and positive`);
    }
  }
};

const controlForIntent = (intent: RunnerMotionIntent): ActiveRunnerControl => {
  switch (intent.kind) {
    case 'advance':
      return { driveDirection: 1, bodyMode: 'upright' };
    case 'retreat':
      return { driveDirection: -1, bodyMode: 'upright' };
    case 'hold':
      return { driveDirection: 0, bodyMode: 'upright' };
    case 'slide':
      return { driveDirection: 0, bodyMode: 'sliding' };
  }
};

const appendSegment = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
  accelerationMps2: number,
): void => {
  if (durationSeconds <= durationTolerance(cursor)) {
    return;
  }

  segments.push({
    startElapsedSeconds: cursor.elapsedSeconds,
    endElapsedSeconds: cursor.elapsedSeconds + durationSeconds,
    startRouteDistanceMeters: cursor.routeDistanceMeters,
    startSpeedMps: cursor.speedMps,
    accelerationMps2,
    driveDirection: cursor.control.driveDirection,
    bodyMode: cursor.control.bodyMode,
  });

  cursor.routeDistanceMeters +=
    cursor.speedMps * durationSeconds
    + 0.5 * accelerationMps2 * durationSeconds * durationSeconds;
  cursor.speedMps = canonicalZero(cursor.speedMps + accelerationMps2 * durationSeconds);
  cursor.elapsedSeconds += durationSeconds;
};

const appendStationary = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
): void => {
  appendSegment(segments, cursor, durationSeconds, 0);
};

const appendBrakingToZero = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
  brakingMps2: number,
): void => {
  const speedMagnitude = Math.abs(cursor.speedMps);
  if (speedMagnitude <= EPSILON) {
    cursor.speedMps = 0;
    appendStationary(segments, cursor, durationSeconds);
    return;
  }

  const direction = Math.sign(cursor.speedMps);
  const stopSeconds = speedMagnitude / brakingMps2;
  const brakingSeconds = Math.min(durationSeconds, stopSeconds);
  appendSegment(
    segments,
    cursor,
    brakingSeconds,
    -direction * brakingMps2,
  );

  const remainingSeconds = durationSeconds - brakingSeconds;
  if (remainingSeconds > durationTolerance(cursor)) {
    cursor.speedMps = 0;
    appendStationary(segments, cursor, remainingSeconds);
  }
};

const appendAccelerationTowardDrive = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
  driveDirection: -1 | 1,
  parameters: RunnerMotionParameters,
): void => {
  if (durationSeconds <= durationTolerance(cursor)) {
    return;
  }

  const speedMagnitude = Math.abs(cursor.speedMps);
  const remainingSpeed = Math.max(0, parameters.topSpeedMps - speedMagnitude);
  const timeToTopSpeed = remainingSpeed / parameters.accelerationMps2;
  const accelerationSeconds = Math.min(durationSeconds, timeToTopSpeed);

  if (accelerationSeconds > durationTolerance(cursor)) {
    appendSegment(
      segments,
      cursor,
      accelerationSeconds,
      driveDirection * parameters.accelerationMps2,
    );
  }

  const remainingSeconds = durationSeconds - accelerationSeconds;
  if (remainingSeconds > durationTolerance(cursor)) {
    cursor.speedMps = driveDirection * parameters.topSpeedMps;
    appendSegment(segments, cursor, remainingSeconds, 0);
  }
};

const appendUprightDrive = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
  parameters: RunnerMotionParameters,
): void => {
  const driveDirection = cursor.control.driveDirection;
  if (driveDirection === 0) {
    appendBrakingToZero(
      segments,
      cursor,
      durationSeconds,
      parameters.brakingMps2,
    );
    return;
  }

  if (Math.abs(cursor.speedMps) > EPSILON && Math.sign(cursor.speedMps) !== driveDirection) {
    const stopSeconds = Math.abs(cursor.speedMps) / parameters.brakingMps2;
    const brakingSeconds = Math.min(durationSeconds, stopSeconds);
    appendSegment(
      segments,
      cursor,
      brakingSeconds,
      driveDirection * parameters.brakingMps2,
    );

    const remainingSeconds = durationSeconds - brakingSeconds;
    if (remainingSeconds <= durationTolerance(cursor)) {
      return;
    }
    cursor.speedMps = 0;
    appendAccelerationTowardDrive(
      segments,
      cursor,
      remainingSeconds,
      driveDirection,
      parameters,
    );
    return;
  }

  if (Math.abs(cursor.speedMps) <= EPSILON) {
    cursor.speedMps = 0;
  }
  appendAccelerationTowardDrive(
    segments,
    cursor,
    durationSeconds,
    driveDirection,
    parameters,
  );
};

const appendControlMotion = (
  segments: RunnerMotionTrajectorySegment[],
  cursor: MutableTrajectoryCursor,
  durationSeconds: number,
  parameters: RunnerMotionParameters,
): void => {
  if (durationSeconds <= durationTolerance(cursor)) {
    return;
  }
  if (cursor.control.bodyMode === 'sliding') {
    appendBrakingToZero(
      segments,
      cursor,
      durationSeconds,
      parameters.slideDecelerationMps2,
    );
    return;
  }
  appendUprightDrive(segments, cursor, durationSeconds, parameters);
};

export const buildRunnerMotionTrajectory = (
  state: RunnerMotionState,
  intent: RunnerMotionIntent,
  deltaTicks: number,
  parameters: RunnerMotionParameters,
): RunnerMotionTrajectory => {
  validateParameters(parameters);
  validateState(state, parameters);
  validateIntent(intent);
  if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative safe integer');
  }
  const endTick = state.tick + deltaTicks;
  if (!Number.isSafeInteger(endTick)) {
    throw new Error('runner motion end tick must be a safe integer');
  }
  const reactionTick = intent.issuedTick + parameters.reactionDelayTicks;
  if (!Number.isSafeInteger(reactionTick)) {
    throw new Error('runner intent reaction tick must be a safe integer');
  }

  const totalSeconds = deltaTicks / parameters.ticksPerSecond;
  const segments: RunnerMotionTrajectorySegment[] = [];
  const cursor: MutableTrajectoryCursor = {
    elapsedSeconds: 0,
    routeDistanceMeters: state.routeDistanceMeters,
    speedMps: state.speedMps,
    control: {
      driveDirection: state.driveDirection,
      bodyMode: state.bodyMode,
    },
  };

  if (reactionTick <= state.tick) {
    cursor.control = controlForIntent(intent);
    appendControlMotion(segments, cursor, totalSeconds, parameters);
  } else if (reactionTick >= endTick) {
    appendControlMotion(segments, cursor, totalSeconds, parameters);
    if (reactionTick === endTick) {
      cursor.control = controlForIntent(intent);
    }
  } else {
    const oldControlSeconds = (reactionTick - state.tick) / parameters.ticksPerSecond;
    appendControlMotion(segments, cursor, oldControlSeconds, parameters);
    cursor.control = controlForIntent(intent);
    appendControlMotion(
      segments,
      cursor,
      totalSeconds - oldControlSeconds,
      parameters,
    );
  }

  return {
    startTick: state.tick,
    ticksPerSecond: parameters.ticksPerSecond,
    segments,
    endState: {
      tick: endTick,
      routeDistanceMeters: cursor.routeDistanceMeters,
      speedMps: canonicalZero(cursor.speedMps),
      driveDirection: cursor.control.driveDirection,
      bodyMode: cursor.control.bodyMode,
    },
  };
};

export const sampleRunnerMotionTrajectory = (
  trajectory: RunnerMotionTrajectory,
  tick: number,
): RunnerMotionState => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'runner motion trajectory sample tick must be a non-negative safe integer',
    );
  }
  if (
    tick < trajectory.startTick
    || tick > trajectory.endState.tick
  ) {
    throw new Error(
      'runner motion trajectory sample tick must lie inside the trajectory interval',
    );
  }

  if (tick === trajectory.endState.tick) {
    return trajectory.endState;
  }

  const elapsedSeconds = (
    tick - trajectory.startTick
  ) / trajectory.ticksPerSecond;

  let segment: RunnerMotionTrajectorySegment | undefined;
  for (
    let index = trajectory.segments.length - 1;
    index >= 0;
    index -= 1
  ) {
    const candidate = trajectory.segments[index];
    if (
      elapsedSeconds + EPSILON >= candidate.startElapsedSeconds
      && elapsedSeconds <= candidate.endElapsedSeconds + EPSILON
    ) {
      segment = candidate;
      break;
    }
  }

  if (segment === undefined) {
    if (trajectory.segments.length === 0) {
      return trajectory.endState;
    }
    throw new Error(
      'runner motion trajectory does not cover the requested tick',
    );
  }

  const durationSeconds = (
    segment.endElapsedSeconds
    - segment.startElapsedSeconds
  );
  const localSeconds = Math.max(
    0,
    Math.min(
      durationSeconds,
      elapsedSeconds - segment.startElapsedSeconds,
    ),
  );

  return {
    tick,
    routeDistanceMeters: (
      segment.startRouteDistanceMeters
      + segment.startSpeedMps * localSeconds
      + 0.5
        * segment.accelerationMps2
        * localSeconds
        * localSeconds
    ),
    speedMps: canonicalZero(
      segment.startSpeedMps
      + segment.accelerationMps2 * localSeconds,
    ),
    driveDirection: segment.driveDirection,
    bodyMode: segment.bodyMode,
  };
};

export const advanceRunnerMotion = (
  state: RunnerMotionState,
  intent: RunnerMotionIntent,
  deltaTicks: number,
  parameters: RunnerMotionParameters,
): RunnerMotionState => buildRunnerMotionTrajectory(
  state,
  intent,
  deltaTicks,
  parameters,
).endState;

/** Continuous sampling for an independently authenticated exact adoption origin.
 * This returns kinematics only: the caller retains the real occurrence moment. */
export const sampleRunnerMotionTrajectoryExact = (trajectory: RunnerMotionTrajectory | ExactRunnerMotionTrajectory, elapsedSeconds: number): Omit<RunnerMotionState, 'tick'> => {
  const duration='durationSeconds' in trajectory?trajectory.durationSeconds:(trajectory.endState.tick-trajectory.startTick)/trajectory.ticksPerSecond;
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||elapsedSeconds>duration)throw new Error('exact runner sample is outside its original trajectory');
  if(elapsedSeconds===duration){const {tick:_,...state}=trajectory.endState;return state;}
  const segment=trajectory.segments.find(s=>elapsedSeconds>=s.startElapsedSeconds&&elapsedSeconds<s.endElapsedSeconds);
  if(!segment)throw new Error('original runner trajectory does not cover exact sample');
  const dt=elapsedSeconds-segment.startElapsedSeconds;
  return {routeDistanceMeters:segment.startRouteDistanceMeters+segment.startSpeedMps*dt+0.5*segment.accelerationMps2*dt*dt,
    speedMps:canonicalZero(segment.startSpeedMps+segment.accelerationMps2*dt),driveDirection:segment.driveDirection,bodyMode:segment.bodyMode};
};

/** The physical state is at an exact cut, while an accepted intent and its
 * reaction retain their absolute integer times. Before reaction, the existing
 * state control remains authoritative, including between the cut and issuance. */
export const buildRunnerMotionTrajectoryAtExactOrigin = (state: RunnerMotionState, intent: RunnerMotionIntent,
  endTick: number, parameters: RunnerMotionParameters, origin: ExactRunnerMotionTrajectory['origin']): ExactRunnerMotionTrajectory => {
  validateParameters(parameters);validateState(state,parameters);validateIntent(intent);
  const tps=parameters.ticksPerSecond,reactionTick=intent.issuedTick+parameters.reactionDelayTicks;
  if(!Number.isSafeInteger(endTick)||endTick<state.tick||!Number.isSafeInteger(reactionTick)
    ||!Number.isSafeInteger(origin.originTick)||origin.originTick<0||!Number.isFinite(origin.elapsedSeconds)||origin.elapsedSeconds<0
    ||origin.tick!==state.tick||quantizeEventTick(origin.originTick,origin.elapsedSeconds,tps)!==state.tick)
    throw new Error('exact runner origin or accepted absolute timing differs');
  const durationSeconds=(endTick-origin.originTick)/tps-origin.elapsedSeconds;
  const reactionSeconds=(reactionTick-origin.originTick)/tps-origin.elapsedSeconds;
  if(!Number.isFinite(durationSeconds)||durationSeconds<0)throw new Error('exact runner end precedes its physical origin');
  const segments:RunnerMotionTrajectorySegment[]=[],cursor:MutableTrajectoryCursor={elapsedSeconds:0,exactIntervals:true,
    routeDistanceMeters:state.routeDistanceMeters,speedMps:state.speedMps,control:{driveDirection:state.driveDirection,bodyMode:state.bodyMode}};
  if(reactionSeconds<=0){cursor.control=controlForIntent(intent);appendControlMotion(segments,cursor,durationSeconds,parameters);}
  else if(reactionSeconds>=durationSeconds){appendControlMotion(segments,cursor,durationSeconds,parameters);
    if(reactionSeconds===durationSeconds)cursor.control=controlForIntent(intent);
  }else{appendControlMotion(segments,cursor,reactionSeconds,parameters);cursor.control=controlForIntent(intent);
    appendControlMotion(segments,cursor,durationSeconds-reactionSeconds,parameters);}
  return{origin:{...origin},ticksPerSecond:tps,durationSeconds,segments,endState:{tick:endTick,
    routeDistanceMeters:cursor.routeDistanceMeters,speedMps:canonicalZero(cursor.speedMps),driveDirection:cursor.control.driveDirection,bodyMode:cursor.control.bodyMode}};
};
