import type {DatabaseSync} from 'node:sqlite';
import {isDeepStrictEqual} from 'node:util';
import {readNativeContactRosterExportV264FromSqlite} from './native-contact-roster-export-v264';
import {parseContactRosterV266,serializeContactRosterV266} from './native-contact-roster-json-v266';

/** A borrowed, idle connection is read through V264; no output destination is handled here. */
export function readNativeContactRosterBytesV272(db:DatabaseSync,input:Readonly<{careerId:string;rosterSnapshotId:string}>) {
 if(db.isTransaction!==false)throw Error('contact export requires no active transaction');
 const payload=readNativeContactRosterExportV264FromSqlite(db,input);
 if(db.isTransaction!==false)throw Error('contact export read did not close its transaction');
 const text=serializeContactRosterV266(payload),bytes=new TextEncoder().encode(text),decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes),parsed=parseContactRosterV266(decoded);
 if(decoded!==text||!isDeepStrictEqual(parsed.payload,payload))throw Error('contact export bytes differ');
 return {bytes,provenance:'NOT_AUTHENTICATED_BY_JSON' as const};
}
