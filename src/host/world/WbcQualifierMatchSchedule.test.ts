import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { planWbcGlobalQualifier } from '../../core/world/competition/WbcGlobalQualifierPods';
import type { WbcGlobalQualifierEdition } from '../../core/world/competition/WbcGlobalQualifierPods';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import { planWbcQualifierSchedule } from '../../core/world/competition/WbcQualifierSchedule';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import { openSqliteWbcQualifierScheduleStore } from './SqliteWbcQualifierScheduleStore';
import { registerWbcQualifierFixtureFromWorld } from './WbcQualifierFixtureFromWorld';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { openSqliteNationalQualificationHistoryStore } from './SqliteNationalQualificationHistoryStore';

const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
const edition: WbcGlobalQualifierEdition = {
  competitionId: 'global-qualifier', editionId: 'qualifier-2032',
  canonicalRole: 'WBC_GLOBAL_QUALIFIER', formatVersion: 'four-pods-v1',
  ruleProfileVersion: 'national-rules-v1', gamePolicyVersion: 'national-games-v1',
  hostingPolicyVersion: 'pod-hosts-v1', qualificationSnapshotId: 'selected-sixteen',
  drawSnapshotId: 'draw-sixteen', calendarWindow: { startsOnDay: 40, endsOnDay: 50 },
  pods: regions.map((_, podIndex) => ({ podIndex, hostNationId: `host-${podIndex}`,
    hostCityId: `city-${podIndex}`, hostVenueId: `venue-${podIndex}`,
    entrants: regions.map((region) => ({ region, nationId: `${region}-${podIndex}` })) })),
};
const selection: WbcQualifierSelection = {
  qualifierEditionId: edition.editionId, directSnapshotId: 'direct-twenty',
  rankingSnapshotId: 'cutoff-ranking', eligibilitySnapshotId: 'eligible-sixteen',
  policyVersion: 'selection-v1', qualificationSnapshotId: edition.qualificationSnapshotId,
  entrants: edition.pods.flatMap((pod) => pod.entrants.map((entrant) => ({ ...entrant,
    route: 'REGIONAL_PRIORITY' as const, sourceId: 'regional-placement' }))),
};
const policy = { version: 'explicit-test-schedule-v1', gamesPerVenuePerDay: 1,
  minimumOffDaysBetweenRounds: 1 };

it('schedules twelve qualifier games with explicit capacity, rest and full source identity', () => {
  const plan = planWbcGlobalQualifier(edition);
  const schedule = planWbcQualifierSchedule(edition, plan, policy);
  expect(schedule.games).toHaveLength(12);
  expect(schedule.games.filter((game) => game.stage === 'SEMIFINAL').map((game) => game.gameDay))
    .toEqual([40, 40, 40, 40, 41, 41, 41, 41]);
  expect(schedule.games.filter((game) => game.stage === 'FINAL').map((game) => game.gameDay))
    .toEqual([43, 43, 43, 43]);
  expect(schedule.source).toEqual({ edition, plan });
  expect(Object.isFrozen(schedule.source.edition.pods[0].entrants)).toBe(true);
  expect(() => planWbcQualifierSchedule({ ...edition,
    calendarWindow: { startsOnDay: 40, endsOnDay: 42 } }, plan, policy)).toThrow('full schedule');
  expect(() => planWbcQualifierSchedule(edition, plan, { ...policy, gamesPerVenuePerDay: 0 }))
    .toThrow('policy');
  expect(() => planWbcQualifierSchedule(edition, { ...plan, drawSnapshotId: 'other' }, policy))
    .toThrow('matching');
  const sharedVenue = { ...edition, pods: edition.pods.map((pod) => ({ ...pod, hostVenueId: 'shared' })) };
  const shared = planWbcQualifierSchedule(sharedVenue, planWbcGlobalQualifier(sharedVenue),
    { ...policy, gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 });
  expect(shared.games.filter((game) => game.stage === 'FINAL')[0].gameDay).toBe(44);
});

it('plays twelve scheduled official Match games and preserves pending rounds through restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-qualifier-match-'));
  const path = join(directory, 'world.sqlite'), matchPath = join(directory, 'matches.sqlite');
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  let matches = new SqliteOfficialStateStore(matchPath);
  closables.push({ close: () => matches.close() });
  const matchSource = { getMatch: (gameId: string) => matches.getMatch(gameId),
    getOfficialFixture: (gameId: string) => matches.getOfficialFixture(gameId) };
  const sources = { selection: { readSelection: () => selection }, matches: matchSource };
  let pods = track(openSqliteWbcGlobalQualifierPodStore(path, sources));
  let schedules = track(openSqliteWbcQualifierScheduleStore(path, { pods }));
  try {
    const plan = pods.initialize({ careerId: 'career-1', edition });
    const request = { careerId: 'career-1', editionId: edition.editionId, policy };
    const schedule = schedules.initialize(request);
    expect(schedules.initialize(request)).toEqual(schedule);
    expect(() => schedules.initialize({ ...request, policy: { ...policy, minimumOffDaysBetweenRounds: 2 } }))
      .toThrow('frozen differently');
    const register = (gameId: string, gameDay = schedule.games.find((game) => game.gameId === gameId)!.gameDay) =>
      registerWbcQualifierFixtureFromWorld({ pods, schedules, matches },
        { careerId: 'career-1', editionId: edition.editionId, gameId, gameDay });
    const play = (gameId: string): void => {
      const fixture = register(gameId);
      expect(register(gameId)).toEqual(fixture);
      const result = playOfficialNineInningGame(matches, { ...fixture.game,
        seasonId: edition.editionId, ruleProfileVersion: edition.ruleProfileVersion,
        gamePolicyVersion: edition.gamePolicyVersion, binding: fixture.binding });
      expect(result.durableRevision).toBe(60);
      expect(result.lineScore.innings).toHaveLength(9);
    };
    const reopen = (): void => {
      schedules.close(); pods.close(); matches.close();
      matches = new SqliteOfficialStateStore(matchPath);
      pods = track(openSqliteWbcGlobalQualifierPodStore(path, sources));
      schedules = track(openSqliteWbcQualifierScheduleStore(path, { pods }));
      expect(pods.readPlan('career-1', edition.editionId)).toEqual(plan);
      expect(pods.readEdition('career-1', edition.editionId)).toEqual(edition);
      expect(schedules.readSchedule('career-1', edition.editionId)).toEqual(schedule);
    };
    const semis = schedule.games.filter((game) => game.stage === 'SEMIFINAL');
    const finals = schedule.games.filter((game) => game.stage === 'FINAL');
    expect(() => register(semis[0].gameId, semis[0].gameDay + 1)).toThrow('accepted schedule');
    expect(() => register('unknown-game', 40)).toThrow('accepted schedule');
    expect(matches.getOfficialFixture(semis[0].gameId)).toBeNull();
    expect(() => register(finals[0].gameId)).toThrow('not yet qualified');
    for (let index = 0; index < 8; index++) {
      play(semis[index].gameId);
      if (index < 7) {
        expect(pods.finalGames('career-1', edition.editionId)).toBeNull();
        expect(pods.finalize('career-1', edition.editionId)).toBeNull();
        reopen();
      }
    }
    expect(pods.finalGames('career-1', edition.editionId)).toHaveLength(4);
    for (let index = 0; index < 4; index++) {
      play(finals[index].gameId);
      if (index < 3) {
        expect(pods.finalize('career-1', edition.editionId)).toBeNull();
        expect(pods.readEvidence('career-1', edition.editionId)).toBeNull();
        reopen();
      }
    }
    const outcome = pods.finalize('career-1', edition.editionId)!;
    expect(outcome.winners).toHaveLength(4);
    expect(pods.finalize('career-1', edition.editionId)).toEqual(outcome);
    const qualification = track(openSqliteNationalQualificationHistoryStore(path,
      { knockouts: { readEvidence: () => null }, qualifiers: pods, selections: sources.selection }));
    qualification.initialize('career-1', { ASIA_PACIFIC: 'regional-ap', AMERICAS: 'regional-am',
      EUROPE: 'regional-eu', AFRICA: 'regional-af' });
    const history = qualification.recordQualifier('career-1', edition.editionId);
    expect(history.qualifiers[0].winners).toEqual(outcome.winners);
    qualification.close(); reopen();
    expect(pods.readOutcome('career-1', edition.editionId)).toEqual(outcome);
    const alternate = track(openSqliteWbcGlobalQualifierPodStore(':memory:', sources));
    alternate.initialize({ careerId: 'career-1', edition: { ...edition, hostingPolicyVersion: 'other-version' } });
    const alternativeSchedules = track(openSqliteWbcQualifierScheduleStore(path, { pods: alternate }));
    expect(() => alternativeSchedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
    expect(() => registerWbcQualifierFixtureFromWorld({ pods: alternate, schedules, matches },
      { careerId: 'career-1', editionId: edition.editionId, gameId: semis[0].gameId, gameDay: semis[0].gameDay }))
      .toThrow('accepted Edition');
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_wbc_qualifier_schedules SET schedule_json='{}'").run(); db.close();
    expect(() => schedules.readSchedule('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
