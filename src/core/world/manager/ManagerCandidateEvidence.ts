import type { ManagerEstimate, ManagerSkillProfile } from './ManagerDecision';
import type { ManagerCandidateEstimateRef } from './AcceptedManagerHire';

type SkillAxis = keyof ManagerSkillProfile;
type FitAxis = 'philosophyFit' | 'rosterFit' | 'staffFit'
  | 'clubCultureFit' | 'publicAcceptance';
const skillAxes: readonly SkillAxis[] = [
  'tacticalJudgment', 'analysis', 'adaptation',
  'playerEvaluation', 'operations', 'leadership',
];
const fitAxes: readonly FitAxis[] = [
  'philosophyFit', 'rosterFit', 'staffFit',
  'clubCultureFit', 'publicAcceptance',
];
type Estimates<Axis extends string> = Readonly<Record<Axis, ManagerEstimate>>;

export type ManagerCandidateObservation = Readonly<{
  eventId: string;
  careerId: string;
  clubId: string;
  managerId: string;
  kind: 'INTERVIEW' | 'REFERENCE' | 'CAREER_EVIDENCE';
  observedAtDay: number;
  projectedSkills: Readonly<Partial<Estimates<SkillAxis>>>;
  fit: Readonly<Partial<Estimates<FitAxis>>>;
}>;
export type ManagerCandidateEvidenceLedger = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  observations: readonly ManagerCandidateObservation[];
}>;
export type ManagerCandidateEstimate = ManagerCandidateEstimateRef & Readonly<{
  projectedSkills: Estimates<SkillAxis>;
  fit: Estimates<FitAxis>;
  uncertainty: number;
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

const validEstimates = (value: unknown, axes: readonly string[]): boolean =>
  record(value) && Object.entries(value).every(([axis, estimate]) =>
    axes.includes(axis) && record(estimate) && fields(estimate,
      ['mean', 'uncertainty', 'evidence'])
    && Number.isFinite(estimate.mean)
    && Number.isFinite(estimate.uncertainty)
    && Number(estimate.uncertainty) > 0
    && Number.isFinite(estimate.evidence)
    && Number(estimate.evidence) > 0);
const copyEstimates = <Axis extends string>(
  values: Readonly<Partial<Estimates<Axis>>>,
): Readonly<Partial<Estimates<Axis>>> => Object.freeze(Object.fromEntries(
  Object.entries(values).map(([axis, estimate]) =>
    [axis, Object.freeze({ ...(estimate as ManagerEstimate) })]),
) as Partial<Estimates<Axis>>);

const validateObservation = (observation: ManagerCandidateObservation): void => {
  if (!fields(observation, ['eventId', 'careerId', 'clubId',
    'managerId', 'kind', 'observedAtDay', 'projectedSkills', 'fit'])
    || !id(observation.eventId) || !id(observation.careerId)
    || !id(observation.clubId) || !id(observation.managerId)
    || !['INTERVIEW', 'REFERENCE', 'CAREER_EVIDENCE']
      .includes(observation.kind)
    || !day(observation.observedAtDay)
    || !validEstimates(observation.projectedSkills, skillAxes)
    || !validEstimates(observation.fit, fitAxes)
    || Object.keys(observation.projectedSkills).length
      + Object.keys(observation.fit).length === 0) {
    throw new Error('invalid manager candidate observation or uncertainty');
  }
};

const validateLedger = (ledger: ManagerCandidateEvidenceLedger): void => {
  if (!fields(ledger, ['careerId', 'clubId', 'revision', 'observations'])
    || !id(ledger.careerId) || !id(ledger.clubId)
    || !Array.isArray(ledger.observations)
    || ledger.revision !== ledger.observations.length) {
    throw new Error('invalid manager candidate evidence ledger');
  }
  const seen = new Set<string>();
  let previousDay = -1;
  for (const observation of ledger.observations) {
    validateObservation(observation);
    if (observation.careerId !== ledger.careerId
      || observation.clubId !== ledger.clubId) {
      throw new Error('manager candidate observation scope mismatch');
    }
    if (seen.has(observation.eventId)) {
      throw new Error('duplicate manager candidate observation');
    }
    if (observation.observedAtDay < previousDay) {
      throw new Error('manager candidate observations out of order');
    }
    seen.add(observation.eventId);
    previousDay = observation.observedAtDay;
  }
};

export const createManagerCandidateEvidenceLedger = (
  careerId: string, clubId: string,
): ManagerCandidateEvidenceLedger => {
  if (!id(careerId) || !id(clubId)) {
    throw new Error('invalid manager candidate evidence scope');
  }
  return Object.freeze({ careerId, clubId, revision: 0,
    observations: Object.freeze([]) });
};

/** Only club-observed reports enter this ledger; no manager true-skill field is accepted. */
export const appendManagerCandidateObservation = (
  ledger: ManagerCandidateEvidenceLedger, expectedRevision: number,
  observation: ManagerCandidateObservation,
): ManagerCandidateEvidenceLedger => {
  validateLedger(ledger);
  if (expectedRevision !== ledger.revision) {
    throw new Error('manager candidate evidence revision mismatch');
  }
  validateObservation(observation);
  if (observation.careerId !== ledger.careerId
    || observation.clubId !== ledger.clubId) {
    throw new Error('manager candidate observation scope mismatch');
  }
  if (ledger.observations.some((item) =>
    item.eventId === observation.eventId)) {
    throw new Error('duplicate manager candidate observation');
  }
  if (ledger.observations.length > 0
    && observation.observedAtDay
      < ledger.observations[ledger.observations.length - 1]!.observedAtDay) {
    throw new Error('manager candidate observations out of order');
  }
  const copy = Object.freeze({ ...observation,
    projectedSkills: copyEstimates(observation.projectedSkills),
    fit: copyEstimates(observation.fit) });
  return Object.freeze({ careerId: ledger.careerId, clubId: ledger.clubId,
    revision: ledger.revision + 1,
    observations: Object.freeze([...ledger.observations, copy]) });
};

/** A dated snapshot; unobserved axes remain unknown instead of being inferred from hidden skill. */
export const getManagerCandidateEstimate = (
  ledger: ManagerCandidateEvidenceLedger,
  managerId: string, asOfDay: number,
): ManagerCandidateEstimate | null => {
  validateLedger(ledger);
  if (!id(managerId) || !day(asOfDay)) {
    throw new Error('invalid manager candidate estimate request');
  }
  const reports = ledger.observations.filter((item) =>
    item.managerId === managerId && item.observedAtDay <= asOfDay);
  if (reports.length === 0) return null;
  const projectedSkills = Object.assign({},
    ...reports.map((report) => report.projectedSkills)) as Partial<Estimates<SkillAxis>>;
  const fit = Object.assign({},
    ...reports.map((report) => report.fit)) as Partial<Estimates<FitAxis>>;
  if (skillAxes.some((axis) => !projectedSkills[axis])
    || fitAxes.some((axis) => !fit[axis])) return null;
  const sourceEventIds = reports.map((report) => report.eventId);
  return Object.freeze({
    estimateId: `manager-estimate:${ledger.clubId}:${managerId}:${sourceEventIds.at(-1)}`,
    clubId: ledger.clubId, managerId,
    availableAtDay: reports.at(-1)!.observedAtDay,
    sourceEventIds: Object.freeze(sourceEventIds),
    projectedSkills: Object.freeze(projectedSkills as Estimates<SkillAxis>),
    fit: Object.freeze(fit as Estimates<FitAxis>),
    uncertainty: Math.max(...skillAxes.map((axis) => projectedSkills[axis]!.uncertainty),
      ...fitAxes.map((axis) => fit[axis]!.uncertainty)),
  });
};
