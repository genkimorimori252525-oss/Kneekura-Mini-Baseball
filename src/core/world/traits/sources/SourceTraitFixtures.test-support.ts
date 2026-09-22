import assert from 'node:assert/strict';
import type { TraitResult } from '../TraitTypes';
import type { SourceTraitAssessment, SourceTraitRequest, TraitSourceSnapshot } from './SourceTraitTypes';
import { getSourceTraitFamilies } from './SourceTraitFamilies';
export function value<T>(r: TraitResult<T>): T { if (!r.ok) assert.fail(JSON.stringify(r.reason)); return r.value; }
export const time = (day: number) => ({ season: 2026, day, sequence: 0 });
export function request(): SourceTraitRequest {
  const scope = { careerId: 'career', playerId: 'player' };
  const families = getSourceTraitFamilies();
  const snapshots: TraitSourceSnapshot[] = [];
  const assessments: SourceTraitAssessment[] = families.map(f => {
    const targetTeamId = f.lifecycleClass === 'RELATIONSHIP_CONTEXTUAL' ? 'opponent' : null;
    const bindings = f.requirements.map(r => {
      const source: TraitSourceSnapshot = { careerId: scope.careerId, owner: r.owner,
        subjectId: r.subject === 'PLAYER' ? scope.playerId : 'opponent',
        sourceKey: f.familyId + ':' + r.role, revision: 4, snapshotId: f.familyId + ':' + r.role + ':4', time: time(2) };
      snapshots.push(source); return { role: r.role, source };
    });
    return { familyId: f.familyId, classificationId: 'classification:' + f.familyId, scope, time: time(10),
      stateId: f.stateIds[0]!, targetTeamId, modelId: 'classifier:' + f.familyId, modelVersion: '1', changeKind: 'RECOGNITION', bindings,
      episodes: [3, 6, 9].map(day => ({ episodeId: f.familyId + ':' + day, time: time(day), eventIds: ['event:' + f.familyId + ':' + day] })) };
  });
  return { projectionId: 'projection:1', scope, time: time(11), worldRevision: 100, targetTeamId: 'opponent',
    policy: { policyId: 'test-only', version: '1', families: families.map(f => ({ familyId: f.familyId,
      modelId: 'classifier:' + f.familyId, modelVersion: '1', minimumRecognitionEpisodes: 3, minimumRecognitionDays: 5 })) },
    currentSources: snapshots, assessments };
}
export function amend(r: SourceTraitRequest, familyId: string, change: Partial<SourceTraitAssessment>): SourceTraitRequest {
  return { ...r, assessments: r.assessments.map(a => a.familyId === familyId ? { ...a, ...change } : a) };
}
