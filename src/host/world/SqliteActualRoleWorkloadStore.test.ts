import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('requires authenticated actual closure, persists no invented assessment or baseline and reopens the same WAL disk',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'actual-role-')),'state.sqlite');
  const store=openSqliteActualRoleWorkloadStore(path,{readLink:()=>null}); const db=new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')!.file).toBe(path);
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(()=>store.readSettlement('missing')).toThrow(/actual role workload closure missing/);
    expect(()=>store.acceptAssessment('missing')).toThrow(/accepted actual role workload assessment missing/);
    expect(()=>store.acceptAssessments(['same','same'])).toThrow(/unique nonempty/);
    expect(()=>store.initializeBaseline('missing')).toThrow(/baseline/);
    expect(db.prepare('SELECT * FROM actual_role_workload_assessments').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM actual_role_workload_settlements').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM world_player_workload_activities').all()).toEqual([]);
  }finally{store.close();db.close();}
  const reopened=openSqliteActualRoleWorkloadStore(path,{readLink:()=>null});
  try{expect(()=>reopened.settle('missing')).toThrow(/actual role workload closure missing/);}finally{reopened.close();}
});
