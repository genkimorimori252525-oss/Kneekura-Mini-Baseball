import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch, recordFairBattedBall, recordLiveBallPlayEnd } from '../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../sim/pitching/PitchAgainstBatter';
import { assessOfficialPhysicalPitchWorkload } from './OfficialPhysicalPitchWorkload';

const policy = { policyId: 'fixture-effort', version: 'v1', availableAtDay: 0, effortUnitsPerPhysicalPitch: 2 };
const before = (balls = 0, strikes = 2) => ({ ruleProfileId: asRuleProfileId('fixture-rules'), inning: 1, half: 'top' as const, outs: 0,
  balls, strikes, bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 }, playId: 7 });
const trajectory = { start: { tick: 0, position: { x: 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 0, z: 0 } },
  acceleration: { x: 0, y: 0, z: 0 }, endTick: 700_000, ticksPerSecond: 1_000_000 };
const taken = (ball = false) => resolveAndRecordPitchAgainstBatter(createCanonicalPlateAppearanceTimeline(ball ? before(3, 0) : before(), 0), {
  action: { kind: 'take' }, trajectory: ball ? { ...trajectory, start: { ...trajectory.start, position: { ...trajectory.start.position, x: 2 } } } : trajectory,
  plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
const swung = (miss = false) => resolveAndRecordPitchAgainstBatter(createCanonicalPlateAppearanceTimeline(before(), 0), {
  action: { kind: 'swing', swing: { startTick: 600_000, endTick: 610_000, ticksPerSecond: 1_000_000,
    stateAtStart: { pose: { grip: { x: miss ? 10 : -0.4, y: 1.5, z: 0 }, tip: { x: miss ? 11 : 0.4, y: 1.5, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } }, trajectory }).timeline;

it('uses actual physical action count with identical effort for called strike, ball, missed swing and contact', () => {
  const contact = recordLiveBallPlayEnd(recordFairBattedBall(swung(), 620_000), { kind: 'play_end', tick: 700_000, reason: 'live_action_complete' });
  for (const timeline of [taken(), taken(true), swung(true), contact]) {
    expect(assessOfficialPhysicalPitchWorkload(timeline, policy, 10)).toEqual({ physicalPitchSequences: [0], effortUnits: 2 });
  }
});
it('rejects unbacked count events, missing physical evidence, duplicate events and unresolved activity', () => {
  const manual = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before(), 0), 1, { kind: 'called_strike' });
  expect(() => assessOfficialPhysicalPitchWorkload(manual, policy, 10)).toThrow('physical');
  const timeline = taken();
  expect(() => assessOfficialPhysicalPitchWorkload({ ...timeline, events: timeline.events.slice(1) }, policy, 10)).toThrow();
  expect(() => assessOfficialPhysicalPitchWorkload({ ...timeline, events: [...timeline.events, timeline.events[0]] }, policy, 10)).toThrow();
  expect(() => assessOfficialPhysicalPitchWorkload(createCanonicalPlateAppearanceTimeline(before(), 0), policy, 10)).toThrow();
});
it('freezes explicit calibration, rejects future/invalid policies and arithmetic overflow', () => {
  const timeline = taken();
  for (const bad of [{ ...policy, availableAtDay: 11 }, { ...policy, effortUnitsPerPhysicalPitch: -1 },
    { ...policy, version: '' }, { ...policy, extra: 1 }]) expect(() => assessOfficialPhysicalPitchWorkload(timeline, bad, 10)).toThrow();
  const first = resolveAndRecordPitchAgainstBatter(createCanonicalPlateAppearanceTimeline(before(0, 1), 0), {
    action: { kind: 'take' }, trajectory, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
  const two = resolveAndRecordPitchAgainstBatter(first, { action: { kind: 'take' }, trajectory: { ...trajectory,
    start: { ...trajectory.start, tick: 700_000 }, endTick: 1_400_000 }, plateZ: 0,
    strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
  expect(() => assessOfficialPhysicalPitchWorkload(two, { ...policy, effortUnitsPerPhysicalPitch: Number.MAX_VALUE }, 10)).toThrow('overflow');
  expect(assessOfficialPhysicalPitchWorkload(timeline, { ...policy, effortUnitsPerPhysicalPitch: 0 }, 10).effortUnits).toBe(0);
});
it('rejects incomplete physical crossing and contact payloads instead of counting their ticks', () => {
  const take = taken(), contact = recordLiveBallPlayEnd(recordFairBattedBall(swung(), 620_000),
    { kind: 'play_end', tick: 700_000, reason: 'live_action_complete' });
  for (const timeline of [take, contact]) {
    const malformed = JSON.parse(JSON.stringify(timeline)) as typeof timeline;
    const event = malformed.events[0];
    if (event.kind === 'TakenPitchPlateCrossed') Object.assign(event.payload, { result: { kind: 'called_strike', crossing: { tick: event.tick } } });
    else if (event.kind === 'BatBallContact') Object.assign(event.payload, { contact: { tick: event.tick } });
    expect(() => assessOfficialPhysicalPitchWorkload(malformed, policy, 10)).toThrow('physical');
  }
  const malformed = JSON.parse(JSON.stringify(take)) as typeof take;
  const event = malformed.events[0];
  if (event.kind !== 'TakenPitchPlateCrossed') throw new Error('fixture physical event differs');
  Object.assign(event.payload.result.crossing.position, { x: Number.NaN });
  expect(() => assessOfficialPhysicalPitchWorkload(malformed, policy, 10)).toThrow('finite');
});
