import type { WorkbenchPitch } from './BattingWorkbench';
import { WORKBENCH_TICKS_PER_SECOND } from './WorkbenchPlayer';
import type { PitchWorldState } from '../../core/sim/contact/BatBallContact';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { findAerodynamicPitchPlateCrossing, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION } from '../../core/sim/pitching/BaseballOrientation';

/** Operator-authored course, shared by both controlled batting instruments.
 * This shooting solve is not a production hitter's perception/prediction. */
export const createWorkbenchPitchTrajectory = (pitch: WorkbenchPitch) => {
  if (!pitch || ![pitch.speedMps,pitch.spinRpm,pitch.courseX,pitch.courseY].every(Number.isFinite)
    || pitch.speedMps < 10 || pitch.speedMps > 80 || pitch.spinRpm < 0 || pitch.spinRpm > 5000
    || Math.abs(pitch.courseX) > 1.5 || pitch.courseY < .2 || pitch.courseY > 2.5
    || !['backspin','topspin','sidespin','gyro'].includes(pitch.spinAxis)) throw new Error('invalid workbench physical scenario');
  const p = WORKBENCH_TICKS_PER_SECOND, spinRate = pitch.spinRpm * Math.PI * 2 / 60;
  const spin = pitch.spinAxis === 'backspin' ? { x: spinRate, y: 0, z: 0 }
    : pitch.spinAxis === 'topspin' ? { x: -spinRate, y: 0, z: 0 }
      : pitch.spinAxis === 'sidespin' ? { x: 0, y: spinRate, z: 0 } : { x: 0, y: 0, z: spinRate };
  const flightEnd = Math.ceil((18 / pitch.speedMps + 0.3) * p);
  const approximateTime = 18 / pitch.speedMps;
  let initial: PitchWorldState = { tick: 0, position: { x: 0, y: 1.8, z: 18 },
    velocity: { x: pitch.courseX / approximateTime,
      y: (pitch.courseY - 1.8 + 4.905 * approximateTime ** 2) / approximateTime, z: -pitch.speedMps }, spin };
  const parameters = { ticksPerSecond: p, integrationStepTicks: 1_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS };
  let trajectory: AerodynamicPitchTrajectory = { start: initial, endTick: flightEnd, parameters, releaseOrientation: IDENTITY_QUATERNION };
  for (let i = 0; i < 4; i++) {
    const course = findAerodynamicPitchPlateCrossing(trajectory, 0);
    if (!course) throw new Error('workbench course does not reach the authored contact plane');
    initial = { ...initial, velocity: { ...initial.velocity,
      x: initial.velocity.x + (pitch.courseX - course.position.x) / course.elapsedSeconds,
      y: initial.velocity.y + (pitch.courseY - course.position.y) / course.elapsedSeconds } };
    trajectory = { ...trajectory, start: initial };
  }
  return {initial,parameters,trajectory,flightEnd};
};
