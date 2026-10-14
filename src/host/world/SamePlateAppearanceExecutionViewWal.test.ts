import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach,expect,it,vi } from 'vitest';
import { executionViewFixture } from './SamePlateAppearanceExecutionView.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixtures:ReturnType<typeof executionViewFixture>[]=[],witnesses:{close():void}[]=[];
afterEach(()=>{witnesses.splice(0).reverse().forEach(w=>w.close());vi.restoreAllMocks();fixtures.splice(0).reverse().forEach(f=>f.close());});
const setup=()=>{const f=executionViewFixture();fixtures.push(f);return f;};
const changeBaseline=(db:DatabaseSync)=>{const row=db.prepare("SELECT source_json FROM world_player_workload_baselines WHERE player_id='away-2'").get()!,source=JSON.parse(String(row.source_json));
  source.sourceVersion='changed-after-proof';db.prepare("UPDATE world_player_workload_baselines SET source_json=? WHERE player_id='away-2'").run(json(source));};
it('EV06 WAL baseline change after preflight is observed by the acquired prefix proof',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let reached=false;
  const patch=vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){if(!reached&&sql==='BEGIN IMMEDIATE'){reached=true;changeBaseline(f.db);}return exec.call(this,sql);});
  expect(()=>f.acceptPrefix()).toThrow(/prerequisites|differ/);expect(reached).toBe(true);patch.mockRestore();
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'reserved_pa_*'").all()).toEqual([]);
});
it.each(['prefix','total','view'] as const)('EV06 reached %s INSERT dependency mutation rolls back its exact owned delta',kind=>{
  const f=setup();let call:()=>unknown,table:string;
  if(kind==='prefix'){call=()=>f.acceptPrefix();table='reserved_pa_work_prefixes';}
  else if(kind==='total'){const p=f.acceptPrefix(),s=f.totalSources(p)[0];f.totals.set(s.sourceId,s);call=()=>f.owner.acceptTotal(s.sourceId);table='reserved_pa_total_assessments';}
  else{const p=f.prepare();call=()=>f.owner.acceptView(p.viewSource.sourceId);table='reserved_pa_execution_views';}
  const rows=rawCensus(f.db),schema=schemaCensus(f.db);let reached=false;
  const witness=witnessSqliteWrite(new RegExp('^INSERT INTO main\\.'+table+' '),db=>{reached=true;changeBaseline(db);return true;});witnesses.push(witness);
  expect(call).toThrow(/differ|same-PA/);expect(reached).toBe(true);expect(rawCensus(f.db)).toEqual(rows);expect(schemaCensus(f.db)).toEqual(schema);
});
it('EV06 real forced COMMIT retires the prefix owner and reports committed uncertainty without repair',()=>{
  const f=setup();let reached=false;const witness=witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_work_prefixes /,db=>{reached=true;db.exec('COMMIT');return true;});witnesses.push(witness);
  expect(()=>f.acceptPrefix()).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(()=>f.owner.readPrefix(f.prefixSource.sourceId)).toThrow(/retired/);
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_work_prefixes').get()!.n).toBe(1);
});
it('EV06 post-COMMIT deletion retires the owner without compensating repair',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let wrote=false,reached=false;
  const witness=witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_work_prefixes /,()=>{wrote=true;return true;});witnesses.push(witness);
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){const value=exec.call(this,sql);if(wrote&&!reached&&sql==='COMMIT'){reached=true;this.prepare('DELETE FROM reserved_pa_work_prefixes').run();}return value;});
  expect(()=>f.acceptPrefix()).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(()=>f.owner.readPrefix(f.prefixSource.sourceId)).toThrow(/retired/);
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_work_prefixes').get()!.n).toBe(0);
});
it('EV10 committed peer baseline change requires a fresh durable proof and retires without repair',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let wrote=false,reached=false;
  const witness=witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_work_prefixes /,()=>{wrote=true;return true;});witnesses.push(witness);
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){const value=exec.call(this,sql);
    if(wrote&&!reached&&sql==='COMMIT'){reached=true;changeBaseline(f.db);}return value;});
  expect(()=>f.acceptPrefix()).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(()=>f.owner.readPrefix(f.prefixSource.sourceId)).toThrow(/retired/);
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_work_prefixes').get()!.n).toBe(1);
});
