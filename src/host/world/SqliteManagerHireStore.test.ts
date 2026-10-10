import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { managerHireFixture } from './ManagerHireFixture.test-support';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';
import { openSqliteManagerHireStore } from
  './SqliteManagerHireStore';
import { openSqliteManagerCandidateEvidenceStore } from
  './SqliteManagerCandidateEvidenceStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-manager-hire-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const { vacantClub, evidence, offer, acceptance, request } = managerHireFixture();

it('adopts one accepted manager hire with Club, wage and journal in one transaction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-manager-hire-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(path);
  stores.push(world);
  world.initialize({ careerId: 'career-a',
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1, revisionEventIds: [],
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [vacantClub()] });
  const authority = { readAcceptedManagerOfferAcceptance:
    (sourceEventId: string) => sourceEventId === acceptance.sourceEventId
      ? acceptance : null };
  const first = openSqliteManagerHireStore(path, authority);
  stores.push(first);
  first.initializeWageSchedules(createClubWageScheduleLedger(
    'career-a', 'club-a'));
  expect(() => first.apply(request())).toThrow('durable manager candidate evidence');
  const candidateStore = openSqliteManagerCandidateEvidenceStore(path, {
    readAcceptedManagerCandidateObservation: (eventId: string) =>
      evidence.observations.find((item) => item.eventId === eventId) ?? null,
  });
  stores.push(candidateStore);
  candidateStore.initialize('career-a', 'club-a');
  candidateStore.append('career-a', 'club-a', 0,
    evidence.observations[0]!);
  expect(candidateStore.append('career-a', 'club-a', 0,
    evidence.observations[0]!)).toEqual(evidence);
  expect(() => candidateStore.append('career-a', 'club-a', 1,
    { ...evidence.observations[0]!, eventId: 'invented-report' }))
    .toThrow('accepted manager observation');
  const withheld = openSqliteManagerHireStore(path, {
    readAcceptedManagerOfferAcceptance: () => null,
  });
  stores.push(withheld);
  expect(() => withheld.apply(request())).toThrow('accepted manager offer');
  expect(world.readClub('career-a', 'club-a')?.revision)
    .toBe(vacantClub().revision);
  withheld.close();
  stores.splice(stores.indexOf(withheld), 1);
  const adopted = first.apply(request());
  expect(adopted.hire.event.managerId).toBe('manager-b');
  expect(world.readClub('career-a', 'club-a')?.state.live.references
    .staffRoleLinks).toMatchObject([{ personId: 'manager-b' }]);
  expect(first.readWageSchedules('career-a', 'club-a')?.revision).toBe(1);
  expect(first.readClubHistory('career-a', 'club-a')?.acceptedEvents
    .at(-1)?.command.eventId).toBe('hire-atomic-1');
  expect(first.apply(request())).toEqual(adopted);
  expect(() => first.apply({ ...request(), offer: {
    ...offer, annualSalaryMinorUnits: 25 } })).toThrow('different');
  expect(() => first.apply({ ...request(), applicationId: 'hire-stale',
    ids: { ...request().ids, clubEventId: 'hire-stale-event' } }))
    .toThrow();
  first.close();
  stores.splice(stores.indexOf(first), 1);
  const reopened = openSqliteManagerHireStore(path, authority);
  stores.push(reopened);
  expect(reopened.readApplication('manager-hire-1')).toEqual(adopted);
  expect(reopened.readClubHistory('career-a', 'club-a')?.acceptedEvents)
    .toHaveLength(1);
  expect(candidateStore.read('career-a', 'club-a')).toEqual(evidence);
});
