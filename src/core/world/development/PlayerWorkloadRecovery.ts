import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export const PLAYER_WORKLOAD_RECOVERY_VERSION = 'player-workload-recovery-v1' as const;
export type PlayerWorkloadRecoveryPolicy = Readonly<{
  policyId: string; version: string; availableAtDay: number;
  workloadFatiguePerUnit: number; travelFatiguePerKm: number; recoveryPerHour: number;
}>;
export type PlayerWorkloadBaseline = Readonly<{
  careerId: string; playerId: string; createdAtDay: number; fatigue: number;
  recoveryCapacity: number; policy: PlayerWorkloadRecoveryPolicy;
}>;
export type PlayerWorkloadRecoveryState = PlayerWorkloadBaseline & Readonly<{
  modelVersion: typeof PLAYER_WORKLOAD_RECOVERY_VERSION; effectiveDay: number; revision: number;
}>;
type ActivityScope = Readonly<{
  sourceEventId: string; sourceVersion: string; evidenceId: string;
  careerId: string; playerId: string; atDay: number;
}>;
export type PlayerWorkloadActivity = ActivityScope & (
  Readonly<{ kind: 'MATCH'; effortUnits: number }>
  | Readonly<{ kind: 'PRACTICE'; effortUnits: number; healthAvailability: number }>
  | Readonly<{ kind: 'TRAVEL'; distanceKm: number }>
  | Readonly<{ kind: 'RECOVERY'; durationHours: number; quality: number; medicalAvailability: number }>
);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unit = (value: unknown): value is number => nonnegative(value) && value <= 1;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const baselineFields = ['careerId', 'playerId', 'createdAtDay', 'fatigue', 'recoveryCapacity', 'policy'] as const;
const validateBaseline = (input: PlayerWorkloadBaseline): void => {
  if (!id(input.careerId) || !id(input.playerId) || !day(input.createdAtDay) || !unit(input.fatigue) || !unit(input.recoveryCapacity)) {
    throw new Error('invalid Player workload baseline');
  }
  const policy = input.policy;
  if (!fields(policy, ['policyId', 'version', 'availableAtDay', 'workloadFatiguePerUnit', 'travelFatiguePerKm', 'recoveryPerHour'])
    || !id(policy.policyId) || !id(policy.version) || !day(policy.availableAtDay) || policy.availableAtDay > input.createdAtDay
    || !nonnegative(policy.workloadFatiguePerUnit) || !nonnegative(policy.travelFatiguePerKm) || !nonnegative(policy.recoveryPerHour)) {
    throw new Error('invalid or future Player workload policy');
  }
};
const freeze = (input: PlayerWorkloadRecoveryState): PlayerWorkloadRecoveryState => Object.freeze({ ...input, policy: Object.freeze({ ...input.policy }) });

/** Explicit calibration and accepted physical state, without schedule/league/outcome modifiers. */
export const createPlayerWorkloadRecovery = (raw: PlayerWorkloadBaseline): PlayerWorkloadRecoveryState => {
  const input = cloneInert(raw);
  if (!fields(input, baselineFields)) throw new Error('invalid Player workload baseline fields');
  validateBaseline(input);
  return freeze({ ...input, modelVersion: PLAYER_WORKLOAD_RECOVERY_VERSION, effectiveDay: input.createdAtDay, revision: 0 });
};

/** No elapsed-day recovery is synthesized. Same-day causality is ordered by revision. */
export const advancePlayerWorkloadRecovery = (rawState: PlayerWorkloadRecoveryState, expectedRevision: number,
  rawActivity: PlayerWorkloadActivity): PlayerWorkloadRecoveryState => {
  const state = cloneInert(rawState), activity = cloneInert(rawActivity);
  if (!fields(state, [...baselineFields, 'modelVersion', 'effectiveDay', 'revision'])
    || state.modelVersion !== PLAYER_WORKLOAD_RECOVERY_VERSION || !day(state.revision) || state.revision === Number.MAX_SAFE_INTEGER
    || !day(expectedRevision) || expectedRevision !== state.revision || !day(state.effectiveDay) || state.effectiveDay < state.createdAtDay) {
    throw new Error('invalid Player workload state or revision');
  }
  validateBaseline(state);
  const common = ['sourceEventId', 'sourceVersion', 'evidenceId', 'careerId', 'playerId', 'atDay', 'kind'];
  if (!activity || !id(activity.sourceEventId) || !id(activity.sourceVersion) || !id(activity.evidenceId)
    || activity.careerId !== state.careerId || activity.playerId !== state.playerId || !day(activity.atDay) || activity.atDay < state.effectiveDay) {
    throw new Error('Player workload activity scope or chronology differs');
  }
  let delta: number;
  switch (activity.kind) {
    case 'MATCH':
    case 'PRACTICE':
      if (!fields(activity, [...common, 'effortUnits', ...(activity.kind === 'PRACTICE' ? ['healthAvailability'] : [])])
        || !nonnegative(activity.effortUnits) || activity.kind === 'PRACTICE' && !unit(activity.healthAvailability)) {
        throw new Error('invalid accepted Player workload effort');
      }
      delta = state.policy.workloadFatiguePerUnit * activity.effortUnits;
      break;
    case 'TRAVEL':
      if (!fields(activity, [...common, 'distanceKm']) || !nonnegative(activity.distanceKm)) throw new Error('invalid accepted Player travel');
      delta = state.policy.travelFatiguePerKm * activity.distanceKm;
      break;
    case 'RECOVERY':
      if (!fields(activity, [...common, 'durationHours', 'quality', 'medicalAvailability']) || !nonnegative(activity.durationHours)
        || activity.durationHours > 24 || !unit(activity.quality) || !unit(activity.medicalAvailability)) throw new Error('invalid accepted Player recovery');
      delta = -(state.policy.recoveryPerHour * activity.durationHours * state.recoveryCapacity * activity.quality * activity.medicalAvailability);
      break;
    default: throw new Error('unknown Player workload activity');
  }
  const fatigue = state.fatigue + delta;
  if (!Number.isFinite(delta) || !Number.isFinite(fatigue)) throw new Error('Player workload arithmetic overflow');
  return freeze({ ...state, effectiveDay: activity.atDay, revision: state.revision + 1, fatigue: Math.max(0, Math.min(1, fatigue)) });
};
