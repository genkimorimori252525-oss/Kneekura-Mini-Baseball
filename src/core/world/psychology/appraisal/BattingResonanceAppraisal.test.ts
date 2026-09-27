import { expect, it } from 'vitest';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork } from '../../team/PlayerRelationships';
import type { BattingResonanceInput } from '../../team/BattingResonance';
import { createEmotionState } from '../EmotionState';
import { appraisalInput, change, value } from './AppraisalFixtures.test-support';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import { evaluateBattingResonanceEmotion } from './BattingResonanceAppraisal';

const relationPolicy = () => ({ policyId: 'relationship-test',
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
const resonance = (linked: boolean): BattingResonanceInput => {
  let network = createPlayerRelationshipNetwork('career', relationPolicy());
  if (linked) network = applyPlayerRelationshipEvidence(network, 0, {
    eventId: 'relationship-1', sourceEventId: 'past-shared-success',
    atDay: 2, fromPlayerId: 'player', toPlayerId: 'teammate',
    kind: 'SHARED_SUCCESS',
  }).state;
  return { network,
    policy: { policyId: 'batting-resonance-test', version: 'v1',
      availableAtDay: 0, minAffinity: 70, minTrust: 70,
      minSharedSuccessMemory: 1, minChannelStrength: 60 },
    success: { sourceEventId: 'event', careerId: 'career',
      gameId: 'match', teamId: 'club', atDay: 3,
      batterPlayerId: 'teammate', result: 'HOME_RUN' },
    lineup: { gameId: 'match', teamId: 'club',
      playerIds: ['teammate', 'player', 'other'] },
    scope: { kind: 'PAIR', playerIds: ['teammate', 'player'] },
    receiverProfile: { playerId: 'player', power: 20,
      contact: 90, onBase: 20, speedPressure: 20 } };
};
const cuePolicy = { policyId: 'cue-calibration', version: 'v1',
  adjacentCue: 1, otherLineupCue: 0.6 } as const;
const motivatedInput = () => change(appraisalInput(), (draft) => {
  draft.event.expectedOutcome = 0.5;
  draft.event.perceivedOutcome = 0.5;
  draft.event.recentSuccess = 0;
  const motivation = draft.model.rows.find((row: { emotion: string }) =>
    row.emotion === 'MOTIVATION');
  motivation.situationWeights.recentSuccess = 1;
});
const initial = () => {
  const input = motivatedInput();
  return value(createEmotionState({ scope: input.importance.scope,
    policy: input.policy }));
};

it('routes eligible teammate success through source appraisal and the single emotion gate', () => {
  const input = motivatedInput();
  const ordinary = value(evaluateAppraisedEmotion(initial(), input));
  expect(ordinary.influence.activeEmotion).toBeNull();
  const result = value(evaluateBattingResonanceEmotion(initial(), input,
    resonance(true), cuePolicy));
  expect(result).not.toBeNull();
  if (!result) throw new Error('expected batting resonance appraisal');
  expect(result.stimulus.channel).toBe('CONTACT');
  expect(result.applied.computation.situation.recentSuccess).toBe(1);
  expect(result.applied.influence.activeEmotion).toBe('MOTIVATION');
  expect(result.applied.influence.effects?.swingAggressionDelta)
    .toBeGreaterThan(0);
  expect(result.applied.event.request.evidenceEventIds).toEqual(['event']);
  expect(result.applied.event.request.sourceSnapshotId)
    .toContain('cue-calibration');
  expect(result.applied.influence.effects).not.toHaveProperty('powerBonus');
});

it('leaves the emotion state untouched when no relationship stimulus is eligible', () => {
  const state = initial();
  const result = evaluateBattingResonanceEmotion(state, motivatedInput(),
    resonance(false), cuePolicy);
  expect(result).toEqual({ ok: true, value: null });
  expect(state.revision).toBe(0);
});

it('rejects mismatched event, receiver and cue policy before appraisal', () => {
  const state = initial();
  expect(evaluateBattingResonanceEmotion(state, motivatedInput(),
    { ...resonance(true), success: {
      ...resonance(true).success, sourceEventId: 'different' } },
    cuePolicy)).toMatchObject({ ok: false,
      reason: { code: 'SCOPE_MISMATCH' } });
  expect(evaluateBattingResonanceEmotion(state, motivatedInput(),
    { ...resonance(true), receiverProfile: {
      ...resonance(true).receiverProfile, playerId: 'other' } },
    cuePolicy).ok).toBe(false);
  expect(evaluateBattingResonanceEmotion(state, motivatedInput(),
    resonance(true), { ...cuePolicy, adjacentCue: -0.2 }).ok)
    .toBe(false);
});

it('does not stack a second success cue on the same appraisal axis', () => {
  const input = change(motivatedInput(), (draft) => {
    draft.event.recentSuccess = 0.8;
  });
  const policy = { ...cuePolicy, adjacentCue: 0.6 };
  const result = value(evaluateBattingResonanceEmotion(initial(), input,
    resonance(true), policy));
  expect(result?.applied.computation.situation.recentSuccess).toBe(0.8);
});

it('keeps distant lineup influence positive and binds calibrated strength to provenance', () => {
  const distant = { ...resonance(true), lineup: {
    gameId: 'match', teamId: 'club',
    playerIds: ['teammate', 'other', 'player', 'fourth'] } };
  const first = value(evaluateBattingResonanceEmotion(initial(),
    motivatedInput(), distant, cuePolicy));
  const revisedPolicy = { ...cuePolicy, otherLineupCue: 0.4 };
  const second = value(evaluateBattingResonanceEmotion(initial(),
    motivatedInput(), distant, revisedPolicy));
  expect(first?.stimulus.proximity).toBe('OTHER_LINEUP');
  expect(first?.applied.computation.situation.recentSuccess).toBe(0.6);
  expect(second?.applied.computation.situation.recentSuccess).toBe(0.4);
  expect(first?.applied.event.request.sourceSnapshotId)
    .not.toBe(second?.applied.event.request.sourceSnapshotId);
});
