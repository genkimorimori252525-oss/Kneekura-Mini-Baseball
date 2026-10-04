import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
const {DatabaseSync,backup}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
/** The source must already be closed. The probe owns and closes every connection
 * to its fresh copy before returning. This isolates a day-level recovery fixture;
 * neither the copy nor its accepted duration proves elapsed physical World time. */
export const withActualRoleWorkloadRecoveryCopy=async(path:string,probe:(copy:string)=>void|Promise<void>)=>{
  const copy=`${path}.recovery.sqlite`;
  assert.equal(existsSync(copy),false,'recovery regression requires a fresh backup');
  const sourceSha256=fileHash(path),source=new DatabaseSync(path,{readOnly:true});
  try{await backup(source,copy);}finally{source.close();}
  try{await probe(copy);}finally{assert.equal(fileHash(path),sourceSha256,'recovery probe changed playable artifact');}
  return {path:copy,sourceSha256,sha256:fileHash(copy),sourceUnchanged:true as const,
    scope:'isolated_day_level_recovery_regression' as const,elapsedWorldTimeProven:false as const};
};
