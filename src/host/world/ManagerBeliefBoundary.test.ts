import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { ManagerBeliefHistory } from '../../core/world/manager/ManagerBeliefHistory';
import { managerBoundaryFixture } from './ManagerBeliefBoundary.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

type Db = Pick<DatabaseSync, 'prepare'>;
type Boundary = Readonly<{ version: 'manager_belief_boundary_v1'; careerId: string; managerId: string;
  revision: number; state: ManagerBeliefHistory; evidence: unknown; hash: string }>;
type BoundaryApi = {
  readManagerBeliefBoundary(db: Db, careerId: string, managerId: string, revision: number): Boundary | null;
  assertManagerBeliefBoundary(db: Db, boundary: Boundary, mode: 'historical' | 'current'): void;
};
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = async () => {
  const f = managerBoundaryFixture(cleanup);
  const api = await vi.importActual<BoundaryApi>('./SqliteManagerBeliefHistoryStore');
  if (typeof api.readManagerBeliefBoundary !== 'function' || typeof api.assertManagerBeliefBoundary !== 'function') {
    throw new Error('bounded Manager belief reader and consumer guard are unavailable');
  }
  const read = (revision: number) => api.readManagerBeliefBoundary(f.db, 'career-a', 'manager-a', revision);
  return { f, api, read };
};

it('reads the genuine seed and observed prefix through the existing Manager owner without writing', async () => {
  const { f, api, read } = await fixture(), before = f.snapshot();
  const initial = read(0)!;
  expect(initial).toMatchObject({ version: 'manager_belief_boundary_v1', careerId: 'career-a', managerId: 'manager-a', revision: 0 });
  expect(initial.state).toEqual(f.initial); expect(initial.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(Object.isFrozen(initial)).toBe(true); expect(Object.isFrozen(initial.state.agent)).toBe(true);
  api.assertManagerBeliefBoundary(f.db, initial, 'current');
  expect(f.snapshot()).toBe(before);
  const observed = f.first(), after = f.snapshot(), one = read(1)!;
  expect(one.state).toEqual(observed.state); expect(one.hash).not.toBe(initial.hash);
  const store = f.history as typeof f.history & { readAtRevision(careerId: string, managerId: string, revision: number): ManagerBeliefHistory | null };
  expect(store.readAtRevision('career-a', 'manager-a', 0)).toEqual(initial.state);
  expect(store.readAtRevision('career-a', 'manager-a', 1)).toEqual(one.state);
  api.assertManagerBeliefBoundary(f.db, one, 'current'); expect(f.snapshot()).toBe(after);
});

it('reopens exact earlier boundaries after two real roster observations without recapturing the later head', async () => {
  const { f, api, read } = await fixture(), zero = read(0)!;
  f.first(); const one = read(1)!;
  const second = f.second(); expect(second.revision).toBe(2);
  f.reopen();
  expect(read(0)).toEqual(zero); expect(read(1)).toEqual(one); expect(read(2)!.state).toEqual(second.state);
  api.assertManagerBeliefBoundary(f.db, zero, 'historical'); api.assertManagerBeliefBoundary(f.db, one, 'historical');
});

it('does not fabricate a missing Manager Person or a roster bootstrap', async () => {
  const { f, api } = await fixture(), before = f.snapshot();
  expect(api.readManagerBeliefBoundary(f.db, 'career-a', 'missing-manager', 0)).toBeNull();
  expect(f.snapshot()).toBe(before);
});

it('rejects a future observation boundary even though its roster execution already exists', async () => {
  const { f, read } = await fixture(), before = f.snapshot();
  expect(f.db.prepare('SELECT 1 FROM world_roster_executions WHERE execution_id=?').get('execution-1')).toBeTruthy();
  expect(() => read(1)).toThrow(/revision|unavailable|prefix|observation/i);
  expect(f.snapshot()).toBe(before);
});

it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid historical revision %s without touching owned rows', async revision => {
  const { f, read } = await fixture(), before = f.snapshot();
  expect(() => read(revision)).toThrow(/revision|invalid|boundary/i); expect(f.snapshot()).toBe(before);
});

it('separates historical authentication from current first-write authority', async () => {
  const { f, api, read } = await fixture(), zero = read(0)!;
  f.first(); const before = f.snapshot();
  api.assertManagerBeliefBoundary(f.db, zero, 'historical');
  expect(() => api.assertManagerBeliefBoundary(f.db, zero, 'current')).toThrow(/stale|current|revision/i);
  expect(f.snapshot()).toBe(before);
});

it('rejects a copied boundary with changed agent values rather than trusting its hash alone', async () => {
  const { f, api, read } = await fixture(), boundary = read(0)!, before = f.snapshot();
  const forged = { ...boundary, state: { ...boundary.state, agent: { ...boundary.state.agent,
    skills: { ...boundary.state.agent.skills, operations: boundary.state.agent.skills.operations + 1 } } } };
  expect(() => api.assertManagerBeliefBoundary(f.db, forged, 'historical')).toThrow(/boundary|source|evidence|different|corrupt/i);
  expect(f.snapshot()).toBe(before);
});

it.each(['seed', 'seed_opportunity', 'observation_before', 'execution', 'world_event'] as const)(
  'reauthenticates the original %s underlying an observed Manager prefix', async fault => {
    const { f, api, read } = await fixture(); f.first(); const accepted = read(1)!;
    if (fault === 'seed') f.db.prepare("UPDATE world_manager_person_heads SET seed_json=json_set(seed_json,'$.agent.skills.operations',99) WHERE manager_id=?").run('manager-a');
    if (fault === 'seed_opportunity') f.db.prepare("UPDATE world_roster_opportunities SET issued_json=json_set(issued_json,'$.selectionAgent.state.skills.operations',99) WHERE decision_id=?").run('decision-1');
    if (fault === 'observation_before') f.db.prepare("UPDATE world_manager_belief_observations SET before_json=json_set(before_json,'$.agent.skills.operations',99) WHERE execution_id=?").run('execution-1');
    if (fault === 'execution') f.db.prepare("UPDATE world_roster_executions SET input_json=json_set(input_json,'$.selectionAgent.state.skills.operations',99) WHERE execution_id=?").run('execution-1');
    if (fault === 'world_event') f.db.prepare("UPDATE world_decision_revision_events SET event_json=json_set(event_json,'$.executionId','foreign-execution') WHERE world_revision=1").run();
    const before = f.snapshot();
    expect(() => read(1)).toThrow(/Manager|manager|seed|roster|execution|source|prefix|corrupt|evidence/i);
    expect(() => api.assertManagerBeliefBoundary(f.db, accepted, 'historical')).toThrow(/Manager|manager|seed|roster|execution|source|prefix|corrupt|evidence/i);
    expect(f.snapshot()).toBe(before);
  });

it('rejects a missing earlier observation while leaving revision zero independently readable', async () => {
  const { f, read } = await fixture(), zero = read(0)!; f.first(); f.second();
  f.db.prepare('DELETE FROM world_manager_belief_observations WHERE execution_id=?').run('execution-1');
  expect(read(0)).toEqual(zero);
  expect(() => read(2)).toThrow(/prefix|observation|revision|missing|corrupt/i);
});

it('does not traverse a corrupted later Manager observation when reading an authenticated earlier prefix', async () => {
  const { f, api, read } = await fixture(); f.first(); const one = read(1)!; f.second();
  f.db.prepare("UPDATE world_manager_belief_observations SET result_json=json_set(result_json,'$.state.agent.skills.operations',99) WHERE execution_id=?").run('execution-2');
  expect(read(1)).toEqual(one); api.assertManagerBeliefBoundary(f.db, one, 'historical');
  expect(() => read(2)).toThrow(/prefix|observation|state|result|corrupt|evidence/i);
});

it.each(['seed', 'execution'] as const)('rolls back a real consumer INSERT after its %s source changes on that writer connection', async fault => {
  const { f, api, read } = await fixture(); f.first(); const accepted = read(1)!;
  f.db.exec('CREATE TABLE test_manager_boundary_consumers (source_id TEXT PRIMARY KEY,boundary_hash TEXT NOT NULL)');
  const mutation = fault === 'seed'
    ? "UPDATE world_manager_person_heads SET seed_json=json_set(seed_json,'$.agent.skills.operations',99) WHERE manager_id='manager-a';"
    : "UPDATE world_roster_executions SET input_json=json_set(input_json,'$.selectionAgent.state.skills.operations',99) WHERE execution_id='execution-1';";
  f.db.exec(`CREATE TRIGGER mutate_manager_boundary_source AFTER INSERT ON test_manager_boundary_consumers BEGIN ${mutation} END;`);
  const before = f.snapshot(); let sawInsert = false, sawMutation = false;
  const statement = 'INSERT INTO test_manager_boundary_consumers (source_id,boundary_hash) VALUES(?,?)';
  const witness = witnessSqliteWrite(statement, db => {
    sawInsert = db === f.db && Boolean(db.prepare('SELECT 1 FROM test_manager_boundary_consumers WHERE source_id=?').get('consumer'));
    const row = fault === 'seed'
      ? db.prepare("SELECT json_extract(seed_json,'$.agent.skills.operations') AS value FROM world_manager_person_heads WHERE manager_id='manager-a'").get()
      : db.prepare("SELECT json_extract(input_json,'$.selectionAgent.state.skills.operations') AS value FROM world_roster_executions WHERE execution_id='execution-1'").get();
    sawMutation = row?.value === 99; return sawInsert && sawMutation;
  });
  try {
    expect(() => {
      f.db.exec('BEGIN IMMEDIATE');
      try {
        api.assertManagerBeliefBoundary(f.db, accepted, 'current');
        f.db.prepare(statement).run('consumer', accepted.hash);
        api.assertManagerBeliefBoundary(f.db, accepted, 'current');
        f.db.exec('COMMIT');
      } catch (error) { f.db.exec('ROLLBACK'); throw error; }
    }).toThrow(/Manager|manager|seed|roster|execution|source|boundary|corrupt|evidence/i);
    expect(witness.wasReached()).toBe(true); expect(sawInsert).toBe(true); expect(sawMutation).toBe(true);
  } finally { witness.close(); }
  expect(f.snapshot()).toBe(before);
  expect(f.db.prepare('SELECT count(*) AS n FROM test_manager_boundary_consumers').get()!.n).toBe(0);
  api.assertManagerBeliefBoundary(f.db, accepted, 'current');
});
