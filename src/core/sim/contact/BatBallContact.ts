import type { Vec3 } from '../../model/geometry';

export type PitchWorldState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type BatPose = Readonly<{
  grip: Vec3;
  tip: Vec3;
}>;

export type BatterSwingState = Readonly<{
  pose: BatPose;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}>;

export type ContactParameters = Readonly<{
  ballRadius: number;
  batRadius: number;
  restitution: number;
  tangentialRetention: number;
  spinTransfer: number;
}>;

export const DEFAULT_CONTACT_PARAMETERS: ContactParameters = Object.freeze({
  ballRadius: 0.0366,
  batRadius: 0.033,
  restitution: 0.52,
  tangentialRetention: 0.82,
  spinTransfer: 0.18,
});

export type BattedBallInitialState = Readonly<{
  tick: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type BatBallContactResult = Readonly<{
  tick: number;
  ballCenter: Vec3;
  point: Vec3;
  batPoint: Vec3;
  normal: Vec3;
  segmentT: number;
  exitVelocity: Vec3;
  exitSpin: Vec3;
}>;

const EPSILON = 1e-12;
const TICKS_PER_SECOND = 1_000_000;

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const scale = (value: Vec3, scalar: number): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (length <= EPSILON) {
    throw new Error('cannot normalize a zero-length vector');
  }
  return scale(value, 1 / length);
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const closestPointOnSegment = (
  point: Vec3,
  start: Vec3,
  end: Vec3,
): Readonly<{ point: Vec3; t: number }> => {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= EPSILON) {
    throw new Error('bat pose grip and tip must not be identical');
  }

  const t = clamp01(dot(subtract(point, start), segment) / lengthSquared);
  return {
    point: add(start, scale(segment, t)),
    t,
  };
};

const validateParameters = (parameters: ContactParameters): void => {
  if (parameters.ballRadius <= 0 || parameters.batRadius <= 0) {
    throw new Error('ballRadius and batRadius must be positive');
  }
  if (parameters.restitution < 0 || parameters.restitution > 1) {
    throw new Error('restitution must be within [0, 1]');
  }
  if (parameters.tangentialRetention < 0 || parameters.tangentialRetention > 1) {
    throw new Error('tangentialRetention must be within [0, 1]');
  }
  if (parameters.spinTransfer < 0) {
    throw new Error('spinTransfer must be non-negative');
  }
};

const advancePitchForContactSweep = (
  pitch: PitchWorldState,
  offsetTicks: number,
): PitchWorldState => {
  const dt = offsetTicks / TICKS_PER_SECOND;
  return {
    tick: pitch.tick + offsetTicks,
    position: add(pitch.position, scale(pitch.velocity, dt)),
    velocity: pitch.velocity,
    spin: pitch.spin,
  };
};

export const sampleBatterSwingState = (
  swing: BatterSwingState,
  offsetTicks: number,
  ticksPerSecond: number = TICKS_PER_SECOND,
): BatterSwingState => {
  if (!Number.isSafeInteger(offsetTicks) || offsetTicks < 0) {
    throw new Error('swing sample offsetTicks must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new Error('swing sample ticksPerSecond must be a positive safe integer');
  }
  const dt = offsetTicks / ticksPerSecond;
  const gripTranslation = scale(swing.linearVelocity, dt);
  const batAxis = subtract(swing.pose.tip, swing.pose.grip);
  const tipAngularTranslation = scale(cross(swing.angularVelocity, batAxis), dt);

  return {
    pose: {
      grip: add(swing.pose.grip, gripTranslation),
      tip: add(add(swing.pose.tip, gripTranslation), tipAngularTranslation),
    },
    linearVelocity: swing.linearVelocity,
    angularVelocity: swing.angularVelocity,
  };
};

export const measureBatBallContactSeparation = (
  pitch: PitchWorldState,
  swing: BatterSwingState,
  parameters: ContactParameters = DEFAULT_CONTACT_PARAMETERS,
): number => {
  validateParameters(parameters);
  const nearest = closestPointOnSegment(
    pitch.position,
    swing.pose.grip,
    swing.pose.tip,
  );
  return magnitude(subtract(pitch.position, nearest.point)) -
    (parameters.ballRadius + parameters.batRadius);
};

const maximumContactClosingSpeed = (
  pitch: PitchWorldState,
  swing: BatterSwingState,
): number => {
  const relativeTranslation = magnitude(subtract(pitch.velocity, swing.linearVelocity));
  const batLength = magnitude(subtract(swing.pose.tip, swing.pose.grip));
  return relativeTranslation + magnitude(swing.angularVelocity) * batLength;
};

export const findBatBallContactTick = (
  pitch: PitchWorldState,
  swing: BatterSwingState,
  deltaTicks: number,
  parameters: ContactParameters = DEFAULT_CONTACT_PARAMETERS,
): number | null => {
  validateParameters(parameters);
  if (!Number.isSafeInteger(pitch.tick) || pitch.tick < 0) {
    throw new Error('pitch.tick must be a non-negative safe integer tick');
  }
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error('deltaTicks must be a non-negative integer');
  }
  if (!Number.isSafeInteger(pitch.tick + deltaTicks)) {
    throw new Error('contact search end tick must be a safe integer');
  }

  if (resolveBatBallContact(pitch, swing, parameters) !== null) {
    return pitch.tick;
  }
  if (deltaTicks === 0) {
    return null;
  }

  const maximumClosingSpeed = maximumContactClosingSpeed(pitch, swing);
  if (maximumClosingSpeed <= EPSILON) {
    return null;
  }

  let offsetTicks = 0;
  while (offsetTicks < deltaTicks) {
    const sampledPitch = advancePitchForContactSweep(pitch, offsetTicks);
    const sampledSwing = sampleBatterSwingState(swing, offsetTicks);
    const separation = measureBatBallContactSeparation(sampledPitch, sampledSwing, parameters);

    if (separation <= 0 && resolveBatBallContact(sampledPitch, sampledSwing, parameters) !== null) {
      return sampledPitch.tick;
    }

    const safeAdvanceTicks = separation > 0
      ? Math.floor((separation / maximumClosingSpeed) * TICKS_PER_SECOND) - 1
      : 1;
    const advanceTicks = Math.max(1, safeAdvanceTicks);
    offsetTicks = Math.min(deltaTicks, offsetTicks + advanceTicks);
  }

  const sampledPitch = advancePitchForContactSweep(pitch, deltaTicks);
  const sampledSwing = sampleBatterSwingState(swing, deltaTicks);
  return resolveBatBallContact(sampledPitch, sampledSwing, parameters) === null
    ? null
    : sampledPitch.tick;
};

export const resolveBatBallContact = (
  pitch: PitchWorldState,
  swing: BatterSwingState,
  parameters: ContactParameters = DEFAULT_CONTACT_PARAMETERS,
): BatBallContactResult | null => {
  validateParameters(parameters);

  const nearest = closestPointOnSegment(
    pitch.position,
    swing.pose.grip,
    swing.pose.tip,
  );
  const batToBall = subtract(pitch.position, nearest.point);
  const distance = magnitude(batToBall);
  const contactDistance = parameters.ballRadius + parameters.batRadius;

  if (distance > contactDistance) {
    return null;
  }

  const normal = distance > EPSILON
    ? scale(batToBall, 1 / distance)
    : normalize(scale(pitch.velocity, -1));

  const leverArm = subtract(nearest.point, swing.pose.grip);
  const localBatVelocity = add(
    swing.linearVelocity,
    cross(swing.angularVelocity, leverArm),
  );
  const relativeVelocity = subtract(pitch.velocity, localBatVelocity);
  const normalSpeed = dot(relativeVelocity, normal);

  if (normalSpeed >= 0) {
    return null;
  }

  const relativeNormal = scale(normal, normalSpeed);
  const relativeTangent = subtract(relativeVelocity, relativeNormal);
  const postRelativeNormal = scale(
    normal,
    -parameters.restitution * normalSpeed,
  );
  const postRelativeTangent = scale(
    relativeTangent,
    parameters.tangentialRetention,
  );
  const exitVelocity = add(
    localBatVelocity,
    add(postRelativeNormal, postRelativeTangent),
  );

  const tangentSlip = subtract(relativeTangent, postRelativeTangent);
  const spinDelta = scale(
    cross(normal, tangentSlip),
    parameters.spinTransfer / parameters.ballRadius,
  );
  const exitSpin = add(pitch.spin, spinDelta);
  const contactPoint = add(nearest.point, scale(normal, parameters.batRadius));

  return {
    tick: pitch.tick,
    ballCenter: pitch.position,
    point: contactPoint,
    batPoint: nearest.point,
    normal,
    segmentT: nearest.t,
    exitVelocity,
    exitSpin,
  };
};

export const createBattedBallInitialStateFromContact = (
  contact: BatBallContactResult,
): BattedBallInitialState => ({
  tick: contact.tick,
  position: contact.ballCenter,
  velocity: contact.exitVelocity,
  spin: contact.exitSpin,
});
