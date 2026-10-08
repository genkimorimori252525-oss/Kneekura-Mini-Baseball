import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ReceivedEnrollmentSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'received_umpire_defender_enrollment_v1';
  runtimeSourceId: string; physicalPitchSourceId: string; playerId: string;
  observationSourceId: string; currentExecutionSourceId: string;
  predecessorDecisionSourceId: string; predecessorMotorSourceId: string; predecessorAdoptionSourceId: string;
}>;
export type ReceivedAvailabilitySource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'received_umpire_defender_policy_availability_v1';
  provenance: 'accepted_at_current_actual_observation_v1'; enrollmentSourceId: string; policyDataSourceId: string;
  physicalPitchSourceId: string; playerId: string; observationSourceId: string; currentExecutionSourceId: string;
}>;
export type ReceivedReplanSource = Readonly<Omit<ReceivedEnrollmentSource, 'runtimeSourceId' | 'capability'> & {
  capability: 'received_umpire_defender_replan_v2'; enrollmentSourceId: string;
  policySourceId: string | null; previousReplanSourceId: string | null;
}>;
export const receivedId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
const refs = ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'observationSourceId', 'currentExecutionSourceId'];
const predecessor = ['predecessorDecisionSourceId', 'predecessorMotorSourceId', 'predecessorAdoptionSourceId'];
function validate<T extends {sourceId: string; capability: string}>(raw: T, capability: string, ids: readonly string[],
  sourceId?: string, nullable: readonly string[] = [], fixed: Readonly<Record<string, string>> = {}): T {
  const source = cloneInert(raw), keys = ['capability', ...ids, ...nullable, ...Object.keys(fixed)];
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).sort().join('|') !== [...keys].sort().join('|')
    || source.capability !== capability || sourceId !== undefined && source.sourceId !== sourceId
    || ids.some(key => !receivedId(Reflect.get(source, key)))
    || nullable.some(key => Reflect.get(source, key) !== null && !receivedId(Reflect.get(source, key)))
    || Object.entries(fixed).some(([key, value]) => Reflect.get(source, key) !== value)) throw new Error('invalid received defender Source');
  return freeze(source);
}
export const receivedEnrollmentInput = (raw: ReceivedEnrollmentSource, sourceId?: string) =>
  validate(raw, 'received_umpire_defender_enrollment_v1', [...refs, ...predecessor, 'runtimeSourceId'], sourceId);
export const receivedAvailabilityInput = (raw: ReceivedAvailabilitySource, sourceId?: string) =>
  validate(raw, 'received_umpire_defender_policy_availability_v1', [...refs, 'enrollmentSourceId', 'policyDataSourceId'], sourceId, [],
    { provenance: 'accepted_at_current_actual_observation_v1' });
export const receivedReplanInput = (raw: ReceivedReplanSource, sourceId?: string) =>
  validate(raw, 'received_umpire_defender_replan_v2', [...refs, ...predecessor, 'enrollmentSourceId'], sourceId,
    ['policySourceId', 'previousReplanSourceId']);
