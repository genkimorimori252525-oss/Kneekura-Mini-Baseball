import { expect, it } from 'vitest';
import * as publicApi from './index';
import * as ledgerApi from './PlayAdjudicationLedger';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { NPB_2026_RULE_PROFILE } from '../rules/RuleProfile';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../rules/PhysicalRuleFacts';
import { evaluateBallWorldTagUpCompliance } from '../rules/BallWorldTagUpCompliance';
import { deriveBallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import { quantizeEventTick } from '../sim/ExactEventTime';

const ruling = { outsAfter: 1, basesAfter: { first: 'runner', second: null, third: null }, scoredRunnerIds: [] };
const root = () => ledgerApi.createPlayAdjudicationLedger({ playId: 7, ruleProfileId: NPB_2026_RULE_PROFILE.id,
  playEnd: { kind: 'play_end', tick: 2_000_000, reason: 'live_action_complete' } });
const initial = () => ledgerApi.recordCorrectRuleSnapshot(root(), 0, { eventId: 'truth', tick: 2_000_000,
  snapshotId: 'rule-1', evidenceRevision: 1, ruling });
const reference = (owner: string) => ({ owner, sourceId: `${owner}-source`, sourceVersion: 'fixture-v1',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const evidence = (end = 1, held = false): ledgerApi.BallWorldAppealComplianceEvidence => {
  const history = deriveBallWorldPlayerBaseContactHistory({ playerId: 'runner',
    base: { center: { x: 0, z: 0 }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
    segments: [{ originTick: 0, startElapsedSeconds: 0, endElapsedSeconds: end,
      actors: (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'runner', primitive: {
        role, radius: 0.05, startTick: 0, endTick: quantizeEventTick(0, end, 1_000_000), ticksPerSecond: 1_000_000,
        startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: held ? 0 : 1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })) }] });
  return { kind: 'ball_world_tag_up_history_v1', history, originBase: 'first',
    firstTouch: { originTick: 0, elapsedSeconds: 0.5, fact: createFlyBallFirstFielderTouchFact('catcher', 500_000) } };
};
const input = () => ({ eventId: 'live-appeal', tick: 2_000_000,
  attempt: createDefensiveAppealAttemptFact('fielder', 'runner', 1, 'tag_up_early_departure', 1_000_000),
  complianceEvidence: evidence(),
  provenance: { version: 'owned_live_appeal_import_v1', playId: 7, gameId: 'game', physicalPitchSourceId: 'pitch',
    clock: { originTick: 0, ticksPerSecond: 1_000_000 }, indicatedAtElapsedSeconds: 0.75,
    executedAtElapsedSeconds: 1, importedAtElapsedSeconds: 2,
    indication: reference('indications'), throwPlan: reference('throw_plans'), execution: reference('executions') },
  rights: { kind: 'pending', reason: 'original_live_ball_and_appeal_rights_required' } });
const record = (...args: any[]) => (ledgerApi as any).recordOwnedLiveAppealImport(...args);
const pending = (value: ledgerApi.PlayAdjudicationLedger) => (ledgerApi as any).getPendingOwnedLiveAppealImports(value);
const close = (value: ledgerApi.PlayAdjudicationLedger) => ledgerApi.closeOfficialPlay(value, value.revision,
  { eventId: 'close', tick: 2_000_010, closureId: 'closure' });

it('imports the earlier physical execution and its exact history without a synthetic official window or result', () => {
  expect((ledgerApi as any).recordOwnedLiveAppealImport).toBeTypeOf('function');
  const before = initial(), bytes = JSON.stringify(before), request = input(), value = record(before, before.revision, request);
  expect(value.events.at(-1)).toEqual({ kind: 'OwnedLiveAppealImported', ...request });
  expect(value.events.at(-1).tick).toBe(2_000_000);
  expect(value.events.at(-1).attempt.tick).toBe(1_000_000);
  expect(value.events.at(-1).complianceEvidence.history.endElapsedSeconds).toBe(1);
  expect(value.playEnd).toEqual(before.playEnd);
  expect(evaluateBallWorldTagUpCompliance(value.events.at(-1).complianceEvidence).kind).toBe('appealable_early_departure');
  expect(value.events.at(-1)).not.toHaveProperty('result');
  expect(value.events.at(-1)).not.toHaveProperty('timing');
  expect(ledgerApi.getPlayAdjudicationState(value)).toEqual(ledgerApi.getPlayAdjudicationState(before));
  expect(ledgerApi.getOfficialStateWindows(value)).toEqual([]);
  expect(pending(value)).toEqual([value.events.at(-1)]);
  expect(pending(JSON.parse(JSON.stringify(value)))).toEqual(pending(value));
  expect(JSON.stringify(before)).toBe(bytes);
  expect(() => close(value)).toThrow(/original live-ball and appeal rights/);
});

it('retains the execution dependency through newer snapshots, calls and reviews without deciding appeal OUT', () => {
  let value = record(initial(), 1, input());
  value = ledgerApi.recordCorrectRuleSnapshot(value, value.revision, { eventId: 'new-truth', tick: 2_000_001,
    snapshotId: 'rule-2', evidenceRevision: 2, ruling });
  value = ledgerApi.recordOnFieldCall(value, value.revision, { eventId: 'new-call', tick: 2_000_002,
    callId: 'call-2', basisSnapshotId: 'rule-2', basisEvidenceRevision: 2, ruling });
  value = ledgerApi.recordReviewDecision(value, value.revision, { eventId: 'review', tick: 2_000_003,
    reviewId: 'review-2', callId: 'call-2', basisSnapshotId: 'rule-2', basisEvidenceRevision: 2,
    decision: 'confirmed', replacementRuling: null });
  expect(pending(value)).toHaveLength(1);
  expect(() => close(value)).toThrow(/original live-ball and appeal rights/);
  const forged = JSON.parse(JSON.stringify(value));
  forged.events.push({ kind: 'OfficialPlayClosed', eventId: 'forged-close', tick: 2_000_010,
    closureId: 'closure', basisRulingId: 'review-2', basisEvidenceRevision: 2 });
  forged.revision++;
  expect(() => ledgerApi.getOfficialPlayClosure(forged)).toThrow(/original live-ball and appeal rights/);
});

it('does not treat compliance at execution as authenticated rights or allow later compliant history to replace the prefix', () => {
  const request = input(); request.complianceEvidence = evidence(1, true);
  const value = record(initial(), 1, request);
  expect(evaluateBallWorldTagUpCompliance(value.events.at(-1).complianceEvidence).kind).toBe('compliant');
  expect(() => close(value)).toThrow(/original live-ball and appeal rights/);
  request.complianceEvidence = evidence(2, true);
  expect(() => record(initial(), 1, request)).toThrow(/execution|history/);
});

const invalid: [string, (value: any) => void][] = [
  ['unknown rights owner', v => { v.rights = { kind: 'ready', timely: true }; }],
  ['unknown rights reason', v => { v.rights.reason = 'assumed'; }],
  ['unproven rights field', v => { v.rights.forfeited = false; }],
  ['synthetic rule result', v => { v.result = { kind: 'out' }; }],
  ['synthetic official window', v => { v.windowId = 'invented'; }],
  ['wrong play', v => { v.provenance.playId = 8; }],
  ['unsupported version', v => { v.provenance.version = 'owned_live_appeal_import_v2'; }],
  ['empty game', v => { v.provenance.gameId = ''; }],
  ['whitespace pitch identity', v => { v.provenance.physicalPitchSourceId = ' pitch '; }],
  ['unknown provenance field', v => { v.provenance.legal = true; }],
  ['invalid clock', v => { v.provenance.clock.ticksPerSecond = 0; }],
  ['foreign history clock', v => { v.provenance.clock.originTick = 1; }],
  ['negative indication time', v => { v.provenance.indicatedAtElapsedSeconds = -1; }],
  ['same-tick indication after execution', v => { v.provenance.indicatedAtElapsedSeconds = 1 + 1e-12; }],
  ['same-tick history after execution', v => { v.complianceEvidence = evidence(1 + 1e-12); }],
  ['history before execution', v => { v.complianceEvidence = evidence(0.9); }],
  ['future first touch', v => { v.complianceEvidence.firstTouch.elapsedSeconds = 1 + 1e-12; }],
  ['execution clock mismatch', v => { v.attempt.tick++; }],
  ['execution after PlayEnd', v => { v.provenance.executedAtElapsedSeconds = 2.1; v.attempt.tick = 2_100_000; v.complianceEvidence = evidence(2.1); }],
  ['recording clock mismatch', v => { v.provenance.importedAtElapsedSeconds = 2.1; }],
  ['import before execution', v => { v.provenance.importedAtElapsedSeconds = 0.9; }],
  ['foreign runner', v => { v.attempt.runnerId = 'other'; }],
  ['foreign base', v => { v.attempt.base = 2; }],
  ['unknown attempt field', v => { v.attempt.out = true; }],
  ['missing original contact', v => { v.complianceEvidence.history.contactAtStart = false; }],
  ['invalid source hash', v => { v.provenance.execution.sourceHash = 'unproven'; }],
  ['unknown Source field', v => { v.provenance.indication.timely = true; }],
  ['duplicate original Source identity', v => { v.provenance.throwPlan = { ...v.provenance.indication, sourceHash: 'c'.repeat(64) }; }],
];
it.each(invalid)('rejects %s both on admission and serialized replay', (_name, change) => {
  const request = structuredClone(input()); change(request);
  expect(() => record(initial(), 1, request)).toThrow();
  const forged = JSON.parse(JSON.stringify(record(initial(), 1, input()))); change(forged.events.at(-1));
  expect(() => ledgerApi.getPlayAdjudicationState(forged)).toThrow();
});

it('requires registered profile, physical PlayEnd, prior rule evidence and fresh ledger revision', () => {
  expect(() => record(root(), 0, input())).toThrow(/correct-rule snapshot/);
  expect(() => record({ ...initial(), playEnd: null }, 1, input())).toThrow(/PlayEnd/);
  expect(() => record({ ...initial(), ruleProfileId: asRuleProfileId('unknown') }, 1, input())).toThrow(/rule profile/);
  expect(() => record(initial(), 0, input())).toThrow(/revision/);
  expect(() => record(initial(), 1, { ...input(), eventId: 'truth' })).toThrow(/unique/);
  const unresolved = ledgerApi.recordUnresolvedCorrectRuleSnapshot(root(), 0, { eventId: 'unresolved', tick: 2_000_000,
    snapshotId: 'rule-1', evidenceRevision: 1, reason: 'insufficient_evidence' });
  expect(pending(record(unresolved, 1, input()))).toHaveLength(1);
});

it('deduplicates original execution identity even when the recording event, hashes or source version change', () => {
  const value = record(initial(), 1, input());
  const request = input(); request.eventId = 'duplicate';
  request.provenance.execution = { ...request.provenance.execution, sourceVersion: 'different', sourceHash: 'c'.repeat(64) };
  expect(() => record(value, value.revision, request)).toThrow(/execution.*already imported/);
  const forged = JSON.parse(JSON.stringify(value)); forged.events.push({ kind: 'OwnedLiveAppealImported', ...request }); forged.revision++;
  expect(() => pending(forged)).toThrow(/execution.*already imported/);
});

it('snapshots inert evidence and exposes the additive API without changing old closure state shapes', () => {
  const request: any = structuredClone(input()), value = record(initial(), 1, request), bytes = JSON.stringify(value);
  request.provenance.execution.sourceId = 'changed'; request.complianceEvidence.history.endElapsedSeconds = 2;
  expect(JSON.stringify(value)).toBe(bytes);
  expect(Object.isFrozen(value.events.at(-1).complianceEvidence.history.episodes[0])).toBe(true);
  expect(Object.isFrozen(value.events.at(-1).provenance.execution)).toBe(true);
  expect(Object.isFrozen(value.events.at(-1).rights)).toBe(true);
  expect(Object.isFrozen(pending(value))).toBe(true);
  let called = 0; const hostile = input();
  Object.defineProperty(hostile.provenance, 'execution', { enumerable: true, get() { called++; return reference('active'); } });
  expect(() => record(initial(), 1, hostile)).toThrow(); expect(called).toBe(0);
  expect((publicApi as any).recordOwnedLiveAppealImport).toBe((ledgerApi as any).recordOwnedLiveAppealImport);
  expect((publicApi as any).getPendingOwnedLiveAppealImports).toBe((ledgerApi as any).getPendingOwnedLiveAppealImports);
  expect(pending(initial())).toEqual([]);
  expect(pending(close(initial()))).toEqual([]);
});

it('keeps the legacy attempt path dependent on its real post-play window and original PlayEnd history', () => {
  const before = initial(), request = input();
  expect(() => ledgerApi.recordDefensiveAppealAttempt(before, before.revision, { eventId: 'legacy', windowId: 'missing',
    timing: 'timely', attempt: request.attempt, complianceEvidence: request.complianceEvidence })).toThrow(/monotonic|window/);
  const opened = ledgerApi.openOfficialStateWindow(before, before.revision, { eventId: 'open', tick: 2_000_000,
    windowId: 'appeal', windowKind: 'appeal' });
  expect(() => ledgerApi.recordDefensiveAppealAttempt(opened, opened.revision, { eventId: 'legacy', windowId: 'appeal',
    timing: 'timely', attempt: { ...request.attempt, tick: 2_000_001 }, complianceEvidence: request.complianceEvidence })).toThrow(/original physical PlayEnd/);
});
