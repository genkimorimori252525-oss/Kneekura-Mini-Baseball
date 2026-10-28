import { describe, expect, it } from 'vitest';
import type { NativeBattingContactTraitProjectionV189 } from '../../host/world/NativeBattingContactTraitProjectionV189';
import { classifyMeasuredTrait } from '../../core/world/traits/classifiers/MeasuredTraitClassifier';
import type { MeasurementModel } from '../../core/world/traits/classifiers/MeasuredTraitTypes';
import { projectSourceTraits } from '../../core/world/traits/sources/SourceTraitProjection';
import type { SourceTraitPolicy } from '../../core/world/traits/sources/SourceTraitTypes';
import {
  createContactDescriptorReportV191 as create,
  readContactDescriptorReportV191 as read,
  withContactDescriptorDisplayNameV191 as rename,
} from './ContactDescriptorReportV191';

const scope = { careerId: 'synthetic-career', playerId: 'synthetic-player' };
const model: MeasurementModel = { modelId: 'synthetic-caller-model', version: 'test-v1', minimumEpisodes: 2,
  minimumDays: 1, windowDays: 10, maximumSourceAgeDays: 0,
  rule: { familyId: 'line_drive', lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: .6 } };
const policy: SourceTraitPolicy = { policyId: 'synthetic-policy', version: '1', families: [
  { familyId: 'line_drive', modelId: model.modelId, modelVersion: model.version,
    minimumRecognitionEpisodes: 2, minimumRecognitionDays: 1 },
] };

// Synthetic caller calibration exercises the display seam; it is never a production model.
function native(days = [5, 6], verticalMps = 10): NativeBattingContactTraitProjectionV189 {
  const time = { season: 2032, day: days.at(-1)!, sequence: 0 };
  const source = { ...scope, subjectId: scope.playerId, owner: 'BATTING_CONTACT' as const,
    sourceKey: 'synthetic-native', revision: 77, snapshotId: 'synthetic-snapshot', time };
  const { playerId: _playerId, ...snapshot } = source;
  const classified = classifyMeasuredTrait({ classificationId: 'classification', scope, time, source: snapshot, model,
    observations: days.map((day, i) => ({ scope, episodeId: 'episode:' + i, eventId: 'event:' + i,
      time: { season: 2032, day, sequence: 0 }, exitVelocityMps: { x: 0, y: verticalMps, z: 30 } })) });
  if (!classified.ok) throw new Error(classified.reason.code);
  const classification = classified.value;
  const projected = projectSourceTraits({ projectionId: 'projection', scope, time, worldRevision: 999, targetTeamId: null,
    policy, currentSources: [snapshot], assessments: classification.assessment ? [classification.assessment] : [] });
  if (!projected.ok) throw new Error(projected.reason.code);
  const projection = projected.value;
  const reasons = classification.status === 'UNAVAILABLE' ? classification.reasons
    : projection.entries.find(x => x.familyId === 'line_drive')!.reasons;
  return { boundary: 'NATIVE_BATTING_CONTACT_TRAIT_PROJECTION_ONLY', status: reasons.length ? 'UNAVAILABLE' : 'READY',
    reasons, scope: { ...scope }, source: snapshot, currentInventoryHash: 'synthetic-inventory', classification, projection,
    timeSemantics: 'AS_OF_LATEST_REGISTERED_CONTACT', populationCoverage: 'SUPPORTED_NATIVE_INVENTORY_ONLY',
    modelAuthority: 'EXPLICIT_CALLER_MODEL', worldRevisionAuthority: 'CALLER_PROJECTION_METADATA' };
}
function withoutClassification(reason = 'NO_MEASUREMENT_MODEL'): NativeBattingContactTraitProjectionV189 {
  const result = native();
  return { ...result, status: 'UNAVAILABLE', reasons: [reason] as NativeBattingContactTraitProjectionV189['reasons'],
    classification: null, projection: null };
}
const mutableReport = () => JSON.parse(JSON.stringify(create(native()))) as Record<string, unknown>;

describe('ContactDescriptorReportV191', () => {
  it('keeps no-model and no-contact states unavailable instead of inferring counts or ABSENT', () => {
    const noModel = create(withoutClassification());
    expect(noModel).toMatchObject({ status: 'UNAVAILABLE', reasons: ['NO_MEASUREMENT_MODEL'],
      sampleCount: null, episodeCount: null, evidenceSpanDays: null, model: null, lineDriveFraction: null });
    const noContacts = create({ ...withoutClassification('NO_REGISTERED_CONTACTS'), source: null });
    expect(noContacts.source).toBeNull();
    expect(noContacts.status).toBe('UNAVAILABLE');
    expect(noContacts.reasons).toEqual(['NO_REGISTERED_CONTACTS']);
    expect(read(JSON.parse(JSON.stringify(noModel)))).toEqual(noModel);
  });

  it('retains insufficient evidence as UNASSESSED with Native reasons and observed counts', () => {
    const report = create(native([425]));
    expect(report).toMatchObject({ status: 'UNASSESSED', reasons: ['INSUFFICIENT_EVIDENCE'], sampleCount: 1,
      episodeCount: 1, evidenceSpanDays: 0, lineDriveFraction: null,
      model: { modelId: 'synthetic-caller-model', version: 'test-v1' } });
    expect(report.source!.time.day).toBe(425);
    expect(report.timeSemantics).toBe('AS_OF_LATEST_REGISTERED_CONTACT');
    expect(read(JSON.parse(JSON.stringify(report)), scope)).toEqual(report);
  });

  it.each([{ verticalMps: 10, status: 'PRESENT', fraction: 1 }, { verticalMps: 0, status: 'ABSENT', fraction: 0 }])(
    'uses the existing READY $status entry and fraction without applying classification thresholds',
    ({ verticalMps, status, fraction }) => {
      const report = create(native([5, 6], verticalMps));
      expect(report).toMatchObject({ status, reasons: [], sampleCount: 2, episodeCount: 2,
        evidenceSpanDays: 1, lineDriveFraction: fraction, displayName: 'ラインドライブ',
        physicsEffects: 'NONE', modelAuthority: 'EXPLICIT_CALLER_MODEL', modelCalibration: 'UNCONFIRMED',
        populationBoundary: 'SUPPORTED_NATIVE_PRODUCERS_ONLY' });
      expect(read(JSON.parse(JSON.stringify(report)), scope)).toEqual(report);
    });

  it('keeps projection model mismatch unavailable even when measured classification is READY', () => {
    const result = native();
    const projection = { ...result.projection!, entries: result.projection!.entries.map(entry =>
      entry.familyId === 'line_drive' ? { ...entry, status: 'UNAVAILABLE' as const, stateId: null,
        reasons: ['MODEL_CHANGED' as const] } : entry) };
    const report = create({ ...result, status: 'UNAVAILABLE', reasons: ['MODEL_CHANGED'], projection });
    expect(report).toMatchObject({ status: 'UNAVAILABLE', reasons: ['MODEL_CHANGED'],
      sampleCount: 2, lineDriveFraction: 1 });
  });

  it('detaches and recursively freezes only the small report, leaving caller data mutable', () => {
    const input = native(), report = create(input);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.scope)).toBe(true);
    expect(Object.isFrozen(report.source)).toBe(true);
    expect(Object.isFrozen(report.source!.time)).toBe(true);
    expect(Object.isFrozen(report.reasons)).toBe(true);
    expect(Object.isFrozen(report.model)).toBe(true);
    expect(report.scope).not.toBe(input.scope);
    expect(report.source).not.toBe(input.source);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.scope)).toBe(false);
    expect(Object.isFrozen(input.source)).toBe(false);
    const raw = mutableReport(), parsed = read(raw);
    expect(Object.isFrozen(raw)).toBe(false);
    expect(Object.isFrozen(raw.scope)).toBe(false);
    expect(parsed.scope).not.toBe(raw.scope);
    (raw.scope as { playerId: string }).playerId = 'changed';
    expect(parsed.scope.playerId).toBe('synthetic-player');
  });

  it('changes only the display name while preserving all descriptor facts and detachment', () => {
    const before = create(native()), after = rename(before, '<img src=x onerror=alert(1)>');
    expect(after.displayName).toBe('<img src=x onerror=alert(1)>');
    expect({ ...after, displayName: before.displayName }).toEqual(before);
    expect(after.scope).not.toBe(before.scope);
    expect(after.source).not.toBe(before.source);
    expect(after.model).not.toBe(before.model);
    expect(Object.isFrozen(after)).toBe(true);
    expect(() => rename(before, '  ')).toThrow(/INVALID_INPUT/);
  });

  it('rejects cross-player or cross-career joins and incorrect source ownership', () => {
    const report = mutableReport();
    expect(() => read(report, { ...scope, playerId: 'someone-else' })).toThrow(/SCOPE_MISMATCH/);
    expect(() => read(report, { ...scope, careerId: 'another-career' })).toThrow(/SCOPE_MISMATCH/);
    for (const patch of [{ owner: 'PITCHING_CONTACT' }, { careerId: 'another-career' }, { subjectId: 'someone-else' }]) {
      expect(() => read({ ...report, source: { ...(report.source as object), ...patch } })).toThrow();
    }
  });

  it.each([
    { sampleCount: Infinity }, { sampleCount: NaN }, { sampleCount: -1 }, { sampleCount: 1.5 },
    { sampleCount: Number.MAX_SAFE_INTEGER + 1 }, { episodeCount: 3 }, { evidenceSpanDays: -1 },
    { sampleCount: null }, { episodeCount: null }, { lineDriveFraction: 1.01 }, { lineDriveFraction: NaN },
    { lineDriveFraction: null }, { model: null }, { source: null }, { reasons: ['INSUFFICIENT_EVIDENCE'] },
    { status: 'READY' }, { status: 'UNASSESSED' }, { status: 'UNAVAILABLE' }, { physicsEffects: 'SPEED_BONUS' },
    { modelCalibration: 'CALIBRATED' }, { modelAuthority: 'NATIVE_DEFAULT' }, { displayName: '' },
    { stateId: 'LINE_DRIVE' }, { observations: [] }, { reasons: [3] },
  ])('rejects invalid or contradictory external report values: %j', patch => {
    expect(() => read({ ...mutableReport(), ...patch })).toThrow();
  });

  it('rejects partial evidence triples and metric claims without classification metadata', () => {
    const report = create(withoutClassification());
    expect(() => read({ ...report, sampleCount: 2 })).toThrow(/INCONSISTENT_STATE/);
    expect(() => read({ ...report, lineDriveFraction: .5 })).toThrow(/INCONSISTENT_STATE/);
    expect(() => read({ ...report, model: { modelId: 'model', version: '1' } })).toThrow(/INCONSISTENT_STATE/);
  });

  it('rejects non-inert records, extra nested keys and accessor inputs without calling getters', () => {
    let accessed = false;
    const accessor = Object.defineProperty(mutableReport(), 'displayName', { enumerable: true,
      get: () => { accessed = true; return 'label'; } });
    expect(() => read(accessor)).toThrow(/INVALID_INPUT/);
    expect(accessed).toBe(false);
    const report = mutableReport();
    expect(() => read({ ...report, scope: { ...scope, teamId: 'extra' } })).toThrow(/INVALID_INPUT/);
    expect(() => read({ ...report, model: { modelId: 'id', version: '1', minimumFraction: .6 } })).toThrow(/INVALID_INPUT/);
    expect(() => read({ ...report, reasons: Object.assign([], { custom: true }) })).toThrow(/INVALID_INPUT/);
    expect(() => read(Object.create(report))).toThrow(/INVALID_INPUT/);
  });

  it('extracts a small report from 8000 observations without retaining or freezing the observation input', () => {
    const input = native(Array.from({ length: 8_000 }, (_, i) => i + 1)), report = create(input);
    expect(report).toMatchObject({ sampleCount: 10, episodeCount: 10, evidenceSpanDays: 9, status: 'PRESENT' });
    expect(JSON.stringify(report).length).toBeLessThan(1_500);
    expect(Object.keys(report)).not.toContain('classification');
    expect(Object.keys(report)).not.toContain('projection');
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.source)).toBe(false);
  });
});
