import type { Vec3 } from '../../model/geometry';
import type {
  DefenderPosePrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

export type GloveReachState = Readonly<{
  tick: number;
  offset: Vec3;
  velocity: Vec3;
}>;

export type GloveReachExecutionParameters = Readonly<{
  gloveRadiusMeters: number;
  maxRelativeReachSpeedMps: number;
  maxRelativeReachAccelerationMps2: number;
}>;

const EPSILON = 1e-12;

const clean = (value: number): number => (
  Math.abs(value) <= EPSILON ? 0 : value
);

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validateVec3 = (name: string, value: Vec3): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validatePositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be finite and positive`);
  }
};

const magnitude = (value: Vec3): number => (
  Math.hypot(value.x, value.y, value.z)
);

export const planGloveReachPoseSegment = (
  state: GloveReachState,
  assessment: PerceivedGloveTargetAssessment,
  parameters: GloveReachExecutionParameters,
): DefenderPosePrimitiveSegment | null => {
  validateTick('state.tick', state.tick);
  validateVec3('state.offset', state.offset);
  validateVec3('state.velocity', state.velocity);
  validateTick('assessment.plannedFromTick', assessment.plannedFromTick);
  validateTick('assessment.targetTick', assessment.targetTick);
  if (
    !Number.isSafeInteger(assessment.ticksPerSecond)
    || assessment.ticksPerSecond <= 0
  ) {
    throw new Error('assessment.ticksPerSecond must be a positive safe integer');
  }
  validateVec3('assessment.desiredOffset', assessment.desiredOffset);
  validatePositive('gloveRadiusMeters', parameters.gloveRadiusMeters);
  validatePositive(
    'maxRelativeReachSpeedMps',
    parameters.maxRelativeReachSpeedMps,
  );
  validatePositive(
    'maxRelativeReachAccelerationMps2',
    parameters.maxRelativeReachAccelerationMps2,
  );

  if (state.tick !== assessment.plannedFromTick) {
    throw new Error(
      'glove reach state tick must equal assessment plannedFromTick',
    );
  }
  if (assessment.targetTick <= assessment.plannedFromTick) {
    throw new Error(
      'assessment targetTick must be after assessment plannedFromTick',
    );
  }
  if (!assessment.withinReach) {
    return null;
  }

  const durationSeconds = (
    assessment.targetTick - assessment.plannedFromTick
  ) / assessment.ticksPerSecond;
  const durationSquared = durationSeconds * durationSeconds;

  const requiredAcceleration: Vec3 = {
    x: clean(2 * (
      assessment.desiredOffset.x
      - state.offset.x
      - state.velocity.x * durationSeconds
    ) / durationSquared),
    y: clean(2 * (
      assessment.desiredOffset.y
      - state.offset.y
      - state.velocity.y * durationSeconds
    ) / durationSquared),
    z: clean(2 * (
      assessment.desiredOffset.z
      - state.offset.z
      - state.velocity.z * durationSeconds
    ) / durationSquared),
  };

  if (
    magnitude(requiredAcceleration)
    > parameters.maxRelativeReachAccelerationMps2 + EPSILON
  ) {
    return null;
  }

  const terminalVelocity: Vec3 = {
    x: clean(
      state.velocity.x + requiredAcceleration.x * durationSeconds,
    ),
    y: clean(
      state.velocity.y + requiredAcceleration.y * durationSeconds,
    ),
    z: clean(
      state.velocity.z + requiredAcceleration.z * durationSeconds,
    ),
  };

  if (
    magnitude(terminalVelocity)
    > parameters.maxRelativeReachSpeedMps + EPSILON
  ) {
    return null;
  }

  return {
    role: 'glove',
    radius: parameters.gloveRadiusMeters,
    startTick: state.tick,
    endTick: assessment.targetTick,
    ticksPerSecond: assessment.ticksPerSecond,
    startOffset: state.offset,
    offsetVelocity: state.velocity,
    offsetAcceleration: requiredAcceleration,
  };
};
