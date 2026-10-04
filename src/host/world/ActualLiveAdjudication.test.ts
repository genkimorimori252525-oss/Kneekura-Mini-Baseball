import { describe, expect, it } from 'vitest';
import * as actual from './ActualLiveAdjudication';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { createPlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { getPlayAdjudicationState } from '../../core/adjudication/PlayAdjudicationLedger';
import type { OwnedLiveCallImportProvenance } from '../../core/adjudication/PlayAdjudicationLedger';
const reference = (owner: string, sourceId: string) => ({ owner, sourceId, sourceVersion: 'fixture-v1', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const provenance: OwnedLiveCallImportProvenance = { version: 'owned_live_call_import_v1', gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
  clock: { originTick: 10, ticksPerSecond: 1000 }, calledAtElapsedSeconds: 2, availableAtElapsedSeconds: 2, importedAtElapsedSeconds: 4,
  call: reference('actual_first_base_umpire_calls', 'call'), perception: reference('actual_first_base_umpire_observations', 'observation'),
  policy: reference('actual_first_base_umpire_setups', 'setup'), ruleEvidence: reference('batted_world_field_executions', 'rule'), reception: null };
const fixture = () => ({ sourceId: 'adjudication', playId: 1, ruleProfile: NPB_2026_RULE_PROFILE, playEnd: createPlayEndFact(4010, 'live_action_complete'),
  recordedAt: { originTick: 10, elapsedSeconds: 4, tick: 4010 },
  snapshots: [{ snapshotId: 'actual_first_base_rule:rule', evidenceRevision: 4, resolution: 'unresolved' as const, reason: 'exact_simultaneity' as const }],
  call: { eventId: 'adjudication:call', tick: 4010, call: { callId: 'call', tick: 2010, basisSnapshotId: 'actual_first_base_rule:rule', basisEvidenceRevision: 4,
    ruling: { outsAfter: 1, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] } }, provenance } });
const project = (value: actual.ActualLiveAdjudicationProjectionInput) => actual.projectActualLiveAdjudication(value);
describe('original actual live-call projection', () => {
  it('imports the original earlier call without changing unresolved truth or physical end', () => {
    const input = fixture(), before = JSON.stringify(input), result = project(input);
    expect(result.kind).toBe('official_pending');
    const event = result.ledger.events.find(e => e.kind === 'OwnedLiveCallImported');
    expect(event).toMatchObject({ tick: 4010, call: { tick: 2010, basisEvidenceRevision: 4 }, provenance });
    expect(getPlayAdjudicationState(result.ledger)).toMatchObject({ kind: 'official_adjudication_open', latestCorrectRule: { resolution: 'unresolved' } });
    expect(result.ledger.playEnd).toEqual(input.playEnd); expect(JSON.stringify(input)).toBe(before);
  });
  it('keeps original evidence identity when a later correct snapshot arrives', () => {
    const input = fixture(); input.snapshots.push({ ...input.snapshots[0], snapshotId: 'actual_first_base_rule:later', evidenceRevision: 5 });
    const result = project(input);
    expect(result.pendingReasons).toContain('on_field_call_stale');
    expect(result.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: { basisSnapshotId: 'actual_first_base_rule:rule', basisEvidenceRevision: 4 } });
  });
  it('does not treat absent review/challenge policies or empty stored windows as none', () => {
    const result = project(fixture());
    expect(result.pendingReasons).toEqual(expect.arrayContaining(['official_window_applicability_unowned', 'official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge']));
    expect(result.ledger.events.some(e => e.kind === 'OfficialPlayClosed')).toBe(false);
  });
  it('refuses an import time that differs from the source-owned recording boundary', () => {
    const input = fixture(); input.call = { ...input.call, provenance: { ...provenance, importedAtElapsedSeconds: 3.9 } };
    expect(() => project(input)).toThrow(/recording/);
  });
});

it('allows unresolved true evidence plus a valid original call only with explicit unavailable review/challenge and proved appeal scope', () => {
  const input = fixture();
  const result = project({ ...input, appealApplicability: 'no_supported_tag_up_appeal', ruleProfile: { ...input.ruleProfile,
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } });
  expect(result.kind).toBe('official_ready'); expect(result.pendingReasons).toEqual([]);
});
it('never substitutes correct rule truth for a missing owned call', () => {
  const input = fixture();
  const result = project({ ...input, call: null, snapshots: [{ snapshotId: 'rule', evidenceRevision: 4,
    ruling: { outsAfter: 1, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] } }],
    appealApplicability: 'no_supported_tag_up_appeal', ruleProfile: { ...input.ruleProfile,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } });
  expect(result.kind).toBe('official_pending'); expect(result.pendingReasons).toEqual(['on_field_call_unavailable']);
});
it('does not close an enabled review with an arbitrary timestamp or next-play intent', () => {
  const input = fixture(); const result = project({ ...input, appealApplicability: 'no_supported_tag_up_appeal', ruleProfile: { ...input.ruleProfile,
    officialWindows: { appeal: { available: true }, review: { available: true }, challenge: { available: false } } } });
  expect(result.kind).toBe('official_pending'); expect(result.pendingReasons).toEqual(['official_window_owner_unavailable:review']);
});

it('keeps later review in the adjudication ledger while original call and physical end remain immutable', async () => {
  const core = await import('../../core/adjudication/PlayAdjudicationLedger');
  const input = fixture(), projected = project({ ...input, appealApplicability: 'no_supported_tag_up_appeal', ruleProfile: { ...input.ruleProfile,
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } });
  const before = JSON.stringify(projected.ledger), end = JSON.stringify(projected.ledger.playEnd);
  const reviewed = core.recordReviewDecision(projected.ledger, projected.ledger.revision, { eventId: 'review:event', tick: 4011,
    reviewId: 'review', callId: 'call', basisSnapshotId: 'actual_first_base_rule:rule', basisEvidenceRevision: 4,
    decision: 'overturned', replacementRuling: { outsAfter: 0, basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] } });
  const closed = core.closeOfficialPlay(reviewed, reviewed.revision, { eventId: 'close:event', closureId: 'close', tick: 4012 });
  expect(core.getOfficialPlayClosure(closed)?.finalRuling).toMatchObject({ source: 'review', gameplay: { outsAfter: 0, basesAfter: { first: 'batter' } } });
  expect(JSON.stringify(projected.ledger)).toBe(before); expect(JSON.stringify(closed.playEnd)).toBe(end);
  expect(closed.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: { tick: 2010, ruling: { outsAfter: 1 } } });
});
