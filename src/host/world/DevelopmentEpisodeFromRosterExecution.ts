import { startDevelopmentLearningEpisode,
  type DevelopmentLearningEpisode,
  type DevelopmentLearningPolicy } from
  '../../core/world/development/DevelopmentLearningEpisode';
import type { DevelopmentCatalystProfile } from
  '../../core/world/development/DevelopmentCatalyst';
import type { DurableDevelopmentRosterChange } from
  './SqliteManagerRosterDecisionStore';

export type DevelopmentEpisodeRosterSources = Readonly<{
  roster: Readonly<{
    readDevelopmentRosterChange(executionId: string):
      DurableDevelopmentRosterChange | null;
  }>;
  person: Readonly<{
    read(sourceId: string): Readonly<{
      careerId: string; playerId: string; personId: string;
      priors: Readonly<{ createdAtDay: number;
        catalyst: Pick<DevelopmentCatalystProfile,
          'careerId' | 'playerId' | 'createdAtDay'
          | 'profileVersion'> }>;
    }> | null;
  }>;
}>;

/** Uses the executed World roster event and hidden Person prior, never a caller-made catalyst. */
export const startDevelopmentEpisodeFromRosterExecution = (
  sources: DevelopmentEpisodeRosterSources,
  input: Readonly<{ episodeId: string; executionId: string;
    playerId: string; personSourceId: string;
    policy: DevelopmentLearningPolicy }>,
): DevelopmentLearningEpisode => {
  if (!input || !input.episodeId || !input.executionId
    || !input.playerId || !input.personSourceId) {
    throw new Error('invalid development episode source identity');
  }
  const change = sources.roster.readDevelopmentRosterChange(
    input.executionId);
  const person = sources.person.read(input.personSourceId);
  if (!change || !person
    || change.before.careerId !== person.careerId
    || person.playerId !== input.playerId
    || person.priors.catalyst.careerId !== person.careerId
    || person.priors.catalyst.playerId !== input.playerId
    || person.priors.createdAtDay
      !== person.priors.catalyst.createdAtDay) {
    throw new Error('development episode lacks accepted roster and Person sources');
  }
  return startDevelopmentLearningEpisode(input.episodeId,
    change.before, change.after, change.event, input.playerId,
    person.priors.catalyst, input.policy);
};
