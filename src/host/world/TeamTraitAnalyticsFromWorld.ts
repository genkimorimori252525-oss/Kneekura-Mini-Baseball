import { deriveTeamTraitAnalyticDescriptors,
  type TeamTraitAnalyticDescriptor,
  type TeamTraitAnalyticPolicy } from
  '../../core/world/team/TeamTraitAnalytics';
import type { DurableWorldSeason } from
  './SqliteWorldSettlementStore';

export type AcceptedTeamTraitAnalyticSources = Readonly<{
  world: Readonly<{
    readSeason(careerId: string, seasonId: string): Pick<
      DurableWorldSeason, 'careerId' | 'seasonId'
        | 'standings' | 'results'> | null;
  }>;
  policy: Readonly<{
    readAcceptedPolicy(sourceId: string): Readonly<{
      sourceId: string; careerId: string;
      policy: TeamTraitAnalyticPolicy;
    }> | null;
  }>;
}>;

/** Analytics read official World settlement; labels never feed back into games. */
export const projectTeamTraitAnalyticsFromWorld = (
  sources: AcceptedTeamTraitAnalyticSources,
  input: Readonly<{ careerId: string; seasonId: string;
    clubId: string; policySourceId: string }>,
): readonly TeamTraitAnalyticDescriptor[] => {
  if (!input || !input.policySourceId) {
    throw new Error('invalid team trait policy source');
  }
  const season = sources.world.readSeason(input.careerId,
    input.seasonId);
  const pinned = sources.policy.readAcceptedPolicy(
    input.policySourceId);
  if (!season || !pinned
    || season.careerId !== input.careerId
    || season.seasonId !== input.seasonId
    || pinned.sourceId !== input.policySourceId
    || pinned.careerId !== input.careerId
    || pinned.policy.seasonId !== input.seasonId) {
    throw new Error('team trait analytics lacks accepted World sources');
  }
  if (season.standings.kind !== 'OFFICIAL') {
    throw new Error('team trait analytics requires completed official season');
  }
  return deriveTeamTraitAnalyticDescriptors(input.clubId,
    season.standings.snapshot, season.results, pinned.policy);
};
