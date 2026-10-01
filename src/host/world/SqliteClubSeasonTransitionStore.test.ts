import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { state, nextPlan } from '../../core/world/club/ClubFixtures.test-support';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import type { ClubCommand, ClubWorldState } from '../../core/world/club/ClubTypes';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteClubSeasonTransitionStore, type AcceptedClubSeasonTransition } from './SqliteClubSeasonTransitionStore';

const stores: { close(): void }[] = [];
afterEach(() => { stores.splice(0).reverse().forEach((store) => store.close()); });
let counter = 0;
const schedule = (seasonId: string) => ({ seasonId, leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'],
  regularSeasonGamesPerClub: 1, games: [{ gameId: `game-${seasonId}`, homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] });
const policy = { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 };
const setup = () => {
  const path = `file:club-season-${counter++}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path); stores.push(world);
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: schedule('league-season-1'), standingsPolicy: policy });
  const accepted = new Map<string, AcceptedClubSeasonTransition>();
  const transition = openSqliteClubSeasonTransitionStore(path, { readAcceptedTransition: (sourceId) => accepted.get(sourceId) ?? null });
  stores.push(transition);
  const record = (sourceId: string, command: ClubCommand) => { accepted.set(sourceId, { sourceId, sourceVersion: 'season-source-v1', command }); return transition.apply(sourceId); };
  return { path, world, accepted, transition, record };
};
const closing = (club: ClubWorldState, label: string) => ({ kind: 'CLOSE_SEASON' as const, snapshotId: `snapshot-${label}`,
  resultRefs: { domesticResultRef: club.season.plan.competitionEditionIds[0], continentalResultRef: null,
    rosterSummaryRef: `accepted-roster-${label}`, fanbaseSummaryRef: `accepted-fanbase-${label}`, derivedSummaryRef: null } });
const rollover = (club: ClubWorldState, label: string): ClubCommand => {
  const plan = nextPlan(club);
  return { eventId: `event-${label}`, careerId: club.careerId, clubId: club.identity.clubId, expectedRevision: club.revision,
    effectiveDay: plan.startsOnDay, causeEventIds: [`accepted-boundary-${label}`],
    operations: [closing(club, label), { kind: 'OPEN_SEASON', plan }] };
};

it('actual economy -> native close/open -> next World season preserves cash, identity and historical snapshots', () => {
  const f = setup();
  // Revenue is written to the real shared World Club head before closing.
  const initial = f.world.readClub('career-a', 'club-a')!.state;
  const economy = openSqliteClubEconomyStore(f.path); stores.push(economy);
  const fact = { factId: 'commercial-1', careerId: 'career-a', clubId: 'club-a', season: 1,
    settlementRef: 'commercial-receipt', category: 'commercial' as const, amount: 10, currency: 'SIM',
    sourceEventId: 'accepted-commercial', receivedAtDay: 11, availableAtDay: 11, capacityRevisionAtReceipt: 0 };
  const revenue = economy.apply({ applicationId: 'economy-1', expectedClubRevision: initial.revision, club: initial,
    history: f.world.readClubHistory('career-a', 'club-a')!, wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    sources: [{ kind: 'STRUCTURAL_REVENUE', fact, policy: { policyId: 'commercial-policy', version: 'revenue-v1',
      careerId: 'career-a', clubId: 'club-a', season: 1, availableAtDay: 10, currency: 'SIM',
      allowedCategories: ['commercial'], maximumSeasonAmount: 100 } }] });
  const before = revenue.batch.state;
  const advanced = f.record('advance-1', rollover(before, 'one'));
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(advanced.state);
  expect(advanced.state.season.plan.season).toBe(2);
  expect(advanced.state.live.finance.cash).toBe(before.live.finance.cash);
  expect(advanced.state.live.finance.openingCash).toBe(before.live.finance.cash);
  expect(advanced.state.live.finance.debt).toBe(before.live.finance.debt);
  expect(advanced.state.live.finance.revenue.commercial).toBe(0);
  expect(advanced.state.initialSeed).toEqual(initial.initialSeed);
  expect(advanced.state.institutional).toEqual(before.institutional);
  expect(advanced.state.live.references).toEqual(before.live.references);
  const snapshot = f.transition.readSeasonSnapshot('career-a', 'club-a', 1)!;
  expect(snapshot.finance.revenue.commercial).toBe(10);
  expect(snapshot.season).toBe(1);
  f.world.initialize({ careerId: 'career-a', clubs: [advanced.state], schedule: schedule('league-season-2'), standingsPolicy: policy });
  expect(f.world.readSeason('career-a', 'league-season-2')!.revision).toBe(0);
  f.record('advance-2', rollover(advanced.state, 'two'));
  expect(f.transition.readSeasonSnapshot('career-a', 'club-a', 1)).toEqual(snapshot);
  expect(f.transition.apply('advance-1')).toEqual(advanced);
  f.transition.close();
  const reopened = openSqliteClubSeasonTransitionStore(f.path); stores.push(reopened);
  expect(reopened.apply('advance-1')).toEqual(advanced);
  expect(reopened.readSeasonSnapshot('career-a', 'club-a', 1)).toEqual(snapshot);
  expect(f.world.readClub('career-a', 'club-a')!.state.season.plan.season).toBe(3);
});

it('carries an actual unpaid obligation through multiple Native years and reopen without reseeding', () => {
  const f = setup();
  // Initialise a second independently created World career so the obligation is accepted in its original checkpoint.
  const first = applyClubCommand(state(), { eventId: 'obligation', careerId: 'career-a', clubId: 'club-a', expectedRevision: 0,
    effectiveDay: 11, causeEventIds: ['signed-contract'], operations: [{ kind: 'RECORD_COMMITMENT', commitmentId: 'long-obligation',
      contractRef: 'signed-long', category: 'stadiumOperations', budgetBucket: 'facilities', amount: 500, currency: 'SIM' }] });
  if (!first.ok) throw new Error(JSON.stringify(first.reason));
  const path = `file:club-long-${counter++}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path); stores.push(world);
  world.initialize({ careerId: 'career-a', clubs: [first.state], schedule: schedule('league-season-1'), standingsPolicy: policy });
  const accepted = new Map<string, AcceptedClubSeasonTransition>();
  let transition = openSqliteClubSeasonTransitionStore(path, { readAcceptedTransition: (sourceId) => accepted.get(sourceId) ?? null }); stores.push(transition);
  let current = first.state;
  for (let year = 1; year <= 24; year++) {
    const sourceId = `year-${year}`; accepted.set(sourceId, { sourceId, sourceVersion: 'v1', command: rollover(current, `year-${year}`) });
    current = transition.apply(sourceId).state;
    if (year === 12) { transition.close(); transition = openSqliteClubSeasonTransitionStore(path,
      { readAcceptedTransition: (id) => accepted.get(id) ?? null }); stores.push(transition); }
  }
  expect(current.season.plan.season).toBe(25);
  expect(current.live.finance.commitments[0]).toMatchObject({ commitmentId: 'long-obligation', amount: 500, paidThisSeason: 0 });
  expect(current.live.finance.cash).toBe(first.state.live.finance.cash);
  expect(current.initialSeed).toEqual(first.state.initialSeed);
  expect(transition.readSeasonSnapshot('career-a', 'club-a', 1)?.finance.commitments[0].commitmentId).toBe('long-obligation');
  expect(transition.readSeasonSnapshot('career-a', 'club-a', 24)?.season).toBe(24);
  expect(world.readClubHistory('career-a', 'club-a')?.acceptedEvents).toHaveLength(24);
  expect(f.world.readClub('career-a', 'club-a')!.state.season.plan.season).toBe(1);
});

it('rejects stale/backdated/changed/nonseason input and duplicate snapshots with no partial state', () => {
  const f = setup(), initial = f.world.readClub('career-a', 'club-a')!.state;
  const command = rollover(initial, 'valid');
  expect(() => f.transition.apply('missing')).toThrow();
  for (const invalid of [{ ...command, expectedRevision: 4 }, { ...command, effectiveDay: 0 },
    { ...command, operations: [{ kind: 'RENAME_CLUB' as const, displayName: 'X', shortName: 'X' }] },
    { ...command, operations: [...command.operations].reverse() }, { ...command, careerId: 'missing' }]) {
    expect(() => f.record('invalid', invalid)).toThrow();
    expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(initial);
    expect(f.transition.readApplication('invalid')).toBeNull();
  }
  const saved = f.record('valid', command);
  const accessor = { sourceId: 'accessor', sourceVersion: 'v1', get command(): ClubCommand { throw new Error('getter must not run'); } };
  f.accepted.set('accessor', accessor);
  expect(() => f.transition.apply('accessor')).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(saved.state);
  f.accepted.set('valid', { sourceId: 'valid', sourceVersion: 'v2', command });
  expect(() => f.transition.apply('valid')).toThrow(/frozen|differs/);
  expect(f.transition.readApplication('valid')).toEqual(saved);
  const duplicate = rollover(saved.state, 'valid');
  expect(() => f.record('duplicate', duplicate)).toThrow(/snapshot/);
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(saved.state);
});

it('next-season initialization preserves the creation checkpoint and rejects damaged accepted history atomically', () => {
  const f = setup();
  const initial = f.world.readClub('career-a', 'club-a')!.state;
  const saved = f.record('advance', rollover(initial, 'advance'));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(f.path); stores.push(db);
  const original = db.prepare('SELECT state_json FROM world_club_checkpoints').get();
  f.world.initialize({ careerId: 'career-a', clubs: [saved.state], schedule: schedule('league-season-2'), standingsPolicy: policy });
  expect(db.prepare('SELECT state_json FROM world_club_checkpoints').get()).toEqual(original);
  const third = f.record('third', rollover(saved.state, 'third'));
  db.exec("UPDATE world_club_event_journal SET event_json='{}'");
  expect(() => f.world.initialize({ careerId: 'career-a', clubs: [third.state],
    schedule: schedule('league-season-3'), standingsPolicy: policy })).toThrow();
  expect(db.prepare('SELECT state_json FROM world_club_checkpoints').get()).toEqual(original);
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(third.state);
  expect(f.world.readSeason('career-a', 'league-season-3')).toBeNull();
});

it('supports separately accepted close and open; failed head update rolls back journal/application/snapshot', () => {
  const f = setup(), initial = f.world.readClub('career-a', 'club-a')!.state;
  const command = rollover(initial, 'atomic');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(f.path); stores.push(db);
  db.exec("CREATE TRIGGER abort_season BEFORE UPDATE ON world_club_heads BEGIN SELECT RAISE(ABORT, 'forced season failure'); END;");
  expect(() => f.record('atomic', command)).toThrow('forced season failure');
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(initial);
  expect(f.world.readClubHistory('career-a', 'club-a')!.acceptedEvents).toHaveLength(0);
  expect(f.transition.readApplication('atomic')).toBeNull();
  expect(f.transition.readSeasonSnapshot('career-a', 'club-a', 1)).toBeNull();
  db.exec('DROP TRIGGER abort_season');
  const closed = f.record('close', { ...command, eventId: 'close-event', operations: [command.operations[0]] });
  expect(closed.state.season.closureRef).toBe('snapshot-atomic');
  const opened = f.record('open', { ...command, eventId: 'open-event', expectedRevision: closed.state.revision, operations: [command.operations[1]] });
  expect(opened.state.season.plan.season).toBe(2);
  db.exec("UPDATE world_club_season_transitions SET result_json='{}' WHERE source_id='close'");
  expect(() => f.transition.readApplication('close')).toThrow(/corrupt/);
  expect(() => f.transition.readSeasonSnapshot('career-a', 'club-a', 1)).toThrow(/corrupt/);
});
