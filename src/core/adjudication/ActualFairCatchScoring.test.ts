import { expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { deriveBallWorldBattedRuleChronology } from '../rules/BallWorldBattedRuleChronology';
import { createPlayEndFact } from '../rules/PhysicalRuleFacts';
import { deriveInitialBattedWorldFieldMotion } from '../sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../sim/ball/BattedWorldScheduledFieldAcquisition';
import { fixture } from '../sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { projectActualFairFieldTimeline, type ActualFairFieldTimelineInput } from '../sim/plateAppearance/ActualFairFieldTimeline';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { classifyClosedPlayForOfficialScoring } from './OfficialScoring';
import { closeOfficialPlay, createPlayAdjudicationLedger, deriveClosedLiveBallMatchState, recordCorrectRuleSnapshot } from './PlayAdjudicationLedger';

// Reconstructed after the executor reset. The scheduled Core acquisition is real
// calculation; the supplied end and closed ledger do not claim Native ownership.
const setup = (outs: 0 | 1 | 2 = 0, z = 5) => {
  const before: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), playId: 7,
    inning: 1, half: 'top', outs, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } };
  const physical = fixture(1_000_000, 1, 5, z);
  const field = deriveInitialBattedWorldFieldMotion(physical);
  const acquisitionInput = { response: physical.response, geometry: physical.geometry, field };
  const plan = prepareBattedWorldScheduledFieldAcquisition(acquisitionInput);
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null,
    throughElapsedSeconds: plan.fenceElapsedSeconds });
  if (progress.kind !== 'secured') throw new Error('fixture must physically secure the airborne ball');
  const originalTimeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline(before, 0), physical.response.world.flight.contact);
  const playEnd = createPlayEndFact(progress.world.moment.ball.tick, 'live_action_complete');
  const input: ActualFairFieldTimelineInput = { originalTimeline, playEnd, field: { baseContacts: [], evidence: {
    batterRunnerId: 'batter', defenderIds: ['carrier', 'receiver'], field: physical.geometry.baseGeometry.field,
    bases: physical.geometry.baseGeometry.gates, ballRadiusMeters: physical.response.world.parameters.ballRadius,
    originTick: physical.response.world.flight.initialBall.tick, ticksPerSecond: physical.response.world.parameters.ticksPerSecond,
    horizon: progress.world.moment,
    contacts: [{ moment: plan.contactMoment, contacts: [{ kind: 'actor', playerId: plan.acquirerPlayerId, role: 'glove' }] }],
    acquisitions: [progress.acquisition],
  } } };
  return { before, input };
};
const projected = (input: ActualFairFieldTimelineInput) => {
  const result = projectActualFairFieldTimeline(input);
  if (result.kind !== 'projected') throw new Error('fair catch projection missing');
  return result.timeline;
};
const closed = (before: CanonicalMatchState, input: ActualFairFieldTimelineInput,
  ruling = { outsAfter: before.outs + 1, basesAfter: before.bases, scoredRunnerIds: [] as string[] }) => {
  const ledger = createPlayAdjudicationLedger({ playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd: input.playEnd });
  const ruled = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'rule', tick: input.playEnd.tick + 1,
    snapshotId: 'snapshot', evidenceRevision: 1, ruling });
  return closeOfficialPlay(ruled, 1, { eventId: 'close', closureId: 'closure', tick: input.playEnd.tick + 2 });
};
const request = (h: ReturnType<typeof setup>) => ({ kind: 'live_ball' as const, match: h.before,
  timeline: projected(h.input), adjudication: closed(h.before, h.input), fairCatchEvidence: h.input });

it('FC01 projects an actual airborne fair catch without inventing ground or a physical-end clock', () => {
  const h = setup(), original = JSON.stringify(h.input), timeline = projected(h.input);
  expect(deriveBallWorldBattedRuleChronology(h.input.field.evidence).ballEvidence.kind).toBe('fly_catch');
  expect(timeline.events.slice(0, h.input.originalTimeline.events.length)).toEqual(h.input.originalTimeline.events);
  expect(timeline.events.slice(h.input.originalTimeline.events.length).map(event => event.kind)).toEqual([
    'BattedBallFirstFielderTouch', 'BattedBallDeclaredFair', 'LiveBallPlayEnded',
  ]);
  expect(timeline.events.at(-1)?.tick).toBe(h.input.playEnd.tick);
  expect(timeline.events.some(event => event.kind === 'BattedBallFirstGroundContact')).toBe(false);
  expect(JSON.stringify(h.input)).toBe(original);
});
it.each([0, 1, 2] as const)('FC02 scores only the closed empty-base batter retirement with %s initial outs', outs => {
  const h = setup(outs);
  expect(classifyClosedPlayForOfficialScoring(request(h))).toEqual({ kind: 'supported', record: {
    playId: 7, closureId: 'closure', basisRulingId: 'snapshot', classification: 'fly_out', battingTeam: 'away',
    runsScored: 0, hitsCredited: 0, errorsCharged: 0,
  } });
});
it('FC03 keeps an uncompleted capture, foul territory and unproved end outside the fair-catch projection', () => {
  const h = setup();
  const candidate = { ...h.input, field: { ...h.input.field, evidence: { ...h.input.field.evidence, acquisitions: [] } } };
  expect(projectActualFairFieldTimeline(candidate)).toEqual({ kind: 'unsupported', reason: 'ground_unavailable' });
  expect(() => projectActualFairFieldTimeline({ ...h.input, playEnd: { ...h.input.playEnd, tick: h.input.playEnd.tick + 1 } }))
    .toThrow(/proved physical horizon/);
  expect(projectActualFairFieldTimeline(setup(0, -5).input)).toEqual({ kind: 'unsupported', reason: 'fair_territory_unavailable' });
});
it('FC04 rejects wrong, overturned and ambiguous official retirements', () => {
  const h = setup(), base = request(h);
  for (const ruling of [
    { outsAfter: 0, basesAfter: h.before.bases, scoredRunnerIds: [] },
    { outsAfter: 2, basesAfter: h.before.bases, scoredRunnerIds: [] },
    { outsAfter: 1, basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] },
  ]) expect(() => classifyClosedPlayForOfficialScoring({ ...base, adjudication: closed(h.before, h.input, ruling) })).toThrow();
});
it('FC05 rederives the physical sidecar and rejects omitted capture, changed projection and occupied starting bases', () => {
  const h = setup(), base = request(h);
  const missing = { ...h.input, field: { ...h.input.field, evidence: { ...h.input.field.evidence, acquisitions: [] } } };
  expect(() => classifyClosedPlayForOfficialScoring({ ...base, fairCatchEvidence: missing })).toThrow(/fair catch scoring/);
  expect(() => classifyClosedPlayForOfficialScoring({ ...base,
    fairCatchEvidence: { ...h.input, originalTimeline: { ...h.input.originalTimeline, startedAtTick: 1 } } })).toThrow();
  const occupied = { ...h.before, bases: { first: 'prior-runner', second: null, third: null } };
  expect(() => classifyClosedPlayForOfficialScoring({ ...base, match: occupied,
    adjudication: closed(occupied, h.input, { outsAfter: 1, basesAfter: occupied.bases, scoredRunnerIds: [] }) })).toThrow();
});

// Pure boundary fixture only: Native must authenticate the hold and executed
// zero-motion prefix before these histories can enter its scoring sidecar.
const occupiedRequest = (outs: 0 | 1 | 2 = 0) => {
  const h = setup(outs), clock = h.input.field.evidence;
  const before = { ...h.before, bases: { first: 'runner-1', second: 'runner-2', third: 'runner-3' } };
  const runners = (['first', 'second', 'third'] as const).map(startingBase => {
    const playerId = before.bases[startingBase];
    return { playerId, startingBase, holdReference: { owner: 'world_same_pa_occupied_runner_holds' as const,
      sourceId: 'hold:' + playerId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) }, history: {
      playerId, originTick: clock.originTick, ticksPerSecond: clock.ticksPerSecond, startElapsedSeconds: 0,
      endElapsedSeconds: clock.horizon.elapsedSeconds, contactAtStart: true, contactAtHorizon: true,
      episodes: [{ startElapsedSeconds: 0, endElapsedSeconds: clock.horizon.elapsedSeconds }],
      events: [{ kind: 'touch' as const, originTick: clock.originTick, elapsedSeconds: 0, tick: clock.originTick }],
    } };
  });
  const occupiedRunners = { kind: 'same_pa_stationary_occupied_runners_v1' as const, runners };
  const input = { ...h.input, occupiedRunners };
  return { input, before, request: { kind: 'live_ball' as const, match: before,
    timeline: projected(h.input), adjudication: closed(before, h.input), fairCatchEvidence: input } };
};

it.each([0, 1, 2] as const)('FC06 preserves the proven original runners through scoring with %s initial outs', outs => {
  const h = occupiedRequest(outs), original = JSON.stringify(h.request);
  expect(classifyClosedPlayForOfficialScoring(h.request)).toMatchObject({ kind: 'supported', record: {
    classification: 'fly_out', runsScored: 0, hitsCredited: 0, errorsCharged: 0,
  } });
  const next = deriveClosedLiveBallMatchState(h.before, h.request.timeline, h.request.adjudication);
  expect(next.bases).toEqual(outs === 2 ? { first: null, second: null, third: null } : h.before.bases);
  expect(next.half).toBe(outs === 2 ? 'bottom' : 'top');
  expect(JSON.stringify(h.request)).toBe(original);
});

it.each(['missing', 'incomplete', 'foreign_runner', 'wrong_base', 'duplicate_hold', 'partial_prefix', 'changed_horizon',
  'departure', 'hidden_departure', 'contact_gap', 'wrong_clock'] as const)(
  'FC07 rejects stationary scoring proof fault %s', fault => {
    const h = occupiedRequest(), proof = structuredClone(h.input.occupiedRunners), first = proof.runners[0];
    if (fault === 'incomplete') proof.runners.pop();
    if (fault === 'foreign_runner') first.playerId = first.history.playerId = 'stranger';
    if (fault === 'wrong_base') first.startingBase = 'second';
    if (fault === 'duplicate_hold') proof.runners[1].holdReference = { ...first.holdReference };
    if (fault === 'partial_prefix') first.history.startElapsedSeconds = first.history.episodes[0].startElapsedSeconds = 0.00001;
    if (fault === 'changed_horizon') first.history.endElapsedSeconds += 0.00001;
    if (fault === 'departure') first.history.contactAtHorizon = false;
    if (fault === 'hidden_departure') Object.assign(first.history.events[0], { kind: 'departure' });
    if (fault === 'contact_gap') first.history.episodes.push({ startElapsedSeconds: 0, endElapsedSeconds: first.history.endElapsedSeconds });
    if (fault === 'wrong_clock') first.history.ticksPerSecond++;
    const physical = fault === 'missing' ? { originalTimeline: h.input.originalTimeline, field: h.input.field, playEnd: h.input.playEnd }
      : { ...h.input, occupiedRunners: proof };
    expect(() => classifyClosedPlayForOfficialScoring({ ...h.request, fairCatchEvidence: physical })).toThrow();
  });

it('FC08 rejects a final ruling that erases or advances a proven original runner', () => {
  const h = occupiedRequest();
  for (const basesAfter of [{ first: null, second: null, third: null },
    { first: 'runner-2', second: 'runner-1', third: 'runner-3' }]) {
    expect(() => classifyClosedPlayForOfficialScoring({ ...h.request,
      adjudication: closed(h.before, h.input, { outsAfter: 1, basesAfter, scoredRunnerIds: [] }) })).toThrow();
  }
});

it('FC09 rejects an occupied proof attached to an empty original match or an unknown physical sidecar field', () => {
  const h = occupiedRequest(), empty = setup();
  expect(() => classifyClosedPlayForOfficialScoring({ ...request(empty), fairCatchEvidence: h.input })).toThrow();
  expect(() => classifyClosedPlayForOfficialScoring({ ...h.request, fairCatchEvidence: { ...h.input,
    inventedEndAuthority: true } as typeof h.input })).toThrow(/sidecar/);
});
