import type { ClubCommand, ClubOperation } from './ClubTypes';
import { BUDGET_BUCKETS, COST_CATEGORIES, REVENUE_CATEGORIES } from './ClubFinanceTypes';
import { capitalReader, facilitiesReader, ownerReader, planReader, referencesReader, stadiumReader } from './ClubSchemas';
import { enumeration, evidenceIds, fail, index, integer, list, nullable, object, positive, record, text, type Reader } from './ClubValidation';

const literal = <T extends string>(value: T) => enumeration([value]);
const moneyFields = { amount: positive, currency: text };
const readers: Readonly<Record<string, Reader<ClubOperation>>> = {
  RECORD_REVENUE: object({ kind: literal('RECORD_REVENUE'), receiptId: text, category: enumeration(REVENUE_CATEGORIES), ...moneyFields }),
  RECORD_COMMITMENT: object({ kind: literal('RECORD_COMMITMENT'), commitmentId: text, contractRef: text,
    category: enumeration(COST_CATEGORIES), budgetBucket: enumeration(BUDGET_BUCKETS), ...moneyFields }),
  SETTLE_COMMITMENT: object({ kind: literal('SETTLE_COMMITMENT'), receiptId: text, commitmentId: text, ...moneyFields }),
  RELEASE_COMMITMENT: object({ kind: literal('RELEASE_COMMITMENT'), commitmentId: text, ...moneyFields }),
  DRAW_DEBT: object({ kind: literal('DRAW_DEBT'), receiptId: text, ...moneyFields }),
  REPAY_DEBT: object({ kind: literal('REPAY_DEBT'), receiptId: text, ...moneyFields }),
  RENAME_CLUB: object({ kind: literal('RENAME_CLUB'), displayName: text, shortName: text }),
  RELOCATE_CLUB: object({ kind: literal('RELOCATE_CLUB'), homeCityId: text }),
  CHANGE_OWNER: object({ kind: literal('CHANGE_OWNER'), owner: ownerReader, ownershipBackingCapacity: index }),
  REFORM_GOVERNANCE: object({ kind: literal('REFORM_GOVERNANCE'), governanceRef: text }),
  REPLACE_STADIUM: object({ kind: literal('REPLACE_STADIUM'), stadium: stadiumReader }),
  UPDATE_FACILITIES: object({ kind: literal('UPDATE_FACILITIES'), facilities: facilitiesReader }),
  UPDATE_STRUCTURAL_CAPITAL: object({ kind: literal('UPDATE_STRUCTURAL_CAPITAL'), capital: capitalReader, structuralRevenueCapacity: integer }),
  UPDATE_REFERENCES: object({ kind: literal('UPDATE_REFERENCES'), references: referencesReader }),
  CLOSE_SEASON: object({ kind: literal('CLOSE_SEASON'), snapshotId: text, resultRefs: object({
    domesticResultRef: text, continentalResultRef: nullable(text), rosterSummaryRef: text, fanbaseSummaryRef: text, derivedSummaryRef: nullable(text) }) }),
  OPEN_SEASON: object({ kind: literal('OPEN_SEASON'), plan: planReader }),
};
export const operationReader: Reader<ClubOperation> = (input, path) => {
  const r = record(input, path); const kind = text(r.kind, path + '.kind');
  if (!Object.hasOwn(readers, kind)) fail('INVALID_INPUT', path + '.kind');
  return readers[kind]!(r, path);
};
export const commandReader: Reader<ClubCommand> = object({ eventId: text, careerId: text, clubId: text,
  expectedRevision: integer, effectiveDay: integer, causeEventIds: evidenceIds, operations: list(operationReader, undefined, true) });
