import { createRequire } from 'node:module';
import { physicalStoreTransactionBoundary } from './PhysicalStoreTransactionBoundary';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
/** Normal Native open of an exclusive private file; query-only owned reads do
 * not create/repair schemas and expose no connection, authority or proof cache. */
export const openSqliteSamePlateAppearanceHistoricalViewReader=(path:string)=>{
  if(!samePaText(path))throw new Error('invalid historical same-PA path');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  db.exec('PRAGMA query_only=1');const boundary=physicalStoreTransactionBoundary(db,'historical same-PA');
  const meter=()=>json({changes:db.prepare('SELECT total_changes() AS n').get()!.n,main:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,user:db.prepare('PRAGMA main.user_version').get()!.user_version,query:db.prepare('PRAGMA query_only').get()!.query_only});
  return Object.freeze({read(reference:unknown){boundary.check();const before=meter();
    try{const value=boundary.read(()=>{const value=readHistoricalSamePaExecutionView(db,reference);if(meter()!==before)throw new Error('historical same-PA proof changed rows/schema/settings');return value;});
      if(db.isTransaction||meter()!==before)throw new Error('historical same-PA committed read changed state');return value;
    }catch(error){if(db.isOpen&&(db.isTransaction||meter()!==before)){boundary.close();throw new AggregateError([error],'historical same-PA retired after uncertain read effects',{cause:error});}throw error;}
  },close(){boundary.close();}});
};
