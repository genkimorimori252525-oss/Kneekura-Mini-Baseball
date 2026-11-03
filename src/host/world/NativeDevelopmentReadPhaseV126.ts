import {createRequire} from 'node:module';
import type {DatabaseSync} from 'node:sqlite';
import {withSamePaContinuationReadPhase} from './SamePlateAppearanceContinuationFromSqlite';
import {withBattedVenueLegalReadSnapshot} from './SqliteBattedVenueLegalPolicyStore';

/** Internal synchronous proof section inside an already-owned transaction.
 * No owner/provider result is memoized here. Writes before/after this section
 * receive separate phases; the existing Native phase owns stamp/poison/lease. */
export function withNativeDevelopmentReadPhaseV126<T>(db:DatabaseSync,body:()=>T):T{
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 if(!(db instanceof Native)||!db.isTransaction)throw Error('development proof phase requires an active Native transaction');
 const setting=db.prepare('PRAGMA query_only').get()!.query_only;
 if(setting!==0&&setting!==1)throw Error('development proof query-only setting differs');
 if(setting===0)db.exec('PRAGMA query_only=1');
 try{return withSamePaContinuationReadPhase(db,()=>withBattedVenueLegalReadSnapshot(db,body));}
 finally{db.exec('PRAGMA query_only='+setting);}
}
