/** Amounts are safe integer minor units in the season's pinned simulation currency. */
export const REVENUE_CATEGORIES = ['matchday', 'broadcasting', 'commercial', 'merchandise', 'prizeMoney', 'transferIncome', 'ownerFunding', 'other'] as const;
export const BUDGET_BUCKETS = ['payroll', 'transfers', 'academy', 'scouting', 'coaching', 'medical', 'facilities'] as const;
export const COST_CATEGORIES = ['playerWages', 'staffWages', 'transferPayments', 'debtService', 'stadiumOperations', 'academyOperations', 'scoutingOperations', 'medicalOperations'] as const;
export type RevenueCategory = typeof REVENUE_CATEGORIES[number];
export type BudgetBucket = typeof BUDGET_BUCKETS[number];
export type CostCategory = typeof COST_CATEGORIES[number];
export type ClubBudgets = Readonly<Record<BudgetBucket, number>>;
export type ClubRevenue = Readonly<Record<RevenueCategory, number>>;
export type ClubCommitment = Readonly<{
  commitmentId: string; contractRef: string; category: CostCategory; budgetBucket: BudgetBucket;
  reservationSeason: number; amount: number; paidBeforeSeason: number; paidThisSeason: number; cancelledAmount: number;
}>;
export type ClubReceipt = Readonly<{
  receiptId: string; season: number; effectiveDay: number;
  kind: 'REVENUE' | 'COMMITMENT_PAYMENT' | 'DEBT_DRAW' | 'DEBT_REPAYMENT';
  amount: number; category: RevenueCategory | null; commitmentId: string | null;
  causeEventIds: readonly string[];
}>;
export type ClubFinanceState = Readonly<{
  openingCash: number; openingDebt: number; cash: number; debt: number;
  revenue: ClubRevenue; commitments: readonly ClubCommitment[]; receipts: readonly ClubReceipt[];
}>;
export type FinancialRegulationProfile = Readonly<{
  profileId: string; version: string; leagueId: string; season: number; currency: string;
  hardPayrollCap: number | null; luxuryTaxThreshold: number | null; squadCostRatioLimit: number | null;
  revenueSharingRate: number; insolvencyRuleRef: string; ownerFundingPolicyRef: string;
}>;
export type ClubFinanceOperation =
  | Readonly<{ kind: 'RECORD_REVENUE'; receiptId: string; category: RevenueCategory; amount: number; currency: string }>
  | Readonly<{ kind: 'RECORD_COMMITMENT'; commitmentId: string; contractRef: string; category: CostCategory; budgetBucket: BudgetBucket; amount: number; currency: string }>
  | Readonly<{ kind: 'SETTLE_COMMITMENT'; receiptId: string; commitmentId: string; amount: number; currency: string }>
  | Readonly<{ kind: 'RELEASE_COMMITMENT'; commitmentId: string; amount: number; currency: string }>
  | Readonly<{ kind: 'DRAW_DEBT' | 'REPAY_DEBT'; receiptId: string; amount: number; currency: string }>;
export type ClubFinanceSummary = Readonly<{
  scope: 'ACCOUNTING_ONLY'; careerId: string; clubId: string; season: number; revision: number; currency: string;
  cash: number; debt: number; receivedRevenue: number; paidOperatingCosts: number;
  outstandingCommitments: number; cashAfterReserve: number;
  budgetAllocated: ClubBudgets; budgetHeadroom: ClubBudgets;
}>;
