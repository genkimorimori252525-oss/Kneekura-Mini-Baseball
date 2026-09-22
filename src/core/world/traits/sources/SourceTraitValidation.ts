import { fail, integer, list, obj, oneOf, order, readScope, readTime, same, text, unique } from '../TraitValidation';
import type { TraitTime } from '../TraitTypes';
import { findSourceTraitFamily } from './SourceTraitFamilies';
import type { SourceTraitAssessment, SourceTraitFamily, SourceTraitPolicy, SourceTraitRequest, TraitSourceSnapshot } from './SourceTraitTypes';
export function sourceFamily(input: unknown, path: string): SourceTraitFamily {
  const f = findSourceTraitFamily(text(input, path)); if (!f) fail('UNKNOWN_FAMILY', path); return f;
}
export const nullableText = (v: unknown, p: string): string | null => v === null ? null : text(v, p);
export const notAfter = (a: TraitTime, b: TraitTime): boolean => a.season <= b.season
  && (a.day < b.day || (a.day === b.day && a.sequence <= b.sequence));
export const sourceKey = (s: TraitSourceSnapshot): string => JSON.stringify([s.careerId, s.owner, s.subjectId, s.sourceKey]);
export function readSnapshot(input: unknown, path: string): TraitSourceSnapshot {
  const r = obj(input, ['careerId','owner','subjectId','sourceKey','revision','snapshotId','time'], path);
  return { careerId: text(r.careerId, path + '.careerId'),
    owner: oneOf(r.owner, ['BATTING_CONTACT','PITCHING_CONTACT','PITCH_TRAJECTORY','PITCH_QUALITY','PITCH_COMMAND',
      'RELEASE_FAILURE','FAMILIARITY','TEAM_ROSTER','TEAM_PITCH_PROFILE','TEAM_TACTICS','CAREER_HISTORY'], path + '.owner'),
    subjectId: text(r.subjectId, path + '.subjectId'), sourceKey: text(r.sourceKey, path + '.sourceKey'),
    revision: integer(r.revision, path + '.revision'), snapshotId: text(r.snapshotId, path + '.snapshotId'), time: readTime(r.time, path + '.time') };
}
function readPolicy(input: unknown, path: string): SourceTraitPolicy {
  const r = obj(input, ['policyId','version','families'], path);
  const families = list(r.families, (v, p) => {
    const x = obj(v, ['familyId','modelId','modelVersion','minimumRecognitionEpisodes','minimumRecognitionDays'], p);
    return { familyId: sourceFamily(x.familyId, p + '.familyId').familyId, modelId: text(x.modelId, p + '.modelId'),
      modelVersion: text(x.modelVersion, p + '.modelVersion'),
      minimumRecognitionEpisodes: integer(x.minimumRecognitionEpisodes, p + '.minimumRecognitionEpisodes', 2),
      minimumRecognitionDays: integer(x.minimumRecognitionDays, p + '.minimumRecognitionDays', 1) };
  }, path + '.families');
  unique(families, f => f.familyId, path + '.families');
  return { policyId: text(r.policyId, path + '.policyId'), version: text(r.version, path + '.version'),
    families: families.sort((a, b) => order(a.familyId, b.familyId)) };
}
function readAssessment(input: unknown, path: string): SourceTraitAssessment {
  const r = obj(input, ['familyId','classificationId','scope','time','stateId','targetTeamId','modelId','modelVersion','changeKind','bindings','episodes'], path);
  const f = sourceFamily(r.familyId, path + '.familyId'), scope = readScope(r.scope, path + '.scope');
  const stateId = nullableText(r.stateId, path + '.stateId'), targetTeamId = nullableText(r.targetTeamId, path + '.targetTeamId');
  if (stateId !== null && !f.stateIds.includes(stateId)) fail('UNSUPPORTED_STATE', path + '.stateId');
  if ((f.lifecycleClass === 'RELATIONSHIP_CONTEXTUAL') !== (targetTeamId !== null)) fail('INVALID_INPUT', path + '.targetTeamId');
  const time = readTime(r.time, path + '.time');
  const bindings = list(r.bindings, (v, p) => {
    const x = obj(v, ['role','source'], p); return { role: text(x.role, p + '.role'), source: readSnapshot(x.source, p + '.source') };
  }, path + '.bindings');
  unique(bindings, b => b.role, path + '.bindings');
  if (bindings.length !== f.requirements.length) fail('SOURCE_CONFLICT', path + '.bindings');
  for (const requirement of f.requirements) {
    const binding = bindings.find(b => b.role === requirement.role);
    if (!binding || binding.source.owner !== requirement.owner || binding.source.careerId !== scope.careerId
      || binding.source.subjectId !== (requirement.subject === 'PLAYER' ? scope.playerId : targetTeamId))
      fail('SOURCE_CONFLICT', path + '.bindings.' + requirement.role);
    if (!notAfter(binding.source.time, time)) fail('BACKDATED_EVALUATION', path + '.bindings.time');
  }
  const episodes = list(r.episodes, (v, p) => {
    const x = obj(v, ['episodeId','time','eventIds'], p), episodeTime = readTime(x.time, p + '.time');
    const eventIds = list(x.eventIds, text, p + '.eventIds');
    if (!eventIds.length) fail('INVALID_INPUT', p + '.eventIds'); unique(eventIds, id => id, p + '.eventIds');
    if (!notAfter(episodeTime, time)) fail('BACKDATED_EVALUATION', p + '.time');
    return { episodeId: text(x.episodeId, p + '.episodeId'), time: episodeTime, eventIds: eventIds.sort(order) };
  }, path + '.episodes');
  unique(episodes, e => e.episodeId, path + '.episodes');
  unique(episodes, e => JSON.stringify(e.time), path + '.episodes.time');
  // Repackaging one event as many episode IDs must not satisfy repetition thresholds.
  unique(episodes.flatMap(e => e.eventIds), id => id, path + '.episodes.eventIds');
  episodes.sort((a, b) => a.time.day - b.time.day || a.time.sequence - b.time.sequence || order(a.episodeId, b.episodeId));
  for (let i = 1; i < episodes.length; i++)
    if (!notAfter(episodes[i - 1]!.time, episodes[i]!.time)) fail('INCONSISTENT_STATE', path + '.episodes.time');
  return { familyId: f.familyId, classificationId: text(r.classificationId, path + '.classificationId'), scope, time,
    stateId, targetTeamId, modelId: text(r.modelId, path + '.modelId'), modelVersion: text(r.modelVersion, path + '.modelVersion'),
    changeKind: oneOf(r.changeKind, ['RECOGNITION','DEVELOPMENT','BOTH'], path + '.changeKind'),
    bindings: bindings.sort((a, b) => order(a.role, b.role)), episodes };
}
export function readSourceTraitRequest(input: unknown): SourceTraitRequest {
  const r = obj(input, ['projectionId','scope','time','worldRevision','targetTeamId','policy','currentSources','assessments'], 'request');
  const scope = readScope(r.scope, 'request.scope'), time = readTime(r.time, 'request.time');
  const policy = readPolicy(r.policy, 'request.policy');
  const currentSources = list(r.currentSources, readSnapshot, 'request.currentSources');
  unique(currentSources, sourceKey, 'request.currentSources');
  unique(currentSources, s => s.snapshotId, 'request.currentSources.snapshotId');
  for (const s of currentSources) {
    if (s.careerId !== scope.careerId) fail('SCOPE_MISMATCH', 'request.currentSources.careerId');
    if (!notAfter(s.time, time)) fail('BACKDATED_EVALUATION', 'request.currentSources.time');
  }
  const assessments = list(r.assessments, readAssessment, 'request.assessments');
  unique(assessments, a => a.familyId, 'request.assessments');
  unique(assessments, a => a.classificationId, 'request.assessments.classificationId');
  for (const a of assessments) {
    if (!same(a.scope, scope)) fail('SCOPE_MISMATCH', 'request.assessments.scope');
    if (!notAfter(a.time, time)) fail('BACKDATED_EVALUATION', 'request.assessments.time');
    if (!policy.families.some(p => p.familyId === a.familyId)) fail('MISSING_FAMILY_POLICY', 'request.assessments.' + a.familyId);
  }
  return { projectionId: text(r.projectionId, 'request.projectionId'), scope, time,
    worldRevision: integer(r.worldRevision, 'request.worldRevision'), targetTeamId: nullableText(r.targetTeamId, 'request.targetTeamId'), policy,
    currentSources: currentSources.sort((a, b) => order(sourceKey(a), sourceKey(b))),
    assessments: assessments.sort((a, b) => order(a.familyId, b.familyId)) };
}
