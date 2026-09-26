import { finalizeDomesticCompetitionSeason,
  type DomesticCompetitionSeasonInput,
  type DomesticCompetitionSeasonSnapshot } from '../competition/DomesticCompetitionSeason';
import { applyClubCommand } from './ClubLifecycle';
import { readState } from './ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { same } from './ClubValidation';

export const DOMESTIC_PRIZE_AWARDS = [
  'DOMESTIC_CHAMPION', 'RUNNER_UP', 'REGULAR_SEASON_TITLE',
] as const;
export type DomesticPrizeAward = typeof DOMESTIC_PRIZE_AWARDS[number];
export type DomesticPrizePolicy = Readonly<{
  policyId: string;
  version: string;
  careerId: string;
  leagueId: string;
  seasonId: string;
  availableAtDay: number;
  currency: string;
  awards: Readonly<Record<DomesticPrizeAward, number>>;
}>;
export type DomesticPrizeBasis = Readonly<{
  award: DomesticPrizeAward;
  careerId: string;
  recipientClubId: string;
  seasonId: string;
  leagueId: string;
  finalizationEventId: string;
  policyId: string;
  policyVersion: string;
  finalizedAtDay: number;
  currency: string;
  amount: number;
}>;
export type DomesticPrizeApplication = Readonly<{
  state: ClubWorldState;
  event: ClubTransitionEvent;
  basis: DomesticPrizeBasis;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));

/** A pinned official season result may pay only a calibrated recipient. */
export const applyOfficialDomesticPrizeRevenue = (
  inputClub: ClubWorldState,
  source: DomesticCompetitionSeasonInput,
  snapshot: DomesticCompetitionSeasonSnapshot,
  policy: DomesticPrizePolicy,
  award: DomesticPrizeAward,
  finalizationEventId: string,
  finalizedAtDay: number,
): DomesticPrizeApplication => {
  const club = readState(inputClub);
  const recomputed = finalizeDomesticCompetitionSeason(source);
  if (!same(recomputed, snapshot)) {
    throw new Error('official domestic prize snapshot mismatch');
  }
  if (!fields(policy, ['policyId', 'version', 'careerId', 'leagueId',
    'seasonId', 'availableAtDay', 'currency', 'awards'])
    || !fields(policy.awards, DOMESTIC_PRIZE_AWARDS)
    || !id(policy.policyId) || !id(policy.version)
    || !id(policy.leagueId) || !id(policy.seasonId)
    || !id(policy.currency) || !day(policy.availableAtDay)
    || !DOMESTIC_PRIZE_AWARDS.includes(award)
    || DOMESTIC_PRIZE_AWARDS.some((kind) =>
      !Number.isSafeInteger(policy.awards[kind])
        || policy.awards[kind] < 0)
    || !id(finalizationEventId) || !day(finalizedAtDay)
    || policy.availableAtDay > finalizedAtDay
    || policy.careerId !== club.careerId
    || policy.leagueId !== snapshot.leagueId
    || policy.seasonId !== snapshot.seasonId
    || policy.currency !== club.season.plan.financialProfile.currency
    || policy.leagueId !== club.season.plan.financialProfile.leagueId) {
    throw new Error('invalid domestic prize policy or source');
  }
  const recipientClubId = award === 'DOMESTIC_CHAMPION'
    ? snapshot.domesticChampionSnapshot.championClubId
    : award === 'RUNNER_UP'
      ? snapshot.domesticChampionSnapshot.runnerUpClubId
      : snapshot.regularSeasonTitleSnapshot.winnerClubId;
  const amount = policy.awards[award];
  if (recipientClubId !== club.identity.clubId || amount <= 0
    || !snapshot.clubMembershipSnapshot.includes(recipientClubId)
    || !club.season.plan.competitionEditionIds.includes(snapshot.seasonId)
    || club.season.closureRef !== null
    || finalizedAtDay < club.season.plan.startsOnDay) {
    throw new Error('domestic prize recipient is unavailable');
  }
  const receiptId = `prize/${encodeURIComponent(snapshot.seasonId)}/${award}/${encodeURIComponent(recipientClubId)}`;
  if (club.live.finance.receipts.some((receipt) =>
    receipt.receiptId === receiptId)) {
    throw new Error('DUPLICATE_ID: domestic prize already recorded');
  }
  const basis: DomesticPrizeBasis = Object.freeze({ award,
    careerId: club.careerId,
    recipientClubId, seasonId: snapshot.seasonId,
    leagueId: snapshot.leagueId, finalizationEventId,
    policyId: policy.policyId, policyVersion: policy.version,
    finalizedAtDay, currency: policy.currency, amount });
  const applied = applyClubCommand(club, { eventId: receiptId,
    careerId: club.careerId, clubId: club.identity.clubId,
    expectedRevision: club.revision,
    effectiveDay: Math.max(club.effectiveDay, finalizedAtDay),
    causeEventIds: [finalizationEventId],
    operations: [{ kind: 'RECORD_REVENUE', category: 'prizeMoney',
      receiptId, amount, currency: policy.currency }],
  });
  if (!applied.ok) {
    throw new Error(`${applied.reason.code}: domestic prize revenue`);
  }
  return Object.freeze({ state: applied.state, event: applied.event,
    basis });
};
