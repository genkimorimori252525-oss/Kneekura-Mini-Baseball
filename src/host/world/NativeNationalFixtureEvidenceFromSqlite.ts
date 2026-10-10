import { nationalCompetitionDrawEvidenceFromSqlite } from './SqliteNationalCompetitionDrawStore';
import { nationalCompetitionEditionEvidenceFromSqlite } from './SqliteNationalCompetitionEditionStore';
import { nationalHostCandidateEvidenceFromSqlite } from './SqliteNationalHostCandidateStore';
import { wbcFinalsGroupEvidenceFromSqlite, wbcFinalsGroupInputEvidenceFromSqlite } from './SqliteWbcFinalsGroupStore';
import { wbcFinalsKnockoutEvidenceFromSqlite, wbcFinalsKnockoutFixtureEvidenceFromSqlite } from './SqliteWbcFinalsKnockoutStore';
import { wbcFinalsScheduleEvidenceFromSqlite } from './SqliteWbcFinalsScheduleStore';
import { wbcBerthEvidenceFromSqlite } from './SqliteWbcBerthStore';
import { wbcDirectBerthEvidenceFromSqlite } from './SqliteWbcDirectBerthStore';
import { wbcRegionalCoefficientEvidenceFromSqlite } from './SqliteWbcRegionalCoefficientStore';
import { officialWbcHistoryEvidenceFromSqlite } from './SqliteOfficialWbcHistoryStore';
import { nationalQualificationHistoryEvidenceFromSqlite } from './SqliteNationalQualificationHistoryStore';
import { wbcWorldQualificationEvidenceFromSqlite } from './SqliteWbcWorldQualificationStore';
import { wbcQualifierSelectionEvidenceFromSqlite } from './SqliteWbcQualifierSelectionStore';
import { wbcGlobalQualifierPodEvidenceFromSqlite, wbcGlobalQualifierPodFixtureEvidenceFromSqlite } from './SqliteWbcGlobalQualifierPodStore';
import { wbcQualifierScheduleEvidenceFromSqlite } from './SqliteWbcQualifierScheduleStore';
import { wbcQualifierEditionEvidenceFromSqlite } from './SqliteWbcQualifierEditionStore';
import { wbcQualifierHostCandidateEvidenceFromSqlite } from './SqliteWbcQualifierHostCandidateStore';
import { wbcQualifierHostAccessEvidenceFromSqlite } from './SqliteWbcQualifierHostAccessStore';
import { worldHostInfrastructureEvidenceFromSqlite } from './SqliteWorldHostInfrastructureStore';
import { nationalRosterEligibilityEvidenceFromSqlite } from './SqliteNationalRosterEligibilityStore';
import { readAcceptedClubHistory } from './SqliteClubEventJournal';
import { nationalRegistrationEvidenceFromSqlite } from './NationalMatchOriginFromSqlite';
import { registerWbcFinalsFixtureFromWorld } from './WbcFinalsFixtureFromWorld';
import { registerWbcQualifierFixtureFromWorld } from './WbcQualifierFixtureFromWorld';
import type { DatabaseSync } from 'node:sqlite';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { nationCompetitionRegionEvidenceFromSqlite } from './SqliteNationCompetitionRegionStore';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite } from './SqliteNationalCompetitionSelectionStore';
import { regionalNationalGroupEvidenceFromSqlite, regionalNationalGroupInputEvidenceFromSqlite } from './SqliteRegionalNationalGroupStore';
import { regionalNationalKnockoutEvidenceFromSqlite, regionalNationalKnockoutFixtureEvidenceFromSqlite } from './SqliteRegionalNationalKnockoutStore';
import { regionalNationalScheduleEvidenceFromSqlite } from './SqliteRegionalNationalScheduleStore';
import { premierTwelveGroupEvidenceFromSqlite, premierTwelveGroupInputEvidenceFromSqlite } from './SqlitePremierTwelveGroupStore';
import { premierTwelveFinalFourEvidenceFromSqlite, premierTwelveFinalFourFixtureEvidenceFromSqlite } from './SqlitePremierTwelveFinalFourStore';
import { premierTwelveScheduleEvidenceFromSqlite } from './SqlitePremierTwelveScheduleStore';
import { worldNationalRankingHistoryEvidenceFromSqlite } from './SqliteWorldNationalRankingHistoryStore';
import { worldNationalRankingSnapshotEvidenceFromSqlite } from './SqliteWorldNationalRankingSnapshotStore';
import { readRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { registerPremierTwelveFixtureFromWorld } from './PremierTwelveFixtureFromWorld';
import { readDurableOfficialGameResult } from './PostseasonResultsFromMatches';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { NationalMatchFixture, NationalMatchOriginSource } from './NationalMatchOriginFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { createCompetitionSourceReader, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

/** Existing producers and their original result dependencies, all on the consuming connection. */
const fixtureGraph = (db: DatabaseSync, careerId: string) => {
  const writer = new SqliteOfficialStateWriter(db);
  const matches = { getMatch: createCompetitionSourceReader((id: string) => writer.getMatch(id)),
    getOfficialFixture: createCompetitionSourceReader((id: string) => writer.getOfficialFixture(id)) };
  const regions = nationCompetitionRegionEvidenceFromSqlite(db);
  const selections = nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle: worldCompetitionCycleEvidenceFromSqlite(db) });
  let regionalGroupsValue: ReturnType<typeof regionalNationalGroupEvidenceFromSqlite> | undefined;
  const regionalGroups = () => regionalGroupsValue ??= regionalNationalGroupEvidenceFromSqlite(db, { regions, matches });
  const regionalInputs = () => regionalNationalGroupInputEvidenceFromSqlite(db, { regions, selections });
  const regionalSources = { regions, matches, groups: {
    readEdition: createCompetitionSourceReader((c: string, e: string) => regionalGroups().readEdition(c, e)),
    readPlan: createCompetitionSourceReader((c: string, e: string) => regionalGroups().readPlan(c, e)),
    readResults: createCompetitionSourceReader((c: string, e: string) => regionalGroups().readResults(c, e)),
    readOutcome: createCompetitionSourceReader((c: string, e: string) => regionalGroups().readOutcome(c, e)),
  } };
  let regionalValue: ReturnType<typeof regionalNationalKnockoutEvidenceFromSqlite> | undefined;
  const regional = () => regionalValue ??= regionalNationalKnockoutEvidenceFromSqlite(db, regionalSources);
  let historyValue: ReturnType<typeof worldNationalRankingHistoryEvidenceFromSqlite> | undefined;
  const history = (): ReturnType<typeof worldNationalRankingHistoryEvidenceFromSqlite> => historyValue ??= worldNationalRankingHistoryEvidenceFromSqlite(db, {
    nations: regions, regional: { readEvidence: createCompetitionSourceReader((c: string, e: string) => regional().readEvidence(c, e)) },
    premier: { readEvidence: createCompetitionSourceReader((c: string, e: string) => premier().readEvidence(c, e)) },
    wbc: { readEvidence: createCompetitionSourceReader((c: string, e: string) => wbc().readEvidence(c, e)) },
  });
  let rankingValue: ReturnType<typeof worldNationalRankingSnapshotEvidenceFromSqlite> | undefined;
  const rankings = () => rankingValue ??= worldNationalRankingSnapshotEvidenceFromSqlite(db, { history: { readHistory: (c, day) => history().readHistory(c, day) } });
  const premierSources = { matches, selections, rankings: { authority: (c: string) => rankings().authority(c) },
    editionCutoff: (editionId: string) => selections.readSelection(careerId, editionId)?.qualificationCutoff ?? null };
  let premierGroupsValue: ReturnType<typeof premierTwelveGroupEvidenceFromSqlite> | undefined;
  const premierGroups = () => premierGroupsValue ??= premierTwelveGroupEvidenceFromSqlite(db, premierSources);
  const finalFourSources = { matches, groups: { readEvidence: createCompetitionSourceReader((c: string, e: string) => premierGroups().readEvidence(c, e)) } };
  let premierValue: ReturnType<typeof premierTwelveFinalFourEvidenceFromSqlite> | undefined;
  const premier = (): ReturnType<typeof premierTwelveFinalFourEvidenceFromSqlite> => premierValue ??= premierTwelveFinalFourEvidenceFromSqlite(db, finalFourSources);
  let qualificationHistoryValue: ReturnType<typeof nationalQualificationHistoryEvidenceFromSqlite> | undefined;
  const qualificationHistory = (): ReturnType<typeof nationalQualificationHistoryEvidenceFromSqlite> => qualificationHistoryValue ??= nationalQualificationHistoryEvidenceFromSqlite(db, {
    knockouts: { readEvidence: createCompetitionSourceReader((c: string, e: string) => regional().readEvidence(c, e)) },
    qualifiers: { readEvidence: createCompetitionSourceReader((c: string, e: string) => pods().readEvidence(c, e)) },
    selections: { readSelection: (c, e) => qualifierSelections().readSelection(c, e) },
  });
  let wbcHistoryValue: ReturnType<typeof officialWbcHistoryEvidenceFromSqlite> | undefined;
  const wbcHistory = (): ReturnType<typeof officialWbcHistoryEvidenceFromSqlite> => wbcHistoryValue ??= officialWbcHistoryEvidenceFromSqlite(db, {
    regions, finals: { readEvidence: createCompetitionSourceReader((c: string, e: string) => wbc().readEvidence(c, e)) },
  });
  let coefficientsValue: ReturnType<typeof wbcRegionalCoefficientEvidenceFromSqlite> | undefined;
  const coefficients = () => coefficientsValue ??= wbcRegionalCoefficientEvidenceFromSqlite(db, { history: { readEdition: (c, e) => wbcHistory().readEdition(c, e) } });
  let worldQualificationValue: ReturnType<typeof wbcWorldQualificationEvidenceFromSqlite> | undefined;
  const worldQualification = (): ReturnType<typeof wbcWorldQualificationEvidenceFromSqlite> => worldQualificationValue ??= wbcWorldQualificationEvidenceFromSqlite(db, {
    selections, nations: regions, history: { readEdition: (c, e) => wbcHistory().readEdition(c, e) },
    regional: { regionalAuthority: c => qualificationHistory().regionalAuthority(c) },
  });
  let directValue: ReturnType<typeof wbcDirectBerthEvidenceFromSqlite> | undefined;
  const direct = () => directValue ??= wbcDirectBerthEvidenceFromSqlite(db, {
    coefficients: { authority: c => coefficients().authority(c) }, nations: regions,
    editionCutoff: e => selections.readSelection(careerId, e)?.qualificationCutoff ?? null,
    regional: { regionalAuthority: c => qualificationHistory().regionalAuthority(c) },
  });
  const readDirect = createCompetitionSourceReader((c: string, e: string) => {
    const selection = selections.readSelection(c, e);
    // Existing accepted prehistory remains a required input; no first-two-cycle defaults are manufactured.
    return selection && selection.cycleOrdinal >= 2 ? worldQualification().readDirect(c, e) : direct().readDirect(c, e);
  });
  let berthsValue: ReturnType<typeof wbcBerthEvidenceFromSqlite> | undefined;
  const berths = () => berthsValue ??= wbcBerthEvidenceFromSqlite(db, { direct: { readDirect },
    coefficients: { authority: c => coefficients().authority(c) }, nations: regions,
    editionCutoff: e => selections.readSelection(careerId, e)?.qualificationCutoff ?? null,
    regional: { regionalAuthority: c => qualificationHistory().regionalAuthority(c) },
    qualifiers: { qualifierAuthority: c => qualificationHistory().qualifierAuthority(c) },
  });
  const wbcGroupSources = { matches, selections,
    draws: { readDraw: (c: string, e: string) => draws().readDraw(c, e) },
    editions: { readWbcEdition: (c: string, e: string) => editions().readWbcEdition(c, e) },
    berths: { readAllocation: (c: string, e: string) => berths().readAllocation(c, e) } };
  let wbcGroupsValue: ReturnType<typeof wbcFinalsGroupEvidenceFromSqlite> | undefined;
  const wbcGroups = () => wbcGroupsValue ??= wbcFinalsGroupEvidenceFromSqlite(db, wbcGroupSources);
  const wbcSources = { matches, editions: { readWbcKnockoutEdition: (c: string, e: string) => editions().readWbcKnockoutEdition(c, e) }, groups: { readEvidence: createCompetitionSourceReader((c: string, e: string) => wbcGroups().readEvidence(c, e)) } };
  let wbcValue: ReturnType<typeof wbcFinalsKnockoutEvidenceFromSqlite> | undefined;
  const wbc = (): ReturnType<typeof wbcFinalsKnockoutEvidenceFromSqlite> => wbcValue ??= wbcFinalsKnockoutEvidenceFromSqlite(db, wbcSources);
  let eligibilityValue: ReturnType<typeof nationalRosterEligibilityEvidenceFromSqlite> | undefined;
  const eligibility = () => eligibilityValue ??= nationalRosterEligibilityEvidenceFromSqlite(db, { selections, nations: regions,
    callups: { readRosterSnapshot: (...args) => nationalRegistrationEvidenceFromSqlite(db).readRosterSnapshot(...args),
      readEligibilityAtDay: (...args) => nationalRegistrationEvidenceFromSqlite(db).readEligibilityAtDay(...args),
      readEligibilitySnapshot: (...args) => nationalRegistrationEvidenceFromSqlite(db).readEligibilitySnapshot(...args) } });
  let qualifierSelectionValue: ReturnType<typeof wbcQualifierSelectionEvidenceFromSqlite> | undefined;
  const qualifierSelections = (): ReturnType<typeof wbcQualifierSelectionEvidenceFromSqlite> => qualifierSelectionValue ??= wbcQualifierSelectionEvidenceFromSqlite(db, {
    direct: { readDirect }, ranking: { readRanking: (c, d) => rankings().readRanking(c, d) }, nations: regions,
    eligibility: { readEligibilityForEdition: (c, e, id) => eligibility().readEligibilityForEdition(c, e, id) },
  });
  const podSources = { matches, selection: { readSelection: (c: string, e: string) => qualifierSelections().readSelection(c, e) },
    editions: { readEdition: (c: string, e: string) => qualifierEditions().readEdition(c, e) } };
  let podsValue: ReturnType<typeof wbcGlobalQualifierPodEvidenceFromSqlite> | undefined;
  const pods = (): ReturnType<typeof wbcGlobalQualifierPodEvidenceFromSqlite> => podsValue ??= wbcGlobalQualifierPodEvidenceFromSqlite(db, podSources);
  let infrastructureValue: ReturnType<typeof worldHostInfrastructureEvidenceFromSqlite> | undefined;
  const infrastructure = () => infrastructureValue ??= worldHostInfrastructureEvidenceFromSqlite(db, {
    nations: regions, clubs: { readClubHistory: (c, club) => readAcceptedClubHistory(db, c, club) },
  });
  let drawsValue: ReturnType<typeof nationalCompetitionDrawEvidenceFromSqlite> | undefined;
  const draws = (): ReturnType<typeof nationalCompetitionDrawEvidenceFromSqlite> => drawsValue ??= nationalCompetitionDrawEvidenceFromSqlite(db, {
    selections, nations: regions, rankings: { readRanking: (c, d) => rankings().readRanking(c, d) },
    history: { readHistory: (c, d) => history().readHistory(c, d) }, wbcBerths: { readAllocation: (c, e) => berths().readAllocation(c, e) },
  });
  let nationalHostsValue: ReturnType<typeof nationalHostCandidateEvidenceFromSqlite> | undefined;
  const nationalHosts = (): ReturnType<typeof nationalHostCandidateEvidenceFromSqlite> => nationalHostsValue ??= nationalHostCandidateEvidenceFromSqlite(db, {
    selections, infrastructure: { readVenues: (c, d) => infrastructure().readVenues(c, d) },
    history: { readHistory: (c, d) => history().readHistory(c, d) }, editions: { readSnapshot: (c, e) => editions().readSnapshot(c, e) },
  });
  let editionsValue: ReturnType<typeof nationalCompetitionEditionEvidenceFromSqlite> | undefined;
  const editions = (): ReturnType<typeof nationalCompetitionEditionEvidenceFromSqlite> => editionsValue ??= nationalCompetitionEditionEvidenceFromSqlite(db, {
    draws: { readDraw: (c, e) => draws().readDraw(c, e) }, hosts: { readCandidates: (c, e, d) => nationalHosts().readCandidates(c, e, d) },
  });
  let accessValue: ReturnType<typeof wbcQualifierHostAccessEvidenceFromSqlite> | undefined;
  const access = () => accessValue ??= wbcQualifierHostAccessEvidenceFromSqlite(db);
  let hostsValue: ReturnType<typeof wbcQualifierHostCandidateEvidenceFromSqlite> | undefined;
  const hosts = (): ReturnType<typeof wbcQualifierHostCandidateEvidenceFromSqlite> => hostsValue ??= wbcQualifierHostCandidateEvidenceFromSqlite(db, {
    selection: { readSelection: (c, e) => qualifierSelections().readSelection(c, e), readRequest: (c, e) => qualifierSelections().readRequest(c, e) },
    infrastructure: { readVenues: (c, day) => infrastructure().readVenues(c, day) }, access: { readAccess: (...args) => access().readAccess(...args) },
    qualifiers: { readEvidence: (c, e) => pods().readEvidence(c, e) }, editions: { readSnapshot: (c, e) => qualifierEditions().readSnapshot(c, e) },
  });
  let qualifierEditionValue: ReturnType<typeof wbcQualifierEditionEvidenceFromSqlite> | undefined;
  const qualifierEditions = (): ReturnType<typeof wbcQualifierEditionEvidenceFromSqlite> => qualifierEditionValue ??= wbcQualifierEditionEvidenceFromSqlite(db, {
    selections, nations: regions, direct: { readDirect }, rankings: { readRanking: (c, day) => rankings().readRanking(c, day) },
    selection: { readSelection: (c, e) => qualifierSelections().readSelection(c, e), readRequest: (c, e) => qualifierSelections().readRequest(c, e) },
    hosts: { readCandidates: (c, e, day) => hosts().readCandidates(c, e, day) },
  });
  return { matches, selections, regions, regionalInputs, regionalGroups, regionalSources, rankings, premierGroups, premierSources, finalFourSources,
    wbcGroupSources, wbcSources, wbcGroups, berths, qualifierEditions, qualifierSelections, podSources };

};

/** Reuses the accepted fixture algorithms. Later rounds never manufacture entrants from schedule slots. */
export const readAdditionalNationalMatchFixture = (db: DatabaseSync,
  source: Pick<NationalMatchOriginSource, 'careerId' | 'editionId' | 'gameId'>): NationalMatchFixture =>
  withBattedVenueLegalReadSnapshot(db, () => withCompetitionSourceReadPhase(() => {
    const { careerId, editionId, gameId } = source, graph = fixtureGraph(db, careerId);
    const selection = graph.selections.readSelection(careerId, editionId);
    const results = (games: readonly { gameId: string }[]) => games.map(game => {
      const result = readDurableOfficialGameResult(graph.matches, game.gameId);
      if (!result) throw new Error('National fixture qualification requires original official results');
      return result;
    });
    if (selection?.kind === 'REGIONAL_NATIONAL') {
      const groups = graph.regionalInputs(), schedules = regionalNationalScheduleEvidenceFromSqlite(db, { groups, selections: graph.selections });
      const schedule = schedules.readSchedule(careerId, editionId), slot = schedule?.games.find(g => g.gameId === gameId);
      if (!schedule || !slot) throw new Error('National fixture requires an accepted Regional schedule');
      const knockout = regionalNationalKnockoutFixtureEvidenceFromSqlite(db, graph.regionalSources);
      const fixture = readRegionalNationalFixtureFromWorld({ groups, knockout, schedules, matches: graph.matches }, { ...source, gameDay: slot.gameDay });
      const plan = groups.readPlan(careerId, editionId);
      let qualification: unknown = null;
      if (slot.stage !== 'GROUP') {
        const knockoutEdition = knockout.readEdition(careerId, editionId), knockoutPlan = knockout.readPlan(careerId, editionId);
        if (!knockoutEdition || !knockoutPlan) throw new Error('National fixture lacks its original knockout plan');
        const groupResults = graph.regionalGroups().readResults(careerId, editionId);
        const openingResults = knockoutPlan.openingGames[0].stage === 'QUARTERFINAL' && slot.stage !== 'QUARTERFINAL'
          ? results(knockoutPlan.openingGames) : [];
        const semifinalResults = slot.stage === 'FINAL' ? results(knockout.readSemifinalGames(careerId, editionId) ?? []) : [];
        qualification = { knockoutEdition, knockoutPlan, groupResults, openingResults, semifinalResults };
      }
      return freeze({ careerId, competitionEditionId: editionId, gameDay: fixture.gameDay, homeClubId: fixture.game.homeNationId,
        awayClubId: fixture.game.awayNationId, fixtureEventId: fixture.binding.fixtureEventId, competitionScope: 'NATIONAL',
        venueId: fixture.binding.venueId, fixtureRevision: fixture.binding.fixtureRevision, selectionHash: hash(selection),
        groupInputHash: hash({ edition: fixture.edition, plan, qualification }), scheduleHash: hash(schedule) });
    }
    if (selection?.kind === 'PREMIER_12') {
      const groups = premierTwelveGroupInputEvidenceFromSqlite(db, graph.premierSources);
      const finalFour = premierTwelveFinalFourFixtureEvidenceFromSqlite(db, graph.finalFourSources);
      const schedules = premierTwelveScheduleEvidenceFromSqlite(db, { groups });
      const schedule = schedules.readSchedule(careerId, editionId), slot = schedule?.games.find(g => g.gameId === gameId);
      if (!schedule || !slot) throw new Error('National fixture requires an accepted Premier12 schedule');
      const fixture = registerPremierTwelveFixtureFromWorld({ groups, finalFour, schedules, matches: { registerOfficialFixture(expected) {
        const accepted = graph.matches.getOfficialFixture(gameId);
        if (!accepted || json(accepted) !== json(expected)) throw new Error('National fixture differs from accepted Match');
        return accepted;
      } } }, { ...source, gameDay: slot.gameDay });
      const plan = groups.readPlan(careerId, editionId), ranking = graph.rankings().readRanking(careerId, selection.qualificationCutoff.day);
      let qualification: unknown = null;
      if (slot.stage !== 'GROUP') {
        const evidence = graph.premierGroups().readEvidence(careerId, editionId), finalPlan = finalFour.readPlan(careerId, editionId);
        if (!evidence || !finalPlan) throw new Error('National fixture lacks its original Premier12 groups');
        qualification = { groupResults: evidence.results, groupOutcome: evidence.outcome, finalPlan,
          semifinalResults: slot.stage === 'SEMIFINAL' ? [] : results(finalPlan.semifinalGames) };
      }
      return freeze({ careerId, competitionEditionId: editionId, gameDay: fixture.gameDay, homeClubId: fixture.game.homeNationId,
        awayClubId: fixture.game.awayNationId, fixtureEventId: fixture.binding.fixtureEventId, competitionScope: 'NATIONAL',
        venueId: fixture.binding.venueId, fixtureRevision: fixture.binding.fixtureRevision, selectionHash: hash(selection),
        groupInputHash: hash({ edition: fixture.edition, plan, ranking, qualification }), scheduleHash: hash(schedule) });
    }
    if (selection?.kind === 'WBC') {
      const groups = wbcFinalsGroupInputEvidenceFromSqlite(db, graph.wbcGroupSources);
      const knockout = wbcFinalsKnockoutFixtureEvidenceFromSqlite(db, graph.wbcSources);
      const schedules = wbcFinalsScheduleEvidenceFromSqlite(db, { groups });
      const schedule = schedules.readSchedule(careerId, editionId), slot = schedule?.games.find(g => g.gameId === gameId);
      if (!schedule || !slot) throw new Error('National fixture requires an accepted WBC finals schedule');
      const fixture = registerWbcFinalsFixtureFromWorld({ groups, knockout, schedules, matches: { registerOfficialFixture(expected) {
        const accepted = graph.matches.getOfficialFixture(gameId);
        if (!accepted || json(accepted) !== json(expected)) throw new Error('National fixture differs from accepted Match');
        return accepted;
      } } }, { ...source, gameDay: slot.gameDay });
      const plan = groups.readPlan(careerId, editionId), berths = graph.berths().readAllocation(careerId, editionId);
      let qualification: unknown = null;
      if (slot.stage !== 'GROUP') {
        const evidence = graph.wbcGroups().readEvidence(careerId, editionId), knockoutPlan = knockout.readPlan(careerId, editionId);
        if (!evidence || !knockoutPlan) throw new Error('National fixture lacks its original WBC finals groups');
        qualification = { groupResults: evidence.results, groupOutcome: evidence.outcome, knockoutPlan,
          roundOf16Results: slot.stage === 'ROUND_OF_16' ? [] : results(knockoutPlan.roundOf16Games),
          quarterfinalResults: slot.stage === 'SEMIFINAL' || slot.stage === 'FINAL'
            ? results(knockout.quarterfinalGames(careerId, editionId) ?? []) : [],
          semifinalResults: slot.stage === 'FINAL' ? results(knockout.semifinalGames(careerId, editionId) ?? []) : [] };
      }
      return freeze({ careerId, competitionEditionId: editionId, gameDay: fixture.gameDay, homeClubId: fixture.game.homeNationId,
        awayClubId: fixture.game.awayNationId, fixtureEventId: fixture.binding.fixtureEventId, competitionScope: 'NATIONAL',
        venueId: fixture.binding.venueId, fixtureRevision: fixture.binding.fixtureRevision, selectionHash: hash(selection),
        groupInputHash: hash({ edition: fixture.edition, plan, berths, qualification }), scheduleHash: hash(schedule) });
    }
    const qualifier = readNativeNationalQualifierEdition(db, careerId, editionId);
    if (qualifier) {
      const pods = wbcGlobalQualifierPodFixtureEvidenceFromSqlite(db, graph.podSources);
      const schedules = wbcQualifierScheduleEvidenceFromSqlite(db, { pods });
      const schedule = schedules.readSchedule(careerId, editionId), slot = schedule?.games.find(g => g.gameId === gameId);
      if (!schedule || !slot) throw new Error('National fixture requires an accepted WBC qualifier schedule');
      const fixture = registerWbcQualifierFixtureFromWorld({ pods, schedules, matches: { registerOfficialFixture(expected) {
        const accepted = graph.matches.getOfficialFixture(gameId);
        if (!accepted || json(accepted) !== json(expected)) throw new Error('National fixture differs from accepted Match');
        return accepted;
      } } }, { ...source, gameDay: slot.gameDay });
      const plan = pods.readPlan(careerId, editionId);
      if (!plan) throw new Error('National fixture lacks its original WBC qualifier plan');
      const qualification = slot.stage === 'SEMIFINAL' ? null : results(plan.pods.flatMap(pod => pod.semifinals));
      return freeze({ careerId, competitionEditionId: editionId, gameDay: fixture.gameDay, homeClubId: fixture.game.homeNationId,
        awayClubId: fixture.game.awayNationId, fixtureEventId: fixture.binding.fixtureEventId, competitionScope: 'NATIONAL',
        venueId: fixture.binding.venueId, fixtureRevision: fixture.binding.fixtureRevision, selectionHash: hash(qualifier.source.world),
        groupInputHash: hash({ qualifier, edition: fixture.edition, plan, qualification }), scheduleHash: hash(schedule) });
    }
    throw new Error('National physical fixture requires an accepted Regional, Premier12, WBC finals or qualifier Edition');
  }));

/** Ordinary callups need no qualifier schema. A present qualifier is replayed through its Native owners. */
export const readNativeNationalQualifierEdition = (db: DatabaseSync, careerId: string, editionId: string) =>
  withBattedVenueLegalReadSnapshot(db, () => {
    if (!db.prepare("SELECT 1 FROM main.sqlite_schema WHERE type='table' AND name='world_wbc_qualifier_editions'").get()
      || !db.prepare('SELECT 1 FROM main.world_wbc_qualifier_editions WHERE career_id=? AND edition_id=?').get(careerId, editionId)) return null;
    return withCompetitionSourceReadPhase(() => fixtureGraph(db, careerId).qualifierEditions().readSnapshot(careerId, editionId));
  });
