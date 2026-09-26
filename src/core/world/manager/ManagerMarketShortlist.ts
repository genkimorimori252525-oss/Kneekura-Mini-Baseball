import { financeSummary } from '../club/ClubFinance';
import type { ClubWorldState } from '../club/ClubTypes';
import { getManagerCandidateEstimate } from './ManagerCandidateEvidence';
import type { ManagerCandidateEvidenceLedger,
  ManagerCandidateEstimate } from './ManagerCandidateEvidence';

type SkillAxis = keyof ManagerCandidateEstimate['projectedSkills'];
type FitAxis = keyof ManagerCandidateEstimate['fit'];
export type ManagerHiringAxis = SkillAxis | FitAxis;
const axes: readonly ManagerHiringAxis[] = [
  'tacticalJudgment', 'analysis', 'adaptation',
  'playerEvaluation', 'operations', 'leadership',
  'philosophyFit', 'rosterFit', 'staffFit',
  'clubCultureFit', 'publicAcceptance',
];
export type ManagerHiringBrief = Readonly<{
  briefId: string;
  careerId: string;
  clubId: string;
  effectiveDay: number;
  priorityAxes: readonly ManagerHiringAxis[];
  minimumLowerBounds: Readonly<Partial<Record<ManagerHiringAxis, number>>>;
  maximumAnnualSalaryMinorUnits: number;
}>;
/** Observed willingness to negotiate, not a guaranteed offer acceptance. */
export type ManagerMarketTerms = Readonly<{
  careerId: string;
  clubId: string;
  managerId: string;
  interestSourceEventId: string;
  interestObservedAtDay: number;
  willingToNegotiate: boolean;
  desiredAnnualSalaryMinorUnits: number;
  termSeasons: number;
}>;
export type ManagerShortlistEntry = ManagerMarketTerms & Readonly<{
  estimate: ManagerCandidateEstimate;
}>;
export type ManagerShortlistRejection = Readonly<{
  managerId: string;
  reason: 'NO_ESTIMATE' | 'NO_INTEREST' | 'COST' | 'BELOW_MINIMUM';
}>;
export type ManagerMarketShortlist = Readonly<{
  briefId: string;
  clubId: string;
  effectiveDay: number;
  shortlist: readonly ManagerShortlistEntry[];
  rejected: readonly ManagerShortlistRejection[];
}>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value: unknown, keys: readonly string[]): boolean =>
  record(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const lower = (estimate: ManagerCandidateEstimate,
  axis: ManagerHiringAxis): number => {
  const value = axis in estimate.projectedSkills
    ? estimate.projectedSkills[axis as SkillAxis]
    : estimate.fit[axis as FitAxis];
  return value.mean - value.uncertainty;
};

/** Compares dated club observations under an explicit brief; no manager true skill enters. */
export const shortlistManagerCandidates = (
  club: ClubWorldState,
  evidence: ManagerCandidateEvidenceLedger,
  brief: ManagerHiringBrief,
  candidates: readonly ManagerMarketTerms[],
): ManagerMarketShortlist => {
  if (!fields(brief, ['briefId', 'careerId', 'clubId',
    'effectiveDay', 'priorityAxes', 'minimumLowerBounds',
    'maximumAnnualSalaryMinorUnits'])
    || !id(brief.briefId) || !day(brief.effectiveDay)
    || !Array.isArray(brief.priorityAxes)
    || brief.priorityAxes.length === 0
    || brief.priorityAxes.some((axis) => !axes.includes(axis))
    || new Set(brief.priorityAxes).size !== brief.priorityAxes.length
    || !record(brief.minimumLowerBounds)
    || Object.entries(brief.minimumLowerBounds).some(([axis, value]) =>
      !axes.includes(axis as ManagerHiringAxis)
        || !Number.isFinite(value))
    || !Number.isSafeInteger(brief.maximumAnnualSalaryMinorUnits)
    || brief.maximumAnnualSalaryMinorUnits <= 0) {
    throw new Error('invalid manager hiring brief');
  }
  if (brief.careerId !== club.careerId
    || brief.clubId !== club.identity.clubId
    || evidence.careerId !== club.careerId
    || evidence.clubId !== club.identity.clubId) {
    throw new Error('manager hiring scope mismatch');
  }
  if (brief.effectiveDay < club.effectiveDay) {
    throw new Error('manager hiring brief precedes club day');
  }
  if (club.live.references.staffRoleLinks.some((link) =>
    link.roleKind === 'MANAGER') || club.season.closureRef !== null) {
    throw new Error('manager hiring requires open-season vacancy');
  }
  if (!Array.isArray(candidates)) {
    throw new Error('invalid manager market candidates');
  }
  const seenManagers = new Set<string>();
  const seenInterest = new Set<string>();
  const shortlist: ManagerShortlistEntry[] = [];
  const rejected: ManagerShortlistRejection[] = [];
  const coachingHeadroom = financeSummary(club).budgetHeadroom.coaching;
  for (const candidate of candidates) {
    if (!fields(candidate, ['careerId', 'clubId',
      'managerId', 'interestSourceEventId',
      'interestObservedAtDay', 'willingToNegotiate',
      'desiredAnnualSalaryMinorUnits', 'termSeasons'])
      || !id(candidate.careerId) || !id(candidate.clubId)
      || !id(candidate.managerId)
      || !id(candidate.interestSourceEventId)
      || !day(candidate.interestObservedAtDay)
      || typeof candidate.willingToNegotiate !== 'boolean'
      || !Number.isSafeInteger(candidate.desiredAnnualSalaryMinorUnits)
      || candidate.desiredAnnualSalaryMinorUnits <= 0
      || !Number.isSafeInteger(candidate.termSeasons)
      || candidate.termSeasons <= 0
      || seenManagers.has(candidate.managerId)
      || seenInterest.has(candidate.interestSourceEventId)) {
      throw new Error('invalid or duplicate manager market candidate');
    }
    if (candidate.careerId !== club.careerId
      || candidate.clubId !== club.identity.clubId) {
      throw new Error('manager interest scope mismatch');
    }
    seenManagers.add(candidate.managerId);
    seenInterest.add(candidate.interestSourceEventId);
    const estimate = getManagerCandidateEstimate(evidence,
      candidate.managerId, brief.effectiveDay);
    let reason: ManagerShortlistRejection['reason'] | null = null;
    if (!estimate) reason = 'NO_ESTIMATE';
    else if (!candidate.willingToNegotiate
      || candidate.interestObservedAtDay > brief.effectiveDay) {
      reason = 'NO_INTEREST';
    } else if (candidate.desiredAnnualSalaryMinorUnits
      > brief.maximumAnnualSalaryMinorUnits
      || BigInt(candidate.desiredAnnualSalaryMinorUnits)
        * BigInt(candidate.termSeasons) > BigInt(coachingHeadroom)) {
      reason = 'COST';
    } else if (Object.entries(brief.minimumLowerBounds)
      .some(([axis, minimum]) => lower(estimate,
        axis as ManagerHiringAxis) < minimum)) {
      reason = 'BELOW_MINIMUM';
    }
    if (reason) rejected.push(Object.freeze({ managerId: candidate.managerId,
      reason }));
    else shortlist.push(Object.freeze({ ...candidate, estimate: estimate! }));
  }
  shortlist.sort((a, b) => {
    for (const axis of brief.priorityAxes) {
      const difference = lower(b.estimate, axis)
        - lower(a.estimate, axis);
      if (difference !== 0) return difference;
    }
    return a.managerId < b.managerId ? -1
      : a.managerId > b.managerId ? 1 : 0;
  });
  return Object.freeze({ briefId: brief.briefId, clubId: brief.clubId,
    effectiveDay: brief.effectiveDay,
    shortlist: Object.freeze(shortlist), rejected: Object.freeze(rejected) });
};
