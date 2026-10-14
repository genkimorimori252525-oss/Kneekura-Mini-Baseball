import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { managerHireFixture } from './ManagerHireFixture.test-support';
import { openSqliteManagerHireStore, readManagerHireWageEvidenceFromSqlite } from './SqliteManagerHireStore';
import { openSqliteManagerCandidateEvidenceStore } from './SqliteManagerCandidateEvidenceStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { persistClubEconomyOperation } from './ClubEconomyOperationDriver';

const closes: (() => void)[] = [], directories: string[] = [];
afterEach(() => { closes.splice(0).reverse().forEach(close => close()); directories.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })); });
const setup = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-staff-wage-')); directories.push(directory);
  const path = join(directory, 'world.sqlite'), f = managerHireFixture();
  const world = openSqliteWorldSettlementStore(path);
  world.initialize({ careerId: 'career-a', clubs: [f.vacantClub()],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1, revisionEventIds: [], games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const observations = new Map(f.evidence.observations.map(item => [item.eventId, item] as const));
  const candidates = openSqliteManagerCandidateEvidenceStore(path, {
    readAcceptedManagerCandidateObservation: id => observations.get(id) ?? null });
  candidates.initialize('career-a', 'club-a'); candidates.append('career-a', 'club-a', 0, f.evidence.observations[0]!);
  const hires = openSqliteManagerHireStore(path, { readAcceptedManagerOfferAcceptance: id => id === f.acceptance.sourceEventId ? f.acceptance : null });
  hires.initializeWageSchedules(createClubWageScheduleLedger('career-a', 'club-a'));
  const hired = hires.apply(f.request()), economy = openSqliteClubEconomyStore(path);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  closes.push(() => world.close(), () => candidates.close(), () => hires.close(), () => economy.close(), () => db.close());
  const operation = { kind: 'STAFF_WAGE' as const, applicationId: 'staff-pay-1', expectedClubRevision: hired.club.revision,
    club: hired.club, history: world.readClubHistory('career-a', 'club-a')!, wageSchedules: hired.schedules,
    managerHire: hires.captureStaffWageReference(hired.applicationId), commitmentId: 'manager-wage-1', payrollRunEventId: 'payroll-run-1',
    policy: { policyId: 'staff-annual', version: 'v1', careerId: 'career-a', clubId: 'club-a', season: 1,
      availableAtDay: 12, dueAtDay: 13, currency: 'SIM' } };
  return { path, f, world, hires, hired, candidates, economy, db, operation, observations };
};

it('pays the original hired Manager annual wage into real cash, commitment, receipt and journal with durable retry', () => {
  const f = setup(), saved = persistClubEconomyOperation(f.economy, f.operation);
  const after = f.world.readClub('career-a', 'club-a')!.state;
  expect(after.live.finance.cash).toBe(f.hired.club.live.finance.cash - 20);
  expect(after.live.finance.commitments.find(item => item.commitmentId === 'manager-wage-1'))
    .toMatchObject({ amount: 60, paidThisSeason: 20, paidBeforeSeason: 0 });
  expect(after.live.finance.receipts).toHaveLength(f.hired.club.live.finance.receipts.length + 1);
  expect(saved.batch.applications[0]).toMatchObject({ kind: 'STAFF_WAGE', basis: { amount: 20, annualAllocation: 20,
    sourceClubEventId: 'hire-atomic-1', payrollRunEventId: 'payroll-run-1' } });
  expect(f.world.readClubHistory('career-a', 'club-a')!.acceptedEvents.at(-1)).toEqual(saved.batch.events[0]);
  expect(saved.batch.financialRegulationAssessment.wageAllocations).toEqual([]);
  expect(() => persistClubEconomyOperation(f.economy, { ...f.operation, applicationId: 'duplicate-payment',
    club: after, history: f.world.readClubHistory('career-a', 'club-a')!, expectedClubRevision: after.revision })).toThrow(/paid|DUPLICATE/);
  const later = { ...f.f.evidence.observations[0]!, eventId: 'later-same-day-interview' };
  f.observations.set(later.eventId, later); f.candidates.append('career-a', 'club-a', 1, later);
  persistClubEconomyOperation(f.economy, { kind: 'STRUCTURAL_REVENUE', applicationId: 'later-sponsor',
    expectedClubRevision: after.revision, club: after, history: f.world.readClubHistory('career-a', 'club-a')!, wageSchedules: f.hired.schedules,
    fact: { factId: 'later-receipt', careerId: 'career-a', clubId: 'club-a', season: 1, category: 'commercial',
      settlementRef: 'sponsor-settlement', sourceEventId: 'sponsor-paid', receivedAtDay: 13, availableAtDay: 13,
      capacityRevisionAtReceipt: after.revision, amount: 1, currency: 'SIM' },
    policy: { policyId: 'structural-v1', version: 'v1', careerId: 'career-a', clubId: 'club-a', season: 1,
      availableAtDay: 12, currency: 'SIM', maximumSeasonAmount: 700, allowedCategories: ['commercial'] } });
  const reopened = openSqliteClubEconomyStore(f.path); closes.push(() => reopened.close());
  expect(persistClubEconomyOperation(reopened, f.operation)).toEqual(saved);
  expect(reopened.readApplication(f.operation.applicationId)).toEqual(saved);
  expect(f.hires.captureStaffWageReference(f.hired.applicationId)).toEqual(f.operation.managerHire);
});

it('rejects caller-rebuilt wage allocations, wrong hire origin, stale heads and unavailable policy before payment', () => {
  const f = setup();
  const altered = { ...f.operation.wageSchedules, schedules: f.operation.wageSchedules.schedules.map(item => ({ ...item,
    annualAmounts: [{ season: 1, amount: 30 }, { season: 2, amount: 10 }, { season: 3, amount: 20 }] })) };
  for (const operation of [
    { ...f.operation, wageSchedules: altered },
    { ...f.operation, managerHire: { ...f.operation.managerHire, requestHash: 'changed' } },
    { ...f.operation, expectedClubRevision: 0 },
    { ...f.operation, policy: { ...f.operation.policy, availableAtDay: 14 } },
  ]) expect(() => persistClubEconomyOperation(f.economy, operation)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(f.hired.club);
  expect(f.economy.readApplication(f.operation.applicationId)).toBeNull();
});

it.each(['world_manager_hire_applications', 'world_wage_schedule_heads'])('rejects missing original %s at admission and on historical payment retry', table => {
  const f = setup();
  const original = f.db.prepare(`SELECT * FROM ${table}`).get()!, columns = Object.keys(original);
  f.db.exec(`DELETE FROM ${table}`);
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
  f.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(original));
  const saved = persistClubEconomyOperation(f.economy, f.operation);
  f.db.exec(`DELETE FROM ${table}`);
  expect(() => f.economy.readApplication(f.operation.applicationId)).toThrow();
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state.live.finance.cash).toBe(saved.batch.state.live.finance.cash);
});

it('rolls back payment, Club journal and source mutation when an INSERT rewrites the original hire', () => {
  const f = setup();
  f.db.exec(`CREATE TRIGGER mutate_hire AFTER INSERT ON world_club_economy_applications BEGIN
    UPDATE world_manager_hire_applications SET request_json=json_set(request_json,'$.offer.annualSalaryMinorUnits',21);
  END`);
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(f.hired.club);
  expect(f.world.readClubHistory('career-a', 'club-a')).toEqual(f.operation.history);
  expect(f.economy.readApplication(f.operation.applicationId)).toBeNull();
  expect(f.hires.captureStaffWageReference(f.hired.applicationId)).toEqual(f.operation.managerHire);
  f.db.exec('DROP TRIGGER mutate_hire');
  expect(persistClubEconomyOperation(f.economy, f.operation).batch.applications[0].basis).toMatchObject({ amount: 20 });
});

it('keeps original hiring observations authoritative during payment retry and historical replay', () => {
  const f = setup(); persistClubEconomyOperation(f.economy, f.operation);
  f.db.exec("UPDATE world_manager_candidate_observation_ids SET event_json=json_set(event_json,'$.kind','REFERENCE')");
  expect(() => f.economy.readApplication(f.operation.applicationId)).toThrow();
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
});


it('rolls back a payment INSERT that changes the persisted annual staff allocation', () => {
  const f = setup();
  f.db.exec(`CREATE TRIGGER mutate_wage AFTER INSERT ON world_club_economy_applications BEGIN
    UPDATE world_wage_schedule_heads SET ledger_json=json_set(ledger_json,
      '$.schedules[0].annualAmounts[0].amount',30,'$.schedules[0].annualAmounts[1].amount',10);
  END`);
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
  expect(f.world.readClub('career-a', 'club-a')!.state).toEqual(f.hired.club);
  expect(f.world.readClubHistory('career-a', 'club-a')).toEqual(f.operation.history);
  expect(f.hires.readWageSchedules('career-a', 'club-a')).toEqual(f.hired.schedules);
  expect(f.economy.readApplication(f.operation.applicationId)).toBeNull();
  f.db.exec('DROP TRIGGER mutate_wage');
  expect(persistClubEconomyOperation(f.economy, f.operation).batch.state.live.finance.cash)
    .toBe(f.hired.club.live.finance.cash - 20);
});

it('rejects a non-Native hiring evidence facade before reaching SQL', () => {
  let sqlCalls = 0;
  const facade = { isTransaction: true, prepare() { sqlCalls += 1; throw new Error('facade SQL reached'); } };
  expect(() => readManagerHireWageEvidenceFromSqlite(facade as never, 'hire'))
    .toThrow(/actual Native SQLite connection/);
  expect(sqlCalls).toBe(0);
});

it('rejects a self-consistent rewritten hire snapshot after a later actual Club event', () => {
  const f = setup();
  persistClubEconomyOperation(f.economy, f.operation);
  const history = f.world.readClubHistory('career-a', 'club-a');
  expect(f.world.readClub('career-a', 'club-a')!.revision).toBeGreaterThan(f.hired.club.revision);
  expect(f.hires.captureStaffWageReference(f.hired.applicationId)).toEqual(f.operation.managerHire);
  f.db.exec(`UPDATE world_manager_hire_applications
    SET before_club_json=json_set(before_club_json,'$.institutional.brand.displayName','Rewritten Club'),
        result_json=json_set(result_json,'$.club.institutional.brand.displayName','Rewritten Club',
          '$.hire.state.institutional.brand.displayName','Rewritten Club')`);
  expect(f.world.readClubHistory('career-a', 'club-a')).toEqual(history);
  expect(() => f.hires.captureStaffWageReference(f.hired.applicationId)).toThrow(/corrupt durable manager hire/);
  expect(() => f.hires.readApplication(f.hired.applicationId)).toThrow(/corrupt durable manager hire/);
  expect(() => f.economy.readApplication(f.operation.applicationId)).toThrow();
  expect(() => persistClubEconomyOperation(f.economy, f.operation)).toThrow();
});
