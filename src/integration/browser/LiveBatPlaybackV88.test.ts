import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { DEFAULT_IMPACT_TRAJECTORY_V1, DEFAULT_WHOLE_ARC_TRAJECTORY_V1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { createLiveBatPlaybackV88 } from './LiveBatPlaybackV88';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const input = (side: 'R' | 'L' = 'R'): LivePitchInputV1 => ({
  originTick: 1234567, seed: 1, batter: { heightMeters: 1.8, bats: side, batLengthM: .84, batMassKg: .88, swingRate: 1,
    timingStdSeconds: 0, aimStdMeters: 0, chaseMarginMeters: .2, clipId: clips.find(c => c.side === side)!.id },
  pitcher: { releaseSpeedMps: 42, spinRadPerSecond: { x: 230, y: 0, z: 0 }, commandStdMeters: 0 },
  measuredClips: clips, batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1,
});
const fixture = () => {
  const pitch = simulateLivePitchV1(input()), descriptor = pitch.diagnostics.batPlaybackV88!,
    measuredClip = clips.find(c => c.id === pitch.clipId)!;
  return { pitch, descriptor, measuredClip };
};

for (const side of ['R', 'L'] as const) for (const mode of ['base', 'height-window', 'local', 'whole-arc'] as const) {
  it(`reconstructs the original ${side} ${mode} motor after a JSON round trip`, () => {
    const source = input(side), batter = mode === 'height-window' ? { ...source.batter, heightMeters: 2.05, preContactSeconds: .12, followThroughSeconds: .03 }
      : mode === 'local' ? { ...source.batter, heightMeters: 1.62, impactTrajectory: { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 as const } }
      : mode === 'whole-arc' ? { ...source.batter, heightMeters: 1.97, impactTrajectory: { ...DEFAULT_WHOLE_ARC_TRAJECTORY_V1, level: 4 as const } }
      : source.batter;
    const pitch = simulateLivePitchV1({ ...source, batter }), before = JSON.stringify(pitch.diagnostics),
      descriptor = pitch.diagnostics.batPlaybackV88!, measuredClip = clips.find(c => c.id === pitch.clipId)!,
      playback = createLiveBatPlaybackV88(JSON.parse(JSON.stringify({ descriptor, measuredClip })));
    expect(descriptor.reference).not.toHaveProperty('frames');
    expect(playback.throughTick).toBe(pitch.diagnostics.referenceThroughTick);
    const ticks = [source.originTick, descriptor.reference.startTick, pitch.diagnostics.referenceContactTick,
      Math.min(pitch.endedAtTick, playback.throughTick), playback.throughTick - .1, playback.throughTick];
    for (const tick of ticks) expect(playback.sampleAtTick(tick)).toEqual(pitch.sampleBatAtTick(tick));
    expect(playback.sampleAtTick(playback.throughTick + 1)).toBeNull();
    expect(JSON.stringify(pitch.diagnostics)).toBe(before);
  });
}

it('omits a measured swing replay for take and bunt', () => {
  for (const batting of ['take', 'bunt'] as const) expect(simulateLivePitchV1({ ...input(), batting }).diagnostics).not.toHaveProperty('batPlaybackV88');
});

it('preserves the physical sampler arithmetic at fractional ticks from a zero origin', () => {
  const pitch = simulateLivePitchV1({ ...input(), originTick: 0 }), descriptor = pitch.diagnostics.batPlaybackV88!,
    measuredClip = clips.find(c => c.id === pitch.clipId)!, playback = createLiveBatPlaybackV88({ descriptor, measuredClip });
  for (let index = 0; index <= 53; index++) {
    const tick = playback.throughTick * index / 53;
    expect(playback.sampleAtTick(tick)).toEqual(pitch.sampleBatAtTick(tick));
  }
});

it('owns inert copies of the descriptor, clip and returned radius profile', () => {
  const { descriptor, measuredClip } = fixture(), raw = JSON.parse(JSON.stringify({ descriptor, measuredClip })),
    playback = createLiveBatPlaybackV88(raw), tick = playback.throughTick, expected = playback.sampleAtTick(tick);
  raw.descriptor.reference.transform.translation.x += 9;
  raw.descriptor.radiusProfile.knots[0].radiusM = 9;
  raw.measuredClip.frames.at(-1).grip.x += 9;
  expect(playback.sampleAtTick(tick)).toEqual(expected);
  const result = playback.sampleAtTick(tick)!;
  (result.radiusProfile.knots[0] as { radiusM: number }).radiusM = 7;
  expect(playback.sampleAtTick(tick)).toEqual(expected);
});

it('rejects mismatched provenance, side, missing keys and corrupt finite-reference data', () => {
  const { descriptor, measuredClip } = fixture();
  const corruptions = [
    (v: any) => { v.measuredClip.id += '-other'; },
    (v: any) => { v.measuredClip.side = v.measuredClip.side === 'R' ? 'L' : 'R'; },
    (v: any) => { v.measuredClip.source.sha256 = '0'.repeat(64); },
    (v: any) => { v.descriptor.sourceFirstTick++; },
    (v: any) => { v.descriptor.sourceLastTick--; },
    (v: any) => { v.descriptor.heightScale = 0; },
    (v: any) => { v.descriptor.reference.playbackRate = 0; },
    (v: any) => { v.descriptor.originTick = v.descriptor.reference.startTick + 1; },
    (v: any) => { v.descriptor.radiusProfile.knots[0].radiusM = -1; },
    (v: any) => { v.descriptor.reference.frames = []; },
    (v: any) => { v.measuredClip.frames[1].tick = v.measuredClip.frames[0].tick; },
  ];
  for (const corrupt of corruptions) {
    const raw = JSON.parse(JSON.stringify({ descriptor, measuredClip })); corrupt(raw);
    expect(() => createLiveBatPlaybackV88(raw)).toThrow();
  }
});

it('rejects prototypes and accessors without invoking them, and rejects invalid observation clocks', () => {
  const { descriptor, measuredClip } = fixture(); let invoked = false;
  const accessor = Object.defineProperty({ ...descriptor }, 'heightScale', { enumerable: true, get() { invoked = true; return 1; } });
  expect(() => createLiveBatPlaybackV88({ descriptor: accessor, measuredClip })).toThrow(/accessors/);
  expect(invoked).toBe(false);
  expect(() => createLiveBatPlaybackV88({ descriptor: Object.assign(Object.create({ inherited: true }), descriptor), measuredClip })).toThrow(/plain inert/);
  const playback = createLiveBatPlaybackV88({ descriptor, measuredClip });
  for (const tick of [NaN, Infinity, -1, descriptor.originTick - 1]) expect(() => playback.sampleAtTick(tick)).toThrow();
});
