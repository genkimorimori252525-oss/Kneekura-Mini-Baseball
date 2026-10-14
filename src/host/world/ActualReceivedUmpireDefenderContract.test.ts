import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const load = async () => {
  for (const path of ['./ActualReceivedUmpireDefender.ts', './ActualReceivedUmpireDefenderSchema.ts']) {
    expect(existsSync(new URL(path, import.meta.url)), 'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBe(true);
  }
  return { ...await import('./ActualReceivedUmpireDefender'), ...await import('./ActualReceivedUmpireDefenderSchema') };
};
const enrollment = () => ({ sourceId: 'enroll-a', sourceVersion: 'v1', capability: 'received_umpire_defender_enrollment_v1',
  runtimeSourceId: 'runtime-a', physicalPitchSourceId: 'pitch-a', playerId: 'player-a', observationSourceId: 'observation-a',
  currentExecutionSourceId: 'execution-a', predecessorDecisionSourceId: 'decision-a', predecessorMotorSourceId: 'motor-a', predecessorAdoptionSourceId: 'adoption-a' });
const availability = () => ({ sourceId: 'availability-a', sourceVersion: 'v1', capability: 'received_umpire_defender_policy_availability_v1',
  provenance: 'accepted_at_current_actual_observation_v1', enrollmentSourceId: 'enroll-a', policyDataSourceId: 'policy-a',
  physicalPitchSourceId: 'pitch-a', playerId: 'player-a', observationSourceId: 'observation-a', currentExecutionSourceId: 'execution-a' });
const replan = () => { const { runtimeSourceId: _runtime, ...refs } = enrollment();
  return { ...refs, sourceId: 'replan-a', capability: 'received_umpire_defender_replan_v2', enrollmentSourceId: 'enroll-a', policySourceId: null, previousReplanSourceId: null }; };
const schema = (db: InstanceType<typeof DatabaseSync>) => db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();

it('accepts only detached exact reference Sources for enrollment availability and process v2', async () => {
  const m = await load();
  for (const [validate, source] of [[m.receivedEnrollmentInput, enrollment()], [m.receivedAvailabilityInput, availability()], [m.receivedReplanInput, replan()]] as const) {
    const accepted = validate(source as never, source.sourceId);
    expect(accepted).toEqual(source); expect(accepted).not.toBe(source); expect(Object.isFrozen(accepted)).toBe(true);
    for (const extra of ['at', 'sequence', 'hash', 'input', 'replan', 'membership', 'selectedAt']) {
      expect(() => validate({ ...source, [extra]: 1 } as never, source.sourceId)).toThrow(/Source/i);
    }
    for (const key of Object.keys(source)) {
      const without = Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
      expect(() => validate(without as never, source.sourceId)).toThrow();
      if (typeof Reflect.get(source, key) === 'string') expect(() => validate({ ...source, [key]: ' ' } as never, source.sourceId)).toThrow();
    }
    expect(() => validate(source as never, 'another-id')).toThrow(/Source/i);
  }
});

it('rejects executable inherited symbolic and hidden Source properties without invoking accessors', async () => {
  const m = await load(); let invoked = false;
  const getter = { ...enrollment() }; Object.defineProperty(getter, 'playerId', { enumerable: true, get() { invoked = true; return 'player-a'; } });
  const hidden = { ...enrollment() }; Object.defineProperty(hidden, 'extra', { value: 1 });
  const symbolic = { ...enrollment(), [Symbol('extra')]: 1 };
  for (const bad of [getter, hidden, symbolic, Object.create(enrollment())]) expect(() => m.receivedEnrollmentInput(bad)).toThrow();
  expect(invoked).toBe(false);
});

it('preserves the distinct v1 wire while v2 only admits explicit nullable dependency references', async () => {
  const m = await load();
  expect(m.receivedReplanInput(replan() as never).policySourceId).toBeNull();
  expect(m.receivedReplanInput({ ...replan(), policySourceId: 'available-a', previousReplanSourceId: 'first-a' } as never).previousReplanSourceId).toBe('first-a');
  expect(() => m.receivedReplanInput({ ...replan(), capability: 'received_umpire_defender_replan_v1' } as never)).toThrow();
  expect(() => m.receivedReplanInput({ ...replan(), policySourceId: '' } as never)).toThrow();
});

it('keeps pristine schema reads inert and installs exactly five tables only inside an owned transaction', async () => {
  const m = await load(), db = new DatabaseSync(':memory:');
  try {
    expect(m.receivedOwnerSchema(db)).toBe('pristine'); expect(schema(db)).toEqual([]);
    expect(() => m.installReceivedOwnerSchema(db)).toThrow(/transaction/i); expect(schema(db)).toEqual([]);
    db.exec('BEGIN IMMEDIATE'); m.installReceivedOwnerSchema(db);
    expect(m.receivedOwnerSchema(db)).toBe('installed');
    expect(schema(db).filter(r => r.type === 'table').map(r => r.name).sort()).toEqual(Object.keys(m.receivedOwnerSchemas).sort());
    expect(schema(db).every(r => r.type === 'table' || r.type === 'index' && r.sql === null)).toBe(true);
    db.exec('ROLLBACK'); expect(m.receivedOwnerSchema(db)).toBe('pristine'); expect(schema(db)).toEqual([]);
  } finally { db.close(); }
});

it('rejects partial weakened trigger view and unknown namespace schemas without repairing them', async () => {
  const m = await load(), db = new DatabaseSync(':memory:');
  try {
    for (const kind of ['partial', 'column', 'trigger', 'view', 'unknown']) {
      db.exec('BEGIN');
      if (kind === 'partial') db.exec(Object.values(m.receivedOwnerSchemas)[0]);
      else if (kind === 'view') db.exec('CREATE VIEW actual_received_umpire_defender_enrollments AS SELECT 1 AS source_id');
      else {
        m.installReceivedOwnerSchema(db);
        if (kind === 'column') db.exec('ALTER TABLE actual_received_umpire_defender_enrollments ADD COLUMN extra TEXT');
        if (kind === 'trigger') db.exec('CREATE TRIGGER extra AFTER INSERT ON actual_received_umpire_defender_enrollments BEGIN SELECT 1; END');
        if (kind === 'unknown') db.exec('CREATE TABLE actual_received_umpire_defender_future(value TEXT)');
      }
      const before = schema(db);
      expect(() => m.receivedOwnerSchema(db)).toThrow(/schema/i);
      expect(() => m.installReceivedOwnerSchema(db)).toThrow(/schema/i);
      expect(schema(db)).toEqual(before); db.exec('ROLLBACK');
    }
  } finally { db.close(); }
});

it('rejects non-main and temporary authority shadowing during schema inspection', async () => {
  const m = await load(), db = new DatabaseSync(':memory:');
  try {
    db.exec("ATTACH ':memory:' AS other"); expect(() => m.receivedOwnerSchema(db)).toThrow(/main-only/i); db.exec('DETACH other');
    db.exec('CREATE TEMP TABLE anything(value TEXT)'); expect(() => m.receivedOwnerSchema(db)).toThrow(/main-only/i);
  } finally { db.close(); }
});

it('independently rejects weakened PK or UNIQUE index metadata despite unchanged declared table SQL',async()=>{
  const m=await load(),db=new DatabaseSync(':memory:');
  try{
    db.exec('BEGIN');m.installReceivedOwnerSchema(db);db.exec('COMMIT');const prepare=db.prepare.bind(db);
    let intercepted=false;
    db.prepare=((sql:string)=>{const statement=prepare(sql);if(/index_list/.test(sql)){
      const all=statement.all.bind(statement);statement.all=((...args:Parameters<typeof statement.all>)=>{intercepted=true;return all(...args).map(row=>({...row,unique:0}));}) as unknown as typeof statement.all;
    }return statement;}) as typeof db.prepare;
    expect(()=>m.receivedOwnerSchema(db),'OWNER_INDEX_CONSTRAINTS_NOT_AUTHENTICATED').toThrow(/schema|index|constraint/);
    db.prepare=prepare;expect(intercepted).toBe(true);
  }finally{db.close();}
});
