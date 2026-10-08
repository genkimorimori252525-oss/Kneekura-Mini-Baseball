import { expect,test } from 'vitest';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,mkdtempSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { privatePitchFaultConservation } from './PrivatePitchFaultConservation.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
const pair=()=>{
 const dir=mkdtempSync(join(tmpdir(),'header-conservation-')),source=join(dir,'source.sqlite'),copy=join(dir,'copy.sqlite');
 const db=new DatabaseSync(source);try{db.exec("PRAGMA journal_mode=WAL;CREATE TABLE data(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO data VALUES(1,'intact');PRAGMA user_version=3");}finally{db.close();}
 const before=readFileSync(source);copyFileSync(source,copy,constants.COPYFILE_EXCL);const opener=new DatabaseSync(copy);try{opener.exec('PRAGMA user_version=3');}finally{opener.close();}
 for(const file of [source,copy])for(const suffix of ['-wal','-shm','-journal'])expect(existsSync(file+suffix)).toBe(false);
 expect(readFileSync(source).equals(before)).toBe(true);return {before,after:readFileSync(copy)};
};
test('HC-S02 Native same-value opener counter commit satisfies exact private fault conservation',()=>{
 const {before,after}=pair(),c=privatePitchFaultConservation(before,after);expect(c.allOtherBytesIdentical).toBe(true);expect(c.fileChangeCounter.after).toBe(c.fileChangeCounter.before+1);
});
test('HC-S03 structural counter conservation rejects every other byte and any other counter delta',()=>{
 const {before,after}=pair();
 for(const offset of [0,16,28,40,60,68,96,100,after.length-1]){const bad=Buffer.from(after);bad[offset]^=1;expect(()=>privatePitchFaultConservation(before,bad)).toThrow();}
 for(const delta of [0,2]){const bad=Buffer.from(after);bad.writeUInt32BE(before.readUInt32BE(24)+delta,24);bad.writeUInt32BE(before.readUInt32BE(92)+delta,92);expect(()=>privatePitchFaultConservation(before,bad)).toThrow();}
 const unequal=Buffer.from(after);unequal.writeUInt32BE(before.readUInt32BE(92),92);expect(()=>privatePitchFaultConservation(before,unequal)).toThrow();
 expect(()=>privatePitchFaultConservation(before,after.subarray(1))).toThrow();
});
