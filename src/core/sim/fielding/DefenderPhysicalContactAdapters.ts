import type { Vec3 } from '../../model/geometry';
import type {
  GloveWorldState,
} from './GloveBallContact';
import type {
  AcceleratedTagContactPrimitiveState,
} from './TagContact';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';

export type DefenderGloveContactInput = Readonly<{
  glove: GloveWorldState;
  acceleration: Vec3;
  deltaTicks: number;
}>;

const validateTiming = (
  primitive: DefenderPhysicalPrimitiveSegment,
): number => {
  if (
    !Number.isSafeInteger(primitive.startTick)
    || primitive.startTick < 0
    || !Number.isSafeInteger(primitive.endTick)
    || primitive.endTick < primitive.startTick
  ) {
    throw new Error('defender primitive must use a valid authoritative tick interval');
  }
  if (
    !Number.isSafeInteger(primitive.ticksPerSecond)
    || primitive.ticksPerSecond <= 0
  ) {
    throw new Error('defender primitive ticksPerSecond must be a positive safe integer');
  }
  return primitive.endTick - primitive.startTick;
};

export const createGloveContactInputFromDefenderPrimitive = (
  primitive: DefenderPhysicalPrimitiveSegment,
): DefenderGloveContactInput => {
  if (primitive.role !== 'glove') {
    throw new Error("glove contact requires a 'glove' primitive");
  }
  const deltaTicks = validateTiming(primitive);

  return {
    glove: {
      tick: primitive.startTick,
      position: primitive.startCenter,
      velocity: primitive.startVelocity,
    },
    acceleration: primitive.acceleration,
    deltaTicks,
  };
};

export const createTagContactPrimitiveFromDefenderPrimitive = (
  primitive: DefenderPhysicalPrimitiveSegment,
): AcceleratedTagContactPrimitiveState => {
  if (primitive.role !== 'tag_hand' && primitive.role !== 'body') {
    throw new Error("tag contact requires a 'tag_hand' or 'body' primitive");
  }
  validateTiming(primitive);

  return {
    tick: primitive.startTick,
    center: primitive.startCenter,
    velocity: primitive.startVelocity,
    acceleration: primitive.acceleration,
    radius: primitive.radius,
  };
};
