import type {DatabaseSync} from 'node:sqlite';
import {receivedHandoffSchema,receivedHandoffTable} from './ActualReceivedUmpireHandoffSchema';
import {receivedHandoffHeader} from './ActualReceivedUmpireHandoffHeader';
import {isStagedReceivedHandoffPhysical} from './SqliteActualReceivedUmpireHandoffStore';
type Row=Readonly<{source_id:string;source_json:string;revision:number}>;
/** Later ordinary physical Sources require a literal admitted transfer. The
 * metadata check never evaluates their future physical or communication bodies. */
export const assertReceivedHandoffPhysicalMetadata=(db:Pick<DatabaseSync,'prepare'>,row:Row,prefix:readonly Row[])=>{
  const kind=(s:string)=>{const r=db.prepare("SELECT CASE WHEN json_valid(?) THEN json_extract(?,'$.action.kind') END AS kind").get(s,s);return r?.kind;};
  const received=(k:unknown)=>k==='received_renewal_adoption_v1'||k==='received_renewal_continuation_v1';
  if(received(kind(row.source_json))||!prefix.slice(0,-1).some(p=>received(kind(p.source_json))))return;
  if(isStagedReceivedHandoffPhysical(db as DatabaseSync,row))return;
  const rows=receivedHandoffSchema(db)==='installed'?db.prepare(`SELECT renewal_enrollment_source_id FROM ${receivedHandoffTable} WHERE execution_source_id=?`).all(row.source_id):[];
  if(rows.length!==1)throw new Error('received later physical successor lacks explicit handoff');
  const h=receivedHandoffHeader(db,String(rows[0].renewal_enrollment_source_id));
  if(!h||h.value.physical.sourceId!==row.source_id||h.value.physical.revision!==row.revision)throw new Error('received later physical handoff rank differs');
};
