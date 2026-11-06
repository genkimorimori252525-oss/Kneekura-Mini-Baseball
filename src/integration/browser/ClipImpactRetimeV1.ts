import type { Vec3 } from '../../core/model/geometry';
import { rotateVectorByQuaternion, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';

type Frame = Readonly<{ tick: number; grip: Vec3; orientation: Quaternion }>;

/**
 * noImpactFollowV1: the measured clips hit a real ball. Across the 673 clips the median sweet-spot speed falls from
 * 28.7 m/s at the clip's contact to 19.3 m/s 4 ms later (2026-11-06): what follows the contact pose is a bat already
 * slowed by that ball. A ball met after the contact pose (an early swing, out-front contact) was then struck by a bat
 * about a third slower than the target, where MLB's out-front contacts are the fastest (Statcast 2024 bat tracking).
 *
 * The poses after the contact stay as measured, so the drawn swing keeps its shape; only their times are pulled in, so
 * the bat leaves the contact pose at the contact speed and slows back to the clip's own speed over windowSeconds of clip
 * time, as a bat that met no ball would. Ticks stay integers and strictly increasing; nothing at or before the contact
 * pose moves.
 */
export function retimeClipAfterContactV1<F extends Frame>(frames: readonly F[], contactTick: number,
  radiusM: number, windowSeconds: number, sourceTicksPerSecond = 1e6): F[] {
  if (!(Number.isFinite(contactTick) && Number.isFinite(radiusM) && radiusM > 0 && Number.isFinite(windowSeconds)
    && windowSeconds >= .01 && windowSeconds <= .3 && frames.length >= 2)) throw Error('invalid clip retime input');
  const sweet = (f: Frame) => {
    const axis = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, f.orientation);
    return { x: f.grip.x + axis.x * radiusM, y: f.grip.y + axis.y * radiusM, z: f.grip.z + axis.z * radiusM };
  };
  const points = frames.map(sweet);
  const speed = (i: number) => {
    const a = points[i], b = points[i + 1];
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / ((frames[i + 1].tick - frames[i].tick) / sourceTicksPerSecond);
  };
  const first = frames.findIndex(f => f.tick >= contactTick);
  if (first < 2 || first >= frames.length - 1) return frames.slice();
  // The clips are normalised so the speed at the contact is the batter's target speed: the segment reaching the pose.
  const contactSpeed = speed(first - 1);
  const out = frames.slice(0, first + 1);
  let at = frames[first].tick;
  for (let i = first; i < frames.length - 1; i++) {
    const dt = frames[i + 1].tick - frames[i].tick, mid = (frames[i].tick + dt / 2 - frames[first].tick) / sourceTicksPerSecond;
    const own = speed(i), target = Math.max(own, own + (contactSpeed - own) * Math.max(0, 1 - mid / windowSeconds));
    at += dt * (target > 0 ? own / target : 1);
    out.push({ ...frames[i + 1], tick: Math.max(out[out.length - 1].tick + 1, Math.round(at)) });
  }
  return out;
}
