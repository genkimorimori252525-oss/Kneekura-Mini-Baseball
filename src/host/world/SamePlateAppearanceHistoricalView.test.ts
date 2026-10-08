import { afterEach,expect,it,vi } from 'vitest';
import { executionViewFixture,reference } from './SamePlateAppearanceExecutionView.test-support';
import { openSqliteSamePlateAppearanceHistoricalViewReader as open } from './SqliteSamePlateAppearanceHistoricalViewReader';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as physicalOwner from './PhysicalPitchEvidenceFromSqlite';
const fixtures:ReturnType<typeof executionViewFixture>[]=[],readers:{close():void}[]=[];
afterEach(()=>{vi.restoreAllMocks();readers.splice(0).reverse().forEach(r=>r.close());fixtures.splice(0).reverse().forEach(f=>f.close());});
const setup=()=>{const f=executionViewFixture();fixtures.push(f);const p=f.prepare(),view=f.owner.acceptView(p.viewSource.sourceId);if(view.kind!=='basis_prepared')throw new Error('fixture view missing');
  const reader=open(f.path);readers.push(reader);return {...f,p,view,reader,viewReference:reference('reserved_pa_execution_views',view)};};
const futurePitch=(f:ReturnType<typeof setup>)=>f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?,?,?,?)').run(f.source.firstPhysicalPitchSourceId,'game',1,1,
  json({sourceId:f.source.firstPhysicalPitchSourceId,gameId:'game'}),'f'.repeat(64),json('opaque future physical payload'),'f'.repeat(64));
it('HI01 historical view replays after a first-pitch claim without current-frame or future-physical reads (actor mocked)',()=>{
  const f=setup();futurePitch(f);expect(()=>f.owner.readView(f.p.viewSource.sourceId)).toThrow(/before|work|pitch/);
  vi.mocked(actorOwner.assertPhysicalActorOpenFrame).mockImplementation(()=>{throw new Error('fresh frame must not be read');});
  const future=vi.spyOn(physicalOwner,'readPhysicalPitchProgressFromSqlite').mockImplementation(()=>{throw new Error('future physical payload must stay opaque');});
  const before=rawCensus(f.db),schema=schemaCensus(f.db);const result=f.reader.read(f.viewReference);
  expect(result.kind).toBe('historical_same_pa_execution_view_v1');expect(result.view).toEqual(f.view);expect(result.reference).toEqual(f.viewReference);
  expect(future).not.toHaveBeenCalled();expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it('HI02 bounded actual revisions ignore opaque future workload payload and current heads',()=>{
  const f=setup();f.db.prepare('INSERT INTO world_player_workload_activities VALUES(?,?,?,?,?,?,?,?)').run('future-opaque','career-a','away-2',99,100,json('opaque future activity'),json('opaque future BEFORE'),json('opaque future AFTER'));
  f.db.prepare("UPDATE world_player_workload_heads SET revision=100,state_json=? WHERE player_id='away-2'").run(json('opaque current head'));
  expect(()=>f.owner.readView(f.p.viewSource.sourceId)).toThrow();expect(f.reader.read(f.viewReference).view).toEqual(f.view);
});
it('HI03 changed required past activity is rejected instead of trusting the reserved AFTER cache',()=>{
  const f=setup(),row=f.db.prepare("SELECT source_id,source_json FROM world_player_workload_activities WHERE player_id='home-1'").get()!,source=JSON.parse(String(row.source_json));source.effortUnits=999;
  f.db.prepare('UPDATE world_player_workload_activities SET source_json=? WHERE source_id=?').run(json(source),row.source_id);
  expect(()=>f.reader.read(f.viewReference)).toThrow(/historical|AFTER|state|differ/);
});
it('HI04 missing required TOTAL and foreign view hashes reject without schema repair',()=>{
  const f=setup(),schema=schemaCensus(f.db);expect(()=>f.reader.read({...f.viewReference,snapshotHash:'f'.repeat(64)})).toThrow();
  f.db.prepare('DELETE FROM reserved_pa_total_assessments WHERE source_id=?').run(f.p.sources[0].sourceId);expect(()=>f.reader.read(f.viewReference)).toThrow();expect(schemaCensus(f.db)).toEqual(schema);
});
it('HI05 authority-free normal reopen retains immutable view bytes and writes nothing',()=>{
  const f=setup(),before=rawCensus(f.db),schema=schemaCensus(f.db);expect(f.reader.read(f.viewReference).view).toEqual(f.view);f.reader.close();
  const reopened=open(f.path);readers.push(reopened);expect(reopened.read(f.viewReference).view).toEqual(f.view);expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it('HI06 moved indexed view identity cannot hide its surviving original raw identity',()=>{
  const f=setup();f.db.prepare('UPDATE reserved_pa_execution_views SET source_id=? WHERE source_id=?').run('moved',f.p.viewSource.sourceId);
  expect(()=>f.reader.read(f.viewReference)).toThrow(/identity|ownership|differ/);
});
it('HI08 surviving raw past activity and Source aliases cannot hide behind future indexes',()=>{
  const f=setup(),row=f.db.prepare("SELECT * FROM world_player_workload_activities WHERE player_id='home-1'").get()!;
  const insert=f.db.prepare('INSERT INTO world_player_workload_activities VALUES(?,?,?,?,?,?,?,?)');
  // All three retain an original past claim, even when another mirror moves.
  for(const variant of ['raw-source-alias','raw-past-cut','typed-past-scope']){
    const source=JSON.parse(String(row.source_json));if(variant!=='raw-source-alias')source.sourceEventId='future-index-alias';
    insert.run('future-index-alias',variant==='typed-past-scope'?'foreign':row.career_id,variant==='typed-past-scope'?'foreign':row.player_id,99,100,json(source),row.before_json,row.after_json);
    expect(()=>f.reader.read(f.viewReference)).toThrow(/historical|ownership|cut|alias|differs/);
    f.db.prepare("DELETE FROM world_player_workload_activities WHERE source_id='future-index-alias'").run();
  }
});
