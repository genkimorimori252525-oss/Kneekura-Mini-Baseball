import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withActualRoleWorkloadRecoveryCopy } from './ActualRoleWorkloadRecoveryArtifact.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture=()=>{
  const path=join(mkdtempSync(join(tmpdir(),'recovery-isolation-')),'playable.sqlite'),db=new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE effects(kind TEXT); INSERT INTO effects VALUES('MATCH');");db.close();return path;
};
it('isolates the recovery probe on a fresh real SQLite backup and qualifies it as no elapsed-world-time evidence',async()=>{
  const path=fixture();
  const result=await withActualRoleWorkloadRecoveryCopy(path,copy=>{
    expect(copy).not.toBe(path);const db=new DatabaseSync(copy);
    try{db.exec("INSERT INTO effects VALUES('RECOVERY')");}finally{db.close();}
    const reopened=new DatabaseSync(copy);try{expect(reopened.prepare('SELECT kind FROM effects').all()).toEqual([{kind:'MATCH'},{kind:'RECOVERY'}]);}finally{reopened.close();}
  });
  expect(result).toMatchObject({path:`${path}.recovery.sqlite`,sourceUnchanged:true,elapsedWorldTimeProven:false,scope:'isolated_day_level_recovery_regression'});
  const main=new DatabaseSync(path);try{expect(main.prepare('SELECT kind FROM effects').all()).toEqual([{kind:'MATCH'}]);}finally{main.close();}
});
it('refuses to overwrite a preexisting recovery copy',async()=>{
  const path=fixture();await withActualRoleWorkloadRecoveryCopy(path,()=>{});
  await expect(withActualRoleWorkloadRecoveryCopy(path,()=>{throw new Error('must not enter');})).rejects.toThrow(/fresh/);
});
it('does not turn a failed recovery probe into a successful report',async()=>{
  const path=fixture();await expect(withActualRoleWorkloadRecoveryCopy(path,()=>{throw new Error('probe failed');})).rejects.toThrow('probe failed');
  const main=new DatabaseSync(path);try{expect(main.prepare('SELECT kind FROM effects').all()).toEqual([{kind:'MATCH'}]);}finally{main.close();}
});
