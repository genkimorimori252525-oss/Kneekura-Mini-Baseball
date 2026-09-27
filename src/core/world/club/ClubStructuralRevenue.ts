import { replayClubEvents } from './ClubEvents';
import { applyClubCommand } from './ClubLifecycle';
import { readState } from './ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { same } from './ClubValidation';

export const STRUCTURAL_REVENUE_CATEGORIES = [
  'broadcasting', 'commercial', 'merchandise',
] as const;
export type StructuralRevenueCategory =
  typeof STRUCTURAL_REVENUE_CATEGORIES[number];
export type StructuralRevenueReceiptFact = Readonly<{
  factId: string;
  careerId: string;
  clubId: string;
  season: number;
  category: StructuralRevenueCategory;
  settlementRef: string;
  sourceEventId: string;
  receivedAtDay: number;
  availableAtDay: number;
  capacityRevisionAtReceipt: number;
  amount: number;
  currency: string;
}>;
export type StructuralRevenuePolicy = Readonly<{
  policyId: string;
  version: string;
  careerId: string;
  clubId: string;
  season: number;
  availableAtDay: number;
  currency: string;
  maximumSeasonAmount: number;
  allowedCategories: readonly StructuralRevenueCategory[];
}>;
export type StructuralRevenueClubHistory = Readonly<{
  checkpoint: ClubWorldState;
  acceptedEvents: readonly ClubTransitionEvent[];
}>;
export type StructuralRevenueBasis = Readonly<{
  factId: string;
  settlementRef: string;
  sourceEventId: string;
  clubId: string;
  season: number;
  category: StructuralRevenueCategory;
  receivedAtDay: number;
  availableAtDay: number;
  capacityRevision: number;
  capacityAtReceipt: number;
  policyId: string;
  policyVersion: string;
  policyAvailableAtDay: number;
  seasonLimit: number;
  currency: string;
  amount: number;
}>;
export type StructuralRevenueApplication = Readonly<{
  state: ClubWorldState;
  event: ClubTransitionEvent;
  basis: StructuralRevenueBasis;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const exactFields = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));

/** Recognizes an actual recurring settlement under the capacity at receipt time. */
export const applyReceivedStructuralRevenue = (
  inputClub: ClubWorldState,
  fact: StructuralRevenueReceiptFact,
  policy: StructuralRevenuePolicy,
  history: StructuralRevenueClubHistory,
): StructuralRevenueApplication => {
  const club = readState(inputClub);
  if (!exactFields(fact, ['factId', 'careerId', 'clubId', 'season',
    'category', 'settlementRef', 'sourceEventId', 'receivedAtDay',
    'availableAtDay', 'capacityRevisionAtReceipt', 'amount', 'currency'])
    || !exactFields(policy, ['policyId', 'version', 'careerId',
      'clubId', 'season', 'availableAtDay', 'currency',
      'maximumSeasonAmount', 'allowedCategories'])
    || !id(fact.factId) || !id(fact.settlementRef)
    || !id(fact.sourceEventId) || !id(fact.currency)
    || !id(policy.policyId) || !id(policy.version)
    || !id(policy.currency) || !day(fact.receivedAtDay)
    || !day(fact.availableAtDay)
    || fact.availableAtDay < fact.receivedAtDay
    || !day(fact.capacityRevisionAtReceipt)
    || !Number.isSafeInteger(fact.amount) || fact.amount <= 0
    || !day(policy.availableAtDay)
    || policy.availableAtDay > fact.receivedAtDay
    || !day(policy.maximumSeasonAmount)
    || !Array.isArray(policy.allowedCategories)
    || policy.allowedCategories.length === 0
    || new Set(policy.allowedCategories).size
      !== policy.allowedCategories.length
    || policy.allowedCategories.some((category) =>
      !STRUCTURAL_REVENUE_CATEGORIES.includes(category))
    || !STRUCTURAL_REVENUE_CATEGORIES.includes(fact.category)
    || !policy.allowedCategories.includes(fact.category)
    || fact.careerId !== club.careerId
    || fact.clubId !== club.identity.clubId
    || fact.season !== club.season.plan.season
    || fact.currency !== club.season.plan.financialProfile.currency
    || policy.careerId !== club.careerId
    || policy.clubId !== club.identity.clubId
    || policy.season !== club.season.plan.season
    || policy.currency !== fact.currency
    || fact.receivedAtDay < club.season.plan.startsOnDay
    || club.season.closureRef !== null) {
    throw new Error('invalid structural revenue fact or policy');
  }
  if (!history || !Array.isArray(history.acceptedEvents)
    || history.checkpoint.revision > fact.capacityRevisionAtReceipt) {
    throw new Error('invalid capacity revision history');
  }
  const current = replayClubEvents(history.checkpoint,
    history.acceptedEvents);
  if (!current.ok || !same(current.value, club)) {
    throw new Error('structural revenue club history mismatch');
  }
  const earlierEvents = history.acceptedEvents.filter((event) =>
    event.afterRevision <= fact.capacityRevisionAtReceipt);
  const atReceipt = replayClubEvents(history.checkpoint, earlierEvents);
  const nextEvent = history.acceptedEvents[earlierEvents.length];
  if (!atReceipt.ok
    || atReceipt.value.revision !== fact.capacityRevisionAtReceipt
    || atReceipt.value.careerId !== club.careerId
    || atReceipt.value.identity.clubId !== club.identity.clubId
    || atReceipt.value.season.plan.season !== fact.season
    || atReceipt.value.effectiveDay > fact.receivedAtDay
    || (nextEvent && nextEvent.command.effectiveDay
      <= fact.receivedAtDay)) {
    throw new Error('capacity revision does not match receipt time');
  }
  const capacity = atReceipt.value.institutional
    .structuralRevenueCapacity;
  if (policy.maximumSeasonAmount > capacity) {
    throw new Error('structural revenue policy exceeds observed capacity');
  }
  const receiptId = `structural/${fact.season}/${encodeURIComponent(
    fact.settlementRef)}`;
  if (club.live.finance.receipts.some((receipt) =>
    receipt.receiptId === receiptId
      || (receipt.kind === 'REVENUE'
        && receipt.causeEventIds.includes(fact.sourceEventId)))) {
    throw new Error('DUPLICATE_ID: structural revenue source');
  }
  const previouslyReceived = club.live.finance.receipts
    .filter((receipt) => receipt.kind === 'REVENUE'
      && receipt.season === fact.season
      && receipt.receiptId.startsWith(`structural/${fact.season}/`))
    .reduce((sum, receipt) => sum + BigInt(receipt.amount), 0n);
  if (previouslyReceived + BigInt(fact.amount)
    > BigInt(Math.min(policy.maximumSeasonAmount, capacity))) {
    throw new Error('structural revenue season limit exceeded');
  }
  const basis: StructuralRevenueBasis = Object.freeze({
    factId: fact.factId, settlementRef: fact.settlementRef,
    sourceEventId: fact.sourceEventId, clubId: fact.clubId,
    season: fact.season, category: fact.category,
    receivedAtDay: fact.receivedAtDay,
    availableAtDay: fact.availableAtDay,
    capacityRevision: atReceipt.value.revision,
    capacityAtReceipt: capacity,
    policyId: policy.policyId, policyVersion: policy.version,
    policyAvailableAtDay: policy.availableAtDay,
    seasonLimit: policy.maximumSeasonAmount,
    currency: fact.currency, amount: fact.amount,
  });
  const applied = applyClubCommand(club, {
    eventId: receiptId, careerId: club.careerId,
    clubId: club.identity.clubId,
    expectedRevision: club.revision,
    effectiveDay: Math.max(club.effectiveDay, fact.availableAtDay),
    causeEventIds: [fact.sourceEventId],
    operations: [{ kind: 'RECORD_REVENUE', receiptId,
      category: fact.category, amount: fact.amount,
      currency: fact.currency }],
  });
  if (!applied.ok) {
    throw new Error(`${applied.reason.code}: structural revenue`);
  }
  return Object.freeze({ state: applied.state, event: applied.event,
    basis });
};
