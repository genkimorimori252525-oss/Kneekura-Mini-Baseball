import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { setup } from '../../core/world/catalog/CatalogFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteClubCatalogSnapshotStore } from './SqliteClubCatalogSnapshotStore';
import { openSqliteCareerClubCreationStore } from './SqliteCareerClubCreationStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { openSqlitePlayerIntakeStore } from './SqlitePlayerIntakeStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationalEligibilityFactStore } from './SqliteNationalEligibilityFactStore';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { generatePlayerPersonPriors } from '../../core/world/development/PlayerPersonPriors';
import { DEVELOPMENT_DOMAINS } from '../../core/world/development/DevelopmentTrajectory';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';

const nodes = (value: unknown): number => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce<number>((n, item) => n + nodes(item), 0) : 0);
const ranges = <T extends string>(keys: readonly T[], min: number, max: number) =>
  Object.fromEntries(keys.map((key) => [key, { min, max }])) as Record<T, { min: number; max: number }>;
// Explicit synthetic priors, independent of Club target ratings and real-player ability.
const personPolicies = {
  trajectory: { policyId: 'fixture-trajectory', profileVersion: 'v1', availableAtDay: 10,
    timingWeights: { VERY_EARLY: 1, EARLY: 1, NORMAL: 1, LATE: 1, VERY_LATE: 1 },
    shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1, STEPWISE_WAVES: 1 }, domainOffsetRanges: ranges(DEVELOPMENT_DOMAINS, 0, 0) },
  catalyst: { policyId: 'fixture-catalyst', profileVersion: 'v1', availableAtDay: 10,
    sensitivityRanges: ranges(CATALYST_FAMILIES, 0.2, 0.8), signatureMotifs: [], signatureMotifCount: 0 },
  star: { policyId: 'fixture-star', profileVersion: 'v1', availableAtDay: 10,
    tierWeights: { ORDINARY: 100, STAR_CANDIDATE: 1, SUPERSTAR_CANDIDATE: 0 },
    potentialRanges: { ORDINARY: ranges(STAR_GENESIS_POTENTIALS, 0.2, 0.8),
      STAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, 0.2, 0.8), SUPERSTAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, 0.2, 0.8) } },
};

it('persists all 234 Clubs, 11700 global Players and hidden Persons, then retains history across intake and reopen', () => {
  const path = `file:world-roster-capacity-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const catalogs = openSqliteClubCatalogSnapshotStore(path), saved = catalogs.initializeCurrent();
  const creation = openSqliteCareerClubCreationStore(path, { catalogs });
  const seed = setup(saved.catalog), careerId = seed.context.careerId;
  // Explicit capacity fixture: these counts do not set production League rules.
  const playerId = (clubId: string, index: number) => index === 0 ? `fixture-player-${clubId}` : `fixture-player-${clubId}-${index}`;
  for (const club of seed.clubs) club.initial.references.playerClubStateRefs = Array.from({ length: 50 }, (_, index) => ({
    playerId: playerId(club.clubId, index), stateRef: `fixture-player-state-${club.clubId}-${index}` }));
  const population = createRosterState({ careerId, effectiveDay: 10,
    profiles: saved.catalog.leagues.map((league) => ({ profileId: `fixture-roster-${league.leagueId}`, version: 'fixture-roster-v1',
      season: 1, competitionEditionId: `fixture-edition-${league.leagueId}`, activeLimit: 10,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false })),
    units: saved.catalog.clubs.flatMap((club) => ([
      { unitId: `fixture-first-${club.clubId}`, clubId: club.clubId, kind: 'FIRST_TEAM' as const },
      { unitId: `fixture-reserve-${club.clubId}`, clubId: club.clubId, kind: 'RESERVE' as const }])),
    players: saved.catalog.clubs.flatMap((club) => Array.from({ length: 50 }, (_, index) => ({
      playerId: playerId(club.clubId, index), clubRights: { rightsHolderClubId: club.clubId, contractId: `fixture-contract-${club.clubId}-${index}` },
      assignment: { unitId: `fixture-${index < 10 ? 'first' : 'reserve'}-${club.clubId}`, clubId: club.clubId },
      availability: { status: 'AVAILABLE' as const, evidenceId: `fixture-health-${club.clubId}-${index}` },
      registrations: [{ competitionEditionId: `fixture-edition-${club.leagueId}`, clubId: club.clubId,
        status: index < 10 ? 'ACTIVE' as const : 'INACTIVE' as const, eligibility: 'ELIGIBLE' as const,
        evidenceId: `fixture-registration-${club.clubId}-${index}` }] }))) });
  expect(population.players).toHaveLength(11700);
  expect(nodes(population)).toBeGreaterThan(100000);
  const rosters = openSqliteManagerRosterDecisionStore(path);
  const snapshots = openSqliteNationalRosterSnapshotStore(path, { roster: rosters });
  const source = { sourceId: 'fixture-next-intake', careerId, playerId: 'fixture-new-player', personId: 'fixture-new-person',
    sourceRecordId: 'fixture-accepted-intake', sourceVersion: 'fixture-intake-v1', acceptedRevision: 1, acceptedAtDay: 425, rosterRevision: 1 };
  const intake = openSqlitePlayerIntakeStore(path, { readAcceptedPlayerIntake: (id) => id === source.sourceId ? source : null });
  const existingSource = { ...source, sourceId: 'fixture-existing-link', playerId: population.players[0].playerId,
    personId: 'fixture-existing-person', sourceRecordId: 'fixture-existing-intake', acceptedAtDay: 10, rosterRevision: 0 };
  const personSources = population.players.map((player, index) => index === 0 ? existingSource : {
    ...existingSource, sourceId: `fixture-person-link-${index}`, playerId: player.playerId,
    personId: `fixture-person-${index}`, sourceRecordId: `fixture-person-intake-${index}`, acceptedRevision: index });
  const acceptedPersons = new Map(personSources.map((person) => [person.sourceId, person]));
  const personSourceIds = personSources.map((person) => person.sourceId);
  const links = openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (id) => acceptedPersons.get(id) ?? null });
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(path);
  const first = saved.catalog.clubs[0].clubId, last = saved.catalog.clubs.at(-1)!.clubId;
  const downstream: { close(): void }[] = [];
  try {
    const initial = creation.initialize({ catalogSnapshotId: saved.snapshotId, creation: seed });
    expect(initial.clubIds).toHaveLength(234);
    for (const clubId of [first, last]) rosters.initialize({ careerId, clubId, roster: population, mood: null });
    const world = openSqliteWorldSettlementStore(path); downstream.push(world);
    const leagueId = saved.catalog.clubs[0].leagueId;
    const leagueClubs = saved.catalog.clubs.filter((club) => club.leagueId === leagueId).map((club) => world.readClub(careerId, club.clubId)!.state);
    const members = leagueClubs.map((club) => club.identity.clubId);
    world.initialize({ careerId, clubs: leagueClubs,
      schedule: { leagueId, seasonId: `fixture-edition-${leagueId}`, memberClubIds: members, regularSeasonGamesPerClub: 1,
        revisionEventIds: ['fixture-capacity-calendar'], games: members.filter((_, index) => index % 2 === 0)
          .map((homeClubId, index) => ({ gameId: `fixture-capacity-game-${index}`, homeClubId, awayClubId: members[index * 2 + 1] })) },
      standingsPolicy: { version: 'fixture-capacity-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 5 } });
    const control = openSqliteWorldControlStore(path); downstream.push(control);
    const human = createHumanControlState({ revision: 0, controllerId: 'fixture-human', controlledClubId: first, domainIds: ['ROSTER'], manualDomainIds: [] });
    control.initialize({ careerId, worldRevision: 0, control: human });
    expect(db.prepare('SELECT count(*) AS n FROM world_roster_heads').get()).toEqual({ n: 1 });
    expect(rosters.readHead(careerId, last)?.roster).toEqual(population);
    const old = snapshots.capture(careerId, first);
    expect(old.roster.players).toHaveLength(11700);
    links.accept(existingSource.sourceId);
    const allLinks = links.acceptBatch(personSourceIds);
    expect(allLinks).toHaveLength(11700);
    expect(new Set(allLinks.map((person) => person.personId)).size).toBe(11700);
    expect(allLinks.every((person, index) => person.playerId === population.players[index].playerId)).toBe(true);
    const nations = openSqliteNationCompetitionRegionStore(path);
    downstream.push(nations);
    // Explicit legal/region facts; no catalog-label inference about this fixture Nation.
    nations.record({ careerId, nationId: 'fixture-nation', region: 'ASIA_PACIFIC', effectiveFromDay: 0, sourceEventId: 'fixture-region' });
    const cycle = openSqliteWorldCompetitionCycleStore(path); downstream.push(cycle);
    cycle.initialize(careerId, worldCycleInput(0));
    const selections = openSqliteNationalCompetitionSelectionStore(path, { cycle }); downstream.push(selections);
    selections.initialize({ careerId, editionId: 'fixture-wbc-2032', kind: 'WBC', cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 400 });
    const facts = openSqliteNationalEligibilityFactStore(path, { personLinks: links, nations }); downstream.push(facts);
    facts.record({ careerId, personLinkSourceId: existingSource.sourceId, active: true,
      fact: { evidenceId: 'fixture-citizenship', playerId: existingSource.playerId, personId: existingSource.personId,
        nationId: 'fixture-nation', basis: 'CITIZENSHIP', effectiveFromDay: 10 } });
    const callupSources = { selections, personLinks: links, facts, nations, rosterSnapshots: snapshots };
    const callups = openSqliteNationalCallupStore(path, callupSources); downstream.push(callups);
    const registrationInput = { eventId: 'fixture-callup', careerId, editionId: 'fixture-wbc-2032', nationId: 'fixture-nation',
      playerId: existingSource.playerId, personId: existingSource.personId, personLinkSourceId: existingSource.sourceId,
      rosterContextClubId: first, registeredAtDay: 420, replacementOf: null,
      eligibilityPolicy: { version: 'fixture-legal-v1', acceptedBases: ['CITIZENSHIP' as const], allowNationSwitch: true, seniorOfficialAppearanceLocksNation: true },
      callupPolicy: { version: 'fixture-national-v1', rosterLimit: 1, initialRegistrationCutoffDay: 420, replacementCutoffDay: 430,
        allowedDeclineReasons: ['PERSONAL' as const] }, response: { decision: 'ACCEPT' as const, reason: null, evidenceId: 'fixture-consent' } };
    const registered = callups.register(registrationInput);
    expect(registered.releaseClubId).toBe(first);
    expect(registered.source.roster.snapshotId).toBe(old.snapshotId);
    const accepted = intake.accept(source.sourceId);
    expect(accepted.rosterAfterRevision).toBe(1);
    const current = rosters.readHead(careerId, first)!.roster;
    expect(current.players).toHaveLength(11701);
    expect(current.players.slice(0, 11700)).toEqual(population.players);
    expect(rosters.readHead(careerId, last)?.roster).toEqual(current);
    expect(links.readAcceptedPlayerPersonLink(source.sourceId)).toEqual({ careerId, playerId: source.playerId, personId: source.personId });
    const genesis = openSqlitePersonGenesisStore(path); downstream.push(genesis);
    genesis.initializeCareer({ careerId, initializedAtDay: 10, careerSeed: 12345, policies: personPolicies });
    const allPeople = genesis.materializeBatch(personSourceIds);
    expect(allPeople).toHaveLength(11700);
    expect(db.prepare('SELECT count(*) AS n FROM world_person_priors').get()).toEqual({ n: 11700 });
    expect(allPeople.every((person, index) => person.playerId === population.players[index].playerId
      && person.personId === personSources[index].personId && person.priors.createdAtDay === 10
      && person.priors.playerId === person.playerId && person.priors.careerId === careerId)).toBe(true);
    for (const person of [allPeople[0], allPeople.at(-1)!]) expect(person.priors).toEqual(generatePlayerPersonPriors({
      careerId, playerId: person.playerId, createdAtDay: 10, careerSeed: 12345, policies: personPolicies }));
    expect(old.roster.players[0]).not.toHaveProperty('priors');
    const person = genesis.materialize(source.sourceId);
    expect(person).toMatchObject({ careerId, playerId: source.playerId, personId: source.personId });
    expect(person.priors).not.toHaveProperty('ability');
    expect(genesis.materialize(source.sourceId)).toEqual(person);
    expect(db.prepare('SELECT count(*) AS n FROM world_person_priors').get()).toEqual({ n: 11701 });
    expect(snapshots.readSnapshot(careerId, old.snapshotId)).toEqual(old);
    expect(callups.register(registrationInput)).toEqual(registered);
    const reopenedCallups = openSqliteNationalCallupStore(path, callupSources);
    try { expect(reopenedCallups.readRegistration(careerId, 'fixture-callup')).toEqual(registered); }
    finally { reopenedCallups.close(); }
    const next = snapshots.capture(careerId, last);
    expect(next.revision).toBe(1);
    expect(next.snapshotId).not.toBe(old.snapshotId);
    const managerId = `fixture-manager-${first}`, appointmentId = `appointment-${first}`, actionId = 'fixture-rest-player';
    const opportunity = { decisionId: actionId, contextId: actionId, worldRevision: 0,
      clubId: first, domainId: 'ROSTER', managerId, appointmentId, legalActionIds: [actionId] };
    const score = { mean: 1, uncertainty: 0, evidence: 1 };
    const agent = { managerId, appointmentId, state: { skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50,
      playerEvaluation: 50, operations: 50, leadership: 50 }, philosophy: { preferredStyleTags: [] as string[] },
      temperament: { riskAppetite: 50, decisionPace: 50, policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
      strategyMemory: { activePolicyActionIds: [] as string[] }, beliefs: { candidates: [{ actionId, styleTags: [] as string[],
        competitiveOutcome: score, resourceHealth: score, executionFeasibility: score, opponentInformationResponse: score }] } } };
    const binding = { actionId, command: { commandId: actionId, expectedRevision: 1, effectiveDay: 426,
      changes: [{ playerId: existingSource.playerId, availability: { status: 'UNAVAILABLE' as const, evidenceId: actionId } }] } };
    const selection = selectManagerControlledDecision(human, opportunity, agent, 'fixture-manager-trace');
    if (!selection.ok) throw new Error('invalid capacity Manager selection fixture');
    rosters.issueOpportunity({ careerId, clubId: first, expectedClubRevision: 0, expectedRosterRevision: 1, clubAsOfDay: 426,
      control: human, decisionId: actionId, contextId: actionId, worldRevision: 0, candidates: [binding], selectionAgent: agent });
    const executed = rosters.apply({ careerId, clubId: first, expectedClubRevision: 0, expectedRosterRevision: 1,
      expectedMoodRevision: null, control: human, opportunity, selection: selection.value, selectionAgent: agent,
      clubAsOfDay: 426, binding, currentWorldRevision: 0, afterWorldRevision: 1, executionId: 'fixture-capacity-execution' });
    expect(executed.rosterRevision).toBe(2);
    const after = rosters.readHead(careerId, last)!.roster;
    expect(after.players).toHaveLength(11701);
    expect(after.players.slice(1)).toEqual(current.players.slice(1));
    expect(after.players[0].availability.status).toBe('UNAVAILABLE');
    expect(control.readHead(careerId)?.worldRevision).toBe(1);
    const reopened = openSqliteManagerRosterDecisionStore(path), reopenedSnapshots = openSqliteNationalRosterSnapshotStore(path, { roster: reopened });
    try {
      expect(reopened.readHead(careerId, first)?.roster).toEqual(after);
      expect(reopened.readExecution('fixture-capacity-execution')).toEqual(executed);
      expect(reopenedSnapshots.readSnapshot(careerId, old.snapshotId)).toEqual(old);
      expect(intake.accept(source.sourceId)).toEqual(accepted);
      const reopenedLinks = openSqlitePlayerPersonLinkStore(path), reopenedGenesis = openSqlitePersonGenesisStore(path);
      try {
        const restoredLinks = reopenedLinks.acceptBatch(personSourceIds), restoredPeople = reopenedGenesis.materializeBatch(personSourceIds);
        expect(restoredLinks).toHaveLength(11700); expect(restoredPeople).toHaveLength(11700);
        expect(restoredLinks[0]).toEqual(allLinks[0]); expect(restoredLinks.at(-1)).toEqual(allLinks.at(-1));
        expect(restoredPeople[0]).toEqual(allPeople[0]); expect(restoredPeople.at(-1)).toEqual(allPeople.at(-1));
        expect(restoredPeople.every((person, index) => JSON.stringify(person) === JSON.stringify(allPeople[index]))).toBe(true);
      } finally { reopenedGenesis.close(); reopenedLinks.close(); }
    } finally { reopenedSnapshots.close(); reopened.close(); }
    const stored = db.prepare('SELECT snapshot_json FROM world_national_roster_snapshots WHERE snapshot_id=?').get(old.snapshotId) as { snapshot_json: string };
    const broken = JSON.parse(stored.snapshot_json);
    broken.roster.players[0].assignment.clubId = 'fixture-wrong-club';
    db.prepare('UPDATE world_national_roster_snapshots SET snapshot_json=? WHERE snapshot_id=?').run(JSON.stringify(broken), old.snapshotId);
    expect(() => snapshots.readSnapshot(careerId, old.snapshotId)).toThrow('corrupt');
    expect(() => callups.readRegistration(careerId, 'fixture-callup')).toThrow('corrupt');
    expect(creation.readSnapshot(careerId)).toEqual(initial);
  } finally { downstream.reverse().forEach((owner) => owner.close()); db.close(); links.close(); intake.close(); snapshots.close(); rosters.close(); creation.close(); catalogs.close(); }
}, 120000);
