import { expect, it } from 'vitest';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from './PlayerRelationships';
import { evaluateBattingResonance,
  selectOffensiveResonanceChannel } from './BattingResonance';

const relationshipPolicy = () => ({ policyId: 'relationships-v1',
  version: 'v1', availableAtDay: 0,
  baseline: { affinity: 70, trust: 70, coordination: 50 },
  deltas: {
    SHARED_SUCCESS: { affinity: 2, trust: 0, coordination: 0 },
    MUTUAL_SUPPORT: { affinity: 0, trust: 2, coordination: 0 },
    JOINT_REPETITION: { affinity: 0, trust: 0, coordination: 1 },
    JOINT_EXECUTION: { affinity: 0, trust: 0, coordination: 1 },
    JOINT_FAILURE: { affinity: 0, trust: 0, coordination: -1 },
    CONFLICT: { affinity: -10, trust: 0, coordination: 0 },
    TRUST_BREACH: { affinity: 0, trust: -10, coordination: 0 },
    ROLE_COMPETITION: { affinity: -1, trust: 0, coordination: 0 },
  },
});
const resonancePolicy = { policyId: 'resonance-calibration',
  version: 'v1', availableAtDay: 0, minAffinity: 70,
  minTrust: 70, minSharedSuccessMemory: 1,
  minChannelStrength: 60 } as const;
const success = { sourceEventId: 'canonical-game-event-1',
  careerId: 'career-1', gameId: 'game-1', teamId: 'team-1',
  atDay: 10, batterPlayerId: 'slugger', result: 'HOME_RUN' } as const;
const lineup = { gameId: 'game-1', teamId: 'team-1',
  playerIds: ['slugger', 'contact', 'power', 'other'] } as const;
const contactProfile = { playerId: 'contact', power: 20,
  contact: 90, onBase: 30, speedPressure: 20 } as const;
const powerProfile = { playerId: 'power', power: 90,
  contact: 20, onBase: 20, speedPressure: 20 } as const;
const pair = { kind: 'PAIR', playerIds: ['slugger', 'contact'] } as const;
const linked = (fromPlayerId: string, toPlayerId = 'slugger') => {
  const initial = createPlayerRelationshipNetwork('career-1',
    relationshipPolicy());
  return applyPlayerRelationshipEvidence(initial, 0, {
    eventId: `relation-${fromPlayerId}-${toPlayerId}`,
    sourceEventId: `historical-success-${fromPlayerId}-${toPlayerId}`,
    atDay: 8, fromPlayerId, toPlayerId,
    kind: 'SHARED_SUCCESS',
  }).state;
};

it('receives slugger success through the contact hitter’s own channel', () => {
  const stimulus = evaluateBattingResonance({ network: linked('contact'),
    policy: resonancePolicy, success, lineup, scope: pair,
    receiverProfile: contactProfile });
  expect(stimulus).toMatchObject({
    type: 'BATTING_RESONANCE_STIMULUS',
    family: 'BATTING_RESONANCE',
    mode: 'CAUSAL_STATE_DESCRIPTOR',
    sourceEventId: 'canonical-game-event-1',
    receiverPlayerId: 'contact', sourcePlayerId: 'slugger',
    channel: 'CONTACT', proximity: 'ADJACENT',
    policyId: resonancePolicy.policyId, policyVersion: 'v1',
  });
  expect(stimulus).not.toHaveProperty('powerBonus');
  expect(stimulus).not.toHaveProperty('homeRunModifier');
  expect(contactProfile.power).toBe(20);
});

it('does not penalize weak or absent relationships', () => {
  const absent = createPlayerRelationshipNetwork('career-1',
    relationshipPolicy());
  const input = { policy: resonancePolicy, success, lineup, scope: pair,
    receiverProfile: contactProfile };
  expect(evaluateBattingResonance({ ...input, network: absent })).toBeNull();
  const weak = applyPlayerRelationshipEvidence(absent, 0, {
    eventId: 'weak-relation', sourceEventId: 'old-conflict',
    atDay: 8, fromPlayerId: 'contact', toPlayerId: 'slugger',
    kind: 'CONFLICT',
  }).state;
  expect(evaluateBattingResonance({ ...input, network: weak })).toBeNull();
  expect(selectOffensiveResonanceChannel({ playerId: 'other',
    power: 0, contact: 0, onBase: 0, speedPressure: 0 },
  resonancePolicy)).toBe('NONE');
});

it('maps the same canonical success to each eligible receiver’s profile', () => {
  let network = linked('contact');
  network = applyPlayerRelationshipEvidence(network, 1, {
    eventId: 'relation-power-slugger',
    sourceEventId: 'historical-success-power-slugger',
    atDay: 8, fromPlayerId: 'power', toPlayerId: 'slugger',
    kind: 'SHARED_SUCCESS',
  }).state;
  const common = { network, policy: resonancePolicy, success, lineup };
  expect(evaluateBattingResonance({ ...common, scope: pair,
    receiverProfile: contactProfile })?.channel).toBe('CONTACT');
  expect(evaluateBattingResonance({ ...common,
    scope: { kind: 'PAIR', playerIds: ['slugger', 'power'] },
    receiverProfile: powerProfile })?.channel).toBe('POWER');
});

it('enforces pair membership and actual lineup context', () => {
  const input = { network: linked('contact'), policy: resonancePolicy,
    success, lineup, receiverProfile: contactProfile };
  expect(() => evaluateBattingResonance({ ...input,
    scope: { kind: 'PAIR', playerIds: ['slugger', 'other'] } }))
    .toThrow('resonance scope');
  expect(() => evaluateBattingResonance({ ...input,
    scope: { kind: 'PAIR', playerIds: ['slugger', 'slugger'] } }))
    .toThrow('resonance scope');
  expect(() => evaluateBattingResonance({ ...input,
    lineup: { ...lineup, playerIds: ['slugger', 'power'] }, scope: pair }))
    .toThrow('resonance lineup');
  expect(() => evaluateBattingResonance({ ...input,
    success: { ...success, gameId: 'different-game' }, scope: pair }))
    .toThrow('resonance lineup');
});

it('requires policy-pinned thresholds and preserves nonadjacent eligibility', () => {
  const input = { network: linked('contact'), policy: resonancePolicy,
    success, lineup: { ...lineup,
      playerIds: ['slugger', 'other', 'contact', 'power'] },
    scope: pair, receiverProfile: contactProfile };
  expect(evaluateBattingResonance(input)?.proximity).toBe('OTHER_LINEUP');
  expect(() => evaluateBattingResonance({ ...input,
    policy: { ...resonancePolicy, minAffinity: -1 } }))
    .toThrow('resonance policy');
});

it('derives cluster eligibility from connected relationship evidence', () => {
  let network = linked('contact');
  const scope = { kind: 'CLUSTER',
    playerIds: ['slugger', 'contact', 'power'] } as const;
  const input = { network, policy: resonancePolicy, success, lineup,
    scope, receiverProfile: contactProfile };
  expect(evaluateBattingResonance(input)).toBeNull();
  network = applyPlayerRelationshipEvidence(network, 1, {
    eventId: 'contact-to-power', sourceEventId: 'old-contact-power-win',
    atDay: 8, fromPlayerId: 'contact', toPlayerId: 'power',
    kind: 'SHARED_SUCCESS',
  }).state;
  expect(evaluateBattingResonance({ ...input, network })?.scope)
    .toEqual(scope);
});

it('uses the receiver-to-source direction and validates event provenance fields', () => {
  const reverseOnly = linked('slugger', 'contact');
  const input = { network: reverseOnly, policy: resonancePolicy,
    success, lineup, scope: pair, receiverProfile: contactProfile };
  expect(evaluateBattingResonance(input)).toBeNull();
  expect(() => evaluateBattingResonance({ ...input,
    success: { ...success, sourceEventId: '' } }))
    .toThrow('resonance success evidence');
  expect(() => evaluateBattingResonance({ ...input,
    success: { ...success, careerId: 'another-career' } }))
    .toThrow('resonance career or day');
});
