import { expect, it } from 'vitest';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { deriveActualFairCatchOccupiedRunnerOutcome, validateActualFairCatchOccupiedRunnerEvidence, type ActualFairCatchRunnerAppealEvidence } from '../rules/FairCatchRunnerOutcome';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
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

// Author-level exact histories, not Native provenance or PlayEnd ownership.
const movingRequest = (startingBase: 'first' | 'second' | 'third' = 'first', outs: 0 | 1 | 2 = 0) => {
  const h = setup(outs);
  // Place the author-level catch after contact so early departures are observable.
  const shifted = (moment: typeof h.input.field.evidence.horizon) => ({ ...moment, elapsedSeconds: moment.elapsedSeconds + 1,
    ball: { ...moment.ball, tick: quantizeEventTick(moment.originTick, moment.elapsedSeconds + 1, h.input.field.evidence.ticksPerSecond) } });
  const clock = { ...h.input.field.evidence, contacts: h.input.field.evidence.contacts.map(frame => ({ ...frame, moment: shifted(frame.moment) })),
    acquisitions: h.input.field.evidence.acquisitions.map(acquisition => {
      if (acquisition.kind !== 'secured') throw new Error('expected secured author fixture');
      return { ...acquisition, contactMoment: shifted(acquisition.contactMoment), moment: shifted(acquisition.moment),
        secureTick: shifted(acquisition.moment).ball.tick };
    }) };
  const firstTouch = clock.contacts[0].moment.elapsedSeconds;
  const before: CanonicalMatchState = { ...h.before, bases: { first: null, second: null, third: null, [startingBase]: 'runner' } };
  const horizon = firstTouch + 20;
  const history = (episodes: readonly (readonly [number, number])[]): BallWorldPlayerBaseContactHistory => ({
    playerId: 'runner', originTick: clock.originTick, ticksPerSecond: clock.ticksPerSecond,
    startElapsedSeconds: 0, endElapsedSeconds: horizon,
    contactAtStart: episodes[0]?.[0] === 0, contactAtHorizon: episodes.at(-1)?.[1] === horizon,
    episodes: episodes.map(([startElapsedSeconds, endElapsedSeconds]) => ({ startElapsedSeconds, endElapsedSeconds })),
    events: episodes.flatMap(([start, end]) => [{ kind: 'touch' as const, originTick: clock.originTick,
      elapsedSeconds: start, tick: quantizeEventTick(clock.originTick, start, clock.ticksPerSecond) },
    ...(end < horizon ? [{ kind: 'departure' as const, originTick: clock.originTick, elapsedSeconds: end,
      tick: quantizeEventTick(clock.originTick, end, clock.ticksPerSecond) }] : [])]),
  });
  const field = { ...h.input.field, evidence: { ...clock, horizon: { ...clock.horizon, elapsedSeconds: horizon,
    ball: { ...clock.horizon.ball, tick: quantizeEventTick(clock.originTick, horizon, clock.ticksPerSecond) } } } };
  const runnerEvidence = { kind: 'same_pa_occupied_fair_catch_runner_evidence_v1' as const, runners: [{
    playerId: 'runner', startingBase,
    holdReference: { owner: 'world_same_pa_occupied_runner_holds' as const, sourceId: 'hold:runner', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
    bases: (['home', 'first', 'second', 'third'] as const).map(base => ({ base,
      history: history(base === startingBase ? [[0, firstTouch + 1]] : []) })),
  }] };
  const input = { ...h.input, field, playEnd: createPlayEndFact(field.evidence.horizon.ball.tick, 'live_action_complete'),
    occupiedRunnerEvidence: runnerEvidence };
  const set = (base: 'home' | 'first' | 'second' | 'third', episodes: readonly (readonly [number, number])[]) => {
    runnerEvidence.runners[0].bases.find(value => value.base === base)!.history = history(episodes);
  };
  const scoring = (basesAfter: CanonicalMatchState['bases'], scoredRunnerIds: string[] = []) => ({ kind: 'live_ball' as const,
    match: before, timeline: projected({ originalTimeline: input.originalTimeline, field, playEnd: input.playEnd }), adjudication: closed(before, input, { outsAfter: outs + 1, basesAfter, scoredRunnerIds }),
    fairCatchEvidence: input });
  return { before, input, runnerEvidence, set, scoring, firstTouch, horizon, history };
};

it('FC10 scores a completed legal tag-up advancement from exact histories', () => {
  const h = movingRequest();
  h.set('second', [[h.firstTouch + 2, h.horizon]]);
  expect(classifyClosedPlayForOfficialScoring(h.scoring({ first: null, second: 'runner', third: null })))
    .toMatchObject({ kind: 'supported', record: { classification: 'fly_out', runsScored: 0 } });
});

const runnerOutcome = (h: ReturnType<typeof movingRequest>) => deriveActualFairCatchOccupiedRunnerOutcome({
  originalMatch: h.before, field: h.input.field, runnerEvidence: h.runnerEvidence });

it('FC11 resolves an original-base return after exact retouch without pretending the excursion was stationary', () => {
  const h = movingRequest();
  h.set('first', [[0, h.firstTouch / 2], [h.firstTouch + 2, h.horizon]]);
  expect(runnerOutcome(h)).toMatchObject({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1',
    finalRunnerLedger: { bases: h.before.bases, scoredRunnerIds: [], retiredRunnerIds: ['batter'] },
    runnerClaims: [{ kind: 'base', base: 'first', tagUpCompliance: { kind: 'compliant', basis: 'retouched_after_first_touch' } }] });
  expect(classifyClosedPlayForOfficialScoring(h.scoring(h.before.bases))).toMatchObject({ kind: 'supported' });
});

it('FC12 derives one run from a complete legal route and rechecks the closed official score', () => {
  const h = movingRequest();
  h.set('second', [[h.firstTouch + 2, h.firstTouch + 3]]);
  h.set('third', [[h.firstTouch + 4, h.firstTouch + 5]]);
  h.set('home', [[h.firstTouch + 6, h.firstTouch + 7]]);
  const empty = { first: null, second: null, third: null };
  expect(runnerOutcome(h)).toMatchObject({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1',
    finalRunnerLedger: { bases: empty, scoredRunnerIds: ['runner'], retiredRunnerIds: ['batter'] } });
  expect(classifyClosedPlayForOfficialScoring(h.scoring(empty, ['runner'])))
    .toMatchObject({ kind: 'supported', record: { runsScored: 1, hitsCredited: 0 } });
  expect(() => classifyClosedPlayForOfficialScoring(h.scoring(empty))).toThrow(/closed runner outcome/);
});

it.each([
  ['raw home touch', 'missing_sequential_touch'],
  ['skipped second', 'missing_sequential_touch'],
  ['early departure', 'tag_up_or_retouch_unresolved'],
  ['between bases', 'stopped_between_bases'],
  ['return after advancement', 'unsupported_reverse_entitlement'],
  ['reverse base', 'unsupported_reverse_entitlement'],
  ['simultaneous bases', 'conflicting_base_contacts'],
] as const)('FC13 keeps %s unresolved without erasing runners or inventing appeal outs', (fault, reason) => {
  const h = movingRequest(fault === 'reverse base' ? 'second' : 'first');
  if (fault === 'raw home touch') h.set('home', [[h.firstTouch + 2, h.horizon]]);
  if (fault === 'skipped second') h.set('third', [[h.firstTouch + 2, h.horizon]]);
  if (fault === 'early departure') { h.set('first', [[0, h.firstTouch / 2]]); h.set('second', [[h.firstTouch + 2, h.horizon]]); }
  if (fault === 'return after advancement') {
    h.set('second', [[h.firstTouch + 2, h.firstTouch + 3]]);
    h.set('first', [[0, h.firstTouch + 1], [h.firstTouch + 4, h.horizon]]);
  }
  if (fault === 'reverse base') h.set('first', [[h.firstTouch + 2, h.horizon]]);
  if (fault === 'simultaneous bases') h.set('second', [[h.firstTouch, h.horizon]]);
  expect(runnerOutcome(h)).toEqual({ kind: 'pending', reason });
});

it('FC14 does not score a legal home route against the third-out catch or invent the suppressed runner base', () => {
  const h = movingRequest('third', 2);
  h.set('home', [[h.firstTouch + 2, h.firstTouch + 3]]);
  expect(runnerOutcome(h)).toEqual({ kind: 'pending', reason: 'third_out_runner_entitlement_unresolved' });
  expect(() => classifyClosedPlayForOfficialScoring(h.scoring({ first: null, second: null, third: null }, ['runner']))).toThrow();
});

it('FC15 validates participation while movement is unresolved, requiring complete original histories', () => {
  const h = movingRequest();
  const input = { originalMatch: h.before, batterRunnerId: 'batter', originTick: h.input.field.evidence.originTick,
    ticksPerSecond: h.input.field.evidence.ticksPerSecond, endElapsedSeconds: h.horizon, runnerEvidence: h.runnerEvidence };
  expect(() => validateActualFairCatchOccupiedRunnerEvidence(input)).not.toThrow();
  expect(runnerOutcome(h)).toEqual({ kind: 'pending', reason: 'stopped_between_bases' });
  for (const change of [
    (proof: typeof h.runnerEvidence) => { proof.runners[0].bases.pop(); },
    (proof: typeof h.runnerEvidence) => { proof.runners[0].bases[0] = proof.runners[0].bases[1]; },
    (proof: typeof h.runnerEvidence) => { proof.runners[0].playerId = 'foreign'; },
    (proof: typeof h.runnerEvidence) => { proof.runners[0].holdReference.sourceHash = 'unsupported'; },
    (proof: typeof h.runnerEvidence) => { proof.runners[0].bases[0].history = { ...proof.runners[0].bases[0].history, startElapsedSeconds: 1 }; },
  ]) { const runnerEvidence = structuredClone(h.runnerEvidence); change(runnerEvidence);
    expect(() => validateActualFairCatchOccupiedRunnerEvidence({ ...input, runnerEvidence })).toThrow(); }
});

it('FC16 leaves contested multi-runner occupancy and original precedence unresolved in either evidence order', () => {
  const h = movingRequest();
  h.set('second', [[h.firstTouch + 2, h.horizon]]);
  const ahead = structuredClone(h.runnerEvidence.runners[0]);
  ahead.playerId = 'ahead'; ahead.startingBase = 'second'; ahead.holdReference.sourceId = 'hold:ahead';
  ahead.bases = ahead.bases.map(entry => ({ base: entry.base,
    history: { ...h.history(entry.base === 'second' ? [[0, h.horizon]] : []), playerId: 'ahead' } }));
  const before = { ...h.before, bases: { first: 'runner', second: 'ahead', third: null } };
  for (const runners of [[h.runnerEvidence.runners[0], ahead], [ahead, h.runnerEvidence.runners[0]]]) {
    expect(deriveActualFairCatchOccupiedRunnerOutcome({ originalMatch: before, field: h.input.field,
      runnerEvidence: { ...h.runnerEvidence, runners } })).toEqual({ kind: 'pending', reason: 'occupancy_conflict' });
  }
});

it('FC17 returns the same immutable supported ledger after runner/base evidence reorder', () => {
  const h = movingRequest(); h.set('second', [[h.firstTouch + 2, h.horizon]]);
  const ahead = structuredClone(h.runnerEvidence.runners[0]);
  ahead.playerId = 'ahead'; ahead.startingBase = 'third'; ahead.holdReference.sourceId = 'hold:ahead';
  ahead.bases = ahead.bases.map(entry => ({ base: entry.base,
    history: { ...h.history(entry.base === 'third' ? [[0, h.horizon]] : []), playerId: 'ahead' } }));
  const input = { originalMatch: { ...h.before, bases: { first: 'runner', second: null, third: 'ahead' } },
    field: h.input.field, runnerEvidence: { ...h.runnerEvidence, runners: [h.runnerEvidence.runners[0], ahead] } };
  const bytes = JSON.stringify(input), outcome = deriveActualFairCatchOccupiedRunnerOutcome(input);
  expect(outcome).toMatchObject({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1',
    finalRunnerLedger: { bases: { first: null, second: 'runner', third: 'ahead' }, scoredRunnerIds: [], retiredRunnerIds: ['batter'] } });
  expect(JSON.stringify(input)).toBe(bytes);
  const reordered = structuredClone(input); reordered.runnerEvidence.runners.reverse();
  reordered.runnerEvidence.runners.forEach(runner => runner.bases.reverse());
  expect(deriveActualFairCatchOccupiedRunnerOutcome(reordered)).toEqual(outcome);
  expect(Object.isFrozen(outcome)).toBe(true);
});

it('FC18 rejects competing stationary and moving sidecars and a forged original-base final ruling', () => {
  const h = movingRequest(); h.set('second', [[h.firstTouch + 2, h.horizon]]);
  expect(() => classifyClosedPlayForOfficialScoring(h.scoring(h.before.bases))).toThrow(/closed runner outcome/);
  const good = h.scoring({ first: null, second: 'runner', third: null });
  expect(() => classifyClosedPlayForOfficialScoring({ ...good, fairCatchEvidence: {
    ...good.fairCatchEvidence, occupiedRunners: occupiedRequest().input.occupiedRunners } })).toThrow(/competing runner/);
});


const appealFor = (h: ReturnType<typeof movingRequest>): ActualFairCatchRunnerAppealEvidence => {
  const executedAtElapsedSeconds = h.firstTouch + 3, clock = h.input.field.evidence;
  const original = h.runnerEvidence.runners[0].bases.find(entry => entry.base === h.runnerEvidence.runners[0].startingBase)!.history;
  const episodes = original.episodes.filter(episode => episode.startElapsedSeconds <= executedAtElapsedSeconds)
    .map(episode => ({ ...episode, endElapsedSeconds: Math.min(episode.endElapsedSeconds, executedAtElapsedSeconds) }));
  const history = { ...h.history(episodes.map(episode => [episode.startElapsedSeconds, episode.endElapsedSeconds])),
    endElapsedSeconds: executedAtElapsedSeconds, contactAtHorizon: episodes.at(-1)?.endElapsedSeconds === executedAtElapsedSeconds,
    events: original.events.filter(event => event.elapsedSeconds < executedAtElapsedSeconds
      || event.kind === 'touch' && event.elapsedSeconds === executedAtElapsedSeconds) };
  const reference = (owner: string) => ({ owner, sourceId: owner, sourceVersion: 'author-fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
  return { executionReference: { owner: 'pa_physical_v1_field_steps', sourceId: 'appeal-execution', sourceHash: 'c'.repeat(64), snapshotHash: 'd'.repeat(64) },
    clock: { originTick: clock.originTick, ticksPerSecond: clock.ticksPerSecond }, indicatedAtElapsedSeconds: h.firstTouch + 2,
    executedAtElapsedSeconds, evaluatedThroughElapsedSeconds: h.horizon,
    attempt: { kind: 'defensive_appeal_attempt', defenderId: 'carrier', runnerId: 'runner',
      base: ({ first: 1, second: 2, third: 3 } as const)[h.runnerEvidence.runners[0].startingBase], reason: 'tag_up_early_departure',
      tick: quantizeEventTick(clock.originTick, executedAtElapsedSeconds, clock.ticksPerSecond) },
    complianceEvidence: { kind: 'ball_world_tag_up_history_v1', history, originBase: h.runnerEvidence.runners[0].startingBase,
      firstTouch: { originTick: clock.originTick, elapsedSeconds: h.firstTouch,
        fact: { kind: 'fly_ball_first_fielder_touch', fielderId: 'carrier', tick: clock.contacts[0].moment.ball.tick } } },
    evidence: { version: 'owned_live_appeal_rights_evidence_v1',
      liveAtExecution: { kind: 'live', playDeclaration: reference('play'),
        at: { originTick: clock.originTick, elapsedSeconds: 0, tick: clock.originTick }, coveredThroughElapsedSeconds: h.horizon },
      window: { openedAtElapsedSeconds: 0, closedAtElapsedSeconds: null, closeReason: null }, appealThrowForfeitures: [] } };
};
const appealedOutcome = (h: ReturnType<typeof movingRequest>, appeals = [appealFor(h)]) => deriveActualFairCatchOccupiedRunnerOutcome({
  originalMatch: h.before, field: h.input.field, runnerEvidence: { ...h.runnerEvidence, appeals } });

it.each([0, 1] as const)('FC19 retires only an actual eligible appealed runner at %s initial outs, preserving the original prefix', outs => {
  const h = movingRequest('first', outs);
  h.set('first', [[0, h.firstTouch / 2], [h.firstTouch + 5, h.horizon]]);
  const outcome = appealedOutcome(h), empty = { first: null, second: null, third: null };
  expect(outcome).toMatchObject({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1',
    correctRuling: { outsAfter: outs + 2, basesAfter: empty, scoredRunnerIds: [] },
    finalRunnerLedger: { bases: empty, retiredRunnerIds: ['batter', 'runner'], scoredRunnerIds: [] },
    appeals: [{ disposition: { kind: 'eligible', result: { kind: 'out' } } }] });
  const request = h.scoring(empty);
  expect(classifyClosedPlayForOfficialScoring({ ...request,
    adjudication: closed(h.before, h.input, { outsAfter: outs + 2, basesAfter: empty, scoredRunnerIds: [] }),
    fairCatchEvidence: { ...h.input, occupiedRunnerEvidence: { ...h.runnerEvidence, appeals: [appealFor(h)] } } }))
    .toMatchObject({ kind: 'supported', record: { classification: 'fly_out', runsScored: 0 } });
});

it('FC20 refuses a bare departure as OUT and preserves ineligible appeal dispositions', () => {
  const h = movingRequest(); h.set('first', [[0, h.firstTouch / 2], [h.firstTouch + 5, h.horizon]]);
  expect(runnerOutcome(h)).toMatchObject({ finalRunnerLedger: { retiredRunnerIds: ['batter'] } });
  const appeal = appealFor(h), expired = { ...appeal, evidence: { ...appeal.evidence,
    window: { openedAtElapsedSeconds: 0, closedAtElapsedSeconds: h.firstTouch + 2.5, closeReason: 'next_pitch_or_play' as const } } };
  expect(appealedOutcome(h, [expired])).toMatchObject({ finalRunnerLedger: { bases: h.before.bases, retiredRunnerIds: ['batter'] },
    appeals: [{ disposition: { kind: 'ineligible', reason: 'appeal_window_expired' } }] });
});

it('FC21 accepts a timely no-violation appeal without a runner retirement', () => {
  const h = movingRequest(); h.set('first', [[0, h.horizon]]);
  expect(appealedOutcome(h)).toMatchObject({ finalRunnerLedger: { bases: h.before.bases, retiredRunnerIds: ['batter'] },
    appeals: [{ disposition: { kind: 'eligible', result: { kind: 'no_violation' } } }] });
});

it('FC22 rejects replaced execution history, mismatched first touch, and duplicated execution identity', () => {
  const h = movingRequest(); h.set('first', [[0, h.firstTouch / 2], [h.firstTouch + 5, h.horizon]]);
  const appeal = appealFor(h);
  expect(() => appealedOutcome(h, [appeal, appeal])).toThrow(/execution identity/);
  expect(() => appealedOutcome(h, [{ ...appeal, complianceEvidence: { ...appeal.complianceEvidence,
    history: h.runnerEvidence.runners[0].bases.find(entry => entry.base === 'first')!.history } }])).toThrow(/execution prefix/);
  expect(() => appealedOutcome(h, [{ ...appeal, complianceEvidence: { ...appeal.complianceEvidence,
    firstTouch: { ...appeal.complianceEvidence.firstTouch, fact: { ...appeal.complianceEvidence.firstTouch.fact, fielderId: 'receiver' } } } }]))
    .toThrow(/first touch/);
});

it('FC23 keeps unresolved original appeal rights and simultaneous appeal ordering pending', () => {
  const h = movingRequest(); h.set('first', [[0, h.firstTouch / 2]]);
  const appeal = appealFor(h), unknown = { ...appeal, evidence: { ...appeal.evidence,
    liveAtExecution: { kind: 'unknown' as const, reason: 'initial_live_ball_owner_missing' as const } } };
  expect(appealedOutcome(h, [unknown])).toEqual({ kind: 'pending', reason: 'appeal_rights_unresolved' });
  expect(appealedOutcome(h, [appeal, { ...appeal, executionReference: { ...appeal.executionReference, sourceId: 'other-execution' } }]))
    .toEqual({ kind: 'pending', reason: 'appeal_ordering_unresolved' });
});

it.each(['before', 'after'] as const)('FC24 applies the actual third-out appeal to the preceding runner home attainment %s execution', when => {
  const h = movingRequest('first', 1); h.set('first', [[0, h.firstTouch / 2]]);
  const ahead = structuredClone(h.runnerEvidence.runners[0]), homeAt = h.firstTouch + (when === 'before' ? 2 : 4);
  ahead.playerId = 'ahead'; ahead.startingBase = 'third'; ahead.holdReference.sourceId = 'hold:ahead';
  ahead.bases = ahead.bases.map(entry => ({ base: entry.base, history: { ...h.history(entry.base === 'third'
    ? [[0, h.firstTouch + 1]] : entry.base === 'home' ? [[homeAt, homeAt + 0.5]] : []), playerId: 'ahead' } }));
  const outcome = deriveActualFairCatchOccupiedRunnerOutcome({ originalMatch: { ...h.before,
    bases: { first: 'runner', second: null, third: 'ahead' } }, field: h.input.field,
  runnerEvidence: { ...h.runnerEvidence, runners: [h.runnerEvidence.runners[0], ahead], appeals: [appealFor(h)] } });
  if (when === 'after') expect(outcome).toEqual({ kind: 'pending', reason: 'third_out_runner_entitlement_unresolved' });
  else expect(outcome).toMatchObject({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1',
    finalRunnerLedger: { bases: { first: null, second: null, third: null }, scoredRunnerIds: ['ahead'], retiredRunnerIds: ['batter', 'runner'] },
    correctRuling: { outsAfter: 3, scoredRunnerIds: ['ahead'] }, appealOutScoring: { kind: 'resolved', suppressed: [], scored: [{ runnerId: 'ahead' }] } });
});
