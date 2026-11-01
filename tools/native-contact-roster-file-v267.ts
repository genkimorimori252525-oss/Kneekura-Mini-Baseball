import * as fs from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import type {NativeContactRosterExportV264} from './native-contact-roster-export-v264';
import {parseContactRosterV266,serializeContactRosterV266} from './native-contact-roster-json-v266';
const digest=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
/** Local file output only. Never opens a database, and never overwrites a destination. */
export function writeContactRosterFileV267(payload:NativeContactRosterExportV264,outputPath:string):Readonly<{version:'native-contact-roster-file-v267';sha256:string;bytes:number;provenance:'NOT_AUTHENTICATED_BY_JSON'}>{
 if(typeof outputPath!=='string'||!outputPath.trim())throw Error('invalid contact output path');
 const text=serializeContactRosterV266(payload),bytes=Buffer.from(text,'utf8'),hash=digest(bytes);
 if(!isDeepStrictEqual(parseContactRosterV266(text).payload,payload))throw Error('contact output differs before write');
 const target=resolve(outputPath),dir=fs.mkdtempSync(join(dirname(target),'.contact-roster-v267-')),temp=join(dir,'record.tmp');
 let fd:number|undefined,ownedTemp=false,failed=false,primary:unknown;const cleanup:unknown[]=[];
 try{
  fd=fs.openSync(temp,'wx',0o600);ownedTemp=true;let offset=0;
  while(offset<bytes.length){const count=fs.writeSync(fd,bytes,offset,bytes.length-offset);if(count<=0)throw Error('contact output short write');offset+=count}
  fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  const staged=fs.readFileSync(temp);if(digest(staged)!==hash||!isDeepStrictEqual(parseContactRosterV266(staged.toString('utf8')).payload,payload))throw Error('staged contact output differs');
  fs.linkSync(temp,target); // Exclusive creation, not rename-overwrite.
  const published=fs.readFileSync(target);if(digest(published)!==hash||!isDeepStrictEqual(parseContactRosterV266(published.toString('utf8')).payload,payload))throw Error('published contact output differs');
 }catch(error){failed=true;primary=error}
 if(fd!==undefined)try{fs.closeSync(fd)}catch(error){cleanup.push(error)}
 if(ownedTemp)try{fs.unlinkSync(temp)}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')cleanup.push(error)}
 try{fs.rmdirSync(dir)}catch(error){cleanup.push(error)}
 if(failed&&cleanup.length)throw new AggregateError([primary,...cleanup],'contact output and cleanup failed');
 if(failed)throw primary;
 if(cleanup.length)throw new AggregateError(cleanup,'contact output cleanup failed');
 return {version:'native-contact-roster-file-v267',sha256:hash,bytes:bytes.length,provenance:'NOT_AUTHENTICATED_BY_JSON'};
}
