import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readReservedPaClaimRows } from './SamePlateAppearanceProvisionalClaimGuard';
import { readPaDispatchClaimRows } from './SamePlateAppearanceDispatchClaimGuard';
import { readSamePaContinuationClaimRows } from './SamePlateAppearanceContinuationClaimGuard';
export type SamePaReleasedClaimCensus = readonly Readonly<{ table: string; rowHash: string }>[];
/** Exact immutable scope, including accepted-but-unused preparation. These
 * collectors authenticate metadata/root links only and never follow release. */
export const readSamePaReleasedClaimCensus = (db: Pick<DatabaseSync, 'prepare'>, enrollmentSourceId: string): SamePaReleasedClaimCensus =>
  [...readReservedPaClaimRows(db, enrollmentSourceId), ...readPaDispatchClaimRows(db, enrollmentSourceId), ...readSamePaContinuationClaimRows(db, enrollmentSourceId)]
    .map(({ table, row }) => ({ table, rowHash: hash(row) })).sort((a, b) => json(a).localeCompare(json(b)));
