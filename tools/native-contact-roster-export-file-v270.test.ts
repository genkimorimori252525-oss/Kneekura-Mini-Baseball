import {createRequire} from 'node:module';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {afterEach,expect,expectTypeOf,it,vi} from 'vitest';
import * as reader from './native-contact-roster-export-v264';
import * as writer from './native-contact-roster-file-v267';
import {exportNativeContactRosterFileV270 as exportFile} from './native-contact-roster-export-file-v270';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fail='native contact roster file V270 is unavailable; use V272 bytes API';
afterEach(()=>vi.restoreAllMocks());
it('rejects normal-looking inputs without reading DB, creating a target, or altering transaction',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v270-disabled-')),path=join(dir,'db.sqlite'),target=join(dir,'output.json'),db=new DatabaseSync(path);
 try{db.exec("CREATE TABLE example(x); BEGIN; INSERT INTO example VALUES ('pending'); PRAGMA query_only=1");const before=db.prepare('SELECT total_changes() n').get(),hash=createHash('sha256').update(readFileSync(path)).digest('hex'),r=vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite'),w=vi.spyOn(writer,'writeContactRosterFileV267');
 expect(()=>exportFile(db,{careerId:'career',rosterSnapshotId:'roster'},target)).toThrow(fail);expect(r).not.toHaveBeenCalled();expect(w).not.toHaveBeenCalled();expect(existsSync(target)).toBe(false);expect(db.isTransaction).toBe(true);expect(db.prepare('SELECT x FROM example').get()!.x).toBe('pending');expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(hash);db.exec('ROLLBACK; PRAGMA query_only=0');expect(db.prepare('SELECT 1 n').get()!.n).toBe(1)
 }finally{db.close()}
});
it('rejects invalid or hostile arguments without inspecting them or calling downstream',()=>{
 const r=vi.spyOn(reader,'readNativeContactRosterExportV264FromSqlite'),w=vi.spyOn(writer,'writeContactRosterFileV267'),poison=new Proxy({}, {get(){throw Error('inspected')},ownKeys(){throw Error('inspected')}});
 expect(()=>exportFile(poison as never,poison as never,poison as never)).toThrow(fail);expect(()=>exportFile(null as never,null as never,'' )).toThrow(fail);expect(r).not.toHaveBeenCalled();expect(w).not.toHaveBeenCalled();
});

it('preserves the original consumer return type',()=>{expectTypeOf<ReturnType<typeof exportFile>>().toEqualTypeOf<Readonly<{version:'native-contact-roster-export-file-v270';file:Readonly<{version:'native-contact-roster-file-v267';sha256:string;bytes:number;provenance:'NOT_AUTHENTICATED_BY_JSON'}>}>>();});
