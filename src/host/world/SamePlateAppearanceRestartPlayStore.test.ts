import { afterEach,expect,it,vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restartFixture } from './SamePlateAppearanceRestartPlay.test-support';
import { samePaRestartPlayTable as table } from './SamePlateAppearanceRestartPlaySource';
import { openSqliteSamePlateAppearanceRestartPlayStore } from './SqliteSamePlateAppearanceRestartPlayStore';
import * as proof from './SamePlateAppearanceRestartPlayProof';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(f=>f());vi.restoreAllMocks();});
/** Actual native owner transactions, with the separately exercised physical
 * derivation isolated so these tests stay independent of long historical runs. */
const fixture=()=>{
  const f=restartFixture(),value=f.derive(),directory=mkdtempSync(join(tmpdir(),'restart-play-')),path=join(directory,'test.sqlite'),db=new DatabaseSync(path),owners:{close():void}[]=[];
  cleanups.push(()=>{owners.forEach(s=>s.close());db.close();rmSync(directory,{recursive:true,force:true});});
  let launched=false;
  vi.spyOn(proof,'deriveSamePaRestartPlayFromSqlite').mockImplementation((_db,s,raw,current)=>{if(current&&launched)throw new Error('restart cut is no longer current');expect(s).toEqual(f.source);expect(raw).toEqual(f.originals);return value;});
  const accepted=new Map<string,unknown>([[f.source.sourceId,f.source],...[f.originals.venue,f.originals.assignment,f.originals.person].map(v=>[v.sourceId,v] as [string,unknown])]);
  const authority={readAcceptedPlay:(id:string)=>accepted.get(id),readAcceptedVenue:(id:string)=>accepted.get(id),readAcceptedAssignment:(id:string)=>accepted.get(id),readAcceptedOfficialPerson:(id:string)=>accepted.get(id)};
  const open=(originals=true)=>{const owner=openSqliteSamePlateAppearanceRestartPlayStore(path,originals?authority:undefined);owners.push(owner);return owner;};
  return{...f,value,db,accepted,open,launch:()=>{launched=true;}};
};
it('reopens saved Play without callbacks but never inserts a Play after the actual launch',()=>{
  const f=fixture(),owner=f.open();expect(owner.accept('restart')).toEqual(f.value);f.launch();f.accepted.clear();expect(f.open(false).accept('restart')).toEqual(f.value);
  f.db.exec('DELETE FROM '+table);f.accepted.set('restart',f.source);for(const v of Object.values(f.originals))f.accepted.set(v.sourceId,v);
  expect(()=>owner.accept('restart')).toThrow('no longer current');expect(f.db.prepare('SELECT * FROM '+table).all()).toEqual([]);
});
it('missing explicit accepted custody/Play or official inputs remains pending with no namespace',()=>{
  const f=fixture(),owner=f.open();f.accepted.delete('restart');expect(owner.accept('restart').kind).toBe('pending');f.accepted.set('restart',f.source);f.accepted.delete('person-u');
  expect(owner.accept('restart').kind).toBe('pending');expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'pa_restart_play_v1_*'").all()).toEqual([]);
});
it('rejects changed originals and source aliases without rewriting immutable evidence',()=>{
  const f=fixture(),owner=f.open();owner.accept('restart');const row=f.db.prepare('SELECT * FROM '+table).get();
  f.accepted.set('venue',{...f.originals.venue,sourceVersion:'changed'});expect(()=>owner.accept('restart')).toThrow();expect(f.db.prepare('SELECT * FROM '+table).get()).toEqual(row);
  f.db.prepare('UPDATE '+table+' SET source_id=?').run('alias');expect(()=>owner.read('restart')).toThrow(/alias/);
});
it('rolls back fresh namespace and row when insertion fails',()=>{
  const f=fixture(),owner=f.open(),prototype=DatabaseSync.prototype,original=prototype.prepare;
  vi.spyOn(prototype,'prepare').mockImplementation(function(this:InstanceType<typeof DatabaseSync>,sql:string){if(sql.startsWith('INSERT INTO main.'+table))throw new Error('injected restart insert failure');return original.call(this,sql);});
  expect(()=>owner.accept('restart')).toThrow('injected restart insert failure');expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'pa_restart_play_v1_*'").all()).toEqual([]);
});
