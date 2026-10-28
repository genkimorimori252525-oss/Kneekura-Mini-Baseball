import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../src/core/adjudication/OfficialWindowPolicy';
import type { TraitScope } from '../src/core/world/traits/TraitTypes';
import { freeze, integer, obj, readScope, record, text } from '../src/core/world/traits/TraitValidation';
import type { MeasurementModel } from '../src/core/world/traits/classifiers/MeasuredTraitTypes';
import type { SourceTraitPolicy, TraitSourceSnapshot } from '../src/core/world/traits/sources/SourceTraitTypes';
import { playerPersonLinkEvidenceFromSqlite, type DurablePlayerPersonLink } from '../src/host/world/SqlitePlayerPersonLinkStore';
import { createContactDescriptorReportV191, type ContactDescriptorReportV191 } from '../src/integration/traits/ContactDescriptorReportV191';
import { readNativeBattingContactTraitProjectionV189FromSqlite } from '../src/host/world/NativeBattingContactTraitProjectionV189';
import { openSqliteNativeBattingContactObservationStoreV188 } from '../src/host/world/SqliteNativeBattingContactObservationStoreV188';
import { withBattedVenueLegalReadSnapshot } from '../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../src/host/world/SamePlateAppearanceLifecycleFromSqlite';

export type NativeContactReportInputV192 = Readonly<{ scope: TraitScope; model: MeasurementModel | null; policy: SourceTraitPolicy | null; worldRevision: number }>;
export type NativeContactReportCollectionInputV192 = Readonly<{ scope: TraitScope; careerCalendarEditionId?: string }>;
export type NativeContactReportCollectionSummaryV192 = Readonly<{
  boundary: 'NATIVE_CONTACT_OBSERVATION_COLLECTION_ONLY'; scope: TraitScope; registeredReferenceCount: number;
  source: TraitSourceSnapshot | null; inventoryHash: string | null;
}>;
const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const snapshot = <T>(db: DatabaseSync, body: () => T): T => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, body));

/** The scoped SQL row only locates an intake Source. The normal Owner validates
 * its full stored record and supporting roster on this same borrowed snapshot. */
export function assertNativeContactReportSubjectV192FromSqlite(db: DatabaseSync, rawScope: TraitScope): DurablePlayerPersonLink {
  if (!(db instanceof Native)) throw new Error('Native contact report subject requires an actual Native connection');
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('Native contact report subject requires a query-only Native snapshot');
  const scope = readScope(rawScope, 'scope');
  return snapshot(db, () => {
    const namespace = db.prepare("SELECT type FROM main.sqlite_master WHERE name='world_player_person_links'").all();
    if (namespace.length !== 1 || namespace[0].type !== 'table') throw new Error('Native contact report subject namespace is absent or not a table');
    const located = db.prepare('SELECT source_id FROM main.world_player_person_links WHERE career_id=? AND player_id=? LIMIT 2').all(scope.careerId, scope.playerId);
    if (located.length !== 1 || typeof located[0].source_id !== 'string' || !located[0].source_id.trim()) throw new Error('Native contact report subject is absent or ambiguous');
    const link = playerPersonLinkEvidenceFromSqlite(db).readLink(located[0].source_id);
    if (!link || link.sourceId !== located[0].source_id || link.careerId !== scope.careerId || link.playerId !== scope.playerId)
      throw new Error('Native contact report subject differs from its authenticated intake');
    return link;
  });
}

/** Small caller metadata only; models remain explicit and uncalibrated. The
 * owner-produced observation/classification graph is never cloned here. */
export function readNativeContactReportV192FromSqlite(db: DatabaseSync, raw: NativeContactReportInputV192): ContactDescriptorReportV191 {
  const input = obj(raw, ['scope', 'model', 'policy', 'worldRevision'], 'request'), scope = readScope(input.scope, 'request.scope');
  const worldRevision = integer(input.worldRevision, 'request.worldRevision');
  if (input.model !== null) record(input.model, 'request.model');
  if (input.policy !== null) record(input.policy, 'request.policy');
  const model = cloneInert(input.model) as MeasurementModel | null, policy = cloneInert(input.policy) as SourceTraitPolicy | null;
  const scopeKey = JSON.stringify([scope.careerId, scope.playerId]);
  return snapshot(db, () => {
    assertNativeContactReportSubjectV192FromSqlite(db, scope);
    return createContactDescriptorReportV191(readNativeBattingContactTraitProjectionV189FromSqlite(db, { scope, model, policy, worldRevision,
      classificationId: 'native-contact-report-v192:classification:' + scopeKey,
      projectionId: 'native-contact-report-v192:projection:' + scopeKey }));
  });
}

/** Read-only subject preflight closes before the existing observation Owner opens
 * its separate writer connection; this is not one cross-connection transaction.
 * The accepted intake anchors the subject, with its supporting roster rechecked.
 * A null capture reports no registered references, not global contact absence. V188 opens
 * and commits its two metadata tables independently: failed capture rolls back
 * receipt/head changes, while a newly installed empty namespace may remain. */
export function collectNativeContactReportObservationsV192(path: string, raw: NativeContactReportCollectionInputV192): NativeContactReportCollectionSummaryV192 {
  text(path, 'path');
  const optional = !!raw && Object.hasOwn(raw, 'careerCalendarEditionId');
  const input = obj(raw, ['scope', ...(optional ? ['careerCalendarEditionId'] : [])], 'collection'), scope = readScope(input.scope, 'collection.scope');
  const editionId = optional ? text(input.careerCalendarEditionId, 'collection.careerCalendarEditionId') : undefined;
  if (!statSync(path).isFile()) throw new Error('Native contact report collection requires an existing regular file');
  const preflight = new Native(path, { readOnly: true });
  try { snapshot(preflight, () => assertNativeContactReportSubjectV192FromSqlite(preflight, scope)); }
  finally { preflight.close(); }
  const owner = openSqliteNativeBattingContactObservationStoreV188(path);
  try {
    const captured = owner.capture(scope, editionId === undefined ? {} : { careerCalendarEditionId: editionId });
    return freeze(cloneInert({ boundary: 'NATIVE_CONTACT_OBSERVATION_COLLECTION_ONLY' as const, scope,
      registeredReferenceCount: captured?.receipts.length ?? 0, source: captured?.source ?? null, inventoryHash: captured?.captureCoverage?.inventoryHash ?? null }));
  } finally { owner.close(); }
}
