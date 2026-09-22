import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getSourceTraitFamilies, projectSourceTraits, compareSourceTraitRequests } from './index';
import { amend, request, time, value } from './SourceTraitFixtures.test-support';
import type { SourceTraitRequest, TraitSourceSnapshot } from './SourceTraitTypes';
const rejected = (input: unknown, code?: string) => {
  const r = projectSourceTraits(input); assert.equal(r.ok, false);
  if (!r.ok && code) assert.equal(r.reason.code, code);
};
const item = (r: SourceTraitRequest, familyId = 'line_drive') => r.assessments.find(a => a.familyId === familyId)!;

describe('source projection input integrity', () => {
  for (const v of [null, 3, 'input', [], new Date()]) it('rejects non-record request ' + String(v), () => rejected(v, 'INVALID_INPUT'));
  it('rejects unknown fields rather than silently accepting hit-probability modifiers', () => rejected({ ...request(), hitBonus: 0.1 }, 'INVALID_INPUT'));
  it('does not invoke getters hidden in a request', () => {
    let called = false; const r = { ...request() };
    Object.defineProperty(r, 'scope', { enumerable: true, get() { called = true; return {}; } });
    rejected(r, 'INVALID_INPUT'); assert.equal(called, false);
  });
  it('does not invoke getters hidden in nested source references', () => {
    let called = false; const r = request(); const s = { ...r.currentSources[0]! };
    Object.defineProperty(s, 'snapshotId', { enumerable: true, get() { called = true; return 'forged'; } });
    rejected({ ...r, currentSources: [s, ...r.currentSources.slice(1)] }, 'INVALID_INPUT'); assert.equal(called, false);
  });
  it('rejects sparse assessment arrays', () => {
    const r = request(), a = [...r.assessments]; delete a[0]; rejected({ ...r, assessments: a }, 'INVALID_INPUT');
  });
  it('rejects symbol-bearing request records', () => rejected({ ...request(), [Symbol('bonus')]: 1 }, 'INVALID_INPUT'));
  it('rejects an unknown family instead of guessing lifecycle from a name', () => {
    const r = request(); rejected({ ...r, assessments: [{ ...item(r), familyId: 'すごい金特' }] }, 'UNKNOWN_FAMILY');
  });
  it('does not duplicate an existing persistent/graded family in the source registry', () => {
    const r = request(); rejected({ ...r, assessments: [{ ...item(r), familyId: 'fastball_quality' }] }, 'UNKNOWN_FAMILY');
  });
  it('rejects unknown states in a known family', () => rejected(amend(request(), 'line_drive', { stateId: 'AUTO_HOME_RUN' }), 'UNSUPPORTED_STATE'));
  it('rejects two variants of one family even across different classification IDs', () => {
    const r = request(); rejected({ ...r, assessments: [...r.assessments, { ...item(r), classificationId: 'other' }] }, 'INCONSISTENT_STATE');
  });
  it('rejects reused classification IDs across families', () => {
    const r = request(); rejected(amend(r, 'command_instability', { classificationId: item(r).classificationId }), 'INCONSISTENT_STATE');
  });
  it('rejects a source from another career', () => {
    const r = request(); rejected({ ...r, currentSources: r.currentSources.map(s => ({ ...s, careerId: 'other' })) }, 'SCOPE_MISMATCH');
  });
  it('rejects a classification for another player', () => {
    const r = request(); const a = item(r);
    rejected(amend(r, a.familyId, { scope: { ...a.scope, playerId: 'other' }, bindings: a.bindings.map(b => ({ ...b, source: { ...b.source, subjectId: 'other' } })) }), 'SCOPE_MISMATCH');
  });
  it('rejects using another player source for this player', () => {
    const r = request(); rejected(amend(r, 'line_drive', { bindings: item(r).bindings.map(b => ({ ...b, source: { ...b.source, subjectId: 'other' } })) }), 'SOURCE_CONFLICT');
  });
  it('rejects using another opponent roster as this opponent', () => {
    const r = request(); rejected(amend(r, 'team_matchup', { bindings: item(r, 'team_matchup').bindings.map(b => b.role === 'roster' ? { ...b, source: { ...b.source, subjectId: 'another' } } : b) }), 'SOURCE_CONFLICT');
  });
  it('rejects supplying trajectory side movement as a negative delivery-failure source', () => {
    const r = request(), a = item(r, 'release_miss_pattern');
    rejected(amend(r, a.familyId, { bindings: a.bindings.map(b => ({ ...b, source: { ...b.source, owner: 'PITCH_TRAJECTORY' } })) }), 'SOURCE_CONFLICT');
  });
  it('rejects a missing quality dependency instead of making command variance an advantage', () => {
    const r = request(); rejected(amend(r, 'wild_stuff', { bindings: item(r, 'wild_stuff').bindings.filter(b => b.role !== 'quality') }), 'SOURCE_CONFLICT');
  });
  it('rejects an extra unrelated source binding', () => {
    const r = request(); rejected(amend(r, 'line_drive', { bindings: [...item(r).bindings, { ...item(r).bindings[0]!, role: 'extra' }] }), 'SOURCE_CONFLICT');
  });
  it('rejects duplicate source roles', () => {
    const r = request(); rejected(amend(r, 'wild_stuff', { bindings: [item(r, 'wild_stuff').bindings[0]!, item(r, 'wild_stuff').bindings[0]!] }), 'INCONSISTENT_STATE');
  });
  it('rejects duplicate current source namespaces', () => {
    const r = request(); rejected({ ...r, currentSources: [...r.currentSources, r.currentSources[0]!] }, 'INCONSISTENT_STATE');
  });
  it('rejects reusing an immutable snapshot ID for another source', () => {
    const r = request(); rejected({ ...r, currentSources: r.currentSources.map((s, i) => i === 1 ? { ...s, snapshotId: r.currentSources[0]!.snapshotId } : s) }, 'INCONSISTENT_STATE');
  });
  for (const v of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    it('rejects invalid world revision ' + v, () => rejected({ ...request(), worldRevision: v }, 'INVALID_INPUT'));
  }
  it('rejects a source snapshot taken after the current time', () => {
    const r = request(); rejected({ ...r, currentSources: r.currentSources.map(s => ({ ...s, time: time(20) })) }, 'BACKDATED_EVALUATION');
  });
  it('rejects classification created after the current time', () => rejected(amend(request(), 'line_drive', { time: time(20) }), 'BACKDATED_EVALUATION'));
  it('rejects evidence episodes created after their classification', () => {
    const r = request(); rejected(amend(r, 'line_drive', { episodes: item(r).episodes.map(e => ({ ...e, time: time(20) })) }), 'BACKDATED_EVALUATION');
  });
  it('rejects source data created after the assessment it supposedly informed', () => {
    const r = request(); rejected(amend(r, 'line_drive', { bindings: item(r).bindings.map(b => ({ ...b, source: { ...b.source, time: time(11) } })) }), 'BACKDATED_EVALUATION');
  });
  it('rejects one event repackaged as several independent recognition episodes', () => {
    const r = request(); rejected(amend(r, 'line_drive', { episodes: item(r).episodes.map(e => ({ ...e, eventIds: ['same-event'] })) }), 'INCONSISTENT_STATE');
  });
  it('rejects duplicate episode IDs', () => {
    const r = request(); rejected(amend(r, 'line_drive', { episodes: item(r).episodes.map(e => ({ ...e, episodeId: 'same' })) }), 'INCONSISTENT_STATE');
  });
  it('rejects empty event evidence inside an episode', () => {
    const r = request(); rejected(amend(r, 'line_drive', { episodes: item(r).episodes.map(e => ({ ...e, eventIds: [] })) }), 'INVALID_INPUT');
  });
  it('rejects opponent parameterization on a noncontextual family', () => rejected(amend(request(), 'line_drive', { targetTeamId: 'opponent' }), 'INVALID_INPUT'));
  it('requires a target for target-specific classifications', () => rejected(amend(request(), 'team_matchup', { targetTeamId: null }), 'INVALID_INPUT'));
  it('requires an explicit calibrated family policy for every assessed family', () => {
    const r = request(); rejected({ ...r, policy: { ...r.policy, families: [] } }, 'MISSING_FAMILY_POLICY');
  });
  it('does not allow a single dramatic event as the recognition policy', () => {
    const r = request(); rejected({ ...r, policy: { ...r.policy, families: r.policy.families.map(f => ({ ...f, minimumRecognitionEpisodes: 1 })) } }, 'INVALID_INPUT');
  });
  it('rejects rewriting thresholds under the same immutable policy version', () => {
    const r = request(), n = { ...r, projectionId: 'new', policy: { ...r.policy, families: r.policy.families.map(f => ({ ...f, minimumRecognitionEpisodes: 4 })) } };
    const result = compareSourceTraitRequests(r, n); assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason.code, 'POLICY_MISMATCH');
  });
  it('allows one underlying command source to support distinct descriptions without source duplication', () => {
    const r = request(), s = r.currentSources.find(s => s.sourceKey === 'command_instability:command')!;
    const n = amend({ ...r, currentSources: r.currentSources.filter(x => x.sourceKey !== 'wild_stuff:variance') }, 'wild_stuff',
      { bindings: item(r, 'wild_stuff').bindings.map(b => b.role === 'variance' ? { ...b, source: s } : b) });
    assert.ok(value(projectSourceTraits(n)).entries.every(e => e.status === 'PRESENT'));
  });
  it('does not collide composite source identities containing separators', () => {
    const r = request(); const extras: TraitSourceSnapshot[] = [
      { ...r.currentSources[0]!, sourceKey: 'a|b', subjectId: 'x', snapshotId: 'one' },
      { ...r.currentSources[0]!, sourceKey: 'b', subjectId: 'x|a', snapshotId: 'two' },
    ];
    assert.ok(projectSourceTraits({ ...r, currentSources: [...r.currentSources, ...extras] }).ok);
  });
  it('owns evidence mode in the explicit family definition, not name/color conditionals', () => {
    for (const f of getSourceTraitFamilies()) {
      assert.ok('evidenceMode' in f);
      assert.ok(['RECOGNITION_REQUIRED', 'SOURCE_CHANGE_OR_RECOGNITION'].includes((f as unknown as { evidenceMode: string }).evidenceMode));
    }
  });
  it('rejects contradictory season progression inside a chronological evidence window', () => {
    const r = request(), a = item(r);
    rejected(amend(r, a.familyId, { episodes: a.episodes.map((e, i) => i === 1 ? { ...e, time: { ...e.time, season: 2025 } } : e) }), 'INCONSISTENT_STATE');
  });
  it('cannot reuse one instant as two distinct recognition episodes', () => {
    const r = request(), a = item(r);
    rejected(amend(r, a.familyId, { episodes: a.episodes.map((e, i) => i === 1 ? { ...e, time: a.episodes[0]!.time } : e) }), 'INCONSISTENT_STATE');
  });
  it('rejects classification-ID repurposing across disjoint families in comparison', () => {
    const r = request(), old = item(r); const before = { ...r, assessments: [old] };
    const after = { ...r, projectionId: 'other', assessments: [{ ...item(r, 'command_instability'), classificationId: old.classificationId }] };
    assert.equal(compareSourceTraitRequests(before, after).ok, false);
  });
});
