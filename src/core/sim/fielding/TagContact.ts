import type { Vec3 } from '../../model/geometry';
import { findAcceleratedSphereContactTick } from '../collision/AcceleratedSphereContact';
import { findMovingSphereContactTick } from '../collision/MovingSphereContact';

/**
 * A physical tag-contact primitive supplied by a body/pose model.
 * The caller may represent the tagger or runner with multiple primitives and
 * select the earliest contact; this type intentionally does not mean player center.
 */
export type TagContactPrimitiveState = Readonly<{
  tick: number;
  center: Vec3;
  velocity: Vec3;
  radius: number;
}>;

export type AcceleratedTagContactPrimitiveState = TagContactPrimitiveState & Readonly<{
  acceleration: Vec3;
}>;

export type TagContactParameters = Readonly<{
  ticksPerSecond: number;
}>;

/**
 * Resolves physical tag contact only. Ball possession, runner protection by a base,
 * and the resulting rule decision belong to later rule evaluation.
 */
export const findTagContactTick = (
  taggerPrimitive: TagContactPrimitiveState,
  runnerPrimitive: TagContactPrimitiveState,
  deltaTicks: number,
  parameters: TagContactParameters,
): number | null => findMovingSphereContactTick(
  taggerPrimitive,
  runnerPrimitive,
  deltaTicks,
  parameters,
);


export const findAcceleratedTagContactTick = (
  taggerPrimitive: AcceleratedTagContactPrimitiveState,
  runnerPrimitive: AcceleratedTagContactPrimitiveState,
  deltaTicks: number,
  parameters: TagContactParameters,
): number | null => findAcceleratedSphereContactTick(
  {
    tick: taggerPrimitive.tick,
    center: taggerPrimitive.center,
    velocity: taggerPrimitive.velocity,
    acceleration: taggerPrimitive.acceleration,
    radius: taggerPrimitive.radius,
  },
  {
    tick: runnerPrimitive.tick,
    center: runnerPrimitive.center,
    velocity: runnerPrimitive.velocity,
    acceleration: runnerPrimitive.acceleration,
    radius: runnerPrimitive.radius,
  },
  deltaTicks,
  parameters,
);
