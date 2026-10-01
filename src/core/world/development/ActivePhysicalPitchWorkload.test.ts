import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch, recordFoulBattedBall } from '../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../sim/pitching/PitchAgainstBatter';
import { assessActivePhysicalPitchWorkload, assessOfficialPhysicalPitchWorkload } from '../../world/development/OfficialPhysicalPitchWorkload';

const policy = { policyId: 'fixture-effort', version: 'v1', availableAtDay: 0, effortUnitsPerPhysicalPitch: 2 };
const match = { ruleProfileId: asRuleProfileId('fixture-rules'), inning: 1, half: 'top' as const, outs: 0,
  balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 }, playId: 7 };
const input = (tick: number) => ({ action: { kind: 'take' as const }, trajectory: {
  start: { tick, position: { x: 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
  acceleration: { x: 0, y: 0, z: 0 }, endTick: tick + 700_000, ticksPerSecond: 1_000_000 },
  plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 });
it('derives actual active prefix effort while retaining the completed official API gate', () => {
  let timeline = createCanonicalPlateAppearanceTimeline(match, 0);
  expect(assessActivePhysicalPitchWorkload(timeline, policy, 10)).toEqual({ physicalPitchSequences: [], effortUnits: 0 });
  for (const expected of [2, 4]) {
    timeline = resolveAndRecordPitchAgainstBatter(timeline, input(timeline.lastEventTick + 1)).timeline;
    expect(timeline.status.kind).toBe('active');
    expect(assessActivePhysicalPitchWorkload(timeline, policy, 10).effortUnits).toBe(expected);
    expect(() => assessOfficialPhysicalPitchWorkload(timeline, policy, 10)).toThrow('completed');
  }
  const completed = resolveAndRecordPitchAgainstBatter(timeline, input(timeline.lastEventTick + 1)).timeline;
  expect(assessOfficialPhysicalPitchWorkload(completed, policy, 10).effortUnits).toBe(6);
  expect(() => assessActivePhysicalPitchWorkload(completed, policy, 10)).toThrow('active');
});
it('does not substitute declared count, corrupt physical payload or future calibration for actual effort', () => {
  const start = createCanonicalPlateAppearanceTimeline(match, 0);
  expect(() => assessActivePhysicalPitchWorkload(recordCountedPitch(start, 1, { kind: 'called_strike' }), policy, 10)).toThrow('physical');
  const actual = resolveAndRecordPitchAgainstBatter(start, input(1)).timeline;
  const malformed = JSON.parse(JSON.stringify(actual)) as typeof actual;
  Object.assign(malformed.events[0].payload, { result: { kind: 'called_strike' } });
  expect(() => assessActivePhysicalPitchWorkload(malformed, policy, 10)).toThrow();
  expect(() => assessActivePhysicalPitchWorkload(actual, { ...policy, availableAtDay: 11 }, 10)).toThrow('future');
});
it.each(['status', 'before', 'result', 'terminal'])('rejects a changed active physical count chain: %s', (mutation) => {
  let actual = resolveAndRecordPitchAgainstBatter(createCanonicalPlateAppearanceTimeline(match, 0), input(1)).timeline;
  actual = resolveAndRecordPitchAgainstBatter(actual, input(actual.lastEventTick + 1)).timeline;
  const malformed = JSON.parse(JSON.stringify(actual)) as typeof actual;
  const second = malformed.events[3];
  if (second.kind !== 'PitchAdjudicated') throw new Error('fixture count event differs');
  if (mutation === 'status') Object.assign(malformed.status, { count: { balls: 1, strikes: 2 } });
  else if (mutation === 'before') Object.assign(second.payload, { countBefore: { balls: 0, strikes: 0 } });
  else if (mutation === 'result') Object.assign(second.payload, { result: { kind: 'continue', count: { balls: 0, strikes: 1 }, cause: 'called_strike' } });
  else Object.assign(second.payload, { result: { kind: 'strikeout', terminalCount: { balls: 0, strikes: 3 }, cause: 'called_strike' } });
  expect(() => assessActivePhysicalPitchWorkload(malformed, policy, 10)).toThrow('count');
});
it('validates actual uncaught foul count without adding a third strike at two strikes', () => {
  const start = createCanonicalPlateAppearanceTimeline({ ...match, strikes: 2 }, 0);
  const contact = resolveAndRecordPitchAgainstBatter(start, {
    action: { kind: 'swing', swing: { startTick: 600_000, endTick: 610_000, ticksPerSecond: 1_000_000,
      stateAtStart: { pose: { grip: { x: -0.4, y: 1.5, z: 0 }, tip: { x: 0.4, y: 1.5, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } },
    trajectory: input(0).trajectory,
  }).timeline;
  expect(contact.status.kind).toBe('batted_ball_pending');
  const foul = recordFoulBattedBall(contact, 620_000, false, null);
  expect(foul.status).toEqual({ kind: 'active', count: { balls: 0, strikes: 2 } });
  expect(assessActivePhysicalPitchWorkload(foul, policy, 10).effortUnits).toBe(2);
  const malformed = JSON.parse(JSON.stringify(foul)) as typeof foul;
  const event = malformed.events[1];
  if (event.kind !== 'FoulBattedBallResolved') throw new Error('fixture foul differs');
  Object.assign(event.payload.resolution, { countResult: { kind: 'continue', count: { balls: 0, strikes: 1 }, cause: 'foul' } });
  expect(() => assessActivePhysicalPitchWorkload(malformed, policy, 10)).toThrow('count');
});
