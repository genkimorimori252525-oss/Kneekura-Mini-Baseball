import { createHash } from 'node:crypto';
import * as publicApi from './index';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import * as ledgerApi from './PlayAdjudicationLedger';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordUnresolvedCorrectRuleSnapshot,
  getPlayAdjudicationState, closeOfficialPlay, getOfficialPlayClosure, recordReviewDecision } from './PlayAdjudicationLedger';

const safe = { outsAfter: 0, basesAfter: { first: 'runner', second: null, third: null }, scoredRunnerIds: [] };
const out = { outsAfter: 1, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] };
const root = () => createPlayAdjudicationLedger({ playId: 7, ruleProfileId: asRuleProfileId('fixture'),
  playEnd: { kind: 'play_end', tick: 500, reason: 'live_action_complete' } });
const truth = () => recordCorrectRuleSnapshot(root(), 0, { eventId: 'truth', tick: 500,
  snapshotId: 'rule-1', evidenceRevision: 1, ruling: safe });
const ref = (owner: string) => ({ owner, sourceId: `${owner}-source`, sourceVersion: 'fixture-v1',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const input = () => ({ eventId: 'import', tick: 500,
  call: { callId: 'call', tick: 400, basisSnapshotId: 'rule-1', basisEvidenceRevision: 1, ruling: { ...out, basesAfter: { ...out.basesAfter }, scoredRunnerIds: [] } },
  provenance: { version: 'owned_live_call_import_v1', playId: 7, gameId: 'game', physicalPitchSourceId: 'pitch',
    clock: { originTick: 100, ticksPerSecond: 1000 }, calledAtElapsedSeconds: 0.3, availableAtElapsedSeconds: 0.31, importedAtElapsedSeconds: 0.4,
    call: ref('actual_calls'), perception: ref('actual_umpire_perceptions'), policy: ref('umpire_models'),
    ruleEvidence: ref('physical_rule_consumptions'), reception: null } });
const record = (...args: any[]) => (ledgerApi as any).recordOwnedLiveCallImport(...args);
const close = (v: ReturnType<typeof root>) => closeOfficialPlay(v, v.revision, { eventId: 'close', tick: 510, closureId: 'closure' });

it('imports the original live call after PlayEnd without retiming the call or changing physical truth', () => {
  expect((ledgerApi as any).recordOwnedLiveCallImport).toBeTypeOf('function');
  const original = truth(), before = JSON.stringify(original), request = input();
  const value = record(original, 1, request);
  expect(value.events[1]).toEqual({ kind: 'OwnedLiveCallImported', ...request });
  expect(getPlayAdjudicationState(value)).toMatchObject({ calls: [{ ...request.call }], latestCorrectRule: { ruling: safe } });
  expect(value.events[1].call.tick).toBe(400); expect(value.events[1].tick).toBe(500);
  expect(JSON.stringify(original)).toBe(before);
  expect(getPlayAdjudicationState(JSON.parse(JSON.stringify(value)))).toEqual(getPlayAdjudicationState(value));
  expect(getOfficialPlayClosure(close(value))).toMatchObject({ finalRuling: { source: 'on_field_call', gameplay: out },
    playEnd: original.playEnd });
  expect(Object.isFrozen(value.events[1].provenance.call)).toBe(true);
});

it('can preserve an unresolved basis without inventing a correct result', () => {
  const v = recordUnresolvedCorrectRuleSnapshot(root(), 0, { eventId: 'uncertain', tick: 500,
    snapshotId: 'rule-1', evidenceRevision: 1, reason: 'exact_simultaneity' });
  const value = record(v, 1, input());
  expect(value.events[0]).toEqual(v.events[0]);
  expect(getOfficialPlayClosure(close(value))?.finalRuling.gameplay).toEqual(out);
});

it('keeps a historical rule basis stale until a current-evidence review resolves it', () => {
  const current = recordCorrectRuleSnapshot(truth(), 1, { eventId: 'new-truth', tick: 500,
    snapshotId: 'rule-2', evidenceRevision: 2, ruling: safe });
  const value = record(current, 2, input());
  expect(() => close(value)).toThrow(/stale/);
  const reviewed = recordReviewDecision(value, 3, { eventId: 'review', tick: 505, reviewId: 'review-1',
    callId: 'call', basisSnapshotId: 'rule-2', basisEvidenceRevision: 2, decision: 'overturned', replacementRuling: safe });
  expect(getOfficialPlayClosure(close(reviewed))?.finalRuling.gameplay).toEqual(safe);
  expect(reviewed.events[2]).toEqual(value.events[2]);
});

const invalid: [string, (v: any) => void][] = [
  ['unknown call field', v => { v.call.perceivedResult = 'out'; }],
  ['unknown ruling field', v => { v.call.ruling.physicalResult = 'out'; }],
  ['array Source hash', v => { v.provenance.call.sourceHash = ['a'.repeat(64)]; }],
  ['wrong play', v => { v.provenance.playId = 8; }],
  ['empty game', v => { v.provenance.gameId = ''; }],
  ['whitespace pitch', v => { v.provenance.physicalPitchSourceId = ' pitch '; }],
  ['future version', v => { v.provenance.version = 'v2'; }],
  ['unknown provenance field', v => { v.provenance.result = 'out'; }],
  ['unsafe clock origin', v => { v.provenance.clock.originTick = Number.MAX_SAFE_INTEGER + 1; }],
  ['noninteger clock rate', v => { v.provenance.clock.ticksPerSecond = 0.5; }],
  ['nonpositive clock rate', v => { v.provenance.clock.ticksPerSecond = 0; }],
  ['negative exact call time', v => { v.provenance.calledAtElapsedSeconds = -1; }],
  ['call clock mismatch', v => { v.call.tick = 401; }],
  ['future live call', v => { v.call.tick = 501; v.provenance.calledAtElapsedSeconds = 0.401; v.provenance.availableAtElapsedSeconds = 0.402; }],
  ['availability precedes call', v => { v.provenance.availableAtElapsedSeconds = 0.3 - 1e-15; }],
  ['same-tick later availability', v => { v.provenance.availableAtElapsedSeconds = 0.4 + 1e-15; }],
  ['import clock mismatch', v => { v.provenance.importedAtElapsedSeconds = 0.401; }],
  ['unsafe imported clock', v => { v.provenance.importedAtElapsedSeconds = Number.MAX_VALUE; }],
  ['missing Source owner', v => { delete v.provenance.call.owner; }],
  ['invalid Source hash', v => { v.provenance.call.sourceHash = 'unverified'; }],
  ['invalid snapshot hash', v => { v.provenance.perception.snapshotHash = 'A'.repeat(64); }],
  ['unknown Source field', v => { v.provenance.policy.result = 'out'; }],
  ['missing rule basis', v => { v.call.basisSnapshotId = 'unknown'; }],
  ['wrong historical revision', v => { v.call.basisEvidenceRevision = 0; }],
];
it.each(invalid)('rejects %s on recording and serialized replay', (_name, change) => {
  const request = input(); change(request);
  expect(() => record(truth(), 1, request)).toThrow();
  const value = record(truth(), 1, input());
  const forged = JSON.parse(JSON.stringify(value)); change(forged.events[1]);
  expect(() => getPlayAdjudicationState(forged)).toThrow();
});

it('requires real physical PlayEnd and refuses duplicate, stale or reordered original-call import', () => {
  const original = truth(), value = record(original, 1, input());
  expect(() => record({ ...original, playEnd: null }, 1, input())).toThrow(/PlayEnd|physical/);
  expect(() => record(original, 0, input())).toThrow(/revision/);
  expect(() => record(value, 2, { ...input(), eventId: 'second', call: { ...input().call, callId: 'second-call' } })).toThrow(/original|call/);
  const ordinary = ledgerApi.recordOnFieldCall(original, 1, { eventId: 'later-call', tick: 500,
    callId: 'later', basisSnapshotId: 'rule-1', basisEvidenceRevision: 1, ruling: safe });
  expect(() => record(ordinary, 2, input())).toThrow(/original|call/);
  expect(() => record(original, 1, { ...input(), eventId: 'truth' })).toThrow(/unique/);
});

it('preserves a reception Source and snapshots caller input without executing accessors', () => {
  const request: any = input(); request.provenance.reception = ref('actual_received_calls');
  const value = record(truth(), 1, request), original = JSON.stringify(value);
  request.provenance.reception.sourceId = 'changed'; request.call.ruling.outsAfter = 3;
  expect(JSON.stringify(value)).toBe(original);
  expect(Object.isFrozen(value.events[1].provenance.reception)).toBe(true);
  let called = 0; const hostile: any = input();
  Object.defineProperty(hostile.provenance, 'call', { enumerable: true, get() { called += 1; return ref('active'); } });
  expect(() => record(truth(), 1, hostile)).toThrow(); expect(called).toBe(0);
  const forged: any = JSON.parse(original);
  Object.defineProperty(forged.events[1].provenance, 'policy', { enumerable: true, get() { called += 1; return ref('active'); } });
  expect(() => getPlayAdjudicationState(forged)).toThrow(); expect(called).toBe(0);
});

it('does not let historical import resolve a new same-tick appeal call requirement', () => {
  let v = truth();
  v = ledgerApi.openOfficialStateWindow(v, 1, { eventId: 'open', tick: 500, windowId: 'appeal', windowKind: 'appeal' });
  v = ledgerApi.closeOfficialStateWindow(v, 2, { eventId: 'fence', tick: 501, windowId: 'appeal', reason: 'next_play_fence' });
  v = ledgerApi.recordDefensiveAppealAttempt(v, 3, { eventId: 'attempt', windowId: 'appeal', timing: 'simultaneous_unresolved',
    attempt: { kind: 'defensive_appeal_attempt', defenderId: 'defender', runnerId: 'runner', base: 1, reason: 'tag_up_early_departure', tick: 501 },
    complianceEvidence: { runnerId: 'runner', originBase: 1,
      firstTouch: { kind: 'fly_ball_first_fielder_touch', fielderId: 'fielder', tick: 200 },
      departure: { kind: 'runner_base_departure', runnerId: 'runner', base: 1, tick: 190 }, retouch: null } });
  v = recordCorrectRuleSnapshot(v, 4, { eventId: 'appeal-truth', tick: 501, snapshotId: 'rule-2', evidenceRevision: 2, ruling: safe });
  const request = input(); request.tick = 501; request.provenance.importedAtElapsedSeconds = 0.401;
  const imported = record(v, 5, request);
  expect(() => close(imported)).toThrow(/same-tick appeal/);
});

it('exports the additive API and keeps pre-import call/review/closure archive bytes unchanged', () => {
  expect(publicApi.recordOwnedLiveCallImport).toBe(ledgerApi.recordOwnedLiveCallImport);
  let value = truth();
  value = ledgerApi.recordOnFieldCall(value, 1, { eventId: 'call-event', tick: 501, callId: 'call', basisSnapshotId: 'rule-1', basisEvidenceRevision: 1, ruling: out });
  value = recordReviewDecision(value, 2, { eventId: 'review-event', tick: 502, reviewId: 'review', callId: 'call', basisSnapshotId: 'rule-1', basisEvidenceRevision: 1, decision: 'overturned', replacementRuling: safe });
  value = closeOfficialPlay(value, 3, { eventId: 'close-event', tick: 503, closureId: 'closure' });
  const json = JSON.stringify({ ledger: value, state: getPlayAdjudicationState(value), closure: getOfficialPlayClosure(value) });
  // Generated from immutable pre-import 8eac874f95fe845bd7694032dd72506b08f701dd.
  expect(Buffer.byteLength(json)).toBe(2278);
  expect(createHash('sha256').update(json).digest('hex')).toBe('d0170ec820ccd8545bc3bfb7716144831c45447f52a805d6bc4368d2f62139e3');
});
