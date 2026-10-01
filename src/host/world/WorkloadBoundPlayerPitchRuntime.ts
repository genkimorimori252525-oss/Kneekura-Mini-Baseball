import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { resolvePlayerPitchAgainstBatterFromWorld, type PlayerPitchAgainstBatterRequest,
  type PlayerPitchAgainstBatterResult } from './PlayerPitchDeliveryRuntime';
import type { SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { AcceptedPitchFatiguePolicy, SqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';

export type WorkloadBoundPlayerPitchRequest = Omit<PlayerPitchAgainstBatterRequest, 'delivery'> & Readonly<{
  delivery: Omit<PlayerPitchAgainstBatterRequest['delivery'], 'root'> & Readonly<{ matchSeed: number }>;
  workloadRevision: number; policySourceId: string;
}>;
export type WorkloadBoundPlayerPitchResult = Readonly<{
  pitch: PlayerPitchAgainstBatterResult; workload: PlayerWorkloadRecoveryState; policy: AcceptedPitchFatiguePolicy;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Exact archived fatigue affects physical execution; no outcome or long-term Source is changed. */
export const resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld = (
  stores: Parameters<typeof resolvePlayerPitchAgainstBatterFromWorld>[0] & Readonly<{
    workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'selectAtRevision'>;
    policies: Pick<SqlitePitchFatiguePolicyStore, 'readAcceptedPolicy'>;
  }>, rawInput: WorkloadBoundPlayerPitchRequest,
): WorkloadBoundPlayerPitchResult => {
  const input = cloneInert(rawInput), delivery = input?.delivery;
  if (!input || !fields(input, ['timeline', 'delivery', 'flight', 'batter', 'workloadRevision', 'policySourceId'])
    || !delivery || !fields(delivery, ['careerId', 'playerId', 'gameDay', 'matchSeed', 'moundReference', 'outingId', 'playId',
      'pitchIndex', 'readyAtUs', 'timingIntent', 'physics']) || !id(delivery.careerId) || !id(delivery.playerId)
    || !integer(delivery.gameDay) || !integer(delivery.matchSeed) || delivery.matchSeed > 0xffff_ffff
    || !integer(input.workloadRevision) || !id(input.policySourceId)) throw new Error('invalid workload-bound pitch request');
  const workload = cloneInert(stores.workload.selectAtRevision(delivery.careerId, delivery.playerId, input.workloadRevision));
  if (!workload || workload.careerId !== delivery.careerId || workload.playerId !== delivery.playerId
    || workload.revision !== input.workloadRevision || !integer(workload.effectiveDay)) throw new Error('pitch workload scope differs');
  if (workload.effectiveDay > delivery.gameDay) throw new Error('pitch workload state is from a future day');
  const policy = cloneInert(stores.policies.readAcceptedPolicy(input.policySourceId));
  if (!policy || policy.sourceId !== input.policySourceId || !id(policy.sourceVersion)) throw new Error('accepted pitch fatigue policy is missing or differs');
  const { sourceId: _sourceId, sourceVersion: _sourceVersion, ...response } = policy;
  const timing = stores.timing.selectProfileAtDay(delivery.careerId, delivery.playerId, delivery.gameDay);
  const execution = applyPitchFatigueToExecution(timing, delivery.physics, workload.fatigue, response, delivery.gameDay);
  const { matchSeed, ...physicalDelivery } = delivery;
  const pitch = resolvePlayerPitchAgainstBatterFromWorld({ timing: { selectProfileAtDay: () => execution.timingProfile }, release: stores.release },
    { timeline: input.timeline, flight: input.flight, batter: input.batter,
      delivery: { ...physicalDelivery, root: new SeedRoot(matchSeed), physics: execution.physics } });
  return freeze({ pitch, workload, policy });
};
