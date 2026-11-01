import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildPitcherWorkbenchInputV77 } from './PitcherWorkbenchV77';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const load = (name: string) => JSON.parse(readFileSync('docs/demos/' + name, 'utf8'));
const base = buildPitcherWorkbenchInputV77({ players: load('live-game-roster-catalog-v105.json').players,
  roster: load('live-game-roster-v98.json'), pitcherId: '1-p0', batterId: '0-b0', catcherId: '1-b0',
  measuredClips: load('measured-bat-motions.json').clips, seed: 1234, pitchType: 'fastball', location: 'auto' });
const situation = (balls: number, strikes: number) => ({ balls, strikes, outs: 0, occupiedBases: { first: false, second: false, third: false } });
const trial = (balls: number, strikes: number, location = 'auto'): LivePitchInputV1 => ({ ...base, location,
  pitcher: { ...base.pitcher, commandStdMeters: .18 }, pitchSituationV111: situation(balls, strikes) } as LivePitchInputV1);
const requested = (r: ReturnType<typeof simulateLivePitchV1>) => r.diagnostics.courseRecognitionV87.pitcher.requestedPosition;
const serial = (r: ReturnType<typeof simulateLivePitchV1>) => JSON.parse(JSON.stringify(r));

it('changes the actual automatic request with the current count instead of repeating the same fixed lottery', () => {
  const ahead = simulateLivePitchV1(trial(0, 2)), behind = simulateLivePitchV1(trial(3, 0));
  expect(requested(ahead)).not.toEqual(requested(behind));
  const zone = behind.diagnostics.strikeZone, middle = (zone.lowerY + zone.upperY) / 2;
  const distance = (p: { x: number; y: number }) => Math.hypot(p.x / zone.halfWidth, (p.y - middle) / ((zone.upperY - zone.lowerY) / 2));
  expect(distance(requested(behind))).toBeLessThan(distance(requested(ahead)));
});

it('preserves every manual-location physical result and random stream when only count context changes', () => {
  for (const location of ['zone', 'low', 'high', 'inside', 'outside']) {
    const without = { ...base, location };
    expect(serial(simulateLivePitchV1(trial(0, 2, location)))).toEqual(serial(simulateLivePitchV1(trial(3, 0, location))));
    const sameCommand = { ...trial(3, 0, location), pitcher: base.pitcher };
    expect(serial(simulateLivePitchV1(sameCommand))).toEqual(serial(simulateLivePitchV1(without)));
  }
});

it('supplies real before-pitch counts from the ordinary Host to automatic pitch planning', () => {
  const host = createLiveBaseballMatchV1(liveMatchFixture(9876));
  for (let i = 0; i < 4; i++) {
    const r = host.issuePitch({ managedTeam: 0, batting: 'take', pitchType: 'auto', location: 'auto' });
    const plan = (r.play.diagnostics as { pitchTargetPlanV111?: { situation: ReturnType<typeof situation> } }).pitchTargetPlanV111;
    expect(plan).toBeDefined(); expect(plan!.situation.balls).toBe(r.beforeMatch.balls); expect(plan!.situation.strikes).toBe(r.beforeMatch.strikes);
    expect(plan!.situation.outs).toBe(r.beforeMatch.outs);
  }
});
