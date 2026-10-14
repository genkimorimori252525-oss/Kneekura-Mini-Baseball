import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach,expect,it,vi } from 'vitest';
import { executionViewFixture,reference } from './SamePlateAppearanceExecutionView.test-support';
import { openSqliteSamePlateAppearanceExecutionStore as open } from './SqliteSamePlateAppearanceExecutionStore';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixtures:ReturnType<typeof executionViewFixture>[]=[],owners:{close():void}[]=[],witnesses:{close():void}[]=[];
afterEach(()=>{witnesses.splice(0).reverse().forEach(w=>w.close());vi.restoreAllMocks();owners.splice(0).reverse().forEach(o=>o.close());fixtures.splice(0).reverse().forEach(f=>f.close());});
const setup=()=>{const f=executionViewFixture();fixtures.push(f);const prefix=f.acceptPrefix(),sources=f.totalSources(prefix);for(const s of sources)f.totals.set(s.sourceId,s);
  expect(f.owner).toHaveProperty('acceptTotalSet');expect(f.owner).toHaveProperty('readTotalSet');return {...f,prefix,sources,ids:sources.map(s=>s.sourceId)};};
const totalCount=(db:DatabaseSync)=>db.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n;
const changeBaseline=(db:DatabaseSync)=>{const row=db.prepare("SELECT source_json FROM world_player_workload_baselines WHERE player_id='away-2'").get()!,source=JSON.parse(String(row.source_json));
  source.sourceVersion='changed-after-proof';db.prepare("UPDATE world_player_workload_baselines SET source_json=? WHERE player_id='away-2'").run(json(source));};
it('BT01 canonical ten TOTALs retain ordinary bytes and use thirteen fresh common proofs (actor mocked)',()=>{
  const f=setup(),before=rawCensus(f.db),schema=schemaCensus(f.db),read=vi.mocked(actorOwner.readPhysicalPlateAppearanceActorFromSqlite);read.mockClear();
  const result=f.owner.acceptTotalSet([...f.ids].reverse());if(result.kind==='pending')throw new Error('unexpected pending');
  expect(read).toHaveBeenCalledTimes(13);expect(result.totals).toHaveLength(10);expect(totalCount(f.db)).toBe(10);
  expect(result.totals.map(t=>t.source.participantReference.playerId)).toEqual([...f.players].sort());
  for(const total of result.totals){expect(total).toEqual({kind:'cumulative_total',source:f.sources.find(s=>s.sourceId===total.source.sourceId),lineage:f.prefix.lineage,coverageHash:f.prefix.coverageHash,effortUnits:0});expect(Object.isFrozen(total)).toBe(true);}
  expect(result.participantTotalReferences).toEqual(result.totals.map(t=>({playerId:t.source.participantReference.playerId,assessmentReference:reference('reserved_pa_total_assessments',t)})));
  expect(Object.isFrozen(result)).toBe(true);expect(schemaCensus(f.db)).toEqual(schema);
  expect(rawCensus(f.db).filter(r=>r.table!=='reserved_pa_total_assessments')).toEqual(before.filter(r=>r.table!=='reserved_pa_total_assessments'));
  const complete=rawCensus(f.db);read.mockClear();expect(f.owner.acceptTotalSet(f.ids)).toEqual(result);expect(read).toHaveBeenCalledTimes(1);expect(rawCensus(f.db)).toEqual(complete);
  f.owner.close();const reopened=open(f.path);owners.push(reopened);read.mockClear();expect(reopened.readTotalSet([...result.participantTotalReferences].reverse())).toEqual(result);expect(read).toHaveBeenCalledTimes(1);expect(rawCensus(f.db)).toEqual(complete);
});
it('BT02 missing accepted inputs stay pending and malformed sets reject before effects',()=>{
  const f=setup(),before=rawCensus(f.db),schema=schemaCensus(f.db);f.totals.delete(f.ids[4]);
  expect(f.owner.acceptTotalSet(f.ids)).toEqual({kind:'pending',missingAcceptedSourceIds:[f.ids[4]]});
  for(const ids of [f.ids.slice(1),[...f.ids.slice(1),f.ids[1]],[...f.ids.slice(1),'']])expect(()=>f.owner.acceptTotalSet(ids)).toThrow();
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it('BT02 malformed participant prefix provenance model and Source aliases reject before effects',()=>{
  const f=setup(),before=rawCensus(f.db),original=f.sources[0];
  const variants=[{...original,participantReference:{...original.participantReference,playerId:'foreign'}},{...original,prefixReference:{...original.prefixReference,sourceId:'foreign'}},
    {...original,provenance:{...original.provenance,assessmentSourceId:f.sources[1].provenance.assessmentSourceId}},{...original,participantReference:{...original.participantReference,revision:99}},
    {...original,sourceId:'alias'},{...original,effortUnits:1},{...original,enrollmentReference:{...original.enrollmentReference,sourceHash:'f'.repeat(64)}}];
  for(const source of variants){f.totals.set(original.sourceId,source);expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow();expect(rawCensus(f.db)).toEqual(before);}
});
it('BT02 mixed existing rows reject without repair and canonical aliases cannot add rows',()=>{
  const f=setup();f.owner.acceptTotal(f.ids[0]);const before=rawCensus(f.db);expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/mixed|partial/);expect(rawCensus(f.db)).toEqual(before);
  const alias={...f.sources[0],sourceId:'alias'};f.totals.set(alias.sourceId,alias);expect(()=>f.owner.acceptTotalSet([alias.sourceId,...f.ids.slice(1)])).toThrow(/alias|canonical|ownership|provenance/);expect(rawCensus(f.db)).toEqual(before);
});
it.each([1,5,10])('BT03 reached INSERT %s fault rolls back the exact total delta',at=>{
  const f=setup(),before=rawCensus(f.db),schema=schemaCensus(f.db);let count=0,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,db=>{if(++count===at){reached=true;changeBaseline(db);}return reached;}));
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/same-PA|differ|prerequisite/);expect(reached).toBe(true);expect(count).toBe(at);expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it.each(['earlier-row','prefix'])('BT03 changed %s between effects cannot hide behind a reused assembly',fault=>{
  const f=setup(),before=rawCensus(f.db);let count=0,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,db=>{if(++count===5){reached=true;db.prepare(fault==='earlier-row'?"UPDATE reserved_pa_total_assessments SET snapshot_hash='corrupt' WHERE source_id=?":"UPDATE reserved_pa_work_prefixes SET snapshot_hash='corrupt' WHERE source_id=?").run(fault==='earlier-row'?f.ids[0]:f.prefix.source.sourceId);}return reached;}));
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/same-PA|differ/);expect(reached).toBe(true);expect(rawCensus(f.db)).toEqual(before);
});
it.each(['commit','replacement'])('BT04 forced %s retires and leaves externally committed partial rows without repair',fault=>{
  const f=setup();let count=0,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,db=>{if(++count===5){reached=true;db.exec('COMMIT');if(fault==='replacement')db.exec('BEGIN IMMEDIATE');}return reached;}));
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(totalCount(f.db)).toBe(5);expect(()=>f.owner.readTotal(f.ids[0])).toThrow(/retired/);
  const reopened=open(f.path,f.authority);owners.push(reopened);expect(()=>reopened.acceptTotalSet(f.ids)).toThrow(/mixed|partial/);expect(totalCount(f.db)).toBe(5);
});
it('BT04 committed peer baseline change is freshly checked and retires without repair',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let wrote=false,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,()=>{wrote=true;return true;}));
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){const value=exec.call(this,sql);if(wrote&&!reached&&sql==='COMMIT'){reached=true;changeBaseline(f.db);}return value;});
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(totalCount(f.db)).toBe(10);expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/retired/);
});
it('BT05 ordinary individual owners and current view retain their exact references after set acceptance',()=>{
  const f=setup(),result=f.owner.acceptTotalSet(f.ids);if(result.kind==='pending')throw new Error('unexpected pending');
  for(const total of result.totals){expect(f.owner.readTotal(total.source.sourceId)).toEqual(total);expect(f.owner.acceptTotal(total.source.sourceId)).toEqual(total);}
  const source={sourceId:'view',sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:f.prefixSource.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',f.prefix),participantTotalReferences:result.participantTotalReferences};
  f.views.set(source.sourceId,source);const view=f.owner.acceptView(source.sourceId);expect(view.kind).toBe('basis_prepared');expect(f.owner.readView(source.sourceId)).toEqual(view);
  const before=rawCensus(f.db);expect(f.owner.readTotalSet(result.participantTotalReferences)).toEqual(result);expect(rawCensus(f.db)).toEqual(before);
  expect(()=>f.owner.readTotalSet(result.participantTotalReferences.slice(1))).toThrow();
});
it('BT02 missing input cannot conceal duplicate accepted assessment provenance',()=>{
  const f=setup(),source=f.sources[0],before=rawCensus(f.db);f.totals.delete(f.ids[9]);
  f.totals.set(source.sourceId,{...source,provenance:{...source.provenance,assessmentSourceId:f.sources[1].provenance.assessmentSourceId}});
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/duplicate|provenance/);expect(rawCensus(f.db)).toEqual(before);
});
it.each(['namespace','model'])('BT02 changed %s rejects all ten before writing',fault=>{
  const f=setup();if(fault==='namespace')f.db.exec('CREATE INDEX unexpected_total_index ON reserved_pa_total_assessments(player_id)');else changeBaseline(f.db);
  const before=rawCensus(f.db),schema=schemaCensus(f.db);expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/same-PA|malformed|differ|prerequisite/);expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it('BT03 each post INSERT proof reauthenticates the actor after a reached dependency fault (actor mocked)',()=>{
  const f=setup(),before=rawCensus(f.db),read=vi.mocked(actorOwner.readPhysicalPlateAppearanceActorFromSqlite);let count=0,reached=false;read.mockClear();
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,()=>{if(++count===5){reached=true;Object.assign(f.actor.world,{tick:f.actor.world.tick+1});}return reached;}));
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/original actor reference differs/);expect(reached).toBe(true);expect(count).toBe(5);expect(read).toHaveBeenCalledTimes(7);expect(rawCensus(f.db)).toEqual(before);
});
it('BT04 transaction replacement inside the committed proof retires despite unchanged durable rows',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec,read=vi.mocked(actorOwner.readPhysicalPlateAppearanceActorFromSqlite),original=read.getMockImplementation()!;
  let wrote=false,committed=false,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,()=>{wrote=true;return true;}));
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){const value=exec.call(this,sql);if(wrote&&sql==='COMMIT')committed=true;return value;});
  read.mockImplementation((db,id)=>{if(committed&&!reached){reached=true;(db as DatabaseSync).exec('COMMIT');(db as DatabaseSync).exec('BEGIN');}return original(db,id);});
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(totalCount(f.db)).toBe(10);expect(()=>f.owner.readTotal(f.ids[0])).toThrow(/retired/);
});
it('BT04 durable traversal release cannot conceal transaction replacement',()=>{
  const f=setup(),exec=NativeDatabase.prototype.exec;let wrote=false,committed=false,reached=false;
  witnesses.push(witnessSqliteWrite(/^INSERT INTO main\.reserved_pa_total_assessments /,()=>{wrote=true;return true;}));
  vi.spyOn(NativeDatabase.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){const value=exec.call(this,sql);
    if(wrote&&sql==='COMMIT')committed=true;
    if(committed&&!reached&&sql.startsWith('RELEASE physical_field_read_')){reached=true;exec.call(this,'COMMIT');exec.call(this,'BEGIN');}return value;});
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/retired.*uncertain/);expect(reached).toBe(true);expect(totalCount(f.db)).toBe(10);expect(()=>f.owner.readTotal(f.ids[0])).toThrow(/retired/);
});
it.each(['namespace','mixed'])('BT02 missing input cannot conceal %s storage',fault=>{
  const f=setup();if(fault==='namespace')f.db.exec('CREATE INDEX unexpected_total_index ON reserved_pa_total_assessments(player_id)');else f.owner.acceptTotal(f.ids[0]);
  f.totals.delete(f.ids[9]);const before=rawCensus(f.db),schema=schemaCensus(f.db);
  expect(()=>f.owner.acceptTotalSet(f.ids)).toThrow(/malformed|mixed|partial/);expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
