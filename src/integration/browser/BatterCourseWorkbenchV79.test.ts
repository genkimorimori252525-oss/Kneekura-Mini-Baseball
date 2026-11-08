import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compareBatterCourseDirectionsV79, type BatterCourseWorkbenchInputV79 } from './BatterCourseWorkbenchV79';
import { buildPitcherWorkbenchInputV77 } from './PitcherWorkbenchV77';
import { createNeutralBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1 } from './LivePitchV1';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (bats: 'R' | 'L' = 'R'): BatterCourseWorkbenchInputV79 => ({
  players: [{ playerId: 'batter', name: 'Batter', bats, heightMeters: 1.8 },
    { playerId: 'pitcher', name: 'Pitcher', bats: 'R', heightMeters: 1.8 }, { playerId: 'catcher', name: 'Catcher', bats: 'R', heightMeters: 1.8 }],
  roster: { version: 'live_physical_roster_v1', sourceId: 'paired-trial', entries: [
    { playerId: 'batter', sourceId: 'course-intention', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', timingStdSeconds: 0, aimStdMeters: 0,
      batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(), directionWeights: [.2, .2, .2, .2, .2] } } },
    { playerId: 'pitcher', sourceId: 'fixed-pitch', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', commandStdMeters: 0 } }] },
  pitcherId: 'pitcher', batterId: 'batter', catcherId: 'catcher', measuredClips: clips, seed: 3, pitchType: 'fastball', location: 'zone', attempts: 2,
});

it.each(['R', 'L'] as const)('counts actual %s-handed trial contact directions, preserving every paired pitch Source and input', bats => {
  const input = source(bats), before = JSON.stringify(input), result = compareBatterCourseDirectionsV79(input),
    { attempts: _attempts, ...build } = input, pitch = { ...buildPitcherWorkbenchInputV77(build), batting: 'balanced' as const },
    counts = [0, 0, 0, 0, 0]; let fouls = 0, misses = 0, firstSource: unknown = null;
  for (let i = 0; i < input.attempts!; i++) {
    const actual = simulateLivePitchV1({ ...pitch, directionTrialSeedV79: (input.seed + i) >>> 0 });
    if (firstSource === null) firstSource = actual.diagnostics.sourceDescriptor;
    else expect(actual.diagnostics.sourceDescriptor).toEqual(firstSource);
    if (actual.contact === null) { misses++; continue; }
    const velocity = actual.contact.exitVelocity, angle = Math.atan2(velocity.x, velocity.z) * 180 / Math.PI;
    if (angle < -45 || angle > 45) fouls++;
    else counts[Math.min(4, Math.floor((angle + 45) / 18))]++;
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  expect(result).toEqual({ version: 79, attempts: 2, pitchSourceUnchanged: true, counts,
    ratios: counts.map(count => total ? count / total : 0), total, fouls, misses,
    authority: 'SHARED_LIVE_PITCH_SWING_TRIAL', nativeAdmission: false });
  expect(total + fouls + misses).toBe(2); expect(JSON.stringify(input)).toBe(before);
  expect(result).not.toHaveProperty('hits'); expect(result).not.toHaveProperty('average'); expect(result).not.toHaveProperty('homeRuns');
  expect(Object.isFrozen(result.counts)).toBe(true);
});

it('requires explicit direction weights and bounded trial counts before simulating', () => {
  const input = source();
  for (const attempts of [0, -1, .5, 41, NaN]) expect(() => compareBatterCourseDirectionsV79({ ...input, attempts })).toThrow();
  const oldPlayers = input.players.map(p => ({ ...p, physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 })), { roster: _roster, ...legacy } = input;
  expect(() => compareBatterCourseDirectionsV79({ ...legacy, players: oldPlayers })).toThrow(/five-direction/);
  expect(() => compareBatterCourseDirectionsV79({ ...input, roster: { ...input.roster!, entries: [{
    playerId: 'batter', sourceId: 'neutral', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', batterCourseProfileV79: createNeutralBatterCourseProfileV79() } }] } })).toThrow(/five-direction/);
});
