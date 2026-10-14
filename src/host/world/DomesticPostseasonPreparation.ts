import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { LEAGUE_PROFILES_V1 } from '../../core/world/competition/LeagueProfiles';
import { applyOfficialTiebreakGame, assertOfficialTiebreakGamePlan, buildOfficialStandings } from '../../core/world/competition/OfficialStandings';
import { projectProvisionalOfficialStandings } from '../../core/world/competition/ProvisionalOfficialStandings';
import type { PostseasonSeriesPlan } from '../../core/world/competition/PostseasonSeries';
import { createWinterChampionshipRoundSchedule } from '../../core/world/competition/WinterChampionship';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { projectDirectDomesticCompetitionFromWorld } from './DirectDomesticCompetitionFromWorld';
import { projectConferenceDomesticCompetitionFromWorld } from './ConferenceDomesticCompetitionFromWorld';
import { projectNorthAmericaDomesticCompetitionFromWorld } from './NorthAmericaDomesticCompetitionFromWorld';
import { projectWinterDomesticCompetitionFromWorld } from './WinterDomesticCompetitionFromWorld';
import { readDurableOfficialGameResult } from './PostseasonResultsFromMatches';
import type { DomesticCompetitionSourceRequest } from './SqliteDomesticCompetitionSeasonStore';

export const postseasonJson = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
export type DomesticPostseasonGroup = Readonly<{ slot: string; data: unknown; series?: PostseasonSeriesPlan;
  games: readonly Readonly<{ gameId: string; homeClubId: string; awayClubId: string; day?: number }>[] }>;

/** Strip only growing plan lists, retaining every original policy/alignment field. */
export const domesticPostseasonLayout = (request: DomesticCompetitionSourceRequest): Readonly<{
  header: unknown; groups: readonly DomesticPostseasonGroup[];
}> => {
  const groups: DomesticPostseasonGroup[] = [];
  const series = (slot: string, plan: PostseasonSeriesPlan | null): void => {
    if (plan) groups.push({ slot, data: plan, series: plan, games: plan.scheduledGames });
  };
  let input;
  if (request.kind === 'DIRECT') {
    request.input.postseasonPlans.forEach(entry => series(entry.stage, entry.plan));
    input = { ...request.input, postseasonPlans: [] };
  } else if (request.kind === 'CONFERENCE') {
    request.input.groupPlans.forEach(group => group.series.forEach(entry => series(JSON.stringify([group.groupId, entry.stage]), entry.plan)));
    series('championship', request.input.championshipPlan);
    input = { ...request.input, groupPlans: request.input.groupPlans.map(group => ({ ...group, series: [] })), championshipPlan: null };
  } else if (request.kind === 'NORTH_AMERICA') {
    request.input.conferencePlans.forEach(group => group.series.forEach(entry => series(JSON.stringify([group.conferenceId, entry.stage]), entry.plan)));
    series('championship', request.input.championshipPlan);
    input = { ...request.input, conferencePlans: request.input.conferencePlans.map(group => ({ ...group, series: [] })), championshipPlan: null };
  } else if (request.kind === 'WINTER') {
    groups.push({ slot: 'round', data: request.input.roundGames, games: request.input.roundGames });
    request.input.tiebreakPlans.forEach(plan => groups.push({ slot: `tiebreak:${plan.gameId}`, data: plan, games: [plan] }));
    series('final', request.input.finalPlan);
    input = { ...request.input, roundGames: [], tiebreakPlans: [], finalPlan: null };
  } else throw new Error('unknown domestic postseason format');
  return { header: { kind: request.kind, input }, groups };
};

/** Pregame legality uses the same standings/bracket contracts as finalization. */
export const validateDomesticPostseasonRequest = (
  sources: Parameters<typeof readCompletedDomesticSeason>[0], request: DomesticCompetitionSourceRequest,
) => {
  const completed = readCompletedDomesticSeason(sources, request.input.careerId, request.input.seasonId);
  if (!completed) throw new Error('postseason requires completed domestic regular season');
  if (request.kind === 'DIRECT') projectDirectDomesticCompetitionFromWorld(sources, request.input);
  else if (request.kind === 'CONFERENCE') projectConferenceDomesticCompetitionFromWorld(sources, request.input);
  else if (request.kind === 'NORTH_AMERICA') projectNorthAmericaDomesticCompetitionFromWorld(sources, request.input);
  else if (request.kind === 'WINTER') {
    const { input } = request, { world, archive } = completed;
    const profile = LEAGUE_PROFILES_V1.find(item => item.leagueId === world.schedule.leagueId);
    if (!profile || profile.leagueId !== 'league-010' || profile.championshipFormat !== 'WINTER_ROUND_ROBIN'
      || archive.baseSchedule.calendarProfileVersion !== profile.calendarProfileVersion
      || archive.baseSchedule.regularSeasonGamesPerClub !== profile.regularSeasonGamesPerClub
      || world.schedule.memberClubIds.length !== profile.clubCount) throw new Error('winter season does not match frozen league profile');
    const round = createWinterChampionshipRoundSchedule({ version: input.version, regularSeasonStandings: world.standings.snapshot, games: input.roundGames });
    const results = input.roundGames.flatMap(game => { const result = readDurableOfficialGameResult(sources.match, game.gameId); return result ? [result] : []; });
    projectProvisionalOfficialStandings(round, results, input.roundTiebreakPolicy);
    if (results.length < round.games.length) {
      if (input.tiebreakPlans.length || input.finalPlan) throw new Error('winter later stage requires all round finals');
    } else {
      let standings = buildOfficialStandings(round, results, input.roundTiebreakPolicy);
      let pending = false;
      const pairs = new Set<string>();
      for (const plan of input.tiebreakPlans) {
        assertOfficialTiebreakGamePlan(standings, plan);
        const pair = postseasonJson([plan.homeClubId, plan.awayClubId].sort());
        if (pairs.has(pair)) throw new Error('winter tiebreak pair is already planned');
        pairs.add(pair);
        const result = readDurableOfficialGameResult(sources.match, plan.gameId);
        if (result) standings = applyOfficialTiebreakGame(standings, plan, result);
        else pending = true;
      }
      if (pending && input.finalPlan) throw new Error('winter final requires all tiebreak finals');
      if (!pending) projectWinterDomesticCompetitionFromWorld(sources, input);
    }
  } else throw new Error('unknown domestic postseason format');
  return completed;
};
