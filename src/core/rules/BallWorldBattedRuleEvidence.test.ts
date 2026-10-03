import { expect, it } from 'vitest';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { BattedWorldAcquisition } from '../sim/ball/BattedWorldAcquisition';
import { quantizeEventTick } from '../sim/ExactEventTime';

const field = { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
  thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } };
const bases = { homePlate: field.homePlate, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } };
const moment = (seconds: number, x = 0, z = 10): BallWorldMoment => ({ originTick: 0, elapsedSeconds: seconds,
  ball: { tick: quantizeEventTick(0, seconds, 1_000_000), position: { x, y: 0.036, z }, velocity: { x: 1, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const ground = (seconds = 1, x = 0, z = 10) => ({ moment: moment(seconds, x, z), contacts: [{ kind: 'ground' as const }] });
const touch = (seconds = 2, x = 0, z = 10) => ({ moment: moment(seconds, x, z),
  contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] });
const query = (contacts: readonly BallWorldBattedRuleContactFrame[] = [ground(), touch()]) => ({ batterRunnerId: 'batter', defenderIds: ['defender'], field, bases,
  ballRadiusMeters: 0.036, originTick: 0, ticksPerSecond: 1_000_000, horizon: moment(4), contacts, acquisitions: [] as BattedWorldAcquisition[] });
const capture = (secured = true): BattedWorldAcquisition => ({ acquirerPlayerId: 'defender', contactMoment: moment(2),
  candidateSecureTick: 3_000_000, archivedCandidateSecureTick: 3_000_000,
  retention: { outcome: { kind: 'secured', secureTick: 3_000_000 } } as BattedWorldAcquisition['retention'],
  transport: { kind: 'glove_constraint', contactOffset: { x: 0, y: 0, z: 0 }, initialEnergyJ: 1, remainingEnergyJ: secured ? 0 : 0.5 },
  ...(secured ? { kind: 'secured' as const, secureTick: 3_000_000, moment: moment(3) }
    : { kind: 'interrupted' as const, reason: 'contact' as const, world: { kind: 'boundary' as const,
      moment: moment(2.5), contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'body' as const,
        moment: moment(2.5), center: { x: 0, y: 0.036, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, normal: null }] } }) });

it('keeps untouched ground before the base gates undecided instead of inventing fair live-ball eligibility', () => {
  expect(deriveBallWorldBattedRuleEvidence(query([ground()]))).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
});
it.each([[0, 'fair'], [61, 'foul']] as const)('uses actual untouched ground beyond the gates at x=%s', (x, territory) => {
  expect(deriveBallWorldBattedRuleEvidence(query([ground(1, x, 60)]))).toMatchObject({ kind: 'grounded', territory, firstGroundContactTick: 1_000_000 });
});
it.each([[0, 70, 'fair'], [61, 0, 'foul']] as const)('preserves the earlier decisive ground territory at x=%s before later touch x=%s', (groundX, touchX, territory) => {
  expect(deriveBallWorldBattedRuleEvidence(query([ground(1, groundX, 60), touch(2, touchX, 60)]))).toMatchObject({
    kind: 'grounded', territory, decisiveTick: 1_000_000 });
});
it.each(['simultaneous_contact', 'surface_policy_pending', 'non_defender_contact'] as const)(
  'keeps decisive ground territory separately from later %s', (reason) => {
    const contacts: BallWorldBattedRuleContactFrame['contacts'] = reason === 'simultaneous_contact'
      ? [...touch().contacts, { kind: 'actor', playerId: 'defender', role: 'body' }]
      : reason === 'surface_policy_pending' ? [{ kind: 'surface', surfaceId: 'wall' }]
        : [{ kind: 'actor', playerId: 'batter', role: 'body' }];
    for (const [x, territory] of [[0, 'fair'], [61, 'foul']] as const) {
      expect(deriveBallWorldBattedRuleEvidence(query([ground(1, x, 60), { moment: moment(2), contacts }]))).toMatchObject({
        kind: 'grounded', territory, decisiveTick: 1_000_000,
        pendingContacts: [{ elapsedSeconds: 2, tick: 2_000_000, reason }],
      });
    }
  });
it('uses true chronological order when decisive ground and a later pending contact share a recorded tick', () => {
  const decisive = ground(1.0000001, 0, 60), later = { moment: moment(1.0000002),
    contacts: [{ kind: 'surface' as const, surfaceId: 'wall' }] };
  expect(decisive.moment.ball.tick).toBe(later.moment.ball.tick);
  expect(deriveBallWorldBattedRuleEvidence(query([decisive, later]))).toMatchObject({
    kind: 'grounded', territory: 'fair', pendingContacts: [{ elapsedSeconds: 1.0000002, reason: 'surface_policy_pending' }],
  });
});
it('keeps an unsupported contact before decisive ground unresolved', () => {
  expect(deriveBallWorldBattedRuleEvidence(query([{ moment: moment(0.5), contacts: [{ kind: 'surface', surfaceId: 'wall' }] },
    ground(1, 0, 60)]))).toMatchObject({ kind: 'unresolved', reason: 'surface_policy_pending' });
});
it.each(['surface_policy_pending', 'simultaneous_contact'] as const)(
  'keeps earlier actual airborne fielder-touch territory after later %s and ground', (reason) => {
    const later: BallWorldBattedRuleContactFrame = { moment: moment(0.75), contacts: reason === 'surface_policy_pending'
      ? [{ kind: 'surface', surfaceId: 'wall' }]
      : [...touch(0.75).contacts, { kind: 'actor', playerId: 'defender', role: 'body' }] };
    expect(deriveBallWorldBattedRuleEvidence(query([touch(0.5), later, ground()]))).toMatchObject({
      kind: 'grounded', territory: 'fair', decisiveTick: 500_000, firstGroundContactTick: 1_000_000,
      pendingContacts: [{ elapsedSeconds: 0.75, tick: 750_000, reason }],
    });
  });
it.each([[0, 'fair'], [30, 'foul']] as const)('uses the first actual fielder touch after ground at x=%s', (x, territory) => {
  expect(deriveBallWorldBattedRuleEvidence(query([ground(), touch(2, x)]))).toMatchObject({ kind: 'grounded', territory,
    firstGroundContactTick: 1_000_000, firstFielderTouch: { fielderId: 'defender', tick: 2_000_000 } });
});
it.each([0, 30])('gives an actual secured airborne catch priority over a first-base race at x=%s', (x) => {
  const input = query([touch(2, x)]), acquired = capture();
  expect(deriveBallWorldBattedRuleEvidence({ ...input, acquisitions: [{ ...acquired, contactMoment: moment(2, x) }] })).toMatchObject({
    kind: 'fly_catch', correctRuleResult: { kind: 'caught', batterRunnerId: 'batter', outTick: 3_000_000 } });
});
it('does not turn an interrupted capture into a secured catch', () => {
  expect(deriveBallWorldBattedRuleEvidence({ ...query([touch()]), acquisitions: [capture(false)] })).toMatchObject({ kind: 'unresolved', reason: 'catch_pending' });
});
it('does not call a pickup after actual ground a fly catch', () => {
  expect(deriveBallWorldBattedRuleEvidence({ ...query(), acquisitions: [capture()] })).toMatchObject({ kind: 'grounded', territory: 'fair' });
});
it('bounds catch interpretation at its actual secure moment even when later ground shares the recorded tick', () => {
  const candidate = capture();
  if (candidate.kind !== 'secured') throw new Error('secured test fixture');
  const secured = { ...candidate, secureTick: 2_000_001, moment: moment(2.0000001), candidateSecureTick: 2_000_001,
    archivedCandidateSecureTick: 2_000_001 };
  const laterGround = ground(2.0000002);
  expect(laterGround.moment.ball.tick).toBe(secured.secureTick);
  expect(deriveBallWorldBattedRuleEvidence({ ...query([touch(), laterGround]), acquisitions: [secured] })).toMatchObject({
    kind: 'fly_catch', correctRuleResult: { kind: 'caught', outTick: 2_000_001 } });
});
it('does not fabricate physical ground from an empty open horizon', () => {
  expect(deriveBallWorldBattedRuleEvidence(query([]))).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
});
it('preserves simultaneous physical contact without selecting a desired eligibility', () => {
  const g = ground();
  expect(deriveBallWorldBattedRuleEvidence(query([{ ...g, contacts: [...g.contacts, ...touch(1).contacts] }]))).toMatchObject({ kind: 'unresolved', reason: 'simultaneous_contact' });
});
it('preserves missing legal surface policy instead of treating a wall as ground or an ordinary catch', () => {
  expect(deriveBallWorldBattedRuleEvidence(query([{ moment: moment(1), contacts: [{ kind: 'surface', surfaceId: 'wall' }] }]))).toMatchObject({ kind: 'unresolved', reason: 'surface_policy_pending' });
});
it.each(['future', 'clock', 'order', 'foreign_capture', 'injected_fair'] as const)('rejects %s outside the actual physical evidence scope', (kind) => {
  const original = query();
  const input = kind === 'future' ? { ...original, horizon: moment(1) }
    : kind === 'clock' ? { ...original, contacts: [{ ...ground(), moment: { ...moment(1), originTick: 1 } }] }
    : kind === 'order' ? { ...original, contacts: [touch(), ground()] }
    : kind === 'foreign_capture' ? { ...original, acquisitions: [{ ...capture(), acquirerPlayerId: 'foreign' }] }
    : { ...original, fair: true };
  expect(() => deriveBallWorldBattedRuleEvidence(input)).toThrow();
});
