import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assessActivePhysicalPitchWorkload, type PhysicalPitchWorkload } from '../../core/world/development/OfficialPhysicalPitchWorkload';
import { resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld, type WorkloadBoundPlayerPitchRequest,
  type WorkloadBoundPlayerPitchResult } from './WorkloadBoundPlayerPitchRuntime';
import type { AcceptedPhysicalPitchEffortPolicy } from './SqliteOfficialPitchWorkloadStore';

export type ContinuousPlayerPitchRequest = WorkloadBoundPlayerPitchRequest & Readonly<{ effortPolicySourceId: string }>;
export type ContinuousPlayerPitchResult = WorkloadBoundPlayerPitchResult & Readonly<{
  prefixWorkload: PhysicalPitchWorkload; effectiveFatigue: number; effortPolicy: AcceptedPhysicalPitchEffortPolicy;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Prior physical actions affect execution immediately; official closure alone writes global workload. */
export const resolveContinuousPlayerPitchAgainstBatterFromWorld = (
  stores: Parameters<typeof resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld>[0] & Readonly<{
    effortPolicies: Readonly<{ readAcceptedPolicy(sourceId: string): AcceptedPhysicalPitchEffortPolicy | null }>;
  }>, rawInput: ContinuousPlayerPitchRequest,
): ContinuousPlayerPitchResult => {
  const input = cloneInert(rawInput);
  if (!input || !fields(input, ['timeline', 'delivery', 'flight', 'batter', 'workloadRevision', 'policySourceId', 'effortPolicySourceId'])
    || !id(input.effortPolicySourceId) || !input.delivery) throw new Error('invalid continuous pitch request');
  const effortPolicy = cloneInert(stores.effortPolicies.readAcceptedPolicy(input.effortPolicySourceId));
  if (!effortPolicy || !fields(effortPolicy, ['sourceId', 'sourceVersion', 'policyId', 'version', 'availableAtDay', 'effortUnitsPerPhysicalPitch'])
    || effortPolicy.sourceId !== input.effortPolicySourceId || !id(effortPolicy.sourceVersion)) throw new Error('accepted physical pitch effort policy is missing or differs');
  const { sourceId: _sourceId, sourceVersion: _sourceVersion, ...calibration } = effortPolicy;
  const prefixWorkload = assessActivePhysicalPitchWorkload(input.timeline, calibration, input.delivery.gameDay);
  const workload = cloneInert(stores.workload.selectAtRevision(input.delivery.careerId, input.delivery.playerId, input.workloadRevision));
  const fatiguePerUnit = workload?.policy?.workloadFatiguePerUnit;
  if (!workload || !Number.isFinite(workload.fatigue) || workload.fatigue < 0 || workload.fatigue > 1
    || !Number.isFinite(fatiguePerUnit) || fatiguePerUnit < 0) throw new Error('invalid continuous pitch workload baseline');
  const delta = prefixWorkload.effortUnits * fatiguePerUnit, unbounded = workload.fatigue + delta;
  if (!Number.isFinite(delta) || !Number.isFinite(unbounded)) throw new Error('continuous physical pitch fatigue arithmetic overflow');
  const effectiveFatigue = Math.min(1, unbounded);
  const { effortPolicySourceId: _effortPolicySourceId, ...request } = input;
  const result = resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld({ ...stores,
    workload: { selectAtRevision: () => ({ ...workload, fatigue: effectiveFatigue }) } }, request);
  return freeze({ ...result, workload, prefixWorkload, effectiveFatigue, effortPolicy });
};
