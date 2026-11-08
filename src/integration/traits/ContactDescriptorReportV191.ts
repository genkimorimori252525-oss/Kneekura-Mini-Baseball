import type { TraitScope } from '../../core/world/traits/TraitTypes';
import type { TraitSourceSnapshot } from '../../core/world/traits/sources/SourceTraitTypes';
import { readSnapshot } from '../../core/world/traits/sources/SourceTraitValidation';
import { fail, fraction, freeze, integer, list, obj, oneOf, readScope, same, text } from '../../core/world/traits/TraitValidation';
import type { NativeBattingContactTraitProjectionV189 } from '../../host/world/NativeBattingContactTraitProjectionV189';

/** Detached display facts only. This report confers no Native authority or physical/ability effects. */
export type ContactDescriptorReportV191 = Readonly<{
  boundary: 'READ_ONLY_NATIVE_CONTACT_DESCRIPTOR_REPORT'; version: 'native-contact-descriptor-report-v191';
  familyId: 'line_drive'; displayName: string; scope: TraitScope; source: TraitSourceSnapshot | null;
  status: 'PRESENT' | 'ABSENT' | 'UNASSESSED' | 'UNAVAILABLE'; reasons: readonly string[];
  sampleCount: number | null; episodeCount: number | null; evidenceSpanDays: number | null;
  lineDriveFraction: number | null; model: Readonly<{ modelId: string; version: string }> | null;
  timeSemantics: 'AS_OF_LATEST_REGISTERED_CONTACT'; populationBoundary: 'SUPPORTED_NATIVE_PRODUCERS_ONLY';
  modelAuthority: 'EXPLICIT_CALLER_MODEL'; modelCalibration: 'UNCONFIRMED'; physicsEffects: 'NONE';
}>;

const keys = ['boundary', 'version', 'familyId', 'displayName', 'scope', 'source', 'status', 'reasons',
  'sampleCount', 'episodeCount', 'evidenceSpanDays', 'lineDriveFraction', 'model', 'timeSemantics',
  'populationBoundary', 'modelAuthority', 'modelCalibration', 'physicsEffects'] as const;
const nullableInteger = (value: unknown, path: string): number | null => value === null ? null : integer(value, path);

/** Validates the small display schema, not the provenance or calibration of the supplied observations.
 * A model and the three counts travel together. PRESENT/ABSENT require a complete classification;
 * UNASSESSED retains Native insufficiency reasons and counts without asserting a measured fraction.
 * UNAVAILABLE can retain measured facts when a later projection gate (for example model mismatch) fails. */
export function readContactDescriptorReportV191(raw: unknown, expectedScope?: TraitScope): ContactDescriptorReportV191 {
  const r = obj(raw, keys, 'report'), scope = readScope(r.scope, 'report.scope');
  if (expectedScope !== undefined && !same(scope, readScope(expectedScope, 'expectedScope')))
    fail('SCOPE_MISMATCH', 'report.scope');
  const source = r.source === null ? null : readSnapshot(r.source, 'report.source');
  if (source && (source.owner !== 'BATTING_CONTACT' || source.careerId !== scope.careerId || source.subjectId !== scope.playerId))
    fail('SOURCE_CONFLICT', 'report.source');
  const status = oneOf(r.status, ['PRESENT', 'ABSENT', 'UNASSESSED', 'UNAVAILABLE'], 'report.status');
  const reasons = list(r.reasons, text, 'report.reasons');
  const sampleCount = nullableInteger(r.sampleCount, 'report.sampleCount'),
    episodeCount = nullableInteger(r.episodeCount, 'report.episodeCount'),
    evidenceSpanDays = nullableInteger(r.evidenceSpanDays, 'report.evidenceSpanDays');
  const lineDriveFraction = r.lineDriveFraction === null ? null : fraction(r.lineDriveFraction, 'report.lineDriveFraction');
  const modelRef = r.model === null ? null : obj(r.model, ['modelId', 'version'], 'report.model');
  const model = modelRef === null ? null : { modelId: text(modelRef.modelId, 'report.model.modelId'),
    version: text(modelRef.version, 'report.model.version') };
  const hasCounts = sampleCount !== null && episodeCount !== null && evidenceSpanDays !== null;
  const noCounts = sampleCount === null && episodeCount === null && evidenceSpanDays === null;
  if ((!hasCounts && !noCounts) || (model === null) !== noCounts || (hasCounts && source === null)
    || (lineDriveFraction !== null && !hasCounts)) fail('INCONSISTENT_STATE', 'report.classification');
  if (hasCounts && (episodeCount > sampleCount || (sampleCount === 0) !== (episodeCount === 0)
    || (episodeCount < 2 && evidenceSpanDays !== 0) || (sampleCount === 0 && lineDriveFraction !== null)))
    fail('INCONSISTENT_STATE', 'report.counts');
  if (status === 'PRESENT' || status === 'ABSENT') {
    if (!hasCounts || lineDriveFraction === null || reasons.length) fail('INCONSISTENT_STATE', 'report.status');
  } else {
    if (!reasons.length) fail('INCONSISTENT_STATE', 'report.reasons');
    if (status === 'UNASSESSED' && (!hasCounts || lineDriveFraction !== null)) fail('INCONSISTENT_STATE', 'report.status');
  }
  return freeze({
    boundary: oneOf(r.boundary, ['READ_ONLY_NATIVE_CONTACT_DESCRIPTOR_REPORT'], 'report.boundary'),
    version: oneOf(r.version, ['native-contact-descriptor-report-v191'], 'report.version'),
    familyId: oneOf(r.familyId, ['line_drive'], 'report.familyId'), displayName: text(r.displayName, 'report.displayName'),
    scope, source, status, reasons, sampleCount, episodeCount, evidenceSpanDays, lineDriveFraction, model,
    timeSemantics: oneOf(r.timeSemantics, ['AS_OF_LATEST_REGISTERED_CONTACT'], 'report.timeSemantics'),
    populationBoundary: oneOf(r.populationBoundary, ['SUPPORTED_NATIVE_PRODUCERS_ONLY'], 'report.populationBoundary'),
    modelAuthority: oneOf(r.modelAuthority, ['EXPLICIT_CALLER_MODEL'], 'report.modelAuthority'),
    modelCalibration: oneOf(r.modelCalibration, ['UNCONFIRMED'], 'report.modelCalibration'),
    physicsEffects: oneOf(r.physicsEffects, ['NONE'], 'report.physicsEffects'),
  });
}

/** Selects only small facts from an owner-produced Native result; it never clones the observation graph. */
export function createContactDescriptorReportV191(
  result: NativeBattingContactTraitProjectionV189, displayName = 'ラインドライブ',
): ContactDescriptorReportV191 {
  const classification = result.classification, entry = result.projection?.entries.find(x => x.familyId === 'line_drive');
  let status: ContactDescriptorReportV191['status'] = 'UNAVAILABLE';
  if (result.status === 'READY') {
    if (classification?.status !== 'READY' || !entry || (entry.status !== 'PRESENT' && entry.status !== 'ABSENT')
      || (entry.status === 'PRESENT' ? entry.stateId !== 'LINE_DRIVE' : entry.stateId !== null)
      || entry.reasons.length) fail('INCONSISTENT_STATE', 'native.projection');
    status = entry.status;
  } else if (classification?.status === 'UNAVAILABLE' && entry?.status === 'UNASSESSED') {
    status = 'UNASSESSED';
  } else if (entry?.status === 'PRESENT' || entry?.status === 'ABSENT') {
    fail('INCONSISTENT_STATE', 'native.status');
  }
  if (classification && (!same(classification.request.scope, result.scope)
    || classification.request.model.rule.familyId !== 'line_drive')) fail('SCOPE_MISMATCH', 'native.classification');
  if (result.projection && !same(result.projection.scope, result.scope)) fail('SCOPE_MISMATCH', 'native.projection.scope');
  return readContactDescriptorReportV191({
    boundary: 'READ_ONLY_NATIVE_CONTACT_DESCRIPTOR_REPORT', version: 'native-contact-descriptor-report-v191',
    familyId: 'line_drive', displayName, scope: result.scope, source: result.source, status, reasons: result.reasons,
    sampleCount: classification?.sampleCount ?? null, episodeCount: classification?.episodeCount ?? null,
    evidenceSpanDays: classification?.evidenceSpanDays ?? null,
    lineDriveFraction: classification?.metrics.find(metric => metric.key === 'lineDriveFraction')?.value ?? null,
    model: classification ? { modelId: classification.request.model.modelId, version: classification.request.model.version } : null,
    timeSemantics: result.timeSemantics, populationBoundary: 'SUPPORTED_NATIVE_PRODUCERS_ONLY',
    modelAuthority: result.modelAuthority, modelCalibration: 'UNCONFIRMED', physicsEffects: 'NONE',
  });
}

/** Names are plain display text. Consumers must use their renderer's text API, such as DOM textContent. */
export function withContactDescriptorDisplayNameV191(
  report: ContactDescriptorReportV191, displayName: string,
): ContactDescriptorReportV191 {
  return freeze({ ...readContactDescriptorReportV191(report), displayName: text(displayName, 'report.displayName') });
}
