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

/**
 * handExtensionV1: past the contact pose the clip's hands keep moving toward the batter (median 4 m/s sideways) and
 * not toward the pitcher (-1..+1 m/s, 673 clips, 2026-11-06). A ball met there, after an early start, was struck
 * near the tip: the bat kept turning while the hands drew back from the ball's line. MLB batters meet early balls on
 * the barrel all the same (Statcast 2024 bat tracking: squared-up share flat over the timing part of contact depth).
 *
 * Within windowSeconds after the contact pose, the sideways hand motion keeps lateralKeep of its share and the hands
 * also move toward the pitcher at forwardMps; the offset so built is then taken back out over returnSeconds, so the
 * follow-through ends where it was measured. Times stay.
 *
 * rotationKeep (< 1) also lets the bat turn only that share as fast inside the window, the hands leading the barrel,
 * so a ball met past the contact pose still finds the barrel near its line; the turn then catches up with the measured
 * follow-through over returnSeconds. The out-front contacts kept sliding to the tip with the hands alone: the slide
 * comes mostly from the turn (squared-up 6-12 in out front: game .10, MLB .45, 2026-11-06).
 */
export function extendHandsAfterContactV1<F extends Frame>(frames: readonly F[], contactTick: number,
  lateralKeep: number, forwardMps: number, windowSeconds: number, returnSeconds = .1, sourceTicksPerSecond = 1e6, rotationKeep = 1): F[] {
  if (!(Number.isFinite(contactTick) && lateralKeep >= 0 && lateralKeep <= 1 && forwardMps >= 0 && forwardMps <= 10
    && windowSeconds >= .01 && windowSeconds <= .2 && returnSeconds > 0 && rotationKeep >= .2 && rotationKeep <= 1 && frames.length >= 2)) throw Error('invalid hand extension input');
  const first = frames.findIndex(f => f.tick >= contactTick);
  if (first < 1) return frames.slice();
  const start = frames[first].tick, out: F[] = frames.slice(0, first + 1);
  let ox = 0, oz = 0, peakX = 0, peakZ = 0;
  for (let i = first + 1; i < frames.length; i++) {
    const at = (frames[i].tick - start) / sourceTicksPerSecond, before = (frames[i - 1].tick - start) / sourceTicksPerSecond;
    // Share of this segment inside the window.
    const inside = Math.max(0, Math.min(at, windowSeconds) - before) / Math.max(1e-9, at - before);
    ox += (lateralKeep - 1) * (frames[i].grip.x - frames[i - 1].grip.x) * inside;
    oz += forwardMps * (at - before) * inside;
    if (inside > 0) { peakX = ox; peakZ = oz; }
    const back = at <= windowSeconds ? 1 : Math.max(0, 1 - (at - windowSeconds) / returnSeconds);
    const x = at <= windowSeconds ? ox : peakX * back, z = at <= windowSeconds ? oz : peakZ * back;
    // The turn's own clock: rotationKeep inside the window, then catching up by the end of the return.
    const turnAt = rotationKeep === 1 ? at : at <= windowSeconds ? rotationKeep * at
      : at <= windowSeconds + returnSeconds ? rotationKeep * windowSeconds + (at - windowSeconds) * (windowSeconds + returnSeconds - rotationKeep * windowSeconds) / returnSeconds : at;
    out.push({ ...frames[i], grip: { x: frames[i].grip.x + x, y: frames[i].grip.y, z: frames[i].grip.z + z },
      orientation: turnAt === at ? frames[i].orientation : orientationAt(frames, start + turnAt * sourceTicksPerSecond) });
  }
  return out;
}

function orientationAt(frames: readonly Frame[], tick: number): Quaternion {
  let hi = frames.findIndex(f => f.tick >= tick);
  if (hi <= 0) return frames[Math.max(0, hi)].orientation;
  const a = frames[hi - 1].orientation, b0 = frames[hi].orientation, u = (tick - frames[hi - 1].tick) / (frames[hi].tick - frames[hi - 1].tick);
  const d0 = a.w * b0.w + a.x * b0.x + a.y * b0.y + a.z * b0.z, b = d0 < 0 ? { w: -b0.w, x: -b0.x, y: -b0.y, z: -b0.z } : b0, d = Math.abs(d0);
  const [p, q] = d > .9995 ? [1 - u, u] : (() => { const th = Math.acos(Math.min(1, d)), sn = Math.sin(th); return [Math.sin((1 - u) * th) / sn, Math.sin(u * th) / sn]; })();
  const r = { w: p * a.w + q * b.w, x: p * a.x + q * b.x, y: p * a.y + q * b.y, z: p * a.z + q * b.z }, n = Math.hypot(r.w, r.x, r.y, r.z);
  return { w: r.w / n, x: r.x / n, y: r.y / n, z: r.z / n };
}

/**
 * sweetSpotHoldV1: past the contact pose the sweet spot carries straight on along its contact-pose path, at the contact
 * speed, for windowSeconds; the bat keeps the clip's turn, now about the sweet spot, and the hands make up the
 * difference. About half of the out-front slide to the tip is the bat's yaw, which is geometry and does not depend on
 * how fast the bat turns, and a third is the hands drifting toward the batter (2026-11-06, K:/kbm-work/inv-front).
 * MLB meets early balls on the barrel (squared-up by contact depth .48/.37/.40/.46/.49/.38, Statcast June 2024).
 * Offline on the recorded contacts, 6-12 in out front: along-bat point .96 -> .85, squared-up proxy .08 -> .49.
 * After the window the grip offset is taken back out over returnSeconds; times and orientations stay.
 */
export function holdSweetSpotAfterContactV1<F extends Frame>(frames: readonly F[], contactTick: number, radiusM: number,
  windowSeconds: number, returnSeconds: number, sourceTicksPerSecond = 1e6): F[] {
  if (!(Number.isFinite(contactTick) && radiusM > 0 && windowSeconds >= .005 && windowSeconds <= .1 && returnSeconds >= .01 && returnSeconds <= .5
    && frames.length >= 2)) throw Error('invalid sweet spot hold input');
  const first = frames.findIndex(f => f.tick >= contactTick);
  if (first < 1 || first >= frames.length - 1) return frames.slice();
  const axis = (f: Frame) => rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, f.orientation);
  const sweet = (f: Frame) => { const a = axis(f); return { x: f.grip.x + a.x * radiusM, y: f.grip.y + a.y * radiusM, z: f.grip.z + a.z * radiusM }; };
  const s0 = sweet(frames[first]), sb = sweet(frames[first - 1]), dt = (frames[first].tick - frames[first - 1].tick) / sourceTicksPerSecond;
  const v = { x: (s0.x - sb.x) / dt, y: (s0.y - sb.y) / dt, z: (s0.z - sb.z) / dt };
  const out: F[] = frames.slice(0, first + 1);
  let off = { x: 0, y: 0, z: 0 };
  for (let i = first + 1; i < frames.length; i++) {
    const f = frames[i], tau = (f.tick - frames[first].tick) / sourceTicksPerSecond;
    if (tau <= windowSeconds) {
      const a = axis(f), want = { x: s0.x + v.x * tau, y: s0.y + v.y * tau, z: s0.z + v.z * tau }, own = sweet(f);
      off = { x: want.x - own.x, y: want.y - own.y, z: want.z - own.z };
      out.push({ ...f, grip: { x: want.x - a.x * radiusM, y: want.y - a.y * radiusM, z: want.z - a.z * radiusM } });
    } else {
      const back = Math.max(0, 1 - (tau - windowSeconds) / returnSeconds);
      out.push(back === 0 ? f : { ...f, grip: { x: f.grip.x + off.x * back, y: f.grip.y + off.y * back, z: f.grip.z + off.z * back } });
    }
  }
  return out;
}

export type ClipAfterContactShapeV1 = Readonly<{ contactTick: number; radiusM: number; windowSeconds?: number; hands?: readonly number[]; hold?: readonly number[] }>;
/** The physical motor and the whiff playback shape the clip the same way: retime, hold the sweet spot, then move the hands. */
export function shapeClipAfterContactV1<F extends Frame>(frames: readonly F[], shape: ClipAfterContactShapeV1): F[] {
  const timed = shape.windowSeconds === undefined ? frames.slice() : retimeClipAfterContactV1(frames, shape.contactTick, shape.radiusM, shape.windowSeconds);
  const held = shape.hold === undefined ? timed : holdSweetSpotAfterContactV1(timed, shape.contactTick, shape.radiusM, shape.hold[0], shape.hold[1]);
  return shape.hands === undefined ? held
    : extendHandsAfterContactV1(held, shape.contactTick, shape.hands[0], shape.hands[1], shape.hands[2], .1, 1e6, shape.hands[3] ?? 1);
}
