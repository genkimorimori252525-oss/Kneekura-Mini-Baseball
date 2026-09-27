import { getClubSeasonWageAllocations } from
  '../../core/world/club/ClubWageScheduleLedger';
import { assessCurrentSeasonFinancialRegulation,
  type FinancialRegulationAssessment } from
  '../../core/world/club/FinancialRegulationAssessment';
import type { SqliteFreeAgentContractStore } from
  './SqliteFreeAgentContractStore';
import type { SqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

export type DurableFinancialRegulationSources = Readonly<{
  world: Pick<SqliteWorldSettlementStore, 'readClub'>;
  wages: Pick<SqliteFreeAgentContractStore,
    'readWageSchedules'>;
}>;

/** Reads the pinned Club profile and accepted wage ledger at one World head. */
export const readCurrentFinancialRegulationFromWorld = (
  sources: DurableFinancialRegulationSources,
  careerId: string,
  clubId: string,
): FinancialRegulationAssessment => {
  const club = sources.world.readClub(careerId, clubId);
  const ledger = sources.wages.readWageSchedules(
    careerId, clubId);
  if (!club || !ledger || club.careerId !== careerId
    || club.clubId !== clubId
    || ledger.careerId !== careerId
    || ledger.clubId !== clubId) {
    throw new Error('financial regulation lacks durable Club or wage sources');
  }
  return assessCurrentSeasonFinancialRegulation(club.state,
    getClubSeasonWageAllocations(ledger, club.state));
};
