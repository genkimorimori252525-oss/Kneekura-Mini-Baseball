import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { resolveBatBallContact } from '../contact/BatBallContact';
import { projectActualFairFieldTimeline, type ActualFairFieldTimelineInput } from './ActualFairFieldTimeline';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact, recordBattedBallFirstFielderTouch, recordCountedPitch, recordFoulBattedBall } from './CanonicalPlateAppearanceTimeline';

// Reconstructed pure projection tests. These accepted physical facts do not prove
// Native Source completeness or establish physical PlayEnd ownership.
const contact = (tick: number) => {
  const result = resolveBatBallContact({ tick, position: { x: 0, y: 1, z: 0.06 }, velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
    { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } }, linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } });
  if (!result) throw new Error('physical contact fixture missing'); return result;
};
const moment = (elapsedSeconds: number) => ({ originTick: 1_000_000, elapsedSeconds,
  ball: { tick: 1_000_000 + elapsedSeconds * 1_000_000, position: { x: 1, y: 0.1, z: 1 }, velocity: { x: 1, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } });
const fixture = (): ActualFairFieldTimelineInput => {
  const match = { ruleProfileId: asRuleProfileId('npb-2026'), playId: 7, inning: 1, half: 'top' as const, outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } };
  const originalTimeline = recordBatBallContact(recordCountedPitch(createCanonicalPlateAppearanceTimeline(match, 0), 100_000, { kind: 'ball' }), contact(1_000_000));
  return { originalTimeline, playEnd: { kind: 'play_end', tick: 3_000_000, reason: 'live_action_complete' }, field: { baseContacts: [], evidence: {
    originTick: 1_000_000, ticksPerSecond: 1_000_000, horizon: moment(2), batterRunnerId: 'batter', defenderIds: ['defender'], ballRadiusMeters: 0.1,
    field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } },
    bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 2, z: 0 }, secondBase: { x: 2, z: 2 }, thirdBase: { x: 0, z: 2 } }, acquisitions: [],
    contacts: [{ moment: moment(0.5), contacts: [{ kind: 'ground' }] }, { moment: moment(1), contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] }],
  } } };
};
it('preserves original pitch events and appends exact ground, first touch, fair and independently supplied end clocks', () => {
  const f = fixture(), before = JSON.stringify(f), result = projectActualFairFieldTimeline(f);
  expect(result.kind).toBe('projected'); if (result.kind !== 'projected') throw new Error('projection missing');
  expect(result.timeline.events.slice(0, f.originalTimeline.events.length)).toEqual(f.originalTimeline.events);
  expect(result.timeline.events.slice(f.originalTimeline.events.length).map(e => [e.kind, e.tick])).toEqual([
    ['BattedBallFirstGroundContact', 1_500_000], ['BattedBallFirstFielderTouch', 2_000_000], ['BattedBallDeclaredFair', 2_000_000], ['LiveBallPlayEnded', 3_000_000],
  ]);
  expect(JSON.stringify(f)).toBe(before);
});
it('keeps unsupported airborne-first chronology and absent ground explicit', () => {
  const f = fixture(), touched = f.field.evidence.contacts[1];
  expect(projectActualFairFieldTimeline({ ...f, field: { ...f.field, evidence: { ...f.field.evidence, contacts: [touched] } } }))
    .toEqual({ kind: 'unsupported', reason: 'ground_unavailable' });
  expect(projectActualFairFieldTimeline({ ...f, field: { ...f.field, evidence: { ...f.field.evidence,
    contacts: [touched, { moment: moment(1.5), contacts: [{ kind: 'ground' }] }] } } }))
    .toEqual({ kind: 'unsupported', reason: 'ground_after_fair_projection_unsupported' });
});
it('rejects an unproved end horizon and a mismatched original contact scope', () => {
  const f = fixture();
  expect(() => projectActualFairFieldTimeline({ ...f, playEnd: { ...f.playEnd, tick: 3_000_001 } })).toThrow(/proved physical horizon/);
  expect(() => projectActualFairFieldTimeline({ ...f, originalTimeline: { ...f.originalTimeline, lastEventTick: 999_999 } })).toThrow(/original timeline scope/);
});
it('preserves a prior foul fielder touch and explicitly declines the legacy duplicate-touch projection', () => {
  const f = fixture(), initial = { ...f.originalTimeline, events: [], nextSequence: 0, lastEventTick: 0,
    status: { kind: 'active' as const, count: { balls: 0, strikes: 0 } } };
  const touched = recordBattedBallFirstFielderTouch(recordBatBallContact(initial, contact(100_000)), {
    fielderId: 'defender', tick: 200_000, ballCenter: { x: -1, y: 0.1, z: -1 }, ballRadiusMeters: 0.1,
    classification: { kind: 'outside_fair_wedge', firstBaseLineSignedSide: -1, thirdBaseLineSignedSide: -1 } });
  const foul = recordFoulBattedBall(touched, 300_000, false, { kind: 'not_caught', batterRunnerId: 'batter', firstFielderTouchTick: 200_000,
    firstGroundContactTick: 300_000, secureCatchTick: 400_000 });
  const originalTimeline = recordBatBallContact(foul, contact(1_000_000)), before = JSON.stringify(originalTimeline);
  expect(projectActualFairFieldTimeline({ ...f, originalTimeline })).toEqual({ kind: 'unsupported', reason: 'prior_fielder_touch_projection_unsupported' });
  expect(JSON.stringify(originalTimeline)).toBe(before);
});
