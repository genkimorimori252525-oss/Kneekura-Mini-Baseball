export { prepareNativeLineDriveFlightV191 as prepare, readNativeLineDriveFlightV191 as read } from '../../src/host/world/NativeLineDriveFlightV191.test-support';
import type { DatabaseSync } from 'node:sqlite';
import type { TraitScope } from '../../src/core/world/traits/TraitTypes';
import { readNativeBattingContactTraitProjectionV189FromSqlite } from '../../src/host/world/NativeBattingContactTraitProjectionV189';
import { createContactDescriptorReportV191 } from '../../src/integration/traits/ContactDescriptorReportV191';
export { withContactDescriptorDisplayNameV191 as renameDisplayReport } from '../../src/integration/traits/ContactDescriptorReportV191';

/** Existing V190 caller rule, explicitly uncalibrated; no production model is supplied. */
export function createDisplayReport(db: DatabaseSync, scope: TraitScope) {
  const model = { modelId: 'v190-native-integration-only', version: '1', minimumEpisodes: 2, minimumDays: 1, windowDays: 10,
    maximumSourceAgeDays: 0, rule: { familyId: 'line_drive' as const, lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: .6 } },
    policy = { policyId: 'v190-integration-only', version: '1', families: [{ familyId: 'line_drive', modelId: model.modelId,
      modelVersion: model.version, minimumRecognitionEpisodes: 2, minimumRecognitionDays: 1 }] };
  const native = readNativeBattingContactTraitProjectionV189FromSqlite(db, { scope, classificationId: 'v191-label-classification',
    projectionId: 'v191-label-projection', worldRevision: 0, model, policy });
  if (native.status !== 'READY') throw new Error('V191 Native display descriptor is unavailable: ' + native.reasons.join(','));
  return createContactDescriptorReportV191(native);
}
