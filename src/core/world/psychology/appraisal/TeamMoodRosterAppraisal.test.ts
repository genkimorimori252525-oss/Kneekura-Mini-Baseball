import { expect, it } from 'vitest';
import { applyRosterChange } from '../../roster/RosterCommands';
import { createRosterState } from '../../roster/RosterState';
import type { RosterStateInput } from '../../roster/RosterTypes';
import { createPlayerRelationshipNetwork } from '../../team/PlayerRelationships';
import { applyTeamMoodSignal, createTeamMoodState } from '../../team/TeamMood';
import type { TeamMoodState } from '../../team/TeamMood';
import { createEmotionState } from '../EmotionState';
import { appraisalInput, change, value } from './AppraisalFixtures.test-support';
import { evaluateAppraisedEmotion } from './AppraisalGate';
import { evaluateTeamMoodRosterAppraisal } from './TeamMoodRosterAppraisal';

const roster = createRosterState({ careerId: 'career',
  profiles: [{ profileId: 'test', version: 'v1', season: 2026,
    competitionEditionId: 'league-2026', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'first', clubId: 'club', kind: 'FIRST_TEAM' }],
  players: ['player', 'other'].map((playerId) => ({ playerId,
    clubRights: { rightsHolderClubId: 'club',
      contractId: `contract-${playerId}` },
    assignment: { unitId: 'first', clubId: 'club' },
    registrations: [], availability: { status: 'AVAILABLE' as const,
      evidenceId: `health-${playerId}` },
  })),
} as RosterStateInput);
const relationships = createPlayerRelationshipNetwork('career', {
  policyId: 'relationship-test', version: 'v1', availableAtDay: 0,
  baseline: { affinity: 50, trust: 50, coordination: 50 },
  deltas: Object.fromEntries([
    'SHARED_SUCCESS', 'MUTUAL_SUPPORT', 'JOINT_REPETITION',
    'JOINT_EXECUTION', 'JOINT_FAILURE', 'CONFLICT', 'TRUST_BREACH',
    'ROLE_COMPETITION',
  ].map((kind) => [kind, { affinity: 0, trust: 0,
    coordination: 0 }])) as Record<'SHARED_SUCCESS' | 'MUTUAL_SUPPORT'
    | 'JOINT_REPETITION' | 'JOINT_EXECUTION' | 'JOINT_FAILURE'
    | 'CONFLICT' | 'TRUST_BREACH' | 'ROLE_COMPETITION',
    { affinity: number; trust: number; coordination: number }>,
});
const moodPolicy = { policyId: 'mood-test', version: 'v1',
  season: 2026, availableAtDay: 0,
  baseline: { confidence: 50, cohesion: 50, energy: 50,
    tension: 50, roleHarmony: 50 },
  directStrength: 1, diffusionStrength: 0,
  dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
    tension: 0, roleHarmony: 0 } };
const moodGatePolicy = { policyId: 'rare-gate', version: 'v1',
  season: 2026, availableAtDay: 0,
  minimumAlignedFraction: 0.75,
  positiveCohesion: 65, positiveConfidence: 65,
  positiveEnergy: 65, severeTension: 65,
  roleHarmonyCollapse: 35 };
const mood = (extreme: boolean,
  otherDelta = 50): TeamMoodState => {
  let state = createTeamMoodState(roster, 'club', moodPolicy,
    ['player', 'other'].map((playerId) => ({ playerId,
      axes: { confidence: 1, cohesion: 1, energy: 1,
        tension: 1, roleHarmony: 1 } })));
  if (!extreme) return state;
  for (const playerId of ['player', 'other']) {
    for (const axis of ['confidence', 'energy'] as const) {
      state = applyTeamMoodSignal(state, roster, relationships, {
        eventId: `mood-${playerId}-${axis}`,
        sourceEventId: `source-${playerId}-${axis}`,
        appraisalId: `appraisal-${playerId}-${axis}`,
        careerId: 'career', clubId: 'club', season: 2026,
        directPlayerId: playerId, atDay: 1, axis,
        delta: playerId === 'other' ? otherDelta : 50,
      }).state;
    }
  }
  return state;
};
const command = { commandId: 'rest-choice',
  causeEventId: 'manager-roster-choice', expectedRevision: 0,
  effectiveDay: 2, changes: [{ playerId: 'player',
    availability: { status: 'UNAVAILABLE' as const,
      evidenceId: 'roster-decision-evidence' } }] };
const rosterEvent = () => {
  const result = applyRosterChange(roster, command);
  if (!result.ok) throw new Error('invalid roster test event');
  return result.event;
};
const emotionInput = () => change(appraisalInput(), (draft) => {
  draft.event.eventId = rosterEvent().eventId;
  draft.evidenceEventIds = [draft.event.eventId];
  draft.event.expectedOutcome = 0.5;
  draft.event.perceivedOutcome = 0.5;
  for (const row of draft.model.rows) {
    row.bias = 0;
    for (const key in row.situationWeights) row.situationWeights[key] = 0;
    for (const key in row.responseWeights) row.responseWeights[key] = 0;
  }
});
const initial = () => {
  const input = emotionInput();
  return value(createEmotionState({ scope: input.importance.scope,
    policy: input.policy }));
};
const cuePolicy = { policyId: 'mood-appraisal-calibration',
  version: 'v1', maxCue: 1,
  weights: { SUPERIORITY: 0, MOTIVATION: 1,
    FEAR: -1, IMPATIENCE: -1, ANGER: 0 } } as const;
const evaluate = (teamMood = mood(true)) =>
  evaluateTeamMoodRosterAppraisal(initial(), emotionInput(),
    teamMood, moodGatePolicy, roster, command, rosterEvent(), cuePolicy);

it('lets a verified roster decision meet an exceptional social environment in personal appraisal', () => {
  const ordinary = value(evaluateAppraisedEmotion(initial(),
    emotionInput()));
  expect(ordinary.influence.activeEmotion).toBeNull();
  const result = value(evaluate());
  expect(result).not.toBeNull();
  if (!result) throw new Error('expected mood appraisal');
  expect(result.gate.mode).toBe('POSITIVE_EXTREME');
  expect(result.cue.value).toBe(1);
  expect(result.applied.influence.activeEmotion).toBe('MOTIVATION');
  expect(result.applied.event.request.evidenceEventIds)
    .toEqual([rosterEvent().eventId]);
  expect(result.applied.event.request.sourceSnapshotId)
    .toContain(cuePolicy.policyId);
  expect(result.applied.influence.effects).not.toHaveProperty('powerBonus');
});

it('does not create a mood appraisal from an ordinary social state', () => {
  const state = initial();
  expect(evaluateTeamMoodRosterAppraisal(state, emotionInput(),
    mood(false), moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy)).toEqual({ ok: true, value: null });
  expect(state.revision).toBe(0);
});

it('rejects forged roster evidence and a mismatched appraisal source', () => {
  expect(evaluateTeamMoodRosterAppraisal(initial(), emotionInput(),
    mood(true), moodGatePolicy, roster, command,
    { ...rosterEvent(), eventId: 'forged' }, cuePolicy).ok).toBe(false);
  const wrong = change(emotionInput(), (draft) => {
    draft.event.eventId = 'unrelated-event';
    draft.evidenceEventIds = ['unrelated-event'];
  });
  expect(evaluateTeamMoodRosterAppraisal(initial(), wrong,
    mood(true), moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy)).toMatchObject({ ok: false,
      reason: { code: 'SCOPE_MISMATCH' } });
});

it('appraises the same social environment through each player’s actual mood', () => {
  const state = mood(true, 20);
  const first = value(evaluateTeamMoodRosterAppraisal(initial(),
    emotionInput(), state, moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy));
  const secondInput = change(emotionInput(), (draft) => {
    draft.importance.scope.playerId = 'other';
    draft.importance.personal.scope.playerId = 'other';
    draft.player.scope.playerId = 'other';
    draft.event.scope.playerId = 'other';
  });
  const secondState = value(createEmotionState({
    scope: secondInput.importance.scope, policy: secondInput.policy }));
  const second = value(evaluateTeamMoodRosterAppraisal(secondState,
    secondInput, state, moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy));
  expect(first?.cue.value).toBe(1);
  expect(second?.cue.value).toBe(0.4);
  expect(first?.applied.influence.activeEmotion).toBe('MOTIVATION');
  expect(second?.applied.influence.activeEmotion).toBeNull();
});

it('rejects a repeat appraisal of the same roster event for one player', () => {
  const first = value(evaluate());
  if (!first) throw new Error('expected mood appraisal');
  const secondInput = change(emotionInput(), (draft) => {
    draft.appraisalId = 'second-appraisal';
    draft.bundleId = 'second-bundle';
    draft.expectedRevision = 1;
    draft.importance.time.tick = 101;
    for (const source of [draft.importance.competition,
      draft.importance.personal, draft.importance.rivalry,
      draft.player, draft.event]) source.stamp.time.tick = 101;
  });
  expect(evaluateTeamMoodRosterAppraisal(first.applied.state,
    secondInput, mood(true), moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy)).toMatchObject({ ok: false,
      reason: { code: 'DUPLICATE_APPRAISAL' } });
});

it('lets severe tension be appraised as pressure after a real roster event', () => {
  let tense = mood(false);
  for (const playerId of ['player', 'other']) {
    tense = applyTeamMoodSignal(tense, roster, relationships, {
      eventId: `tension-${playerId}`,
      sourceEventId: `tension-source-${playerId}`,
      appraisalId: `tension-appraisal-${playerId}`,
      careerId: 'career', clubId: 'club', season: 2026,
      directPlayerId: playerId, atDay: 1,
      axis: 'tension', delta: 50,
    }).state;
  }
  const result = value(evaluateTeamMoodRosterAppraisal(initial(),
    emotionInput(), tense, moodGatePolicy, roster, command,
    rosterEvent(), cuePolicy));
  expect(result?.gate.mode).toBe('DYSFUNCTION_EXTREME');
  expect(result?.cue.value).toBe(-1);
  expect(result?.applied.influence.activeEmotion).toBe('IMPATIENCE');
  expect(result?.applied.event.request.evidenceEventIds)
    .toEqual([rosterEvent().eventId]);
});
