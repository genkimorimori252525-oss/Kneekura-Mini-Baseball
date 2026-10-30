import { expect, it } from 'vitest';
import { calculateDefensiveExecution, type DefensiveExecutionInput } from './DefensiveExecutionCalculation';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { generateDefensiveIntentCandidates } from '../../core/sim/fielding/DefensiveDecision';
import { createTeamCoveragePlan } from '../../core/sim/fielding/TeamCoveragePlan';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { calculateDefensiveCandidatesV1, createDefensiveCandidateSetProjectionV1,
  createDefensiveTeamSelectionProjectionV1, extractDefensiveActorSelectionV1,
  type DefensiveCandidateSetProjectionInputV1 } from './DefensiveCandidateCalculationV1';

const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const ref = (sourceId: string, tick = 100) => ({ sourceId, sourceHash: 'a'.repeat(64), playId: 7, revision: 2, observedAtTick: tick, availableAtTick: tick });
const input = (playerId = 'player-a'): DefensiveExecutionInput => ({ startedAtTick: 100, ratings: { situationalAwareness: .5, firstStep: .5 }, decision: {
  self: { playerId }, perceivedWorld: { observerId: playerId, observationTime: 100, attention: { target: { kind: 'ball' }, focusedSinceTick: 90 },
    ball: { estimate: { position: { x: 0, y: 1, z: 20 }, velocity: { x: 0, y: 0, z: 1 } }, sourceObservedAt: 90, predictedAt: 100, confidence: .9 },
    players: [{ playerId: 'seen-teammate', memory: { estimate: { position: { x: 0, z: 10 }, velocity: { x: 0, z: 2 } }, sourceObservedAt: 95, predictedAt: 100, confidence: .9 } }], communications: [], knownContext: null },
  prePlayPlan: { ballPursuitPriority: .8, baseCoverPriorities: [{ base: 1, priority: .7 }], relayPriority: .6, backupPriority: .5, deepCoveragePriority: .4, holdPriority: .1 },
  // Explicit controlled perceived/known-geometry fixture. These refs are not Native evidence.
  perceivedCues: [{ kind: 'teammate_ball_commitment', playerId: 'seen-teammate', observedAt: 95, confidence: .9 },
    { kind: 'base_needs_cover', base: 1, observedAt: 100, confidence: .9 },
    { kind: 'relay_needed', target: { x: 15, z: 10 }, observedAt: 100, confidence: .9 },
    { kind: 'backup_needed', target: { x: 60, z: -20 }, observedAt: 100, confidence: .9 },
    { kind: 'deep_coverage_needed', target: { x: 0, z: 40 }, observedAt: 100, confidence: .9 }] } });
const source = (index = 0): DefensiveCandidateSetProjectionInputV1 => ({ reference: ref('candidate-' + index), registeredPosition: positions[index],
  input: input('player-' + index), calibration: playerDecisionCalibrationFixture(), inputReferences: {
    observation: ref('observation-' + index), decisionModel: ref('model-' + index), plan: ref('plan-' + index), effectiveCalibration: ref('calibration-' + index),
    geometry: ref('geometry'), cues: Array.from({ length: 5 }, (_, cue) => ref('cue-' + index + '-' + cue, cue === 0 ? 95 : 100)) } });
const team = () => ({ reference: ref('team'), requireBallHandler: true, defenders: positions.map((_, index) => createDefensiveCandidateSetProjectionV1(source(index))) });

it('retains every original generated candidate and byte-identical legacy selected/scheduling', () => {
  const raw = input(), calibration = playerDecisionCalibrationFixture(), before = actorHash({ raw, calibration });
  const legacy = calculateDefensiveExecution(raw, calibration), value = calculateDefensiveCandidatesV1(raw, calibration);
  expect(value.candidates).toEqual(generateDefensiveIntentCandidates({ ...raw.decision, minimumCueConfidence: calibration.minimumCueConfidence, communicationTrust: calibration.communicationTrust }));
  expect(value.candidates.map(candidate => candidate.intent.kind)).toEqual(['ball_handler', 'base_cover', 'relay', 'backup', 'deep_coverage', 'hold']);
  expect(actorJson({ selected: value.selected, scheduling: value.scheduling })).toBe(actorJson(legacy));
  expect(actorHash({ raw, calibration })).toBe(before); expect(value.nativeAdmission).toBe(false);
  expect(Object.isFrozen(value.candidates[2].intent)).toBe(true); expect(Object.isFrozen(raw.decision.perceivedCues[2])).toBe(false);
});
it('effective thresholds and timing apply to the full set without changing legacy calculation', () => {
  const raw = input(), calibration = { ...playerDecisionCalibrationFixture(), minimumCueConfidence: .95 };
  const value = calculateDefensiveCandidatesV1(raw, calibration);
  expect(value.candidates.map(candidate => candidate.intent.kind)).toEqual(['hold']);
  expect({ selected: value.selected, scheduling: value.scheduling }).toEqual(calculateDefensiveExecution(raw, calibration));
});
it('uses the two original decision ratings while preserving legacy calculation for a complete nominal fielding model', () => {
  const fullRatings = { situationalAwareness: .5, firstStep: .5, acceleration: .5, armStrength: .5,
    battedBallRead: .5, catching: .5, routeEfficiency: .5, tagSkill: .5, throwingAccuracy: .5, transfer: .5,
    positionSuitability: Object.fromEntries(positions.map(position => [position, .5])) };
  const raw = { ...input(), ratings: fullRatings }, calibration = playerDecisionCalibrationFixture(), before = actorHash(raw);
  const projected = calculateDefensiveCandidatesV1({ ...raw, ratings: {
    situationalAwareness: fullRatings.situationalAwareness, firstStep: fullRatings.firstStep } }, calibration);
  expect({ selected: projected.selected, scheduling: projected.scheduling }).toEqual(calculateDefensiveExecution(raw, calibration));
  expect(actorHash(raw)).toBe(before);
  // Unused nominal-model fields are retained by its Source/hash owner, rather
  // than admitted as arbitrary fields in this narrow timing input contract.
  expect(() => calculateDefensiveCandidatesV1(raw, calibration)).toThrow(/fields/);
});
it('retains received communication candidates and rejects canonical-target/getter ingress', () => {
  const raw = structuredClone(source());
  Object.assign(raw.input.decision.perceivedWorld, { communications: [{ event: { sourceId: 'original-callout', targetScope: { kind: 'player', playerId: 'player-0' },
    kind: 'callout', issuedAt: 90, content: { kind: 'cover_base', base: 1 } }, receivedAt: 100, confidence: .8 }] });
  const value = createDefensiveCandidateSetProjectionV1(raw);
  expect(value.calculation.candidates.some(candidate => candidate.evidenceKinds.includes('communication:cover_base'))).toBe(true);
  const extra = structuredClone(raw); Object.assign(extra.input.decision, { canonicalTarget: { x: 999, z: 999 } });
  expect(() => createDefensiveCandidateSetProjectionV1(extra)).toThrow(/fields/);
  const future = structuredClone(raw); Object.assign(future.input.decision.perceivedWorld.communications[0], { receivedAt: 101 });
  expect(() => createDefensiveCandidateSetProjectionV1(future)).toThrow(/future/);
  const accessor = structuredClone(raw); let calls = 0;
  Object.defineProperty(accessor.input, 'startedAtTick', { enumerable: true, get: () => { calls++; return 100; } });
  expect(() => createDefensiveCandidateSetProjectionV1(accessor)).toThrow(/accessors/); expect(calls).toBe(0);
});
it('projects the same nine-player DP plan and extracts a source member instead of an individual fallback', () => {
  const raw = team(), projected = createDefensiveTeamSelectionProjectionV1(raw);
  const expected = createTeamCoveragePlan({ requireBallHandler: true, defenders: raw.defenders.map(defender => ({ playerId: defender.calculation.input.decision.self.playerId,
    registeredPosition: defender.registeredPosition, candidates: defender.calculation.candidates })) });
  expect(projected.plan).toEqual(expected); expect(projected.nativeAdmission).toBe(false);
  expect(projected.plan.assignments.filter(assignment => assignment.intent.kind === 'ball_handler')).toHaveLength(1);
  for (const assignment of expected.assignments) {
    const actor = extractDefensiveActorSelectionV1(projected, assignment.playerId);
    expect(actor.assignment).toEqual(assignment); expect(actor.nativeAdmission).toBe(false);
    expect(actor.scheduling).toEqual(raw.defenders.find(defender => defender.calculation.input.decision.self.playerId === assignment.playerId)!.calculation.scheduling);
    expect(actor.candidate.intent).toEqual(assignment.intent);
  }
});
it('rejects altered candidates/legacy choice/calibration/geometry before team selection', () => {
  const raw = team();
  for (const alter of [
    (value: any) => value.defenders[0].calculation.candidates[0].localPriority = 999,
    (value: any) => value.defenders[0].calculation.selected.intent = { kind: 'hold' },
    (value: any) => value.defenders[0].calculation.scheduling.movementStartTick++,
    (value: any) => value.defenders[0].calculation.calibration.minimumCueConfidence = .95,
    (value: any) => value.defenders[0].calculation.candidates[2].intent.target.x = 999,
  ]) { const bad = structuredClone(raw); alter(bad); expect(() => createDefensiveTeamSelectionProjectionV1(bad)).toThrow(/differs|candidate/i); }
});
it('rejects late refs, future perception/cues, foreign play, absent geometry and duplicate players', () => {
  for (const alter of [
    (value: any) => value.inputReferences.observation.availableAtTick = 101,
    (value: any) => value.inputReferences.cues[2].availableAtTick = 101,
    (value: any) => value.inputReferences.plan.playId = 8,
    (value: any) => value.inputReferences.geometry = null,
    (value: any) => value.input.decision.perceivedWorld.ball.sourceObservedAt = 101,
    (value: any) => value.input.decision.perceivedWorld.players[0].memory.predictedAt = 101,
    (value: any) => value.input.decision.perceivedCues[0].observedAt = 101,
    (value: any) => value.input.decision.self.playerId = 'foreign-observer',
  ]) { const bad = structuredClone(source()); alter(bad); expect(() => createDefensiveCandidateSetProjectionV1(bad)).toThrow(); }
  const raw = team(); const duplicate = { ...raw, defenders: [raw.defenders[0], raw.defenders[0], ...raw.defenders.slice(2)] };
  expect(() => createDefensiveTeamSelectionProjectionV1(duplicate)).toThrow(/unique|duplicate/i);
});
it('rejects role-conflicting/non-member team edits and foreign actor extraction', () => {
  const value = createDefensiveTeamSelectionProjectionV1(team());
  for (const alter of [
    (bad: any) => bad.plan.assignments.find((assignment: any) => assignment.intent.kind !== 'ball_handler').intent = { kind: 'ball_handler' },
    (bad: any) => { bad.plan.assignments[0].intent = { kind: 'base_cover', base: 1 }; bad.plan.assignments[1].intent = { kind: 'base_cover', base: 1 }; },
    (bad: any) => bad.plan.assignments[0].intent = { kind: 'relay', target: { x: 999, z: 999 } },
    (bad: any) => bad.reference.availableAtTick = 101,
  ]) { const bad = structuredClone(value); alter(bad); expect(() => extractDefensiveActorSelectionV1(bad, 'player-0')).toThrow(/differs|future|unavailable/i); }
  expect(() => extractDefensiveActorSelectionV1(value, 'not-on-defense')).toThrow(/actor|player/i);
});
