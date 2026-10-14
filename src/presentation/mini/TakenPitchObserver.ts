import type { Vec3 } from '../../core/model/geometry';

/** Presentation-only orientation: world yaw follows +z; positive pitch looks downward. */
export type VisualGaze = Readonly<{ yaw: number; pitch: number }>;

function finiteVector(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function lookAtObservedBall(eye: Vec3, ball: Vec3): VisualGaze {
  if (!finiteVector(eye) || !finiteVector(ball)) {
    throw new Error('Batter POV needs finite canonical positions.');
  }
  const dx = ball.x - eye.x;
  const dz = ball.z - eye.z;
  const horizontal = Math.max(0.05, Math.hypot(dx, dz));
  return {
    yaw: Math.atan2(dx, dz),
    pitch: Math.atan2(eye.y - ball.y, horizontal),
  };
}

export function blendObservedBallGaze(
  source: VisualGaze,
  destination: VisualGaze,
  progress: number,
): VisualGaze {
  if (![source.yaw, source.pitch, destination.yaw, destination.pitch, progress].every(Number.isFinite)) {
    throw new Error('Invalid visual gaze interpolation.');
  }
  const alpha = Math.max(0, Math.min(1, progress));
  const smooth = alpha * alpha * (3 - 2 * alpha);
  const turn = Math.atan2(Math.sin(destination.yaw - source.yaw), Math.cos(destination.yaw - source.yaw));
  return {
    yaw: source.yaw + turn * smooth,
    pitch: source.pitch + (destination.pitch - source.pitch) * smooth,
  };
}

/**
 * Keep the batter watching a taken pitch only slightly behind the zone,
 * without a 180-degree rotation all the way to the catcher.
 * Canonical ball still continues to its true mitt reception point.
 * The angular bounds apply to the presentation camera ONLY.
 */
export function capTakenPitchGaze(
  atPlate: VisualGaze,
  atBall: VisualGaze,
  maxYawRadians = 0.42,
  maxPitchDeltaRadians = 0.18,
): VisualGaze {
  if (![atPlate.yaw, atPlate.pitch, atBall.yaw, atBall.pitch,
    maxYawRadians, maxPitchDeltaRadians].every(Number.isFinite)
    || maxYawRadians < 0 || maxPitchDeltaRadians < 0) {
    throw new Error('Invalid taken-pitch visual limits.');
  }
  const yawDelta = Math.atan2(Math.sin(atBall.yaw - atPlate.yaw),
    Math.cos(atBall.yaw - atPlate.yaw));
  return {
    yaw: atPlate.yaw + Math.max(-maxYawRadians, Math.min(maxYawRadians, yawDelta)),
    pitch: atPlate.pitch + Math.max(-maxPitchDeltaRadians,
      Math.min(maxPitchDeltaRadians, atBall.pitch - atPlate.pitch)),
  };
}

/**
 * On an unswung pitch, preserve the actual ball's plate crossing and the
 * catcher reception sample. This does not create or change physical samples.
 */
export function observedTakenPitchProgress(localTick: number, plateCrossingTick: number, catcherReceivingTick: number): number {
  if (![localTick, plateCrossingTick, catcherReceivingTick].every(Number.isSafeInteger)
      || catcherReceivingTick <= plateCrossingTick) {
    throw new Error('Invalid taken-pitch event ordering.');
  }
  return Math.max(0, Math.min(1, (localTick - plateCrossingTick) / (catcherReceivingTick - plateCrossingTick)));
}
