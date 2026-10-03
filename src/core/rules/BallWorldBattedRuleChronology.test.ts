import { expect, it } from 'vitest';
import { deriveBallWorldBattedRuleChronology } from './BallWorldBattedRuleChronology';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { BattedWorldAcquisition } from '../sim/ball/BattedWorldAcquisition';
import { quantizeEventTick } from '../sim/ExactEventTime';

const field = { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } };
const bases = { homePlate: field.homePlate, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } };
const moment = (seconds: number, z = 10): BallWorldMoment => ({ originTick: 0, elapsedSeconds: seconds,
  ball: { tick: quantizeEventTick(0, seconds, 1_000_000), position: { x: 0, y: 0.036, z }, velocity: { x: 1, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const ground = (seconds = 1, z = 10): BallWorldBattedRuleContactFrame => ({ moment: moment(seconds, z), contacts: [{ kind: 'ground' }] });
const touch = (seconds = 2, z = 10): BallWorldBattedRuleContactFrame => ({ moment: moment(seconds, z), contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] });
const query = (contacts: readonly BallWorldBattedRuleContactFrame[]) => ({ batterRunnerId: 'batter', defenderIds: ['defender'], field, bases,
  ballRadiusMeters: 0.036, originTick: 0, ticksPerSecond: 1_000_000, horizon: moment(4), contacts, acquisitions: [] as BattedWorldAcquisition[] });
it('retains the true decisive untouched ground moment without rewriting the legacy result', () => {
  const first = ground(1.0000001, 60), later = touch(1.0000002, 60), input = query([first, later]);
  expect(first.moment.ball.tick).toBe(later.moment.ball.tick);
  const result = deriveBallWorldBattedRuleChronology(input);
  expect(result.ballEvidence).toEqual(deriveBallWorldBattedRuleEvidence(input));
  expect(result.ballDecisionMoment).toEqual(first.moment);
  expect(result.firstGroundMoment).toEqual(first.moment);
});
it('uses the actual later fielder touch when earlier ground is before the gates', () => {
  const input = query([ground(1.0000001), touch(1.0000002)]), result = deriveBallWorldBattedRuleChronology(input);
  expect(result.ballDecisionMoment).toEqual(input.contacts[1].moment);
  expect(result.ballEvidence).toEqual(deriveBallWorldBattedRuleEvidence(input));
});
it('retains both earlier airborne territory and the actual later ground required for a ground-ball race', () => {
  const input = query([touch(0.5), ground()]), result = deriveBallWorldBattedRuleChronology(input);
  expect(result.ballDecisionMoment).toEqual(input.contacts[0].moment);
  expect(result.firstGroundMoment).toEqual(input.contacts[1].moment);
});
it('does not reverse a recorded tick into a fictitious secure catch moment', () => {
  const securedAt = moment(2.0000001), input = query([touch(), ground(2.0000002)]);
  const acquisition = { acquirerPlayerId: 'defender', contactMoment: moment(2), candidateSecureTick: securedAt.ball.tick,
    archivedCandidateSecureTick: securedAt.ball.tick, retention: { outcome: { kind: 'secured', secureTick: securedAt.ball.tick } },
    transport: { kind: 'glove_constraint', contactOffset: { x: 0, y: 0, z: 0 }, initialEnergyJ: 1, remainingEnergyJ: 0 },
    kind: 'secured', secureTick: securedAt.ball.tick, moment: securedAt } as BattedWorldAcquisition;
  input.acquisitions.push(acquisition);
  const result = deriveBallWorldBattedRuleChronology(input);
  expect(result.ballEvidence.kind).toBe('fly_catch');
  expect(result.ballDecisionMoment).toEqual(securedAt);
  expect(result.ballEvidence).toEqual(deriveBallWorldBattedRuleEvidence(input));
});
it('retains the legacy pending legal contacts after a decisive moment', () => {
  const input = query([ground(1, 60), { moment: moment(2), contacts: [{ kind: 'surface', surfaceId: 'wall' }] }]);
  expect(deriveBallWorldBattedRuleChronology(input)).toMatchObject({ ballDecisionMoment: input.contacts[0].moment,
    ballEvidence: { kind: 'grounded', pendingContacts: [{ elapsedSeconds: 2, reason: 'surface_policy_pending' }] } });
});
it.each([{ contacts: [] }, { contacts: [ground()] }])('keeps unresolved eligibility without a fabricated decisive moment: $contacts', ({ contacts }) => {
  const input = query(contacts), result = deriveBallWorldBattedRuleChronology(input);
  expect(result.ballEvidence).toEqual(deriveBallWorldBattedRuleEvidence(input));
  expect(result.ballDecisionMoment).toBe(null);
});
