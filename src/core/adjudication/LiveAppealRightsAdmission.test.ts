import { expect, it } from 'vitest';
import * as api from './PlayAdjudicationLedger';
import * as publicApi from './index';
import { NPB_2026_RULE_PROFILE } from '../rules/RuleProfile';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../rules/PhysicalRuleFacts';
import { deriveBallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';

const reference = (owner: string) => ({ owner, sourceId: `${owner}-source`, sourceVersion: 'fixture-v1',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const ruling = { outsAfter: 1, basesAfter: { first: 'runner', second: null, third: null }, scoredRunnerIds: [] };
const initial = () => api.recordCorrectRuleSnapshot(api.createPlayAdjudicationLedger({ playId: 7,
  ruleProfileId: NPB_2026_RULE_PROFILE.id, playEnd: { kind: 'play_end', tick: 2_000_000, reason: 'live_action_complete' } }),
0, { eventId: 'truth', tick: 2_000_000, snapshotId: 'rule-1', evidenceRevision: 1, ruling });
const importedInput = (suffix = '', held = false): api.OwnedLiveAppealImportInput => ({ eventId: `import${suffix}`, tick: 2_000_000,
  attempt: createDefensiveAppealAttemptFact('fielder', 'runner', 1, 'tag_up_early_departure', 1_000_000),
  complianceEvidence: { kind: 'ball_world_tag_up_history_v1', originBase: 'first',
    history: deriveBallWorldPlayerBaseContactHistory({ playerId: 'runner',
      base: { center: { x: 0, z: 0 }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
      segments: [{ originTick: 0, startElapsedSeconds: 0, endElapsedSeconds: 1,
        actors: (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'runner', primitive: {
          role, radius: 0.05, startTick: 0, endTick: 1_000_000, ticksPerSecond: 1_000_000,
          startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: held ? 0 : 1, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 } } })) }] }),
    firstTouch: { originTick: 0, elapsedSeconds: 0.5, fact: createFlyBallFirstFielderTouchFact('catcher', 500_000) } },
  provenance: { version: 'owned_live_appeal_import_v1', playId: 7, gameId: 'game', physicalPitchSourceId: 'pitch',
    clock: { originTick: 0, ticksPerSecond: 1_000_000 }, indicatedAtElapsedSeconds: 0.75,
    executedAtElapsedSeconds: 1, importedAtElapsedSeconds: 2,
    indication: reference(`indications${suffix}`), throwPlan: reference(`throws${suffix}`), execution: reference(`executions${suffix}`) },
  rights: { kind: 'pending', reason: 'original_live_ball_and_appeal_rights_required' } });
const imported = (held = false) => api.recordOwnedLiveAppealImport(initial(), 1, importedInput('', held));
const input = (): any => ({ eventId: 'rights', tick: 2_000_001,
  provenance: { version: 'owned_live_appeal_rights_admission_v1', originalImport: importedInput().provenance,
    admittedAtElapsedSeconds: 2.000001, legalState: reference('legal-state'), venue: reference('venue') },
  evidence: { version: 'owned_live_appeal_rights_evidence_v1',
    liveAtExecution: { kind: 'live', playDeclaration: reference('play-declaration'),
      at: { originTick: 0, elapsedSeconds: 0, tick: 0 }, coveredThroughElapsedSeconds: 1 },
    window: { openedAtElapsedSeconds: 0, closedAtElapsedSeconds: null, closeReason: null },
    appealThrowForfeitures: [] } });
const admit = (...args: any[]) => (api as any).recordOwnedLiveAppealRightsAdmission(...args);
const admissions = (ledger: api.PlayAdjudicationLedger) => (api as any).getOwnedLiveAppealRightsAdmissions(ledger);
const close = (ledger: api.PlayAdjudicationLedger) => api.closeOfficialPlay(ledger, ledger.revision,
  { eventId: 'close', tick: 2_000_010, closureId: 'closure' });
const snapshot = (ledger: api.PlayAdjudicationLedger) => api.recordCorrectRuleSnapshot(ledger, ledger.revision,
  { eventId: 'new-truth', tick: 2_000_002, snapshotId: 'rule-2', evidenceRevision: 2, ruling });
const call = (ledger: api.PlayAdjudicationLedger, fresh = true) => api.recordOnFieldCall(ledger, ledger.revision,
  { eventId: fresh ? 'new-call' : 'stale-call', tick: fresh ? 2_000_003 : 2_000_001, callId: fresh ? 'call-2' : 'call-1',
    basisSnapshotId: fresh ? 'rule-2' : 'rule-1', basisEvidenceRevision: fresh ? 2 : 1, ruling });

it('admits matching original rights and derives exact appeal OUT evidence without creating an official ruling', () => {
  expect((api as any).recordOwnedLiveAppealRightsAdmission).toBeTypeOf('function');
  const before = imported(), oldState = api.getPlayAdjudicationState(before), value = admit(before, before.revision, input());
  expect(api.getPendingOwnedLiveAppealImports(value)).toEqual([]);
  expect(admissions(value)).toHaveLength(1);
  expect(admissions(value)[0]).toMatchObject({ kind: 'OwnedLiveAppealRightsAdmitted', tick: 2_000_001,
    disposition: { kind: 'eligible', result: { kind: 'out', runnerId: 'runner', appealedBase: 1,
      classification: 'tag_up_appeal', outTick: 1_000_000, appealTick: 1_000_000 } } });
  expect(api.getPlayAdjudicationState(value)).toEqual(oldState);
  expect(value.events[1]).toEqual(before.events[1]);
  expect(() => close(value)).toThrow(/newer correct-rule snapshot/);
  expect(() => close(snapshot(value))).toThrow(/explicit on-field call/);
  expect(api.getOfficialPlayClosure(close(call(snapshot(value))))?.finalRuling.source).toBe('on_field_call');
  expect(admissions(JSON.parse(JSON.stringify(value)))).toEqual(admissions(value));
});

it('discharges only the matching original execution and preserves unrelated pending rights', () => {
  let value = imported(); value = api.recordOwnedLiveAppealImport(value, value.revision, importedInput('-other'));
  value = admit(value, value.revision, input());
  expect(api.getPendingOwnedLiveAppealImports(value).map(x => x.eventId)).toEqual(['import-other']);
  expect(() => close(call(snapshot(value)))).toThrow(/original live-ball and appeal rights/);
  expect(() => admit(value, value.revision, { ...input(), eventId: 'again' })).toThrow(/pending.*execution|already admitted/);
  expect(() => admit(initial(), 1, input())).toThrow(/pending.*execution/);
});

it('requires a call after the refreshed snapshot and keeps existing official windows open', () => {
  let value = imported(); value = api.openOfficialStateWindow(value, value.revision,
    { eventId: 'open', tick: 2_000_000, windowId: 'appeal', windowKind: 'appeal' });
  value = admit(value, value.revision, input());
  value = snapshot(call(value, false));
  expect(() => close(value)).toThrow(/window remains open/);
  value = api.closeOfficialStateWindow(value, value.revision,
    { eventId: 'window-close', tick: 2_000_002, windowId: 'appeal', reason: 'resolved' });
  expect(() => close(value)).toThrow(/explicit on-field call/);
  expect(api.getOfficialPlayClosure(close(call(value)))).not.toBeNull();
});

it('uses the original exact compliance even when rights are admitted after later base contact', () => {
  const value = admit(imported(true), 2, input());
  expect(admissions(value)[0].disposition).toEqual({ kind: 'eligible', result: {
    kind: 'no_violation', runnerId: 'runner', appealedBase: 1 } });
});

it.each([
  ['dead_ball', (v: any) => { v.evidence.liveAtExecution = { kind: 'dead', cause: reference('time'),
    at: { originTick: 0, elapsedSeconds: 0.9, tick: 900_000 } }; }],
  ['appeal_throw_forfeited', (v: any) => { v.evidence.appealThrowForfeitures = [{ indication: reference('earlier-indication'),
    throwPlan: reference('earlier-throw'), legalCoverage: reference('coverage'), firstCertainDeadAtElapsedSeconds: 0.8 }]; }],
  ['appeal_window_expired', (v: any) => { v.evidence.window.closedAtElapsedSeconds = 0.9;
    v.evidence.window.closeReason = 'next_pitch_or_play'; }],
] as const)('records %s as ineligible without appeal OUT or silent official closure', (reason, change) => {
  const request = input(); change(request);
  const value = admit(imported(), 2, request);
  expect(admissions(value)[0].disposition).toEqual({ kind: 'ineligible', reason });
  expect(api.getPendingOwnedLiveAppealImports(value)).toEqual([]);
  expect(() => close(value)).toThrow(/newer correct-rule snapshot/);
  expect(() => close(snapshot(value))).toThrow(/explicit on-field call/);
});

it('preserves exact timing when closure and execution quantize to the same tick', () => {
  const before = input(); before.evidence.window.closedAtElapsedSeconds = 1 - 1e-12;
  before.evidence.window.closeReason = 'next_pitch_or_play';
  expect(admissions(admit(imported(), 2, before))[0].disposition.kind).toBe('ineligible');
  const after = input(); after.evidence.window.closedAtElapsedSeconds = 1 + 1e-12;
  after.evidence.window.closeReason = 'next_pitch_or_play';
  expect(admissions(admit(imported(), 2, after))[0].disposition.result.kind).toBe('out');
});

it('can reject proved forfeiture while leaving unknown initial live and window owners explicit', () => {
  const request = input();
  request.evidence.liveAtExecution = { kind: 'unknown', reason: 'initial_live_ball_owner_missing' };
  request.evidence.window = { kind: 'unresolved', reason: 'original_live_appeal_window_owner_required' };
  request.evidence.appealThrowForfeitures = [{ indication: reference('earlier-indication'), throwPlan: reference('earlier-throw'),
    legalCoverage: reference('coverage'), firstCertainDeadAtElapsedSeconds: 0.9 }];
  expect(admissions(admit(imported(), 2, request))[0].disposition).toEqual({ kind: 'ineligible', reason: 'appeal_throw_forfeited' });
  request.evidence.appealThrowForfeitures = [];
  expect(() => admit(imported(), 2, request)).toThrow(/unresolved|owner|coverage/);
});

it('can reject proved dead ball with an unresolved original appeal window', () => {
  const request = input(); request.evidence.window = { kind: 'unresolved', reason: 'original_live_appeal_window_owner_required' };
  request.evidence.liveAtExecution = { kind: 'dead', cause: reference('time'), at: { originTick: 0, elapsedSeconds: 0.9, tick: 900_000 } };
  expect(admissions(admit(imported(), 2, request))[0].disposition).toEqual({ kind: 'ineligible', reason: 'dead_ball' });
});

const invalid: [string, (v: any) => void][] = [
  ['unknown request field', v => { v.timely = true; }],
  ['unsupported admission version', v => { v.provenance.version = 'owned_live_appeal_rights_admission_v2'; }],
  ['foreign original execution', v => { v.provenance.originalImport.execution.sourceId = 'other'; }],
  ['rewritten original execution hash', v => { v.provenance.originalImport.execution.sourceHash = 'c'.repeat(64); }],
  ['foreign original scope', v => { v.provenance.originalImport.gameId = 'other'; }],
  ['rewritten original time', v => { v.provenance.originalImport.executedAtElapsedSeconds += 1e-12; }],
  ['rewritten original import time', v => { v.provenance.originalImport.importedAtElapsedSeconds += 1e-12; }],
  ['wrong admission clock', v => { v.tick++; }],
  ['admission before original import', v => { v.provenance.admittedAtElapsedSeconds = 1.999999999999; }],
  ['invalid legal Source hash', v => { v.provenance.legalState.sourceHash = 'unverified'; }],
  ['unknown evidence version', v => { v.evidence.version = 'unsupported'; }],
  ['eligibility flag', v => { v.evidence.eligible = true; }],
  ['missing complete coverage', v => { v.evidence.liveAtExecution.coveredThroughElapsedSeconds = 1 - 1e-12; }],
  ['coverage after admission', v => { v.evidence.liveAtExecution.coveredThroughElapsedSeconds = 3; }],
  ['future live declaration', v => { v.evidence.liveAtExecution.at = { originTick: 0, elapsedSeconds: 1 + 1e-12, tick: 1_000_000 }; }],
  ['live declaration after original first contact', v => { v.evidence.liveAtExecution.at = { originTick: 0, elapsedSeconds: 0.6, tick: 600_000 }; }],
  ['live declaration exactly at original first contact', v => { v.evidence.liveAtExecution.at = { originTick: 0, elapsedSeconds: 0.5, tick: 500_000 }; }],
  ['foreign live clock', v => { v.evidence.liveAtExecution.at.originTick = 1; }],
  ['unmatched live tick', v => { v.evidence.liveAtExecution.at.tick = 1; }],
  ['unknown live state', v => { v.evidence.liveAtExecution.kind = 'unknown'; }],
  ['window never opened', v => { v.evidence.window.openedAtElapsedSeconds = 1 + 1e-12; }],
  ['exact window opening boundary', v => { v.evidence.window.openedAtElapsedSeconds = 1; }],
  ['window close without reason', v => { v.evidence.window.closedAtElapsedSeconds = 0.9; }],
  ['window reason without close', v => { v.evidence.window.closeReason = 'next_pitch_or_play'; }],
  ['window closes before opening', v => { v.evidence.window.openedAtElapsedSeconds = 0.8; v.evidence.window.closedAtElapsedSeconds = 0.7;
    v.evidence.window.closeReason = 'defense_left_field'; }],
  ['exact window boundary', v => { v.evidence.window.closedAtElapsedSeconds = 1; v.evidence.window.closeReason = 'next_pitch_or_play'; }],
  ['exact dead-ball boundary', v => { v.evidence.liveAtExecution = { kind: 'dead', cause: reference('time'),
    at: { originTick: 0, elapsedSeconds: 1, tick: 1_000_000 } }; }],
  ['exact forfeiture boundary', v => { v.evidence.appealThrowForfeitures = [{ indication: reference('i'), throwPlan: reference('t'),
    legalCoverage: reference('c'), firstCertainDeadAtElapsedSeconds: 1 }]; }],
  ['future forfeiture claim', v => { v.evidence.appealThrowForfeitures = [{ indication: reference('i'), throwPlan: reference('t'),
    legalCoverage: reference('c'), firstCertainDeadAtElapsedSeconds: 3 }]; }],
  ['forfeiture flag', v => { v.evidence.appealThrowForfeitures = [{ indication: reference('i'), throwPlan: reference('t'),
    legalCoverage: reference('c'), firstCertainDeadAtElapsedSeconds: 0.9, forfeited: true }]; }],
];
it.each(invalid)('rejects %s on append and on serialized replay', (_name, change) => {
  const request = input(); change(request);
  expect(() => admit(imported(), 2, request)).toThrow();
  const forged = JSON.parse(JSON.stringify(admit(imported(), 2, input()))); change(forged.events.at(-1));
  expect(() => api.getPlayAdjudicationState(forged)).toThrow();
});

it('rejects a forged persisted disposition and duplicate admission rather than replaying caller authority', () => {
  const forged = JSON.parse(JSON.stringify(admit(imported(), 2, input())));
  forged.events.at(-1).disposition.result.outTick = 2_000_001;
  expect(() => api.getPlayAdjudicationState(forged)).toThrow(/disposition/);
  const duplicate = JSON.parse(JSON.stringify(admit(imported(), 2, input())));
  duplicate.events.push({ ...duplicate.events.at(-1), eventId: 'duplicate' }); duplicate.revision++;
  expect(() => api.getPlayAdjudicationState(duplicate)).toThrow(/pending.*execution|already admitted/);
});

it('snapshots inert evidence, requires the current revision and exports additive APIs', () => {
  const request = input(), value = admit(imported(), 2, request), bytes = JSON.stringify(value);
  request.evidence.window.openedAtElapsedSeconds = 0.8; request.provenance.legalState.sourceId = 'changed';
  expect(JSON.stringify(value)).toBe(bytes);
  expect(Object.isFrozen(admissions(value)[0].evidence.window)).toBe(true);
  expect(Object.isFrozen(admissions(value)[0].provenance.originalImport.execution)).toBe(true);
  expect(Object.isFrozen(admissions(value)[0].disposition.result)).toBe(true);
  expect(() => admit(imported(), 1, input())).toThrow(/revision/);
  let calls = 0; const hostile = input();
  Object.defineProperty(hostile.evidence, 'window', { enumerable: true, get() { calls++; return {}; } });
  expect(() => admit(imported(), 2, hostile)).toThrow(); expect(calls).toBe(0);
  expect((publicApi as any).recordOwnedLiveAppealRightsAdmission).toBe((api as any).recordOwnedLiveAppealRightsAdmission);
  expect((publicApi as any).getOwnedLiveAppealRightsAdmissions).toBe((api as any).getOwnedLiveAppealRightsAdmissions);
});
