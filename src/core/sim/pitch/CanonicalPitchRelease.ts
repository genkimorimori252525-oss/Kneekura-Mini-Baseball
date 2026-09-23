import type { Vec3 } from '../../model/geometry';
import type { PitchTrajectorySegment } from '../pitching/PitchTrajectory';
import type { PitchMotionTimeline } from './PitchMotionTimeline';

export type CanonicalPitchRelease = Readonly<{
  releaseAtUs: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

const checkedVec3 = (name: string, value: Vec3): Vec3 => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must have finite coordinates`);
  }
  return Object.freeze({ ...value });
};

export const createCanonicalPitchRelease = (
  timeline: Pick<PitchMotionTimeline, 'releaseUs'>,
  position: Vec3,
  physics: Readonly<{ velocity: Vec3; spin: Vec3 }>,
): CanonicalPitchRelease => {
  if (!Number.isSafeInteger(timeline.releaseUs) || timeline.releaseUs < 0) {
    throw new Error('release time must be a non-negative safe integer microsecond time');
  }
  return Object.freeze({
    releaseAtUs: timeline.releaseUs,
    position: checkedVec3('release position', position),
    velocity: checkedVec3('release velocity', physics.velocity),
    spin: checkedVec3('release spin', physics.spin),
  });
};

export const createPitchTrajectoryFromRelease = (
  release: CanonicalPitchRelease,
  acceleration: Vec3,
  endAtUs: number,
): PitchTrajectorySegment => {
  if (!Number.isSafeInteger(endAtUs) || endAtUs < release.releaseAtUs) {
    throw new Error('flight end must be a safe integer at or after release');
  }
  return Object.freeze({
    start: Object.freeze({
      tick: release.releaseAtUs,
      position: checkedVec3('release position', release.position),
      velocity: checkedVec3('release velocity', release.velocity),
      spin: checkedVec3('release spin', release.spin),
    }),
    acceleration: checkedVec3('pitch acceleration', acceleration),
    endTick: endAtUs,
    ticksPerSecond: 1_000_000,
  });
};
