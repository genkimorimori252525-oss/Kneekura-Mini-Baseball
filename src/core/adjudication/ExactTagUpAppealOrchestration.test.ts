import { expect, it } from 'vitest';
import { deriveBallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../rules/PhysicalRuleFacts';
import { NPB_2026_RULE_PROFILE } from '../rules/RuleProfile';
import { openRuleProfileOfficialStateWindow } from './OfficialWindowPolicy';
import { closeOfficialPlay, closeOfficialStateWindow, createPlayAdjudicationLedger, getPlayAdjudicationState,
  recordCorrectRuleSnapshot, type BallWorldAppealComplianceEvidence } from './PlayAdjudicationLedger';
import { orchestrateTagUpAppealAttempt, type ExactTagUpAppealAttemptInput } from './TagUpAppealOrchestration';
const profile = NPB_2026_RULE_PROFILE;
const evidence = (held = false, end = 2): BallWorldAppealComplianceEvidence => {
  const history = deriveBallWorldPlayerBaseContactHistory({ playerId: 'runner',
    base: { center: { x: 0, z: 0 }, halfSize: { x: 0.2500001, z: 0.25 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
    segments: [{ originTick: 0, startElapsedSeconds: 0, endElapsedSeconds: end,
      actors: (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'runner', primitive: {
        role, radius: 0.05, startTick: 0, endTick: end * 1_000_000, ticksPerSecond: 1_000_000,
        startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: held ? 0 : 1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })) }] });
  const elapsedSeconds = held ? 0.25 : history.events[1].elapsedSeconds + 1e-10;
  return { kind: 'ball_world_tag_up_history_v1', history, originBase: 'first', firstTouch: { originTick: 0, elapsedSeconds,
    fact: createFlyBallFirstFielderTouchFact('fielder', quantizeEventTick(0, elapsedSeconds, 1_000_000)) } };
};
const initial = () => {
  let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId: profile.id,
    playEnd: { kind: 'play_end', tick: 2_000_000, reason: 'live_action_complete' } });
  ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'rule', tick: 2_000_000, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: 1, basesAfter: { first: 'runner', second: null, third: null }, scoredRunnerIds: [] } });
  return openRuleProfileOfficialStateWindow(ledger, 1, { profile, eventId: 'open', tick: 2_000_001, windowId: 'appeal', windowKind: 'appeal' });
};
const request = (complianceEvidence = evidence(), tick = 2_000_002): ExactTagUpAppealAttemptInput => ({ profile, eventId: 'attempt', windowId: 'appeal',
  attempt: createDefensiveAppealAttemptFact('fielder', 'runner', 1, 'tag_up_early_departure', tick), complianceEvidence });
it('ETA01 consumes exact original history without rounding an early departure into compliance', () => {
  const input = request(); expect(input.complianceEvidence.history.events[1].tick).toBe(input.complianceEvidence.firstTouch.fact.tick);
  const before = initial(), result = orchestrateTagUpAppealAttempt(before, before.revision, input);
  expect(result.compliance.kind).toBe('appealable_early_departure'); expect(result.result.kind).toBe('out');
  expect(result.ledger.events.at(-1)).toMatchObject({ kind: 'DefensiveAppealAttemptRecorded', complianceEvidence: input.complianceEvidence });
  expect(before.events).toHaveLength(2);
  expect(() => closeOfficialPlay(result.ledger, result.ledger.revision,
    { eventId: 'close', closureId: 'closure', tick: 2_000_003 })).toThrow(/newer correct-rule snapshot|window/);
});
it('ETA02 consumes continuous contact without fabricating a departure or retouch event', () => {
  const input = request(evidence(true)), before = initial(), result = orchestrateTagUpAppealAttempt(before, before.revision, input);
  expect(result.compliance).toMatchObject({ kind: 'compliant', basis: 'contact_at_first_fielder_touch' });
  expect(result.result.kind).toBe('no_violation');
  expect((result.ledger.events.at(-1) as any).complianceEvidence.history.events).toEqual(input.complianceEvidence.history.events);
  expect((result.ledger.events.at(-1) as any).complianceEvidence.history.events).toHaveLength(1);
});
it.each(['expired', 'simultaneous_unresolved'] as const)('ETA03 preserves original RuleProfile %s appeal-window timing', timing => {
  const old = initial(), closed = closeOfficialStateWindow(old, old.revision, { eventId: 'fence', tick: 2_000_002,
    windowId: 'appeal', reason: 'next_play_fence' });
  const result = orchestrateTagUpAppealAttempt(closed, closed.revision, request(evidence(), timing === 'expired' ? 2_000_003 : 2_000_002));
  expect(result.result.kind).toBe(timing === 'expired' ? 'appeal_expired' : 'simultaneous_unresolved');
  expect(result.ledger.events.at(-1)).toHaveProperty('timing', timing);
});
it.each(['runner', 'base', 'future_physical_history', 'recorded_tick', 'missing_initial_contact', 'fielder_identity'] as const)
('ETA04 rejects %s without appending an appeal', fault => {
  const input: any = request(), before = initial();
  if (fault === 'runner') input.attempt = { ...input.attempt, runnerId: 'foreign' };
  if (fault === 'base') input.attempt = { ...input.attempt, base: 2 };
  if (fault === 'future_physical_history') input.complianceEvidence = evidence(false, 3);
  if (fault === 'recorded_tick') input.complianceEvidence.firstTouch.fact = { ...input.complianceEvidence.firstTouch.fact, tick: 12 };
  if (fault === 'missing_initial_contact') input.complianceEvidence.history = { ...input.complianceEvidence.history, contactAtStart: false };
  if (fault === 'fielder_identity') input.complianceEvidence.firstTouch.fact.fielderId = 123;
  expect(() => orchestrateTagUpAppealAttempt(before, before.revision, input)).toThrow(); expect(before.events).toHaveLength(2);
});
it.each(['recorded_tick', 'fielder_identity'] as const)('ETA05 validates persisted exact %s again during ledger replay', fault => {
  const before = initial(), result = orchestrateTagUpAppealAttempt(before, before.revision, request());
  const changed = structuredClone(result.ledger) as any;
  if (fault === 'recorded_tick') changed.events.at(-1).complianceEvidence.history.events[1].tick++;
  else changed.events.at(-1).complianceEvidence.firstTouch.fact.fielderId = 123;
  expect(() => getPlayAdjudicationState(changed)).toThrow(/chronology|clock|fielderId/);
});
