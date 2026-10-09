import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json,actorHash as hash,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as ref,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readHistoricalSamePaLifecycleViewFromSqlite,readCurrentSamePaLifecycleViewFromSqlite,readSamePaLifecycleRecordFromSqlite,
  assertSamePaLifecycleWorkCoverage,assertSamePaLifecycleReservedStateFromSqlite,withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaLifecycleOutcomeFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { assertSamePaTerminalEndpointStorage as storage,samePaTerminalSchema as schema } from './SamePlateAppearanceTerminalStorage';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import type { AcceptedSamePaTerminalEndpoint,SamePaTerminalEndpoint,SamePaTerminalProofMode } from './SamePlateAppearanceTerminalEndpoint';
const table='pa_terminal_v1_endpoints';const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA terminal endpoint original final coverage differs');};
export const samePaTerminalEndpointInput=(raw:unknown,id?:string):AcceptedSamePaTerminalEndpoint=>{
  const s=cloneInert(raw) as AcceptedSamePaTerminalEndpoint;if(!fields(s,['sourceId','sourceVersion','capability','enrollmentReference','finalViewReference','outcomeReference'])
    ||!text(s.sourceId)||!text(s.sourceVersion)||id!==undefined&&s.sourceId!==id||s.capability!=='same_pa_terminal_endpoint_v1'||!ref(s.enrollmentReference,'same_pa_enrollments')
    ||!ref(s.finalViewReference,'pa_lifecycle_v1_execution_views')||!ref(s.outcomeReference,'pa_lifecycle_v1_outcomes'))throw new Error('invalid terminal endpoint Source');return freeze(s);
};
const rowFor=(v:SamePaTerminalEndpoint):Record<string,string|number>=>{const s=v.source,l=v.lineage;return{source_id:s.sourceId,source_version:s.sourceVersion,career_id:l.careerId,game_id:l.gameId,play_id:l.playId,
  enrollment_source_id:l.enrollmentReference.sourceId,actor_source_id:l.actorReference.sourceId,first_pitch_source_id:l.firstPhysicalPitchSourceId,
  final_view_source_id:s.finalViewReference.sourceId,outcome_source_id:s.outcomeReference.sourceId,coverage_hash:v.coverageHash,
  source_json:json(s),source_hash:hash(s),snapshot_json:json(v),snapshot_hash:hash(v)};};
const row=(db:DatabaseSync,id:string)=>{
  const rows=storage(db)?Object.keys(schema).flatMap(t=>db.prepare(`SELECT * FROM main.${t} WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')}
    OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}).map(row=>({table:t,row}))):[];
  if(rows.length>1||rows.length===1&&(rows[0].table!==table||rows[0].row.source_id!==id))throw new Error('terminal endpoint raw identity alias differs');
  if(!rows.length){for(const t of db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND (name GLOB 'pa_settlement_v1_*' OR name GLOB 'pa_terminal_v1_*')").all()){
    const name=String(t.name),columns=db.prepare('PRAGMA main.table_info('+name+')').all().map(r=>r.name);
    for(const c of ['source_json','snapshot_json'].filter(c=>columns.includes(c)))if(db.prepare(`SELECT 1 FROM main.${name},json_tree(CASE WHEN json_valid(${c}) THEN ${c} ELSE 'null' END) obj
      WHERE obj.type='object' AND EXISTS(SELECT 1 FROM json_each(obj.value) o WHERE o.key='owner' AND o.atom=$owner)
      AND EXISTS(SELECT 1 FROM json_each(obj.value) i WHERE i.key='sourceId' AND i.atom=$id) LIMIT 1`).get({owner:table,id}))throw new Error('terminal endpoint missing with surviving settlement/transition claim');
  }}return rows[0]?.row??null;
};
const derive=(db:DatabaseSync,source:AcceptedSamePaTerminalEndpoint,fresh:boolean):SamePaTerminalEndpoint=>{
  const basis=(fresh?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,source.finalViewReference),v=basis.view;
  same(source.enrollmentReference,v.lineage.enrollmentReference);same(source.outcomeReference,v.cut.outcomeReference);
  if(v.cut.stage!=='terminal')throw new Error('terminal endpoint requires a completed original PA outcome');
  const outcome=readSamePaLifecycleOutcomeFromSqlite(db,source.outcomeReference);same(outcome.lineage,v.lineage);same(outcome.timeline,v.cut.timeline);
  if(outcome.disposition!=='terminal'||(!outcome.context&&!outcome.fairCatch)||v.participants.length!==10||new Set(v.participants.map(p=>p.playerId)).size!==10)throw new Error('terminal endpoint outcome/ten coverage incomplete');
  if(outcome.fairCatch){same(outcome.fairCatch.timeline,v.cut.timeline);same(outcome.fairCatch.playEnd,outcome.officialLedger.playEnd);
    same(hash(outcome.fairCatch),outcome.physicalProofHash);if(outcome.source.kind!=='fair_catch'||outcome.context!==null)throw new Error('terminal catch endpoint original owner differs');}
  else if(!['walk','strikeout'].includes(v.cut.timeline.status.kind))throw new Error('terminal endpoint original non-live outcome differs');
  same(outcome.controllerRetirementBasis.physicalPitchReference,v.cut.physicalPitchReference);
  return freeze({kind:'same_pa_terminal_endpoint_v1',source,lineage:v.lineage,enrollmentReference:source.enrollmentReference,finalViewReference:source.finalViewReference,outcomeReference:source.outcomeReference,
    gameDay:basis.actor.binding.gameDay,coverageHash:v.coverageHash,timeline:v.cut.timeline,participants:v.participants,actor:basis.actor,officialLedger:outcome.officialLedger,
    context:outcome.context,physicalCompletedAtTick:outcome.physicalCompletedAtTick,controllerRetirementBasis:outcome.controllerRetirementBasis,baseCenters:outcome.baseCenters,
    ...(outcome.fairCatch?{fairCatch:outcome.fairCatch}:{})});
};
const currentCoverage=(db:DatabaseSync,v:SamePaTerminalEndpoint)=>{
  const basis=readHistoricalSamePaLifecycleViewFromSqlite(db,v.finalViewReference),prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',basis.view.source.prefixReference.sourceId);
  if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('terminal final prefix missing');assertSamePaLifecycleWorkCoverage(db,v.enrollmentReference,prefix.source.anchorViewReference,prefix.source.eventReferences);
};
const read=(db:DatabaseSync,id:string,mode:SamePaTerminalProofMode):SamePaTerminalEndpoint|null=>withSamePaLifecycleReadPhase(db,()=>{
  const r=row(db,id);if(!r)return null;const s=samePaTerminalEndpointInput(JSON.parse(String(r.source_json)),id),v=derive(db,s,false);same(r,rowFor(v));
  // Settlement changes actual heads. Endpoint currentness concerns complete
  // terminal work coverage; its original BEFORE always replays historically.
  if(mode==='current')currentCoverage(db,v);return v;
});
export const readSamePaTerminalEndpointFromSqlite=(db:DatabaseSync,referenceInput:SamePaReference<'pa_terminal_v1_endpoints'>,mode:SamePaTerminalProofMode):SamePaTerminalEndpoint=>{
  const r=cloneInert(referenceInput);if(!ref(r,table)||!['current','historical'].includes(mode))throw new Error('invalid terminal endpoint reference');const v=read(db,r.sourceId,mode);
  if(!v)throw new Error('terminal endpoint missing');same(reference(table,v),r);return v;
};
export const openSqliteSamePlateAppearanceTerminalEndpointStore=(path:string,authority?:Readonly<{readAcceptedEndpoint(id:string):unknown}>)=>{
  if(!text(path)||authority&&typeof authority.readAcceptedEndpoint!=='function')throw new Error('invalid terminal endpoint owner');const{DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path),tx=battingInvocationTransaction(db,()=>storage(db));
  const rows=()=>storage(db)?Object.keys(schema).map(t=>db.prepare('SELECT * FROM main.'+t+' ORDER BY rowid').all()):[[],[]];
  return Object.freeze({read:(id:string)=>tx.run(false,proof=>proof(()=>read(db,id,'historical')),()=>{}),accept:(id:string)=>{
    if(!text(id))throw new Error('invalid terminal endpoint identity');const raw=authority?.readAcceptedEndpoint(id)??null,s=raw===null?null:samePaTerminalEndpointInput(raw,id);
    const prior=tx.run(false,proof=>proof(()=>read(db,id,'historical')),()=>{});if(prior){if(s)same(prior.source,s);return prior;}if(!s)return freeze({kind:'pending' as const,reason:'accepted_terminal_endpoint_missing'});
    const before=tx.run(false,proof=>proof(()=>({value:derive(db,s,true),rows:rows()})),()=>{}),v=before.value,r=rowFor(v),expected=before.rows.map(a=>[...a]);expected[0].push(r);
    const final=()=>{same(read(db,id,'current'),v);same(rows(),expected);assertSamePaLifecycleReservedStateFromSqlite(db,readHistoricalSamePaLifecycleViewFromSqlite(db,s.finalViewReference));};
    return tx.run(true,(proof,step)=>{same(proof(()=>({value:derive(db,s,true),rows:rows()})),before);if(!storage(db)){for(const ddl of Object.values(schema))step(()=>db.exec(ddl),0,1);same(proof(()=>derive(db,s,true)),v);}
      if(db.prepare('SELECT 1 FROM main.'+table+' WHERE enrollment_source_id=?').get(v.enrollmentReference.sourceId))throw new Error('terminal canonical endpoint alias rejected');
      step(()=>{const result=db.prepare('INSERT INTO main.'+table+' VALUES('+Object.keys(r).map(()=>'?').join(',')+')').run(...Object.values(r));if(result.changes!==1)throw new Error('terminal endpoint exact row delta differs');},1);
      proof(final);return v;},value=>{same(value,v);final();});},close:tx.close});
};
