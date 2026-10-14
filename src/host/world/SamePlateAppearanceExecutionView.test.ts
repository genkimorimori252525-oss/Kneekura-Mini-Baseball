import { afterEach,expect,it,vi } from 'vitest';
import { executionViewFixture } from './SamePlateAppearanceExecutionView.test-support';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { openSqliteSamePlateAppearanceExecutionStore as open } from './SqliteSamePlateAppearanceExecutionStore';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const fixtures:ReturnType<typeof executionViewFixture>[]=[];
const owners:{close():void}[]=[];
afterEach(()=>{owners.splice(0).reverse().forEach(o=>o.close());fixtures.splice(0).reverse().forEach(f=>f.close());vi.restoreAllMocks();});
const setup=()=>{const f=executionViewFixture();fixtures.push(f);return f;};
it('EV01 ten explicit zero TOTALs preserve distinct actual fatigue and project revisions without global writes (actor mocked)',()=>{
  const f=setup(),before=rawCensus(f.db),{prefix,viewSource}=f.prepare(),view=f.owner.acceptView(viewSource.sourceId);
  if(view.kind!=='basis_prepared')throw new Error('fixture view pending');
  expect(prefix.kind).toBe('empty_prefix');expect(prefix.physicalRevision).toBe(0);expect(prefix.timeline.events).toEqual([]);
  expect(view.kind).toBe('basis_prepared');expect(view.participants).toHaveLength(10);
  for(const p of view.participants){const original=f.enrollment.participants.find(x=>x.binding.playerId===p.playerId)!;
    expect(p.reservedState).toEqual(original.state);expect(p.projectedState).toEqual({...original.state,effectiveDay:2,revision:original.state.revision+1});
    expect(p.activity).toMatchObject({kind:'MATCH',effortUnits:0,atDay:2,evidenceId:prefix.source.sourceId});}
  expect(rawCensus(f.db).filter(r=>!String(r.table).startsWith('reserved_pa_'))).toEqual(before);
  expect(f.db.prepare('SELECT state,predecessor_resume_source_id,consuming_source_id FROM same_pa_successor_rights').get()).toEqual({state:'blocked_execution_basis',predecessor_resume_source_id:null,consuming_source_id:null});
});
it('EV02 unsupplied accepted Sources remain pending without schema while dangling non-null references reject',()=>{
  const f=setup(),before=schemaCensus(f.db);expect(f.owner.acceptPrefix('missing')).toEqual({kind:'pending',missingAcceptedSourceIds:['missing']});expect(schemaCensus(f.db)).toEqual(before);
  f.prefixes.set('foreign',{...f.prefixSource,sourceId:'foreign',enrollmentReference:{...f.prefixSource.enrollmentReference,sourceId:'absent'}});
  expect(()=>f.owner.acceptPrefix('foreign')).toThrow(/missing|original|reference/);expect(schemaCensus(f.db)).toEqual(before);
});
it('EV02 omitted or foreign assessments cannot synthesize a partial view or zero effort',()=>{
  const f=setup(),p=f.prepare();const missing={...p.viewSource,sourceId:'incomplete',participantTotalReferences:p.viewSource.participantTotalReferences.slice(1)};
  f.views.set(missing.sourceId,missing);expect(()=>f.owner.acceptView(missing.sourceId)).toThrow();
  const swapped=structuredClone(p.sources[0]);swapped.sourceId='swapped';swapped.participantReference.playerId='foreign';f.totals.set(swapped.sourceId,swapped);expect(()=>f.owner.acceptTotal(swapped.sourceId)).toThrow();
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_execution_views').get()!.n).toBe(0);
});
it('EV03 a nonzero empty-prefix assessment rejects even with otherwise exact provenance',()=>{
  const f=setup(),prefix=f.acceptPrefix(),source={...f.totalSources(prefix)[0],effortUnits:1};f.totals.set(source.sourceId,source);
  expect(()=>f.owner.acceptTotal(source.sourceId)).toThrow(/empty|zero|TOTAL/);expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n).toBe(0);
});
it('EV05 exact prefix TOTAL and view retries survive normal authority-free reopen with no row or schema changes',()=>{
  const f=setup(),p=f.prepare(),view=f.owner.acceptView(p.viewSource.sourceId),before=rawCensus(f.db),schema=schemaCensus(f.db);
  expect(f.owner.acceptPrefix(f.prefixSource.sourceId)).toEqual(p.prefix);expect(f.owner.acceptTotal(p.sources[0].sourceId)).toEqual(p.assessments[0]);expect(f.owner.acceptView(p.viewSource.sourceId)).toEqual(view);
  f.owner.close();const o=open(f.path);owners.push(o);expect(o.readPrefix(f.prefixSource.sourceId)).toEqual(p.prefix);expect(o.readTotal(p.sources[0].sourceId)).toEqual(p.assessments[0]);expect(o.readView(p.viewSource.sourceId)).toEqual(view);
  expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
});
it('EV09 alternate prefix and view Source IDs and reordered ten-reference aliases reject',()=>{
  const f=setup(),p=f.prepare();f.owner.acceptView(p.viewSource.sourceId);const before=rawCensus(f.db);
  f.prefixes.set('prefix-alias',{...f.prefixSource,sourceId:'prefix-alias'});expect(()=>f.owner.acceptPrefix('prefix-alias')).toThrow(/canonical|alias|already/);
  f.views.set('view-alias',{...p.viewSource,sourceId:'view-alias',participantTotalReferences:[...p.viewSource.participantTotalReferences].reverse()});expect(()=>f.owner.acceptView('view-alias')).toThrow(/canonical|alias|already/);
  expect(rawCensus(f.db)).toEqual(before);
});
it('EV05 changed accepted TOTAL provenance invalidates a retry and a corrupt assessment invalidates a view',()=>{
  const f=setup(),p=f.prepare(),s=p.sources[0];f.totals.set(s.sourceId,{...s,provenance:{...s.provenance,assessmentVersion:'changed'}});
  expect(()=>f.owner.acceptTotal(s.sourceId)).toThrow(/frozen|differ/);
  f.db.prepare("UPDATE reserved_pa_total_assessments SET snapshot_hash=? WHERE source_id=?").run('f'.repeat(64),s.sourceId);
  expect(()=>f.owner.acceptView(p.viewSource.sourceId)).toThrow();
});
it.each(['indexed','raw'] as const)('EV03 surviving %s physical work cannot qualify empty coverage after reservation',fault=>{
  const f=setup(),source={sourceId:'prior-pitch',gameId:f.actor.source.gameId},snapshot={source,frame:{gameId:f.actor.source.gameId,match:{playId:f.actor.match.playId}}};
  f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?,?,?,?)').run(source.sourceId,fault==='raw'?'moved':source.gameId,fault==='raw'?99:f.actor.match.playId,1,json(source),hash(source),json(snapshot),hash(snapshot));
  expect(()=>f.acceptPrefix()).toThrow(/before|work|pitch|prerequisites/);
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'reserved_pa_*'").all()).toEqual([]);
});
it('EV10 one common actor authentication validates all ten TOTALs per proof and is rebuilt for independent effects and reads',()=>{
  const f=setup(),p=f.prepare(),read=vi.mocked(actorOwner.readPhysicalPlateAppearanceActorFromSqlite);read.mockClear();
  const value=f.owner.acceptView(p.viewSource.sourceId);expect(value.kind).toBe('basis_prepared');expect(read).toHaveBeenCalledTimes(4);
  read.mockClear();expect(f.owner.readView(p.viewSource.sourceId)).toEqual(value);expect(read).toHaveBeenCalledTimes(1);
  read.mockClear();expect(f.owner.readView(p.viewSource.sourceId)).toEqual(value);expect(read).toHaveBeenCalledTimes(1);
});
it.each(['array','object'] as const)('EV03 typed %s history preserves original work after every indexed and Source scope moves',shape=>{
  const f=setup(),source={sourceId:'moved-history',physicalPitchSourceId:'other-pitch'},original={physicalPitchSourceId:f.source.firstPhysicalPitchSourceId};
  f.db.exec('CREATE TABLE actual_field_observations(source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
  f.db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?)').run(source.sourceId,'other-pitch',json(source),json({source,history:shape==='array'?[original]:original}));
  expect(()=>f.acceptPrefix()).toThrow(/before|physical|claim|work/);
});
it('EV02 one assessment provenance identity cannot be reassigned to a different original participant',()=>{
  const f=setup(),prefix=f.acceptPrefix(),sources=f.totalSources(prefix);f.totals.set(sources[0].sourceId,sources[0]);f.owner.acceptTotal(sources[0].sourceId);
  const reused={...sources[1],provenance:{...sources[1].provenance,assessmentSourceId:sources[0].provenance.assessmentSourceId}};
  f.totals.set(reused.sourceId,reused);expect(()=>f.owner.acceptTotal(reused.sourceId)).toThrow(/assessment|provenance|ownership/);
});
it('EV02 prior-PA archived assessment provenance cannot be recycled as a new empty TOTAL',()=>{
  const f=setup(),prefix=f.acceptPrefix(),source=f.totalSources(prefix)[0],prior={sourceId:'prior-assessment',provenance:source.provenance,participantReference:{playerId:source.participantReference.playerId}};
  const snapshot={source:prior,careerId:'career-a',gameId:'earlier-game',playId:7,playerId:source.participantReference.playerId};
  f.db.exec('CREATE TABLE actual_role_workload_assessments(source_id TEXT PRIMARY KEY,closure_source_id TEXT,career_id TEXT,game_id TEXT,play_id INTEGER,player_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT)');
  f.db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?,?,?,?,?,?,?,?)').run(prior.sourceId,'earlier-closure','career-a','earlier-game',7,source.participantReference.playerId,json(prior),hash(prior),json(snapshot),hash(snapshot));
  f.totals.set(source.sourceId,source);expect(()=>f.owner.acceptTotal(source.sourceId)).toThrow(/assessment|provenance|ownership/);
});
it('EV02 a delimiter-combined provenance key is not four explicit assessment fields',()=>{
  const f=setup(),prefix=f.acceptPrefix(),source=f.totalSources(prefix)[0];
  f.totals.set(source.sourceId,{...source,provenance:{'assessmentSourceId|assessmentVersion|calibrationSourceId|calibrationVersion':'fixture-v1'}});
  expect(()=>f.owner.acceptTotal(source.sourceId)).toThrow(/invalid|provenance|fields/);
});
