import { expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { deriveBallWorldFieldFirstBaseRace, type BallWorldFieldFirstBaseRaceInput } from './BallWorldFieldFirstBaseRace';
import type { BallWorldMoment, BallWorldBoundaryContact } from '../sim/ball/BallWorldContinuation';
import type { BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import type { BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';
import type { GroundedPlayableWallInput } from './BallWorldGroundedPlayableWall';
import { deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence } from './BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import { quantizeEventTick } from '../sim/ExactEventTime';

const moment = (at: number, x = 0, z = 60): BallWorldMoment => ({ originTick: 0, elapsedSeconds: at,
  ball: { tick: quantizeEventTick(0, at, 1_000_000), position: { x, y: 0.036, z },
    velocity: { x: 0, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const history = (playerId: string, at: number | null): BallWorldFirstBaseRaceInput['runnerHistory'] => ({
  playerId, originTick: 0, ticksPerSecond: 1_000_000, startElapsedSeconds: 0, endElapsedSeconds: 4,
  contactAtStart: false, contactAtHorizon: false,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: at }],
  events: at === null ? [] : [{ kind: 'touch', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) },
    { kind: 'departure', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) }] });
const query = (wallAt = 1.5, groundX = 0) => {
  const ground = { moment: moment(1, groundX), contacts: [{ kind: 'ground' as const }] };
  const wall = { moment: moment(wallAt), contacts: [{ kind: 'surface' as const, surfaceId: 'outfield-wall' }] };
  const field: BallWorldFieldTerritoryInput = { evidence: { batterRunnerId: 'batter', defenderIds: ['defender'],
    originTick: 0, ticksPerSecond: 1_000_000, ballRadiusMeters: 0.036, horizon: moment(4),
    field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } },
    bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } },
    contacts: [ground, wall].sort((a,b) => a.moment.elapsedSeconds-b.moment.elapsedSeconds), acquisitions: [] }, baseContacts: [] };
  const race: BallWorldFirstBaseRaceInput = { outsAtStart: 0, batterRunnerId: 'batter', defenderIds: ['defender'],
    originTick: 0, ticksPerSecond: 1_000_000, horizonElapsedSeconds: 4, runnerHistory: history('batter', null),
    defenders: [{ history: history('defender', 2), controlledContacts: [{ playerId: 'defender', originTick: 0, elapsedSeconds: 2, tick: 2_000_000 }] }] };
  const physicalContact: BallWorldBoundaryContact = { kind: 'surface', surfaceId: 'outfield-wall', moment: wall.moment,
    point: { x: 0, y: 0.036, z: 60.036 }, normal: { x: 0, y: 0, z: -1 } };
  const physicalContacts: GroundedPlayableWallInput['physicalContacts'][number][] = [{ contact: physicalContact,
    reboundCursor: { moment: { ...wall.moment, ball: { ...wall.moment.ball, velocity: { x: 0, y: 0, z: -1 } } },
      previousContacts: [{ kind: 'surface', surfaceId: 'outfield-wall' }] } }];
  return { field, race, playableWalls: { policy: { version: 'grounded_fair_playable_wall_v1' as const, ruleProfileId: asRuleProfileId('npb-2026'), rulesRevision: '2026',
    surfaceIds: ['outfield-wall'] }, physicalContacts } };
};
const derive = (input: ReturnType<typeof query>) => deriveBallWorldFieldFirstBaseRace(input as BallWorldFieldFirstBaseRaceInput);

it('WALL01 connects an explicitly supported later playable wall to the actual grounded fair race', () => {
  const input = query(), original = JSON.stringify(input), legacy = deriveBallWorldFieldFirstBaseRace({ field: input.field, race: input.race });
  expect(legacy.groundRule).toBeNull();
  expect(legacy.pendingContacts).toEqual([{ elapsedSeconds: 1.5, tick: 1_500_000, reason: 'surface_policy_pending' }]);
  const result = derive(input);
  expect(result.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out' } });
  expect(result.pendingContacts).toEqual([]);
  expect(result).toMatchObject({ playableWallEvidence: { contacts: [{ surfaceId: 'outfield-wall', moment: input.field.evidence.contacts[1].moment }] } });
  expect(result).not.toHaveProperty('playEnd'); expect(result).not.toHaveProperty('officialRuling');
  expect(JSON.stringify(input)).toBe(original);
});

it('WALL02 preserves byte-identical legacy output when no policy is supplied', () => {
  const input = query(), result = deriveBallWorldFieldFirstBaseRace({ field: input.field, race: input.race });
  expect(result).not.toHaveProperty('playableWallEvidence');
  expect(result.pendingContacts).toHaveLength(1); expect(result.groundRule).toBeNull();
});
it.each([0.5, 0.9999999])('WALL03 leaves a wall before ground/fair at %s unresolved', at => {
  const result = derive(query(at));
  expect(result.groundRule).toBeNull(); expect(result.pendingContacts).toHaveLength(1);
  expect(result.playableWallEvidence?.contacts).toEqual([]);
});
it('WALL04 uses exact physical time when ground and later wall share the recorded tick', () => {
  const input = query(1.0000002);
  input.field = { ...input.field, evidence: { ...input.field.evidence, contacts: [
    { ...input.field.evidence.contacts[0], moment: moment(1.0000001) }, input.field.evidence.contacts[1]] } };
  const result = derive(input);
  expect(result.pendingContacts).toEqual([]); expect(result.groundRule).not.toBeNull();
});
it('WALL05 preserves a simultaneously contacted unknown surface', () => {
  const input = query();
  input.field = { ...input.field, evidence: { ...input.field.evidence, contacts: [input.field.evidence.contacts[0],
    { ...input.field.evidence.contacts[1], contacts: [{ kind: 'surface', surfaceId: 'outfield-wall' }, { kind: 'surface', surfaceId: 'unknown-roof' }] }] } };
  const result = derive(input);
  expect(result.pendingContacts).toEqual([{ elapsedSeconds: 1.5, tick: 1_500_000, reason: 'simultaneous_contact' }]);
  expect(result.groundRule).toBeNull();
});
it('WALL06 preserves foul territory and its later wall', () => {
  const result = derive(query(1.5, 90));
  expect(result.fieldTerritory).toMatchObject({ territory: 'foul' });
  expect(result.pendingContacts).toHaveLength(1); expect(result.groundRule).toBeNull();
});
it.each(['missing', 'normal', 'continuing'] as const)('WALL07 retains %s raw physical contact uncertainty', kind => {
  const input = query();
  input.playableWalls.physicalContacts = kind === 'missing' ? [] : [{ ...input.playableWalls.physicalContacts[0],
    contact: { ...input.playableWalls.physicalContacts[0].contact,
      ...(kind === 'normal' ? { normal: null } : { continuing: true as const }) } }];
  const result = derive(input); expect(result.pendingContacts).toHaveLength(1); expect(result.groundRule).toBeNull();
});
it('WALL08 rejects a fabricated or shifted original wall contact', () => {
  const input = query(); input.playableWalls.physicalContacts = [{ ...input.playableWalls.physicalContacts[0],
    contact: { ...input.playableWalls.physicalContacts[0].contact, moment: moment(1.5001) } }];
  expect(() => derive(input)).toThrow('grounded playable-wall original contact differs');
});

it('WALL13 retains a singleton wall with an unresolved physical response even when its normal exists', () => {
  const input = query(); input.playableWalls.physicalContacts = [{ ...input.playableWalls.physicalContacts[0], reboundCursor: null }];
  const result = derive(input); expect(result.pendingContacts).toHaveLength(1); expect(result.groundRule).toBeNull();
  expect(result.playableWallEvidence?.contacts).toEqual([]);
});
it('WALL14 rejects a rebound cursor from another event', () => {
  const input = query(); input.playableWalls.physicalContacts = [{ ...input.playableWalls.physicalContacts[0],
    reboundCursor: { ...input.playableWalls.physicalContacts[0].reboundCursor!, moment: moment(1.5001) } }];
  expect(() => derive(input)).toThrow('grounded playable-wall original rebound differs');
});
it('WALL15 retains uncertainty when a duplicate physical observation has no resolved rebound', () => {
  const input = query(); input.playableWalls.physicalContacts.push({ ...input.playableWalls.physicalContacts[0], reboundCursor: null });
  const result = derive(input); expect(result.pendingContacts).toHaveLength(1); expect(result.groundRule).toBeNull();
});
it.each(['revision', 'unknown-profile', 'duplicate', 'base-alias', 'result'] as const)('WALL09 rejects %s policy widening', kind => {
  const input = query();
  if (kind === 'revision') input.playableWalls.policy.rulesRevision = 'future';
  if (kind === 'unknown-profile') input.playableWalls.policy.ruleProfileId = asRuleProfileId('unregistered');
  if (kind === 'duplicate') input.playableWalls.policy.surfaceIds.push('outfield-wall');
  if (kind === 'base-alias') input.playableWalls.policy.surfaceIds.push(battedWorldBaseSurfaceId('second'));
  if (kind === 'result') Object.assign(input.playableWalls.policy, { fair: true });
  expect(() => derive(input)).toThrow();
});
it('WALL10 leaves unknown later contacts pending even when one wall is supported', () => {
  const input = query(); input.field = { ...input.field, evidence: { ...input.field.evidence, contacts: [
    ...input.field.evidence.contacts, { moment: moment(1.75), contacts: [{ kind: 'surface', surfaceId: 'unknown-roof' }] }] } };
  const result = derive(input);
  expect(result.playableWallEvidence?.contacts).toHaveLength(1);
  expect(result.pendingContacts).toEqual([{ elapsedSeconds: 1.75, tick: 1_750_000, reason: 'surface_policy_pending' }]);
  expect(result.groundRule).toBeNull();
});
it('WALL11 retains bounded possession uncertainty after resolving the legal wall contact', () => {
  const input = query();
  input.field = { ...input.field, evidence: { ...input.field.evidence, contacts: [...input.field.evidence.contacts,
    { moment: moment(1.75), contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] }] } };
  const result = deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence({ ...input,
    possessionEvidence: { policy: 'scheduled_capture_confirmation_v1', originTick: 0, ticksPerSecond: 1_000_000,
      throughElapsedSeconds: 4, pending: [{ planSourceId: 'plan', playerId: 'defender', contactElapsedSeconds: 1.75,
        phase: 'fence_pending', earliestPotentialControlElapsedSeconds: 1.8 }] } } as Parameters<typeof deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence>[0]);
  expect(result.pendingContacts).toEqual([]); expect(result.possessionGuard.blocked).toBe(true); expect(result.groundRule).toBeNull();
});

it('WALL12 never removes the physical wall to manufacture an airborne fly catch', () => {
  const input = query(); const touched = { moment: moment(1.75), contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] };
  const secured = { kind: 'secured' as const, acquirerPlayerId: 'defender', contactMoment: touched.moment,
    candidateSecureTick: 2_000_000, archivedCandidateSecureTick: 2_000_000, secureTick: 2_000_000, moment: moment(2),
    retention: { outcome: { kind: 'secured', secureTick: 2_000_000 } },
    transport: { kind: 'glove_constraint', contactOffset: { x: 0, y: 0, z: 0 }, initialEnergyJ: 1, remainingEnergyJ: 0 } };
  input.field = { ...input.field, evidence: { ...input.field.evidence, contacts: [input.field.evidence.contacts[1], touched],
    acquisitions: [secured as import('../sim/ball/BattedWorldAcquisition').BattedWorldAcquisition] } };
  const result = derive(input); expect(result.ballEvidence.kind).toBe('unresolved'); expect(result.groundRule).toBeNull();
  expect(result.playableWallEvidence?.contacts).toEqual([]); expect(result.pendingContacts).toHaveLength(1);
});
