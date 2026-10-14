import type { ManagerHireWageReference } from '../../core/world/manager/ManagerHireTransaction';
import type { StructuralRevenuePolicy,
  StructuralRevenueReceiptFact } from
  '../../core/world/club/ClubStructuralRevenue';
import type { AnnualWagePaymentPolicy } from
  '../../core/world/club/ScheduledPlayerWagePayment';
import type { ClubEconomyStoreRequest,
  DurableClubEconomyApplication,
  SqliteClubEconomyStore } from './SqliteClubEconomyStore';

type CommonOperation = Pick<ClubEconomyStoreRequest,
  'applicationId' | 'expectedClubRevision' | 'club' | 'history'
  | 'wageSchedules'>;
export type StructuralRevenueOperation = Readonly<CommonOperation & {
  kind: 'STRUCTURAL_REVENUE';
  fact: StructuralRevenueReceiptFact;
  policy: StructuralRevenuePolicy;
}>;
export type PlayerWageOperation = Readonly<CommonOperation & {
  kind: 'PLAYER_WAGE';
  commitmentId: string;
  payrollRunEventId: string;
  policy: AnnualWagePaymentPolicy;
}>;
export type StaffWageOperation = Readonly<Omit<PlayerWageOperation, 'kind'> & {
  kind: 'STAFF_WAGE'; managerHire: ManagerHireWageReference;
}>;
export type ClubEconomyOperation =
  | StructuralRevenueOperation | PlayerWageOperation | StaffWageOperation;

/**
 * Adopts one source-backed non-Matchday operation. Keep the exact operation
 * evidence for retry; the store pins it by applicationId and checks Club CAS.
 * Core source rules own season, receipt, due-date and availability validation.
 */
export const persistClubEconomyOperation = (
  store: SqliteClubEconomyStore,
  operation: ClubEconomyOperation,
): DurableClubEconomyApplication => {
  const { applicationId, expectedClubRevision, club, history,
    wageSchedules } = operation;
  const common = { applicationId, expectedClubRevision, club, history,
    wageSchedules };
  if (operation.kind === 'STRUCTURAL_REVENUE') {
    return store.apply({ ...common, sources: [{
      kind: 'STRUCTURAL_REVENUE', fact: operation.fact,
      policy: operation.policy,
    }] });
  }
  if (operation.kind === 'PLAYER_WAGE') {
    return store.apply({ ...common, sources: [{
      kind: 'PLAYER_WAGE', commitmentId: operation.commitmentId,
      payrollRunEventId: operation.payrollRunEventId,
      policy: operation.policy,
    }] });
  }
  if (operation.kind === 'STAFF_WAGE') {
    return store.apply({ ...common, sources: [{ kind: 'STAFF_WAGE',
      commitmentId: operation.commitmentId, managerHire: operation.managerHire,
      payrollRunEventId: operation.payrollRunEventId, policy: operation.policy,
    }] });
  }
  throw new Error('unknown club economy operation');
};
