import type { DatabaseSync } from 'node:sqlite';
import type { ActualLiveParticipationReceipt, CompletedPlayParticipationReceipt } from './SqliteOfficialParticipationStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveActualLiveParticipationEvidence } from './ActualLiveParticipationEvidenceFromSqlite';
import { deriveCompletedPlayParticipationEvidence } from './CompletedPlayParticipationEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { assertTaggedParticipationFields, participationReceiptId, readOwnedParticipationBindingJson,
  readOwnedParticipationReceiptRow, participationHasRawDiscriminator } from './ActualLiveParticipationMetadata';

type Db = Pick<DatabaseSync, 'prepare'>;
export type TaggedParticipationReceipt = ActualLiveParticipationReceipt | CompletedPlayParticipationReceipt;
/** Format classification only. Admission and consumers must still replay the original Native owner. */
export const isNationalParticipationKind = (kind: unknown): boolean => kind === 'NATIONAL_PHYSICAL_PLAY_V1'
  || kind === 'NATIONAL_ACTUAL_LIVE_V1' || kind === 'NATIONAL_FOUL_TERMINAL_V1';
export const isSupportedParticipationKind = (kind: unknown): kind is TaggedParticipationReceipt['evidenceKind'] =>
  kind === 'ACTUAL_LIVE_V1' || kind === 'PHYSICAL_PLAY_V1' || kind === 'FOUL_TERMINAL_V1' || isNationalParticipationKind(kind);

/** Shared consumer-side rederivation. The caller owns the Native read/write transaction. */
export const readTaggedParticipationReceipt = (db: Db, receiptId: string): TaggedParticipationReceipt => withBattedVenueLegalReadSnapshot(db as DatabaseSync, () => {
  const row = readOwnedParticipationReceiptRow(db, receiptId);
  if (!row || !participationHasRawDiscriminator(db, row.receipt_json)) throw new Error('tagged participation original receipt is missing');
  const receipt = JSON.parse(row.receipt_json) as TaggedParticipationReceipt;
  if (!isSupportedParticipationKind(receipt.evidenceKind)) throw new Error('unsupported participation receipt format');
  assertTaggedParticipationFields(db, row.receipt_json, receipt.evidenceKind);
  const evidence = receipt.evidenceKind === 'ACTUAL_LIVE_V1' || receipt.evidenceKind === 'NATIONAL_ACTUAL_LIVE_V1'
    ? deriveActualLiveParticipationEvidence(db, row.game_id, row.player_id, receipt.closureSourceId, receipt.evidenceKind)
    : deriveCompletedPlayParticipationEvidence(db, row.game_id, row.player_id, receipt.closureSourceId, receipt.evidenceKind);
  const bindingJson = readOwnedParticipationBindingJson(db, row.game_id, row.player_id);
  if (receipt.receiptId !== participationReceiptId(row.game_id, row.player_id) || bindingJson === null
    || row.receipt_json !== json(receipt) || row.receipt_json !== json(evidence.receipt)
    || json(JSON.parse(bindingJson)) !== json(receipt.binding)) throw new Error('tagged participation receipt differs from original evidence');
  return freeze(receipt);
});
