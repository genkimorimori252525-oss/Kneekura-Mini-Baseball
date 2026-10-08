import { createRequire } from 'node:module';
import { expect,it } from 'vitest';
import { assertFoulTerminalApplicationStorage,foulTerminalApplicationTableSql,foulTerminalAcknowledgementTableSql,
  foulTerminalApplicationEvidenceFromSqlite }
  from './ActualFoulTerminalApplicationEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const withSchema = (sql:string,body:(db:InstanceType<typeof DatabaseSync>) => void) => {
  const db = new DatabaseSync(':memory:');
  try { db.exec(sql); body(db); } finally { db.close(); }
};
// Storage admission only. No successful receipt or original physical evidence
// is inserted or inferred by these synthetic layout tests.
it('A-SM01 rejects changed quoted acknowledgement status whitespace',() => withSchema(
  foulTerminalAcknowledgementTableSql.replace("status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY'",
    "status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_ PLAY'"),db => {
    expect(() => assertFoulTerminalApplicationStorage(db,'acknowledgement'),'ACK_SCHEMA_LITERAL_BYTES_MISSING').toThrow(/schema|constraint/);
  }));
it('A-SM02 rejects changed quoted legacy queue status whitespace',() => withSchema(
  foulTerminalApplicationTableSql.replace("status='QUEUED'","status='QUE UED'"),db => {
    expect(() => assertFoulTerminalApplicationStorage(db),'LEGACY_SCHEMA_LITERAL_BYTES_MISSING').toThrow(/schema|constraint/);
  }));
it('A-SM03 admits only the exact acknowledged capable CHECK',() => withSchema(foulTerminalAcknowledgementTableSql,db => {
  expect(assertFoulTerminalApplicationStorage(db,'acknowledgement')).toBe(true);
}));
it('A-SM04 admits exact legacy CHECK while refusing acknowledgement capability',() => withSchema(foulTerminalApplicationTableSql,db => {
  expect(assertFoulTerminalApplicationStorage(db)).toBe(true);
  expect(() => assertFoulTerminalApplicationStorage(db,'acknowledgement')).toThrow(/prerequisite|schema/);
}));
it('A-SM05 rejects an arbitrary extra CHECK status arm',() => withSchema(
  foulTerminalAcknowledgementTableSql.replace("status='QUEUED'","status IN ('QUEUED','UNREQUESTED')"),db => {
    expect(() => assertFoulTerminalApplicationStorage(db,'acknowledgement')).toThrow(/schema|constraint/);
  }));
it('A-SM06 permits formatting whitespace outside quoted literals',() => withSchema(
  foulTerminalAcknowledgementTableSql.replace('status TEXT NOT NULL','\n status \n TEXT NOT NULL '),db => {
    expect(assertFoulTerminalApplicationStorage(db,'acknowledgement')).toBe(true);
  }));

it.each([
  ['QUEUED','{}'],['OFFICIAL_APPLIED_PENDING_POST_PLAY',null],['OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY',null],
] as const)('A-SM07 refuses impossible %s result nullability before original evidence parsing',(status,result) =>
  withSchema(foulTerminalAcknowledgementTableSql,db => {
    db.exec('PRAGMA ignore_check_constraints=ON');
    db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'malformed-stage','game',7,'application','pitch','end','obligation',status,'{}','bad','{}','bad',result);
    db.exec('PRAGMA ignore_check_constraints=OFF');
    const before = db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(() => foulTerminalApplicationEvidenceFromSqlite(db).read('malformed-stage')).toThrow('foul terminal queue archive stage is unsupported');
    expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before);
  }));
it('A-SM08 refuses an acknowledged row under legacy CHECK before original evidence parsing',() =>
  withSchema(foulTerminalApplicationTableSql,db => {
    db.exec('PRAGMA ignore_check_constraints=ON');
    db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'malformed-stage','game',7,'application','pitch','end','obligation',
      'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','{}','bad','{}','bad','{}');
    db.exec('PRAGMA ignore_check_constraints=OFF');
    const before = db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(() => foulTerminalApplicationEvidenceFromSqlite(db).read('malformed-stage'))
      .toThrow('foul terminal acknowledgement storage prerequisite requires its exact CHECK schema');
    expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before);
  }));
