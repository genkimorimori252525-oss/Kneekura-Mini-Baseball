import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readContactDescriptorReportV191 } from './ContactDescriptorReportV191';
import { createContactDescriptorEnvelopeV229, readContactDescriptorEnvelopeV229 } from './ContactDescriptorEnvelopeV229';
const scope = { careerId: 'career-a', playerId: 'player-a' };
const source = { careerId: scope.careerId, owner: 'BATTING_CONTACT' as const, subjectId: scope.playerId,
  sourceKey: 'collection-a', revision: 2, snapshotId: 'snapshot-a', time: { season: 2030, day: 7, sequence: 1 } };
const report = readContactDescriptorReportV191({ boundary: 'READ_ONLY_NATIVE_CONTACT_DESCRIPTOR_REPORT', version: 'native-contact-descriptor-report-v191',
  familyId: 'line_drive', displayName: 'ラインドライブ', scope, source, status: 'UNAVAILABLE', reasons: ['NO_MEASUREMENT_MODEL'],
  sampleCount: null, episodeCount: null, evidenceSpanDays: null, lineDriveFraction: null, model: null,
  timeSemantics: 'AS_OF_LATEST_REGISTERED_CONTACT', populationBoundary: 'SUPPORTED_NATIVE_PRODUCERS_ONLY',
  modelAuthority: 'EXPLICIT_CALLER_MODEL', modelCalibration: 'UNCONFIRMED', physicsEffects: 'NONE' });
const identity = { scope, source, capturedInventoryHash: 'a'.repeat(64), currentInventoryHash: 'a'.repeat(64) };
describe('contact envelope identity', () => {
  it('keeps the old report and its matching captured and current collection identity', () => {
    const output = createContactDescriptorEnvelopeV229(report, identity);
    expect(output.report).toEqual(report); expect(output.identity).toEqual(identity);
    expect(output.report.physicsEffects).toBe('NONE'); expect(output.report.timeSemantics).toBe('AS_OF_LATEST_REGISTERED_CONTACT');
    expect(Object.isFrozen(output.identity)).toBe(true);
  });
  it('rejects mismatched scope, source or captured/current collection', () => {
    expect(() => createContactDescriptorEnvelopeV229(report, { ...identity, scope: { ...scope, playerId: 'other' } })).toThrow();
    expect(() => createContactDescriptorEnvelopeV229(report, { ...identity, source: { ...source, snapshotId: 'other' } })).toThrow();
    expect(() => createContactDescriptorEnvelopeV229(report, { ...identity, currentInventoryHash: 'b'.repeat(64) })).toThrow();
  });
  it('retains missing-capture or no-registered-contacts rather than inventing an inventory', () => {
    const uncaptured = readContactDescriptorReportV191({ ...report, reasons: ['INVENTORY_NOT_CAPTURED'] });
    expect(createContactDescriptorEnvelopeV229(uncaptured, { ...identity, capturedInventoryHash: null, currentInventoryHash: null }).identity?.capturedInventoryHash).toBeNull();
    const empty = readContactDescriptorReportV191({ ...report, source: null, reasons: ['NO_REGISTERED_CONTACTS'] });
    expect(createContactDescriptorEnvelopeV229(empty, null).identity).toBeNull();
    expect(() => createContactDescriptorEnvelopeV229(empty, identity)).toThrow();
  });
});

it('keeps the complete old runtime bytes after removing only the opt-in export', () => {
  let actual = readFileSync('tools/native-contact-report-runtime-v192.ts', 'utf8');
  const addedImports = "import { createContactDescriptorEnvelopeV229, type ContactDescriptorEnvelopeV229 } from '../src/integration/traits/ContactDescriptorEnvelopeV229';\nimport { readNativeBattingContactObservationSnapshotV189FromSqlite } from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';\n";
  expect(actual.split(addedImports)).toHaveLength(2); actual = actual.replace(addedImports, '');
  const begin = actual.indexOf('/** Opt-in envelope:'), end = actual.indexOf('/** Read-only subject preflight', begin);
  expect(begin).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(begin); actual = actual.slice(0, begin) + actual.slice(end);
  expect(Buffer.from(actual)).toEqual(readFileSync('work/contact-envelope-v229-baseline/worktree.ts'));
  expect(readFileSync('work/contact-envelope-v229-baseline/worktree.ts')).toEqual(readFileSync('work/contact-envelope-v229-baseline/git-parent.ts'));
});

it('strictly parses the versioned envelope and rejects foreign scope and extra fields', () => {
  const valid = createContactDescriptorEnvelopeV229(report, identity);
  expect(readContactDescriptorEnvelopeV229(JSON.parse(JSON.stringify(valid)), scope)).toEqual(valid);
  expect(() => readContactDescriptorEnvelopeV229({ ...valid, extra: true })).toThrow();
  expect(() => readContactDescriptorEnvelopeV229({ ...valid, version: 'other' })).toThrow();
  expect(() => readContactDescriptorEnvelopeV229(valid, { ...scope, playerId: 'other' })).toThrow();
  expect(() => createContactDescriptorEnvelopeV229(readContactDescriptorReportV191({ ...report, reasons: ['INVENTORY_NOT_CAPTURED'] }), { ...identity, currentInventoryHash: null })).toThrow();
});
