import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
/** Lifecycle only for a concrete physical store's private Native connection.
 * It grants no evidence/readiness and never borrows an unexplained transaction. */
export const physicalStoreTransactionBoundary = (db:DatabaseSync,label:string) => {
  let closed=false,failed=false,owned=false;
  const retire=(primary:unknown,cleanup:unknown[]=[]):never=>{
    failed=true;owned=false;
    try{db.close();closed=true;}catch(error){cleanup.push(error);}
    throw new AggregateError([primary,...cleanup],label+' owner retired after uncertain transaction cleanup',{cause:primary});
  };
  const check=()=>{
    if(closed||failed)throw new Error(label+' owner is closed or retired');
    if(db.isTransaction&&!owned)retire(new Error(label+' unowned private transaction'));
    if(owned&&!db.isTransaction)retire(new Error(label+' owned private transaction disappeared'));
  };
  const queryOnly=()=>{const value=db.prepare('PRAGMA query_only').get()!.query_only;
    if(value!==0&&value!==1)throw new Error(label+' query_only state differs');return value;};
  const run=<T>(write:boolean,body:()=>T):T=>{
    check();
    if(owned)throw new Error(label+' nested write transaction');
    const setting=queryOnly(),identity='physical_store_'+randomUUID().replaceAll('-','');
    let phase:'acquiring'|'active'|'committing'='acquiring',beginReturned=false,identityReady=false;
    try{
      // BEGIN can throw after actually acquiring. Keep acquisition inside the
      // cleanup bracket; no later call may borrow the resulting transaction.
      db.exec(write?'BEGIN IMMEDIATE':'BEGIN');beginReturned=true;
      if(!db.isTransaction)throw new Error(label+' transaction acquisition did not retain ownership');
      owned=true;phase='active';db.exec('SAVEPOINT '+identity);identityReady=true;
      const value=write?body():withBattedWorldPhysicalReadTraversal(db,body);
      if(!db.isTransaction||queryOnly()!==setting)throw new Error(label+' transaction or setting changed before commit');
      db.exec('RELEASE '+identity);identityReady=false;
      if(!db.isTransaction)throw new Error(label+' owned commit transaction disappeared');
      phase='committing';db.exec('COMMIT');
      if(db.isTransaction||queryOnly()!==setting)throw new Error(label+' commit retained an uncertain transaction or setting');
      owned=false;return value;
    }catch(primary){
      if(failed||closed){owned=false;throw primary;}
      const cleanup:unknown[]=[];
      // A thrown acquired BEGIN, a disappeared active transaction or a failed
      // COMMIT cannot establish a reusable owned state, even if cleanup works.
      let uncertain=phase==='committing';
      try{
        const active=db.isTransaction;
        if(phase==='acquiring'&&(active||beginReturned)||phase==='active'&&(!active||!identityReady))uncertain=true;
        if(active){
          if(identityReady)try{db.exec('ROLLBACK TO '+identity);}catch(error){uncertain=true;cleanup.push(error);}
          db.exec('ROLLBACK');
        }
        if(db.isTransaction){uncertain=true;cleanup.push(new Error(label+' rollback left a live transaction'));}
      }catch(error){uncertain=true;cleanup.push(error);}
      try{if(queryOnly()!==setting){uncertain=true;db.exec('PRAGMA query_only='+setting);}
        if(queryOnly()!==setting)throw new Error(label+' cleanup setting was not restored');
      }catch(error){uncertain=true;cleanup.push(error);}
      owned=false;
      if(uncertain||cleanup.length)return retire(primary,cleanup);
      throw primary;
    }
  };
  return {
    check,
    read<T>(body:()=>T):T{check();return owned?body():run(false,body);},
    write<T>(body:()=>T):T{return run(true,body);},
    close(){if(!closed){failed=true;owned=false;db.close();closed=true;}},
  };
};
