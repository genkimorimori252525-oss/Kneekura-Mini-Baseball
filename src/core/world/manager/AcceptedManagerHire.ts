import { financeSummary } from '../club/ClubFinance';
import { applyClubCommand } from '../club/ClubLifecycle';
import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import { same } from '../club/ClubValidation';

/** A club-specific observation record. It has no hidden true-skill field. */
export type ManagerCandidateEstimateRef = Readonly<{
  estimateId: string;
  clubId: string;
  managerId: string;
  availableAtDay: number;
  sourceEventIds: readonly string[];
}>;
export type ManagerEmploymentOffer = Readonly<{
  offerId: string;
  estimateId: string;
  careerId: string;
  clubId: string;
  managerId: string;
  roleId: string;
  appointmentId: string;
  contractId: string;
  offeredAtDay: number;
  currency: string;
  annualSalaryMinorUnits: number;
  termSeasons: number;
}>;
export type ManagerOfferAcceptance = Readonly<{
  acceptanceId: string;
  sourceEventId: string;
  offerId: string;
  managerId: string;
  acceptedAtDay: number;
  accepted: true;
}>;
export type ManagerHireEvent = Readonly<{
  type: 'MANAGER_HIRED';
  eventId: string;
  sourceClubEventId: string;
  careerId: string;
  clubId: string;
  managerId: string;
  appointmentId: string;
  contractId: string;
  commitmentId: string;
  offerId: string;
  acceptanceId: string;
  estimateId: string;
  effectiveDay: number;
  beforeRevision: number;
  afterRevision: number;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Validates one accepted bilateral hire against the actual club transaction. */
export const applyAcceptedManagerHire = (
  before: ClubWorldState,
  after: ClubWorldState,
  clubEvent: ClubTransitionEvent,
  estimate: ManagerCandidateEstimateRef,
  offer: ManagerEmploymentOffer,
  acceptance: ManagerOfferAcceptance,
): Readonly<{ state: ClubWorldState; event: ManagerHireEvent }> => {
  if (before.live.references.staffRoleLinks.some((link) =>
    link.roleKind === 'MANAGER')
    || before.season.closureRef !== null) {
    throw new Error('manager hire requires an open-season vacancy');
  }
  if (!fields(estimate, ['estimateId', 'clubId',
    'managerId', 'availableAtDay', 'sourceEventIds'])
    || !id(estimate.estimateId)
    || estimate.clubId !== before.identity.clubId
    || !id(estimate.managerId)
    || !day(estimate.availableAtDay)
    || !Array.isArray(estimate.sourceEventIds)
    || estimate.sourceEventIds.length === 0
    || estimate.sourceEventIds.some((sourceId) => !id(sourceId))
    || new Set(estimate.sourceEventIds).size
      !== estimate.sourceEventIds.length) {
    throw new Error('invalid manager candidate estimate');
  }
  if (!fields(offer, ['offerId', 'estimateId', 'careerId',
    'clubId', 'managerId', 'roleId', 'appointmentId',
    'contractId', 'offeredAtDay', 'currency',
    'annualSalaryMinorUnits', 'termSeasons'])
    || !id(offer.offerId) || !id(offer.roleId)
    || !id(offer.appointmentId) || !id(offer.contractId)
    || !id(offer.currency)
    || offer.estimateId !== estimate.estimateId
    || offer.careerId !== before.careerId
    || offer.clubId !== before.identity.clubId
    || offer.managerId !== estimate.managerId
    || !day(offer.offeredAtDay)
    || offer.offeredAtDay < estimate.availableAtDay
    || !Number.isSafeInteger(offer.annualSalaryMinorUnits)
    || offer.annualSalaryMinorUnits <= 0
    || !Number.isSafeInteger(offer.termSeasons)
    || offer.termSeasons <= 0
    || offer.currency !== before.season.plan.financialProfile.currency) {
    throw new Error('invalid manager offer or estimate scope');
  }
  if (!fields(acceptance, ['acceptanceId', 'sourceEventId',
    'offerId', 'managerId', 'acceptedAtDay', 'accepted'])
    || !id(acceptance.acceptanceId)
    || !id(acceptance.sourceEventId)
    || acceptance.offerId !== offer.offerId
    || acceptance.managerId !== offer.managerId
    || acceptance.accepted !== true
    || !day(acceptance.acceptedAtDay)
    || acceptance.acceptedAtDay < offer.offeredAtDay
    || acceptance.acceptedAtDay > clubEvent.command.effectiveDay) {
    throw new Error('invalid manager offer acceptance');
  }
  const total = BigInt(offer.annualSalaryMinorUnits)
    * BigInt(offer.termSeasons);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('manager wage liability overflow');
  }
  if (total > BigInt(financeSummary(before).budgetHeadroom.coaching)) {
    throw new Error('manager wage liability exceeds coaching budget');
  }
  if (before.live.finance.commitments.some((item) =>
    item.contractRef === offer.contractId)
    || before.live.references.staffRoleLinks.some((link) =>
      link.appointmentId === offer.appointmentId)) {
    throw new Error('duplicate manager contract or appointment');
  }
  if (clubEvent.kind !== 'CLUB_CHANGED'
    || clubEvent.command.careerId !== before.careerId
    || clubEvent.command.clubId !== before.identity.clubId
    || clubEvent.command.effectiveDay < acceptance.acceptedAtDay
    || !clubEvent.command.causeEventIds.includes(estimate.estimateId)
    || !clubEvent.command.causeEventIds.includes(offer.offerId)
    || !clubEvent.command.causeEventIds.includes(
      acceptance.sourceEventId)) {
    throw new Error('manager club event omits accepted offer');
  }
  const replay = applyClubCommand(before, clubEvent.command);
  if (!replay.ok || !same(replay.state, after)
    || !same(replay.event, clubEvent)) {
    throw new Error('manager club event does not reproduce state');
  }
  const operations = clubEvent.command.operations;
  const liability = operations.find((op) =>
    op.kind === 'RECORD_COMMITMENT');
  const references = operations.find((op) =>
    op.kind === 'UPDATE_REFERENCES');
  if (operations.length !== 2
    || liability?.kind !== 'RECORD_COMMITMENT'
    || references?.kind !== 'UPDATE_REFERENCES'
    || liability.contractRef !== offer.contractId
    || liability.category !== 'staffWages'
    || liability.budgetBucket !== 'coaching'
    || liability.currency !== offer.currency
    || liability.amount !== Number(total)
    || !id(liability.commitmentId)) {
    throw new Error('manager signed wage liability is missing');
  }
  const appointed = { roleId: offer.roleId,
    roleKind: 'MANAGER' as const,
    personId: offer.managerId,
    appointmentId: offer.appointmentId };
  if (!same(after.live.references, {
    ...before.live.references,
    staffRoleLinks: [...before.live.references.staffRoleLinks,
      appointed],
  }) || !same(references.references, after.live.references)) {
    throw new Error('manager appointment does not match acceptance');
  }
  const event: ManagerHireEvent = Object.freeze({
    type: 'MANAGER_HIRED',
    eventId: `manager-hire:${clubEvent.command.eventId}`,
    sourceClubEventId: clubEvent.command.eventId,
    careerId: before.careerId,
    clubId: before.identity.clubId,
    managerId: offer.managerId,
    appointmentId: offer.appointmentId,
    contractId: offer.contractId,
    commitmentId: liability.commitmentId,
    offerId: offer.offerId,
    acceptanceId: acceptance.acceptanceId,
    estimateId: estimate.estimateId,
    effectiveDay: clubEvent.command.effectiveDay,
    beforeRevision: before.revision,
    afterRevision: after.revision,
  });
  return Object.freeze({ state: after, event });
};
