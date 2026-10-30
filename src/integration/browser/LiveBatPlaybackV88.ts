import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { sampleBatRadius, type BatRadiusProfile } from '../../core/sim/contact/RigidBatBallContact';
import type { LiveMeasuredClipV1, LivePitchFrameV1 } from './LivePitchV1';
import { registerMeasuredBatToFieldV1 } from './MeasuredBatFieldRegistrationV1';

/** Serializable observation recipe for the already registered physical motor.
 * Measured keys stay in their original library; this does not extend a play,
 * create ball observations or assign an official time/result. */
export type LiveBatPlaybackDescriptorV88 = Readonly<{
  version: 88; originTick: number; battingSide: 'R' | 'L'; heightScale: number;
  sourceFirstTick: number; sourceLastTick: number; radiusProfile: BatRadiusProfile;
  reference: Omit<ReferenceBatKinematicsInputV1, 'frames'>;
}>;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === [...names].sort().join('|');
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function createLiveBatPlaybackV88(raw: Readonly<{ descriptor: LiveBatPlaybackDescriptorV88; measuredClip: LiveMeasuredClipV1 }>) {
  const { descriptor: d, measuredClip: clip } = cloneInert(raw);
  if (!d || typeof d !== 'object' || Array.isArray(d)
    || !fields(d, ['version', 'originTick', 'battingSide', 'heightScale', 'sourceFirstTick', 'sourceLastTick', 'radiusProfile', 'reference'])
    || d.version !== 88 || !tick(d.originTick) || !['R', 'L'].includes(d.battingSide)
    || !Number.isFinite(d.heightScale) || d.heightScale <= 0 || d.heightScale > 10
    || !tick(d.sourceFirstTick) || !tick(d.sourceLastTick) || d.sourceFirstTick >= d.sourceLastTick
    || !d.reference || typeof d.reference !== 'object' || Object.hasOwn(d.reference, 'frames')
    || d.reference.startTick < d.originTick || !clip || clip.side !== d.battingSide
    || clip.id !== d.reference.provenance?.clipId || clip.source?.sha256 !== d.reference.provenance?.sourceSha256
    || !Array.isArray(clip.frames) || clip.frames.some((frame, index) => !tick(frame.tick) || index > 0 && frame.tick <= clip.frames[index - 1].tick))
    throw new Error('invalid live bat playback descriptor or measured provenance');
  const selected = registerMeasuredBatToFieldV1(clip.frames).filter(frame => frame.tick >= d.sourceFirstTick && frame.tick <= d.sourceLastTick);
  if (selected[0]?.tick !== d.sourceFirstTick || selected.at(-1)?.tick !== d.sourceLastTick)
    throw new Error('live bat playback requires the original selected source keys');
  const frames = selected.map(frame => ({ ...frame, grip: {
    x: frame.grip.x * d.heightScale, y: frame.grip.y * d.heightScale, z: frame.grip.z * d.heightScale,
  } }));
  const reference = createReferenceBatKinematicsV1({ ...d.reference, frames });
  sampleBatRadius(d.radiusProfile, 0);
  const throughTick = d.reference.startTick + (d.sourceLastTick - d.sourceFirstTick) / d.reference.sourceTicksPerSecond
    / d.reference.playbackRate * d.reference.ticksPerSecond;
  if (!Number.isFinite(throughTick) || throughTick > Number.MAX_SAFE_INTEGER) throw new Error('invalid live bat playback boundary');
  const sampleAtTick = (atTick: number): LivePitchFrameV1['bat'] => {
    if (!Number.isFinite(atTick) || atTick < d.originTick) throw new Error('bat observation precedes release or has an invalid clock');
    if (atTick > throughTick) return null;
    // Preserve the physical sampler's elapsed-seconds/world-tick arithmetic.
    const seconds = (atTick - d.originTick) / d.reference.ticksPerSecond;
    return { ...reference.sampleContinuous(d.originTick + seconds * d.reference.ticksPerSecond).state.pose,
      radiusProfile: cloneInert(d.radiusProfile) };
  };
  return Object.freeze({ throughTick, sampleAtTick });
}
