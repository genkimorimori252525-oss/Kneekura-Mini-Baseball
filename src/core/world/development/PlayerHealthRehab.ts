import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export const PLAYER_HEALTH_REHAB_VERSION = 'player-health-rehab-v1' as const;
export type HealthRehabPolicy = Readonly<{
  policyId: string; version: string; availableAtDay: number; medicalBurdenReductionPerHour: number;
  rehabEntryMaximumBurden: number; returnMaximumBurden: number; practiceExposurePerEffortUnit: number;
  minimumPracticeExposure: number; minimumRehabGames: number;
}>;
export type PlayerHealthDiagnosis = Readonly<{
  caseId: string; careerId: string; playerId: string; diagnosedAtDay: number; injuryBurden: number; policy: HealthRehabPolicy;
}>;
type EvidenceScope = Readonly<{
  sourceId: string; sourceVersion: string; caseId: string; careerId: string; playerId: string; atDay: number;
}>;
export type HealthRehabEvidence = EvidenceScope & (
  Readonly<{ kind: 'MEDICAL_RECOVERY'; workloadActivityId: string; durationHours: number; quality: number;
    medicalAvailability: number; recoveryCapacity: number }>
  | Readonly<{ kind: 'REHAB_PRACTICE'; workloadActivityId: string; effortUnits: number; beforeFatigue: number; healthAvailability: number }>
  | Readonly<{ kind: 'REHAB_GAME'; gameId: string; participationReceiptId: string; rosterSnapshotId: string }>
);
export type PlayerHealthRehabState = PlayerHealthDiagnosis & Readonly<{
  modelVersion: typeof PLAYER_HEALTH_REHAB_VERSION; revision: number; effectiveDay: number; phase: 'INJURED' | 'REHAB' | 'READY';
  practiceExposure: number; medicalRecoveryHours: number; medicalWorkloadIds: readonly string[]; practiceWorkloadIds: readonly string[];
  rehabGameIds: readonly string[]; acceptedSourceIds: readonly string[];
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unit = (value: unknown): value is number => nonnegative(value) && value <= 1;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const baselineFields = ['caseId', 'careerId', 'playerId', 'diagnosedAtDay', 'injuryBurden', 'policy'];
const validateDiagnosis = (input: PlayerHealthDiagnosis): void => {
  if (!id(input.caseId) || !id(input.careerId) || !id(input.playerId) || !day(input.diagnosedAtDay) || !unit(input.injuryBurden)) {
    throw new Error('invalid clinical diagnosis scope or burden');
  }
  const policy = input.policy;
  if (!fields(policy, ['policyId', 'version', 'availableAtDay', 'medicalBurdenReductionPerHour', 'rehabEntryMaximumBurden',
    'returnMaximumBurden', 'practiceExposurePerEffortUnit', 'minimumPracticeExposure', 'minimumRehabGames'])
    || !id(policy.policyId) || !id(policy.version) || !day(policy.availableAtDay) || policy.availableAtDay > input.diagnosedAtDay
    || !nonnegative(policy.medicalBurdenReductionPerHour) || !unit(policy.rehabEntryMaximumBurden) || policy.rehabEntryMaximumBurden >= 1
    || !unit(policy.returnMaximumBurden) || policy.returnMaximumBurden > policy.rehabEntryMaximumBurden
    || !nonnegative(policy.practiceExposurePerEffortUnit) || !positive(policy.minimumPracticeExposure)
    || !day(policy.minimumRehabGames) || policy.minimumRehabGames < 1) throw new Error('invalid or future clinical rehabilitation policy');
};
const phase = (state: Pick<PlayerHealthRehabState, 'injuryBurden' | 'medicalRecoveryHours' | 'practiceExposure' | 'rehabGameIds' | 'policy'>): PlayerHealthRehabState['phase'] => {
  if (state.medicalRecoveryHours <= 0 || state.injuryBurden > state.policy.rehabEntryMaximumBurden) return 'INJURED';
  if (state.injuryBurden <= state.policy.returnMaximumBurden && state.practiceExposure >= state.policy.minimumPracticeExposure
    && state.rehabGameIds.length >= state.policy.minimumRehabGames) return 'READY';
  return 'REHAB';
};
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Clinical truth is independent of Club rights, assignment, registration and global fatigue. */
export const createPlayerHealthRehab = (raw: PlayerHealthDiagnosis): PlayerHealthRehabState => {
  const input = cloneInert(raw);
  if (!fields(input, baselineFields) || !positive(input.injuryBurden)) throw new Error('clinical diagnosis requires positive injury burden');
  validateDiagnosis(input);
  return freeze({ ...input, modelVersion: PLAYER_HEALTH_REHAB_VERSION, revision: 0, effectiveDay: input.diagnosedAtDay,
    phase: 'INJURED', practiceExposure: 0, medicalRecoveryHours: 0, medicalWorkloadIds: [], practiceWorkloadIds: [], rehabGameIds: [], acceptedSourceIds: [] });
};

/** Evidence is resolved by the Native owners; elapsed days never synthesize medical care or rehabilitation. */
export const advancePlayerHealthRehab = (rawState: PlayerHealthRehabState, expectedRevision: number,
  rawEvidence: HealthRehabEvidence): PlayerHealthRehabState => {
  const state = cloneInert(rawState), evidence = cloneInert(rawEvidence);
  if (!fields(state, [...baselineFields, 'modelVersion', 'revision', 'effectiveDay', 'phase', 'practiceExposure', 'medicalRecoveryHours',
    'medicalWorkloadIds', 'practiceWorkloadIds', 'rehabGameIds', 'acceptedSourceIds']) || state.modelVersion !== PLAYER_HEALTH_REHAB_VERSION
    || !day(state.revision) || state.revision === Number.MAX_SAFE_INTEGER || !day(expectedRevision) || expectedRevision !== state.revision
    || !day(state.effectiveDay) || state.effectiveDay < state.diagnosedAtDay || !nonnegative(state.practiceExposure) || !nonnegative(state.medicalRecoveryHours)) {
    throw new Error('invalid clinical state or revision');
  }
  validateDiagnosis(state);
  for (const values of [state.medicalWorkloadIds, state.practiceWorkloadIds, state.rehabGameIds, state.acceptedSourceIds]) {
    if (!Array.isArray(values) || values.some((value) => !id(value)) || new Set(values).size !== values.length) throw new Error('invalid clinical evidence history');
  }
  if (state.acceptedSourceIds.length !== state.revision
    || state.medicalWorkloadIds.length + state.practiceWorkloadIds.length + state.rehabGameIds.length !== state.revision
    || state.phase !== phase(state)) throw new Error('clinical evidence history or phase differs');
  if (!evidence || !id(evidence.sourceId) || !id(evidence.sourceVersion) || evidence.caseId !== state.caseId
    || evidence.careerId !== state.careerId || evidence.playerId !== state.playerId || !day(evidence.atDay) || evidence.atDay < state.effectiveDay) {
    throw new Error('clinical effect scope or chronology differs');
  }
  if (state.acceptedSourceIds.includes(evidence.sourceId)) throw new Error('clinical effect Source is reused');
  const common = ['sourceId', 'sourceVersion', 'caseId', 'careerId', 'playerId', 'atDay', 'kind'];
  let injuryBurden = state.injuryBurden, practiceExposure = state.practiceExposure, medicalRecoveryHours = state.medicalRecoveryHours;
  let medicalWorkloadIds = state.medicalWorkloadIds, practiceWorkloadIds = state.practiceWorkloadIds, rehabGameIds = state.rehabGameIds;
  if (evidence.kind === 'MEDICAL_RECOVERY' || evidence.kind === 'REHAB_PRACTICE') {
    if (!id(evidence.workloadActivityId)) throw new Error('clinical effect lacks actual workload');
    if ([...medicalWorkloadIds, ...practiceWorkloadIds].includes(evidence.workloadActivityId)) throw new Error('clinical workload is reused');
  }
  switch (evidence.kind) {
    case 'MEDICAL_RECOVERY': {
      if (!fields(evidence, [...common, 'workloadActivityId', 'durationHours', 'quality', 'medicalAvailability', 'recoveryCapacity'])
        || !positive(evidence.durationHours) || evidence.durationHours > 24 || !unit(evidence.quality)
        || !unit(evidence.medicalAvailability) || !unit(evidence.recoveryCapacity)) throw new Error('invalid actual medical recovery');
      const hours = evidence.durationHours * evidence.quality * evidence.medicalAvailability * evidence.recoveryCapacity;
      const reduction = state.policy.medicalBurdenReductionPerHour * hours;
      medicalRecoveryHours += hours;
      if (!Number.isFinite(reduction) || !Number.isFinite(medicalRecoveryHours)) throw new Error('clinical recovery arithmetic overflow');
      injuryBurden = Math.max(0, injuryBurden - reduction); medicalWorkloadIds = [...medicalWorkloadIds, evidence.workloadActivityId];
      break;
    }
    case 'REHAB_PRACTICE': {
      if (state.phase === 'INJURED') throw new Error('rehabilitation practice requires actual medical recovery');
      if (!fields(evidence, [...common, 'workloadActivityId', 'effortUnits', 'beforeFatigue', 'healthAvailability'])
        || !nonnegative(evidence.effortUnits) || !unit(evidence.beforeFatigue) || !unit(evidence.healthAvailability)) throw new Error('invalid actual rehabilitation practice');
      const exposure = state.policy.practiceExposurePerEffortUnit * evidence.effortUnits * (1 - evidence.beforeFatigue)
        * Math.min(evidence.healthAvailability, 1 - injuryBurden);
      practiceExposure += exposure;
      if (!Number.isFinite(exposure) || !Number.isFinite(practiceExposure)) throw new Error('clinical practice arithmetic overflow');
      practiceWorkloadIds = [...practiceWorkloadIds, evidence.workloadActivityId]; break;
    }
    case 'REHAB_GAME':
      if (rehabGameIds.includes(evidence.gameId)) throw new Error('clinical game exposure is reused');
      if (state.phase === 'INJURED' || practiceExposure <= 0) throw new Error('rehab game requires effective rehabilitation practice');
      if (!fields(evidence, [...common, 'gameId', 'participationReceiptId', 'rosterSnapshotId']) || !id(evidence.gameId)
        || !id(evidence.participationReceiptId) || !id(evidence.rosterSnapshotId)) throw new Error('invalid actual rehabilitation game');
      rehabGameIds = [...rehabGameIds, evidence.gameId]; break;
    default: throw new Error('unknown clinical rehabilitation effect');
  }
  const next = { ...state, revision: state.revision + 1, effectiveDay: evidence.atDay, injuryBurden, practiceExposure, medicalRecoveryHours,
    medicalWorkloadIds, practiceWorkloadIds, rehabGameIds, acceptedSourceIds: [...state.acceptedSourceIds, evidence.sourceId] };
  return freeze({ ...next, phase: phase(next) });
};
