import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { compareSourceTraitRequests, projectSourceTraits } from './index';
import { amend, request, time, value } from './SourceTraitFixtures.test-support';
import type { SourceTraitAssessment, SourceTraitRequest } from './SourceTraitTypes';
function next(r: SourceTraitRequest, id = 'line_drive', change: Partial<SourceTraitAssessment> = {}): SourceTraitRequest {
  return amend({ ...r, projectionId: 'projection:2', time: time(12), worldRevision: 101 }, id,
    { classificationId: 'new:' + id, time: time(11), ...change });
}
const transition = (a: SourceTraitRequest, b: SourceTraitRequest, id = 'line_drive') => value(compareSourceTraitRequests(a, b)).changes.find(x => x.familyId === id)!.transition;

describe('source-driven descriptor changes', () => {
  it('marks present->confirmed absent as cleared, not an inherited permanent mastery', () => {
    const r = request(); assert.equal(transition(r, next(r, 'line_drive', { stateId: null })), 'CLEARED');
  });
  it('marks absent->present as appeared', () => {
    const r = amend(request(), 'line_drive', { stateId: null });
    assert.equal(transition(r, next(r, 'line_drive', { stateId: 'LINE_DRIVE' })), 'APPEARED');
  });
  it('changes exclusive distribution variants instead of stacking ground and fly labels', () => {
    const r = request(), n = next(r, 'pitcher_contact_distribution', { stateId: 'FLY_BALL' });
    assert.equal(transition(r, n, 'pitcher_contact_distribution'), 'CHANGED');
    assert.equal(value(projectSourceTraits(n)).entries.filter(x => x.familyId === 'pitcher_contact_distribution').length, 1);
  });
  it('treats missing evidence as unavailable, not a cure', () => {
    const r = request(); assert.equal(transition(r, next(r, 'line_drive', { stateId: null, episodes: [] })), 'BECAME_UNAVAILABLE');
  });
  it('treats an omitted assessment as loss of knowledge, not removal', () => {
    const r = request(); assert.equal(transition(r, { ...next(r), assessments: r.assessments.filter(x => x.familyId !== 'line_drive') }), 'BECAME_UNAVAILABLE');
  });
  it('does not pretend an unknown negative was cured when fresh absence is confirmed', () => {
    const r = amend(request(), 'command_instability', { episodes: [] });
    assert.equal(transition(r, next(r, 'command_instability', { stateId: null, episodes: request().assessments.find(x => x.familyId === 'command_instability')!.episodes }), 'command_instability'), 'RESOLVED_ABSENT');
  });
  it('can clear a causal negative when its current source assessment confirms improvement', () => {
    const r = request(); assert.equal(transition(r, next(r, 'release_miss_pattern', { stateId: null }), 'release_miss_pattern'), 'CLEARED');
  });
  it('can clear a retrospective label without changing the underlying result history', () => {
    const r = request(), saved = JSON.stringify(r);
    assert.equal(transition(r, next(r, 'pitcher_result_history', { stateId: null }), 'pitcher_result_history'), 'CLEARED');
    assert.equal(JSON.stringify(r), saved);
  });
  it('keeps unchanged families unchanged and preserves before/after provenance', () => {
    const r = request(), d = value(compareSourceTraitRequests(r, next(r)));
    assert.equal(d.changes.length, 8); assert.ok(d.changes.every(c => c.transition === 'UNCHANGED'));
    const e = d.changes.find(x => x.familyId === 'line_drive')!;
    assert.notEqual(e.before.assessment?.classificationId, e.after.assessment?.classificationId);
  });
  it('allows identical-request recomputation and reports no transitions', () => {
    const r = request(); assert.ok(value(compareSourceTraitRequests(r, r)).changes.every(c => c.transition === 'UNCHANGED'));
  });
  for (const property of ['careerId', 'playerId'] as const) {
    it('refuses to compare another ' + property, () => {
      const a = { ...request(), assessments: [], currentSources: [] };
      const b = { ...next(a), scope: { ...a.scope, [property]: 'other' }, assessments: [], currentSources: [] };
      const result = compareSourceTraitRequests(a, b); assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason.code, 'SCOPE_MISMATCH');
    });
  }
  it('refuses to call a changed opponent a descriptor loss', () => {
    const a = request(), result = compareSourceTraitRequests(a, { ...next(a), targetTeamId: 'another' });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'SCOPE_MISMATCH');
  });
  it('rejects backdated comparison', () => {
    const a = request(), result = compareSourceTraitRequests(a, { ...a, projectionId: 'earlier', time: time(10) });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason.code, 'BACKDATED_EVALUATION');
  });
  it('rejects a decreasing world revision', () => {
    const a = request(); assert.equal(compareSourceTraitRequests(a, { ...next(a), worldRevision: 99 }).ok, false);
  });
  it('rejects immutable projection-ID reuse with changed requests', () => {
    const a = request(); assert.equal(compareSourceTraitRequests(a, { ...next(a), projectionId: a.projectionId }).ok, false);
  });
  it('rejects immutable classification-ID reuse with different conclusions', () => {
    const a = request(); const b = next(a, 'line_drive', { stateId: null, classificationId: 'classification:line_drive' });
    assert.equal(compareSourceTraitRequests(a, b).ok, false);
  });
  it('rejects source rollback even if the resulting label happens to be unchanged', () => {
    const a = request(); const b = { ...next(a), currentSources: a.currentSources.map(s => ({ ...s, revision: 3, snapshotId: s.snapshotId + ':older' })) };
    assert.equal(compareSourceTraitRequests(a, b).ok, false);
  });
  it('rejects a source revision acquiring another immutable snapshot ID', () => {
    const a = request(); const b = { ...next(a), currentSources: a.currentSources.map(s => ({ ...s, snapshotId: s.snapshotId + ':rewrite' })) };
    assert.equal(compareSourceTraitRequests(a, b).ok, false);
  });
  it('marks old classifications unavailable after a valid source update', () => {
    const a = request(); const b = { ...next(a), currentSources: a.currentSources.map(s => s.sourceKey === 'line_drive:contact' ? { ...s, revision: 5, snapshotId: 'new-source', time: time(11) } : s) };
    assert.equal(transition(a, b), 'BECAME_UNAVAILABLE');
  });
  it('does not freeze caller requests during difference calculation', () => {
    const a = request(), b = next(a); const d = value(compareSourceTraitRequests(a, b));
    assert.equal(Object.isFrozen(a), false); assert.equal(Object.isFrozen(b), false); assert.ok(Object.isFrozen(d.changes[0]?.after.assessment));
  });
});
