import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getTraitFamilies } from '../TraitFamilies';
import { getSourceTraitFamilies, projectSourceTraits } from './index';
import { amend, request, time, value } from './SourceTraitFixtures.test-support';
import type { SourceTraitRequest } from './SourceTraitTypes';
const row = (r: SourceTraitRequest, id = 'line_drive') => value(projectSourceTraits(r)).entries.find(x => x.familyId === id)!;

describe('explicit descriptor families', () => {
  it('covers all four remaining classes without altering the 27-family persistent registry', () => {
    const fs = getSourceTraitFamilies(); assert.equal(fs.length, 8);
    assert.equal(new Set(fs.map(f => f.lifecycleClass)).size, 4);
    assert.ok(fs.every(f => !getTraitFamilies().some(g => g.familyId === f.familyId)));
    assert.equal(getTraitFamilies().length, 27);
  });
  it('keeps reference labels, exact source sections and deeply immutable role ownership', () => {
    const fs = getSourceTraitFamilies(); assert.ok(fs.length);
    for (const f of fs) {
      assert.ok(f.referenceName && f.sourceSections.length && f.stateIds.length && f.requirements.length);
      assert.ok(Object.isFrozen(f) && Object.isFrozen(f.stateIds) && Object.isFrozen(f.requirements[0]));
    }
    assert.ok(Object.isFrozen(fs));
  });
  it('requires quality AND variance for wild-stuff; variance alone is not a benefit', () => {
    assert.deepEqual(getSourceTraitFamilies().find(f => f.familyId === 'wild_stuff')?.requirements.map(r => r.owner), ['PITCH_QUALITY', 'PITCH_COMMAND']);
  });
  it('gives historical labels a HISTORY_ONLY route', () => {
    assert.equal(getSourceTraitFamilies().find(f => f.familyId === 'pitcher_result_history')?.route, 'HISTORY_ONLY');
  });
  it('uses one parameterized team-matchup family, not one per club', () => {
    assert.equal(getSourceTraitFamilies().filter(f => f.lifecycleClass === 'RELATIONSHIP_CONTEXTUAL').length, 1);
    assert.equal(getSourceTraitFamilies().find(f => f.familyId === 'team_matchup')?.requirements.length, 4);
  });
});

describe('source-backed projection', () => {
  it('projects all registered families from their own classifications and sources', () => {
    const p = value(projectSourceTraits(request())); assert.equal(p.entries.length, 8);
    assert.ok(p.entries.every(e => e.status === 'PRESENT' && e.stateId !== null));
    assert.equal(p.boundary, 'SOURCE_TRAIT_PROJECTION_ONLY');
  });
  it('returns explicit unassessed rows when no owner has classified the sources', () => {
    const p = value(projectSourceTraits({ ...request(), assessments: [] }));
    assert.equal(p.entries.length, 8); assert.ok(p.entries.every(e => e.status === 'UNASSESSED' && e.stateId === null));
  });
  it('distinguishes a confirmed absent descriptor from missing evidence', () => {
    assert.equal(row(amend(request(), 'line_drive', { stateId: null })).status, 'ABSENT');
    assert.equal(row(amend(request(), 'line_drive', { episodes: [] })).status, 'UNAVAILABLE');
  });
  it('does not confirm a cure from an unqualified negative classification', () => {
    const r = row(amend(request(), 'command_instability', { stateId: null, episodes: [] }), 'command_instability');
    assert.equal(r.status, 'UNAVAILABLE'); assert.deepEqual(r.reasons, ['INSUFFICIENT_EVIDENCE']);
  });
  it('does not derive any outcome modifiers, extra hit chance or skill bonuses', () => {
    const p = value(projectSourceTraits(request()));
    assert.ok(p.entries.length); for (const e of p.entries) {
      assert.deepEqual(Object.keys(e).sort(), ['assessment','familyId','lifecycleClass','reasons','route','stateId','status']);
    }
  });
  it('detaches and freezes output without freezing or mutating caller data', () => {
    const r = request(), before = JSON.stringify(r), p = value(projectSourceTraits(r));
    assert.equal(JSON.stringify(r), before); assert.equal(Object.isFrozen(r), false);
    assert.ok(Object.isFrozen(p.entries[0]?.assessment?.bindings[0]?.source.time));
    assert.notEqual(p.entries[0]?.assessment, r.assessments.find(a => a.familyId === p.entries[0]?.familyId));
  });
  it('is independent of source, assessment, binding and policy-array ordering', () => {
    const r = request(); const reverse = { ...r, currentSources: [...r.currentSources].reverse(),
      policy: { ...r.policy, families: [...r.policy.families].reverse() },
      assessments: [...r.assessments].reverse().map(a => ({ ...a, bindings: [...a.bindings].reverse(), episodes: [...a.episodes].reverse() })) };
    assert.deepEqual(value(projectSourceTraits(reverse)), value(projectSourceTraits(r)));
  });
  it('marks a classification stale when the current source revision changes', () => {
    const r = request(); const changed = { ...r, currentSources: r.currentSources.map(s => s.sourceKey === 'line_drive:contact' ? { ...s, revision: 5, snapshotId: 'new' } : s) };
    assert.equal(row(changed).status, 'UNAVAILABLE'); assert.deepEqual(row(changed).reasons, ['STALE_SOURCE']);
  });
  it('does not confuse equal numeric revisions with identical snapshots', () => {
    const r = request(); const changed = { ...r, currentSources: r.currentSources.map(s => s.sourceKey === 'line_drive:contact' ? { ...s, snapshotId: 'replacement' } : s) };
    assert.deepEqual(row(changed).reasons, ['STALE_SOURCE']);
  });
  it('requires a current source rather than treating old evidence as still current', () => {
    const r = request(); assert.deepEqual(row({ ...r, currentSources: r.currentSources.filter(s => s.sourceKey !== 'line_drive:contact') }).reasons, ['MISSING_SOURCE']);
  });
  it('requires the current classifier model version', () => {
    assert.deepEqual(row(amend(request(), 'line_drive', { modelVersion: 'old' })).reasons, ['MODEL_CHANGED']);
  });
  it('requires enough distinct episodes for recognition', () => {
    const r = request(), a = r.assessments.find(a => a.familyId === 'line_drive')!;
    assert.equal(row(amend(r, 'line_drive', { episodes: a.episodes.slice(0, 2) })).status, 'UNAVAILABLE');
  });
  it('requires elapsed observation days, not only repeated assertions at one instant', () => {
    const r = request(), a = r.assessments.find(a => a.familyId === 'line_drive')!;
    assert.equal(row(amend(r, 'line_drive', { episodes: a.episodes.map((e, i) => ({ ...e, time: { ...time(9), sequence: i } })) })).status, 'UNAVAILABLE');
  });
  it('allows an actual-source-development projection with a cause episode', () => {
    const r = request(), a = r.assessments.find(a => a.familyId === 'command_instability')!;
    assert.equal(row(amend(r, a.familyId, { changeKind: 'DEVELOPMENT', episodes: a.episodes.slice(0, 1) }), a.familyId).status, 'PRESENT');
  });
  it('does not let development bypass sufficient recognition for statistical descriptors', () => {
    const r = request(), a = r.assessments.find(a => a.familyId === 'pitcher_contact_distribution')!;
    assert.equal(row(amend(r, a.familyId, { changeKind: 'DEVELOPMENT', episodes: a.episodes.slice(0, 1) }), a.familyId).status, 'UNAVAILABLE');
  });
  it('keeps retrospective result history under recognition evidence even when called development', () => {
    const r = request(), a = r.assessments.find(a => a.familyId === 'pitcher_result_history')!;
    assert.equal(row(amend(r, a.familyId, { changeKind: 'DEVELOPMENT', episodes: a.episodes.slice(0, 1) }), a.familyId).status, 'UNAVAILABLE');
  });
  it('does not transfer a team matchup descriptor to another opponent', () => {
    assert.equal(row({ ...request(), targetTeamId: 'another-opponent' }, 'team_matchup').status, 'OUT_OF_CONTEXT');
  });
  it('removes contextual applicability outside any opponent context, not the underlying history', () => {
    assert.equal(row({ ...request(), targetTeamId: null }, 'team_matchup').status, 'OUT_OF_CONTEXT');
  });
  for (const owner of ['TEAM_ROSTER','TEAM_PITCH_PROFILE','TEAM_TACTICS','FAMILIARITY']) {
    it('invalidates team matchup when current ' + owner + ' changes', () => {
      const r = request(); const next = { ...r, currentSources: r.currentSources.map(s => s.owner === owner ? { ...s, revision: s.revision + 1, snapshotId: s.snapshotId + ':new' } : s) };
      assert.equal(row(next, 'team_matchup').status, 'UNAVAILABLE');
    });
  }
  it('retains source change-kind and provenance without inventing development events', () => {
    const e = row(request()); assert.equal(e.assessment?.changeKind, 'RECOGNITION');
    assert.equal(e.assessment?.bindings[0]?.source.revision, 4);
    assert.equal(e.assessment?.episodes.length, 3);
  });
});
