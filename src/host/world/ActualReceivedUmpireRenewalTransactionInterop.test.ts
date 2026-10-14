import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { openReceivedTransaction,withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
import { withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('PI01 retires an old private outer owner after nested renewal RELEASE cleanup failure',()=>{
  const directory=mkdtempSync(join(tmpdir(),'renewal-proof-interop-')),tx=openReceivedTransaction(join(directory,'state.sqlite')),exec=DatabaseSync.prototype.exec;let injected=false;
  try{DatabaseSync.prototype.exec=function(this:InstanceType<typeof DatabaseSync>,sql:string){const value=exec.call(this,sql);if(!injected&&sql==='RELEASE received_renewal_read_proof'){injected=true;throw new Error('injected renewal cleanup');}return value;};
    expect(()=>tx.read(()=>withRenewalReadProof(tx.db,()=>42))).toThrow(/cleanup/);expect(injected).toBe(true);DatabaseSync.prototype.exec=exec;
    expect(()=>tx.read(()=>null),'NESTED_RENEWAL_PROOF_FAILURE_OLD_HANDLE_REUSED').toThrow(/retired|closed/);
  }finally{DatabaseSync.prototype.exec=exec;tx.close();rmSync(directory,{recursive:true});}
});
it('PI02 preserves a borrowed query-only ON transaction through nested renewal and old proofs',()=>{
  const db=new DatabaseSync(':memory:');
  try{db.exec('BEGIN; PRAGMA query_only=1');expect(withRenewalReadProof(db,()=>withReceivedReadProof(db,()=>17))).toBe(17);
    expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(db.prepare('SELECT * FROM sqlite_master').all()).toEqual([]);
  }finally{db.exec('PRAGMA query_only=0; ROLLBACK');db.close();}
});
