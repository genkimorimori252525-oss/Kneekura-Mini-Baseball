import { expect, it } from 'vitest';
import { deriveBallWorldFieldFirstBaseRace } from './BallWorldFieldFirstBaseRace';
import type { BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import type { BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';
import type { BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { BallWorldBaseBoundaryContact } from '../sim/ball/BallWorldBaseBoundary';
import type { BattedWorldAcquisition } from '../sim/ball/BattedWorldAcquisition';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import { quantizeEventTick } from '../sim/ExactEventTime';

const moment = (elapsedSeconds: number, x = 0, z = 10): BallWorldMoment => ({ originTick: 0, elapsedSeconds,
  ball: { tick: quantizeEventTick(0, elapsedSeconds, 1_000_000), position: { x, y: 0.036, z },
    velocity: { x: 1, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const ground = (at = 1, x = 0, z = 10): BallWorldBattedRuleContactFrame => ({ moment: moment(at, x, z), contacts: [{ kind: 'ground' }] });
const touch = (at = 1.5, x = 0, z = 10): BallWorldBattedRuleContactFrame => ({ moment: moment(at, x, z),
  contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] });
const bag = (at = 0.5, baseId: BallWorldBaseBoundaryContact['baseId'] = 'first'): BallWorldBaseBoundaryContact => ({ kind: 'base', baseId,
  moment: moment(at, 27, 27), point: { x: 27, y: 0, z: 27 }, normal: { x: 0, y: 1, z: 0 } });
const bagFrame = (base: BallWorldBaseBoundaryContact): BallWorldBattedRuleContactFrame => ({ moment: base.moment,
  contacts: [{ kind: 'surface', surfaceId: battedWorldBaseSurfaceId(base.baseId) }] });
const field = (contacts: readonly BallWorldBattedRuleContactFrame[] = [ground(1, 0, 60)],
  baseContacts: readonly BallWorldBaseBoundaryContact[] = [], acquisitions: readonly BattedWorldAcquisition[] = []): BallWorldFieldTerritoryInput => ({
  evidence: { batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: 1_000_000,
    field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } },
    bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } },
    ballRadiusMeters: 0.036, horizon: moment(4), contacts, acquisitions }, baseContacts });
const history = (playerId: string, at: number | null): BallWorldFirstBaseRaceInput['runnerHistory'] => ({ playerId,
  originTick: 0, ticksPerSecond: 1_000_000, startElapsedSeconds: 0, endElapsedSeconds: 4, contactAtStart: at === 0, contactAtHorizon: at === 4,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: at }], events: at === null ? [] : [
    { kind: 'touch', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) },
    ...(at < 4 ? [{ kind: 'departure' as const, originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) }] : [])] });
const race = (runnerAt: number | null = null, controlAt: number | null = 2): BallWorldFirstBaseRaceInput => ({ outsAtStart: 0,
  batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: 1_000_000, horizonElapsedSeconds: 4,
  runnerHistory: history('batter', runnerAt), defenders: [{ history: history('defender', controlAt), controlledContacts: controlAt === null ? [] : [
    { playerId: 'defender', originTick: 0, elapsedSeconds: controlAt, tick: quantizeEventTick(0, controlAt, 1_000_000) }] }] });
const capture = (contactMoment: BallWorldMoment, securedAt: number): Extract<BattedWorldAcquisition, { kind: 'secured' }> => ({
  kind: 'secured', acquirerPlayerId: 'defender', contactMoment, candidateSecureTick: quantizeEventTick(0, securedAt, 1_000_000),
  archivedCandidateSecureTick: quantizeEventTick(0, securedAt, 1_000_000), secureTick: quantizeEventTick(0, securedAt, 1_000_000),
  moment: { ...contactMoment, elapsedSeconds: securedAt, ball: { ...contactMoment.ball, tick: quantizeEventTick(0, securedAt, 1_000_000) } },
  retention: { outcome: { kind: 'secured', secureTick: quantizeEventTick(0, securedAt, 1_000_000) } } as BattedWorldAcquisition['retention'],
  transport: { kind: 'glove_constraint', contactOffset: { x: 0, y: 0, z: 0 }, initialEnergyJ: 1, remainingEnergyJ: 0 } });

it.each(['first', 'third'] as const)('uses adopted %s bag territory and actual later ground for a first-base OUT', (baseId) => {
  const base = bag(0.5, baseId), result = deriveBallWorldFieldFirstBaseRace({ field: field([bagFrame(base), ground()], [base]), race: race() });
  expect(result.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_contact', baseId });
  expect(result.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair', decisiveTick: 500_000, firstGroundContactTick: 1_000_000 });
  expect(result.ballDecisionMoment?.elapsedSeconds).toBe(0.5);
  expect(result.firstGroundMoment?.elapsedSeconds).toBe(1);
  expect(result.pendingContacts).toEqual([]);
  expect(result.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out', runnerTouchTick: null } });
});
it('does not convert a bag into ground or remove it to manufacture an airborne catch', () => {
  const base = bag(), fielder = touch(), acquired = capture(fielder.moment, 1.75);
  for (const contacts of [[bagFrame(base)], [bagFrame(base), fielder]]) {
    const result = deriveBallWorldFieldFirstBaseRace({ field: field(contacts, [base], contacts.length > 1 ? [acquired] : []), race: race() });
    expect(result.fieldTerritory).toMatchObject({ territory: 'fair', basis: 'base_contact' });
    expect(result.firstGroundMoment).toBe(null);
    expect(result.ballEvidence.kind).toBe('unresolved');
    expect(result.groundRule).toBe(null);
  }
});
it('preserves first-bag fair territory when the actual later ground is on the foul side', () => {
  const base = bag(), result = deriveBallWorldFieldFirstBaseRace({ field: field([bagFrame(base), ground(1, 70, 60)], [base]), race: race() });
  expect(result.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair', decisiveTick: 500_000 });
  expect(result.groundRule?.correctRuleResult.kind).toBe('resolved');
});
it('keeps an airborne foul-side touch pending until actual catch or ground, without count or bunt guesses', () => {
  const foul = touch(0.5, 70, 10), base = bag(1);
  const pending = deriveBallWorldFieldFirstBaseRace({ field: field([foul]), race: race() });
  expect(pending.fieldTerritory).toMatchObject({ territory: 'foul', basis: 'fielder_touch' });
  expect(pending.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'catch_pending' });
  const caught = deriveBallWorldFieldFirstBaseRace({ field: field([foul], [], [capture(foul.moment, 0.75)]), race: race() });
  expect(caught.ballEvidence).toMatchObject({ kind: 'fly_catch', correctRuleResult: { kind: 'caught', outTick: 750_000 } });
  expect(caught.ballDecisionMoment?.elapsedSeconds).toBe(0.75);
  expect(caught.groundRule).toBe(null);
  const grounded = deriveBallWorldFieldFirstBaseRace({ field: field([foul, bagFrame(base), ground(1.5)], [base]), race: race() });
  expect(grounded.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'foul', firstGroundContactTick: 1_500_000 });
  expect(grounded.groundRule).toBe(null);
  for (const result of [pending, caught, grounded]) {
    expect(result).not.toHaveProperty('countAfter');
    expect(result).not.toHaveProperty('playEnd');
    expect(result).not.toHaveProperty('officialClosure');
  }
});
it('keeps an earlier secured airborne catch ahead of later ground, bag, and unknown surface contacts', () => {
  const fielder = touch(0.5), base = bag(1), result = deriveBallWorldFieldFirstBaseRace({ field: field([fielder, bagFrame(base), ground(1.5),
    { moment: moment(2), contacts: [{ kind: 'surface', surfaceId: 'wall' }] }], [base], [capture(fielder.moment, 0.75)]), race: race() });
  expect(result.ballEvidence.kind).toBe('fly_catch');
  expect(result.ballDecisionMoment?.elapsedSeconds).toBe(0.75);
  expect(result.firstGroundMoment?.elapsedSeconds).toBe(1.5);
  expect(result.groundRule).toBe(null);
});
it.each([[1.0000001, 1.0000002, 'fly_catch'], [1.0000002, 1.0000001, 'grounded']] as const)(
  'orders capture at %s and actual ground at %s within one recorded tick', (secureAt, groundAt, kind) => {
    const fielder = touch(0.5), result = deriveBallWorldFieldFirstBaseRace({
      field: field([fielder, ground(groundAt)], [], [capture(fielder.moment, secureAt)]), race: race() });
    expect(result.ballEvidence.kind).toBe(kind);
    expect(result.groundRule !== null).toBe(kind === 'grounded');
  });
it('keeps exactly coincident acquisition and a new physical contact pending', () => {
  const fielder = touch(0.5), result = deriveBallWorldFieldFirstBaseRace({
    field: field([fielder, ground(1)], [], [capture(fielder.moment, 1)]), race: race() });
  expect(result.pendingContacts).toEqual([{ elapsedSeconds: 1, tick: 1_000_000, reason: 'simultaneous_contact' }]);
  expect(result.ballEvidence.kind).not.toBe('fly_catch');
  expect(result.groundRule).toBe(null);
});
it('allows zero-duration capture at its own sole-glove contact', () => {
  const fielder = touch(0.5), result = deriveBallWorldFieldFirstBaseRace({
    field: field([fielder], [], [capture(fielder.moment, 0.5)]), race: race() });
  expect(result.ballEvidence.kind).toBe('fly_catch');
  expect(result.pendingContacts).toEqual([]);
});
it('retains interrupted acquisition then later re-acquisition chronology instead of treating first touch as control', () => {
  const first = touch(0.5), second = touch(1.5), acquired = capture(second.moment, 1.75);
  const { kind: _kind, secureTick: _secureTick, moment: _moment, ...candidate } = capture(first.moment, 0.75);
  const interrupted: BattedWorldAcquisition = { ...candidate, kind: 'interrupted', reason: 'contact', world: {
    kind: 'boundary', moment: moment(0.6), contacts: [{ kind: 'actor', playerId: 'defender', role: 'body',
      moment: moment(0.6), center: moment(0.6).ball.position, velocity: { x: 0, y: 0, z: 0 }, normal: null }] } };
  const body: BallWorldBattedRuleContactFrame = { moment: moment(0.6), contacts: [{ kind: 'actor', playerId: 'defender', role: 'body' }] };
  const result = deriveBallWorldFieldFirstBaseRace({ field: field([first, body, second], [], [interrupted, acquired]), race: race() });
  expect(result.ballEvidence).toMatchObject({ kind: 'fly_catch', firstFielderTouch: { tick: 500_000 }, correctRuleResult: { outTick: 1_750_000 } });
  expect(result.ballDecisionMoment?.elapsedSeconds).toBe(1.75);
  expect(result.groundRule).toBe(null);
});

const blocker = (kind: string, at: number): { frame: BallWorldBattedRuleContactFrame; baseContacts: BallWorldBaseBoundaryContact[]; reason: string } => {
  if (kind === 'continuing' || kind === 'degenerate' || kind === 'second') {
    const base = { ...bag(at, kind === 'second' ? 'second' : 'first'), ...(kind === 'continuing' ? { continuing: true as const } : {}),
      ...(kind === 'degenerate' ? { normal: null } : {}) };
    return { frame: bagFrame(base), baseContacts: [base], reason: kind === 'second' ? 'base_policy_pending' : 'physical_contact_pending' };
  }
  return { frame: { moment: moment(at), contacts: kind === 'wall' ? [{ kind: 'surface', surfaceId: 'wall' }]
    : kind === 'non_defender' ? [{ kind: 'actor', playerId: 'batter', role: 'body' }]
      : [{ kind: 'actor', playerId: 'defender', role: 'body' }, { kind: 'actor', playerId: 'defender', role: 'glove' }] },
  baseContacts: [], reason: kind === 'wall' ? 'surface_policy_pending' : kind === 'non_defender' ? 'non_defender_contact' : 'simultaneous_contact' };
};
it.each(['wall', 'non_defender', 'simultaneous', 'continuing', 'degenerate', 'second'])(
  'keeps %s pending through the race decision but not after an earlier completed race', (kind) => {
    for (const [at, resolves] of [[1.5, false], [2, false], [2.0000002, true]] as const) {
      const pending = blocker(kind, at), result = deriveBallWorldFieldFirstBaseRace({
        field: field([ground(1, 0, 60), pending.frame], pending.baseContacts), race: race(null, at > 2 ? 2.0000001 : 2) });
      expect(result.pendingContacts).toEqual([{ elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000), reason: pending.reason }]);
      expect(result.groundRule !== null).toBe(resolves);
      expect(result.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
    }
  });
it('requires actual ground after an earlier fair bag and earlier runner contact before allowing the race', () => {
  const base = bag(0.5), pending = blocker('wall', 0.8), result = deriveBallWorldFieldFirstBaseRace({
    field: field([bagFrame(base), pending.frame, ground(1)], [base]), race: race(0.75) });
  expect(result.ballDecisionMoment?.elapsedSeconds).toBe(0.5);
  expect(result.firstGroundMoment?.elapsedSeconds).toBe(1);
  expect(result.groundRule).toBe(null);
});
it('bounds blockers through a later territory decision as well as actual ground and race', () => {
  const pending = blocker('wall', 1), result = deriveBallWorldFieldFirstBaseRace({
    field: field([ground(0.5), pending.frame, touch(1.5)]), race: race(0.75, null) });
  expect(result.fieldTerritory).toMatchObject({ kind: 'unresolved', reason: 'surface_policy_pending' });
  expect(result.groundRule).toBe(null);
});
it.each([[2.0000001, 2.0000002, 'safe'], [2.0000002, 2.0000001, 'out'], [2, 2, 'simultaneous']] as const)(
  'preserves actual same-tick first-base ordering %s/%s as %s', (runnerAt, controlAt, kind) => {
    const result = deriveBallWorldFieldFirstBaseRace({ field: field(), race: race(runnerAt, controlAt) });
    expect(result.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe(kind);
    expect(result.groundRule?.correctRuleResult.kind).toBe(kind === 'simultaneous' ? 'unresolved' : 'resolved');
  });
it('does not turn the horizon or missing race events into an invented result', () => {
  const result = deriveBallWorldFieldFirstBaseRace({ field: field(), race: race(null, null) });
  expect(result.groundRule?.correctRuleResult).toMatchObject({ kind: 'unresolved', batterRunnerFirstBase: { reason: 'no_first_base_event' } });
  expect(result.groundRule?.actualChronology.decisionMoment).toBe(null);
});
it('carries post-ground gate and settling territory into the same actual race kernel', () => {
  const firstGround = ground(0), initial = { ...firstGround.moment, ball: { ...firstGround.moment.ball, velocity: { x: 0, y: 0, z: 100 } } };
  const gate = deriveBallWorldFieldFirstBaseRace({ field: { ...field([{ ...firstGround, moment: initial }]),
    groundSegments: [{ moment: initial, throughElapsedSeconds: 1, rollingDecelerationMps2: 0 }] }, race: race() });
  expect(gate.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_gate' });
  expect(gate.groundRule?.correctRuleResult.kind).toBe('resolved');
  const stopped = { ...moment(1), ball: { ...moment(1).ball, velocity: { x: 0, y: 0, z: 0 } } };
  const settled = deriveBallWorldFieldFirstBaseRace({ field: field([firstGround, { moment: stopped, contacts: [{ kind: 'rolling_stop' }] }]), race: race() });
  expect(settled.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'settling' });
  expect(settled.groundRule?.correctRuleResult.kind).toBe('resolved');
});
it('retains the third-out consequence without adding official closure and returns detached frozen evidence', () => {
  const query = { field: field(), race: { ...race(), outsAtStart: 2 } }, before = JSON.stringify(query);
  const result = deriveBallWorldFieldFirstBaseRace(query);
  expect(result.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', outsAfter: 3, thirdOut: true });
  expect(result).not.toHaveProperty('officialClosure');
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.firstGroundMoment?.ball)).toBe(true);
  expect(Object.isFrozen(query.field.evidence.contacts)).toBe(false);
  expect(JSON.stringify(query)).toBe(before);
});
it.each(['origin', 'frequency', 'horizon', 'batter', 'defenders', 'injected'])(
  'rejects differing original %s scope', (kind) => {
    const original = race(), changed = kind === 'origin' ? { ...original, originTick: 1 }
      : kind === 'frequency' ? { ...original, ticksPerSecond: 2_000_000 } : kind === 'horizon' ? { ...original, horizonElapsedSeconds: 5 }
        : kind === 'batter' ? { ...original, batterRunnerId: 'other' } : kind === 'defenders' ? { ...original, defenderIds: ['other'] } : original;
    const input = { field: field(), race: changed, ...(kind === 'injected' ? { groundRule: 'safe' } : {}) };
    expect(() => deriveBallWorldFieldFirstBaseRace(input)).toThrow();
  });
it.each(['missing', 'wrong_base', 'wrong_state', 'duplicate', 'extra_metadata'])(
  'rejects %s base provenance before specializing a surface', (kind) => {
    const base = bag(), baseContacts = kind === 'missing' ? [] : kind === 'duplicate' ? [base, base]
      : kind === 'wrong_base' ? [{ ...base, baseId: 'third' as const }]
        : kind === 'wrong_state' ? [{ ...base, moment: moment(base.moment.elapsedSeconds, 3, 3) }]
          : [{ ...base, fair: true }];
    expect(() => deriveBallWorldFieldFirstBaseRace({ field: field([bagFrame(base), ground()], baseContacts), race: race() })).toThrow();
  });
it.each(['base_moment', 'base_ball', 'frame_moment', 'frame_ball'])(
  'rejects injected %s metadata rather than matching only a subset of physical provenance', (kind) => {
    const original = bag(), base = kind === 'base_moment' ? { ...original, moment: { ...original.moment, fair: true } }
      : kind === 'base_ball' ? { ...original, moment: { ...original.moment, ball: { ...original.moment.ball, held: true } } } : original;
    const frame = bagFrame(original), changed = kind === 'frame_moment' ? { ...frame, moment: { ...frame.moment, fair: true } }
      : kind === 'frame_ball' ? { ...frame, moment: { ...frame.moment, ball: { ...frame.moment.ball, held: true } } } : frame;
    expect(() => deriveBallWorldFieldFirstBaseRace({ field: field([changed, ground()], [base]), race: race() })).toThrow();
  });
