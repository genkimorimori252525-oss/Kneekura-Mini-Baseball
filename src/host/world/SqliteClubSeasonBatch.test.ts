import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { nextPlan, state } from '../../core/world/club/ClubFixtures.test-support';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import { openSqliteClubSeasonTransitionStore, type AcceptedClubSeasonTransition } from './SqliteClubSeasonTransitionStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const stores: { close(): void }[] = [];
afterEach(() => stores.splice(0).reverse().forEach((store) => store.close()));
const boundary = (club: ClubWorldState, suffix = ''): AcceptedClubSeasonTransition => {
  const sourceId = `boundary-${club.identity.clubId}${suffix}`;
  return { sourceId, sourceVersion: 'boundary-v1', command: { eventId: sourceId, careerId: club.careerId,
    clubId: club.identity.clubId, expectedRevision: club.revision, effectiveDay: club.effectiveDay + 2, causeEventIds: [`approved-${sourceId}`],
    operations: [{ kind: 'CLOSE_SEASON', snapshotId: `snapshot-${sourceId}`, resultRefs: { domesticResultRef: 'league-season-1',
      continentalResultRef: null, rosterSummaryRef: `roster-${sourceId}`, fanbaseSummaryRef: `fan-${sourceId}`, derivedSummaryRef: null } },
    { kind: 'OPEN_SEASON', plan: nextPlan(club) }] } };
};
const setup = () => {
  const path = `file:season-batch-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const clubs = [state(), { ...state(), identity: { ...state().identity, clubId: 'club-b' },
    live: { ...state().live, references: { ...state().live.references,
      rivalryStateRefs: [{ fromClubId: 'club-b', toClubId: 'club-a', stateRef: 'b-a' }] } } }];
  const world = openSqliteWorldSettlementStore(path); stores.push(world);
  world.initialize({ careerId: 'career-a', clubs, schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: clubs.map((club) => club.identity.clubId), regularSeasonGamesPerClub: 1, revisionEventIds: [],
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }] }, standingsPolicy: {
    version: 'v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const sources = new Map(clubs.map((club) => { const accepted = boundary(club); return [accepted.sourceId, accepted]; }));
  const owner = openSqliteClubSeasonTransitionStore(path, { readAcceptedTransition: (id) => sources.get(id) ?? null }); stores.push(owner);
  return { path, clubs, world, sources, owner, ids: [...sources.keys()] };
};

it('advances all requested actual Club heads atomically, then replays original results after later seasons/reopen', () => {
  const f = setup();
  const first = f.owner.applyBatch(f.ids);
  expect(first.map((result) => result.state.season.plan.season)).toEqual([2, 2]);
  for (const result of first) {
    expect(f.world.readClub('career-a', result.state.identity.clubId)!.state).toEqual(result.state);
    const next = boundary(result.state, '-second'); f.sources.set(next.sourceId, next);
  }
  f.owner.applyBatch(first.map((result) => `boundary-${result.state.identity.clubId}-second`));
  expect(f.owner.applyBatch(f.ids)).toEqual(first);
  f.owner.close();
  const reopened = openSqliteClubSeasonTransitionStore(f.path); stores.push(reopened);
  expect(reopened.applyBatch(f.ids)).toEqual(first);
  expect(f.world.readClub('career-a', 'club-a')!.state.season.plan.season).toBe(3);
});

it('a failure at the second member rolls back every head, event, application and closing snapshot', () => {
  const f = setup();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(f.path); stores.push(db);
  db.exec("CREATE TRIGGER batch_failure BEFORE UPDATE ON world_club_heads WHEN NEW.club_id='club-b' BEGIN SELECT RAISE(ABORT, 'second member failed'); END;");
  expect(() => f.owner.applyBatch(f.ids)).toThrow('second member failed');
  for (const [i, id] of f.ids.entries()) {
    expect(f.world.readClub('career-a', f.clubs[i].identity.clubId)!.state).toEqual(f.clubs[i]);
    expect(f.world.readClubHistory('career-a', f.clubs[i].identity.clubId)!.acceptedEvents).toHaveLength(0);
    expect(f.owner.readApplication(id)).toBeNull();
    expect(f.owner.readSeasonSnapshot('career-a', f.clubs[i].identity.clubId, 1)).toBeNull();
  }
  db.exec('DROP TRIGGER batch_failure');
  expect(f.owner.applyBatch(f.ids)).toHaveLength(2);
});

it('reads and detaches every accepted Source before the first member write', () => {
  const f = setup(), observed: number[] = [];
  const owner = openSqliteClubSeasonTransitionStore(f.path, { readAcceptedTransition: (id) => {
    observed.push(f.world.readClub('career-a', 'club-a')!.state.season.plan.season);
    return f.sources.get(id) ?? null;
  } }); stores.push(owner);
  expect(owner.applyBatch(f.ids)).toHaveLength(2);
  expect(observed).toEqual([1, 1]);
});

it('rejects duplicate Sources/members, mixed Careers, stale members and changed Sources without partial acceptance', () => {
  const f = setup();
  expect(() => f.owner.applyBatch([])).toThrow();
  expect(() => f.owner.applyBatch([f.ids[0], f.ids[0]])).toThrow();
  const duplicate = { ...f.sources.get(f.ids[0])!, sourceId: 'duplicate' }; f.sources.set('duplicate', duplicate);
  expect(() => f.owner.applyBatch([f.ids[0], 'duplicate'])).toThrow();
  const second = f.sources.get(f.ids[1])!;
  f.sources.set(f.ids[1], { ...second, command: { ...second.command, expectedRevision: 100 } });
  expect(() => f.owner.applyBatch(f.ids)).toThrow();
  f.sources.set(f.ids[1], { ...second, command: { ...second.command, careerId: 'other' } });
  expect(() => f.owner.applyBatch(f.ids)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(f.clubs[0]);
  expect(f.owner.readApplication(f.ids[0])).toBeNull();
  f.sources.set(f.ids[1], second); const first = f.owner.applyBatch(f.ids);
  f.sources.set(f.ids[1], { ...second, sourceVersion: 'changed' });
  expect(() => f.owner.applyBatch(f.ids)).toThrow(/frozen/);
  expect(f.owner.readApplication(f.ids[1])).toEqual(first[1]);
});
