import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { fileHash, rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
// Native mechanics only. This manufactures no terminal or gameplay evidence.
const exercise=(readOnly:boolean)=>{
 const directory=mkdtempSync(join(tmpdir(),'private-native-readback-')),donor=join(directory,'donor.sqlite'),copy=join(directory,'copy.sqlite');
 const writer=new DatabaseSync(donor);try{writer.exec("PRAGMA journal_mode=WAL;CREATE TABLE proof(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO proof VALUES(1,'original')");}finally{writer.close();}
 for(const suffix of ['-wal','-shm','-journal'])expect(existsSync(donor+suffix)).toBe(false);
 const hash=fileHash(donor);copyFileSync(donor,copy,constants.COPYFILE_EXCL);
 const db=readOnly?new DatabaseSync(copy,{readOnly:true}):new DatabaseSync(copy);
 try{const rows=rawCensus(db),schema=schemaCensus(db),changes=db.prepare('SELECT total_changes() AS n').get()!.n;
  withSqliteReadTransaction(db,()=>{
   expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(db.isTransaction).toBe(true);
   expect(db.prepare('SELECT value FROM proof WHERE id=1').get()!.value).toBe('original');
   expect(()=>db.exec("INSERT INTO proof VALUES(2,'forbidden')")).toThrow(/readonly/i);
   expect(rawCensus(db)).toEqual(rows);expect(schemaCensus(db)).toEqual(schema);expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
  });
  expect(db.isTransaction).toBe(false);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(rawCensus(db)).toEqual(rows);expect(schemaCensus(db)).toEqual(schema);
 }finally{db.close();}
 expect(fileHash(copy)).toBe(hash);expect(fileHash(donor)).toBe(hash);
 for(const suffix of ['-wal','-shm'])expect(existsSync(copy+suffix)).toBe(readOnly);
 for(const suffix of ['-wal','-shm','-journal'])expect(existsSync(donor+suffix)).toBe(false);
 expect(existsSync(copy+'-journal')).toBe(false);
};
test('NR-S01 real Native readOnly WAL copy retains sidecars after an unchanged read and close',()=>exercise(true));
test('NR-S02 normal Native private copy with query-only snapshot closes sidecar-free with identical bytes',()=>exercise(false));
