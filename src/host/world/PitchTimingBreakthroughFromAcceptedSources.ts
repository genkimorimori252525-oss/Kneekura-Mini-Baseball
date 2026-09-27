import { derivePitchTimingBreakthroughs,
  type PitchTimingBreakthroughCheckpoint,
  type PitchTimingBreakthroughEvent,
  type PitchTimingBreakthroughPolicy } from
  '../../core/world/development/PitchTimingBreakthrough';
import type { SqlitePlayerPitchTimingStore } from
  './SqlitePlayerPitchTimingStore';

export type AcceptedPitchTimingBreakthroughSources = Readonly<{
  timing: Pick<SqlitePlayerPitchTimingStore,
    'readDevelopmentEvidenceAtDay'>;
  checkpoints: Readonly<{
    readAcceptedCheckpoints(careerId: string, playerId: string,
      asOfDay: number): readonly PitchTimingBreakthroughCheckpoint[];
  }>;
  policy: Readonly<{
    readAcceptedPolicy(policySourceId: string):
      PitchTimingBreakthroughPolicy | null;
  }>;
}>;

/** Projects a historical label from actual source revisions and owner-certified checkpoints. */
export const projectPitchTimingBreakthroughs = (
  sources: AcceptedPitchTimingBreakthroughSources,
  input: Readonly<{ careerId: string; playerId: string;
    asOfDay: number; policySourceId: string }>,
): readonly PitchTimingBreakthroughEvent[] => {
  if (!input || !input.policySourceId) {
    throw new Error('invalid breakthrough policy source');
  }
  const evidence = sources.timing.readDevelopmentEvidenceAtDay(
    input.careerId, input.playerId, input.asOfDay);
  if (!evidence) return Object.freeze([]);
  const policy = sources.policy.readAcceptedPolicy(
    input.policySourceId);
  if (!policy) throw new Error('accepted breakthrough policy is missing');
  return derivePitchTimingBreakthroughs({
    source: evidence.source, episodes: evidence.episodes,
    asOfDay: input.asOfDay, policy,
    checkpoints: sources.checkpoints.readAcceptedCheckpoints(
      input.careerId, input.playerId, input.asOfDay),
  });
};
