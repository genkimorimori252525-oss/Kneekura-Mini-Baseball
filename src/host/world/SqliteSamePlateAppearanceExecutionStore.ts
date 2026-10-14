import { readSamePlateAppearanceEnrollmentBasis } from './SamePlateAppearanceEnrollmentFromSqlite';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { reservedPaSchema,assertReservedPaStorage } from './SamePlateAppearanceExecutionStorage';
import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';
import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';
import { proveSamePaExecution,proveSamePaTotalSet,samePaExecutionReference,samePaExecutionTables,samePaExecutionInput,samePaExecutionRow,type SamePaExecutionKind,type SamePaExecutionResult } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaText,type SamePaEmptyWorkPrefix } from './SamePlateAppearanceWorkPrefix';
import type { SamePaCumulativeTotal, AcceptedSamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import type { SamePaExecutionView,SamePaTotalReference } from './SamePlateAppearanceExecutionView';
import { samePaTotalInput } from './SamePlateAppearanceCumulativeTotal';
import { assertSamePaTotalSetDistinct,samePaTotalSetIds,samePaTotalSetSources,samePaTotalSetReferences,type SamePaTotalSet } from './SamePlateAppearanceTotalSet';
type Authority=Readonly<{readAcceptedPrefix?(sourceId:string):unknown;readAcceptedTotal?(sourceId:string):unknown;readAcceptedView?(sourceId:string):unknown}>;
type Pending=Readonly<{kind:'pending';missingAcceptedSourceIds:readonly string[]}>;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA execution write accounting or frozen dependency differs');};

/** No supplied connection or proof enters this owner. Reads never install
 * storage; each accepted row has independent pre/post-write/committed proofs. */
export const openSqliteSamePlateAppearanceExecutionStore=(path:string,authority?:Authority)=>{
  if(!samePaText(path)||authority&&Object.values(authority).some(v=>typeof v!=='function'))throw new Error('invalid same-PA execution owner');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  let closed=false,failed=false;
  const check=()=>{if(closed||failed)throw new Error('same-PA execution owner closed or retired');};
  const counters=()=>({changes:Number(db.prepare('SELECT total_changes() AS n').get()!.n),main:Number(db.prepare('PRAGMA main.schema_version').get()!.schema_version),
    temp:Number(db.prepare('PRAGMA temp.schema_version').get()!.schema_version),user:Number(db.prepare('PRAGMA main.user_version').get()!.user_version)});
  const setting=()=>Number(db.prepare('PRAGMA query_only').get()!.query_only);
  const retire=(error:unknown,cleanup:unknown[]=[]):never=>{failed=true;try{db.close();closed=true;}catch(e){cleanup.push(e);}
    throw new AggregateError([error,...cleanup],'same-PA execution owner retired after uncertain transaction state; committed effects cannot be rolled back',{cause:error});};
  const run=<T>(write:boolean,body:(proof:<R>(fn:()=>R)=>R,step:(fn:()=>void,rows:number,schemas?:number)=>void)=>T,verify?:(value:T)=>void):T=>{
    check();if(db.isTransaction)return retire(new Error('same-PA execution unowned transaction'));
    const originalSetting=setting(),original=counters(),identity='reserved_pa_'+randomUUID().replaceAll('-','');
    let expected={...original},acquired=false,identityReady=false,committing=false,uncertain=false;
    const account=()=>same(counters(),expected);
    const identityCheck=()=>{if(!db.isTransaction||setting()!==originalSetting)throw new Error('same-PA execution transaction or setting changed');
      try{db.exec('RELEASE '+identity);identityReady=false;db.exec('SAVEPOINT '+identity);identityReady=true;}catch(e){uncertain=true;throw e;}};
    const proof=<R>(fn:()=>R):R=>{identityCheck();account();db.exec('PRAGMA query_only=1');
      try{const value=withBattedWorldPhysicalReadTraversal(db,fn);if(!db.isTransaction||setting()!==1)throw new Error('same-PA execution proof transaction changed');account();return value;}
      finally{db.exec('PRAGMA query_only='+originalSetting);identityCheck();account();}};
    const step=(fn:()=>void,rows:number,schemas=0)=>{identityCheck();account();fn();expected={...expected,changes:expected.changes+rows,main:expected.main+schemas};identityCheck();account();};
    try{
      db.exec(write?'BEGIN IMMEDIATE':'BEGIN');acquired=true;if(!db.isTransaction)throw new Error('same-PA execution acquisition changed');
      db.exec('SAVEPOINT '+identity);identityReady=true;account();proof(()=>assertReservedPaStorage(db));
      const value=body(proof,step);proof(()=>assertReservedPaStorage(db));identityCheck();account();db.exec('RELEASE '+identity);identityReady=false;committing=true;db.exec('COMMIT');
      if(db.isTransaction||setting()!==originalSetting)throw new Error('same-PA execution commit changed');account();
      if(verify){
        // The committed snapshot owns a fresh marker as well. The inner
        // physical traversal releases its marker before returning, so retain
        // this outer identity until the independent proof has fully closed.
        db.exec('BEGIN');db.exec('SAVEPOINT '+identity);identityReady=true;
        proof(()=>verify(value));identityCheck();account();db.exec('RELEASE '+identity);identityReady=false;
        db.exec('COMMIT');if(db.isTransaction||setting()!==originalSetting)throw new Error('same-PA execution durable commit changed');account();}
      return value;
    }catch(error){const cleanup:unknown[]=[];uncertain ||= committing;
      try{if(db.isTransaction){if(identityReady)try{db.exec('ROLLBACK TO '+identity);}catch(e){uncertain=true;cleanup.push(e);}else uncertain=true;db.exec('ROLLBACK');}else if(acquired)uncertain=true;}catch(e){uncertain=true;cleanup.push(e);}
      try{if(setting()!==originalSetting){uncertain=true;db.exec('PRAGMA query_only='+originalSetting);}if(db.isTransaction)throw new Error('same-PA execution rollback retained transaction');}catch(e){uncertain=true;cleanup.push(e);}
      if(uncertain||cleanup.length)return retire(error,cleanup);throw error;
    }
  };
  const read=(kind:SamePaExecutionKind,id:string)=>{check();if(!samePaText(id))throw new Error('invalid same-PA execution Source identity');
    return run(false,proof=>proof(()=>proveSamePaExecution(db,{kind,sourceId:id})));};
  const accept=(kind:SamePaExecutionKind,id:string):SamePaExecutionResult|Pending=>{
    check();if(!samePaText(id))throw new Error('invalid same-PA execution Source identity');
    const reader=kind==='prefix'?authority?.readAcceptedPrefix:kind==='total'?authority?.readAcceptedTotal:authority?.readAcceptedView;
    const raw=reader?.(id)??null,source=raw===null?null:samePaExecutionInput(kind,raw,id),prior=read(kind,id);
    if(prior){if(source)same(source,prior.source);return prior;}
    if(!source)return Object.freeze({kind:'pending',missingAcceptedSourceIds:Object.freeze([id])});
    const preflight=run(false,proof=>proof(()=>proveSamePaExecution(db,{kind,sourceId:id,source})));if(!preflight)throw new Error('same-PA execution derivation missing');
    return run(true,(proof,step)=>{
      const current=proof(()=>proveSamePaExecution(db,{kind,sourceId:id,source}));same(current,preflight);if(!current)throw new Error('same-PA execution derivation missing');
      const table=samePaExecutionTables[kind],row=samePaExecutionRow(current);
      const beforeRows=proof(()=>assertReservedPaStorage(db)?Object.keys(reservedPaSchema).map(t=>db.prepare(`SELECT * FROM main.${t} ORDER BY rowid`).all()):[[],[],[]]);
      if(!assertReservedPaStorage(db)){
        if(kind!=='prefix')throw new Error('same-PA execution prefix storage missing');
        for(const sql of Object.values(reservedPaSchema))step(()=>db.exec(sql),0,1);
        // Bootstrap DDL invalidates every prior assembly; reauthenticate on its
        // completed exact namespace before the first INSERT.
        same(proof(()=>proveSamePaExecution(db,{kind,sourceId:id,source})),current);
      }
      const clauses=kind==='prefix'?['enrollment_source_id','physical_revision']:kind==='total'?['enrollment_source_id','prefix_source_id','player_id']:['enrollment_source_id','prefix_source_id','assessment_set_hash'];
      if(db.prepare(`SELECT source_id FROM main.${table} WHERE ${clauses.map(k=>k+'=?').join(' AND ')}`).get(...clauses.map(k=>row[k])))throw new Error('same-PA canonical owner already exists; Source alias rejected');
      const expectedRows=beforeRows.map(rows=>[...rows]);
      step(()=>db.prepare(`INSERT INTO main.${table} VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row)),1);
      expectedRows[Object.keys(reservedPaSchema).indexOf(table)].push(row);
      const saved=proof(()=>{
        const value=proveSamePaExecution(db,{kind,sourceId:id});same(value,current);
        for(const [i,t] of Object.keys(reservedPaSchema).entries())same(db.prepare(`SELECT * FROM main.${t} ORDER BY rowid`).all(),expectedRows[i]);return value;
      });if(!saved)throw new Error('same-PA execution accepted row missing');return saved;
    },value=>same(proveSamePaExecution(db,{kind,sourceId:id}),value));
  };
  const ownedRows=()=>Object.keys(reservedPaSchema).map(table=>db.prepare(`SELECT * FROM main.${table} ORDER BY rowid`).all());
  const readTotalSet=(references:readonly SamePaTotalReference[]):SamePaTotalSet=>{
    check();const refs=samePaTotalSetReferences(references);
    return run(false,proof=>proof(()=>proveSamePaTotalSet(db,{references:refs}).value));
  };
  const acceptTotalSet=(sourceIds:readonly string[]):SamePaTotalSet|Pending=>{
    check();const ids=samePaTotalSetIds(sourceIds),missing:string[]=[],captured:AcceptedSamePaCumulativeTotal[]=[];
    for(const id of ids){const raw=authority?.readAcceptedTotal?.(id)??null;if(raw===null)missing.push(id);else captured.push(samePaTotalInput(raw,id));}
    // Validate available Sources before returning pending; never synthesize an
    // accepted zero assessment for a missing input.
    assertSamePaTotalSetDistinct(captured);
    if(captured.length&&missing.length)run(false,proof=>proof(()=>{
      const first=captured[0],basis=readSamePlateAppearanceEnrollmentBasis(db,first.enrollmentReference.sourceId);
      if(!basis||basis.enrollment.participants.length!==ids.length)throw new Error('same-PA TOTAL set original participant coverage incomplete');
      same(samePaExecutionReference('same_pa_enrollments',basis.enrollment),first.enrollmentReference);
      for(const source of captured){same(source.enrollmentReference,first.enrollmentReference);if(!basis.enrollment.participants.some(p=>p.binding.playerId===source.participantReference.playerId))throw new Error('same-PA TOTAL set foreign participant');}
    }));
    if(missing.length){
      run(false,proof=>proof(()=>{
        if(!assertReservedPaStorage(db))return;
        assertReservedPaClaims(db);
        const present=ids.filter(id=>actualLivePlayOwnerIdentityRow(db,samePaExecutionTables.total,id)!==null).length;
        if(present!==0&&present!==ids.length)throw new Error('same-PA TOTAL set has mixed existing rows; partial set cannot be repaired');
      }));
      return Object.freeze({kind:'pending',missingAcceptedSourceIds:Object.freeze(missing)});
    }
    const sources=samePaTotalSetSources(captured);
    const preflight=run(false,proof=>proof(()=>({proof:proveSamePaTotalSet(db,{sources}),rows:ownedRows()})));
    if(preflight.proof.presentSourceIds.length===sources.length)return preflight.proof.value;
    return run(true,(proof,step)=>{
      const acquired=proof(()=>({proof:proveSamePaTotalSet(db,{sources}),rows:ownedRows()}));same(acquired,preflight);
      const expectedRows=acquired.rows.map(rows=>[...rows]),present:string[]=[],values=acquired.proof.value;
      const table=samePaExecutionTables.total,index=Object.keys(reservedPaSchema).indexOf(table);
      for(const total of values.totals){
        const row=samePaExecutionRow(total);
        // The acquired proof, then each adjacent post-INSERT proof, is the next
        // write's precondition. step rechecks identity and exact counters before
        // the INSERT; no callback or database effect intervenes.
        step(()=>db.prepare(`INSERT INTO main.${table} VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row)),1);
        present.push(total.source.sourceId);expectedRows[index].push(row);
        proof(()=>{const saved=proveSamePaTotalSet(db,{sources,expectedPresent:present});same(saved.value,values);same(ownedRows(),expectedRows);});
      }
      return values;
    },value=>{const saved=proveSamePaTotalSet(db,{sources,expectedPresent:sources.map(s=>s.sourceId)});same(saved.value,value);
      const expectedRows=preflight.rows.map(rows=>[...rows]);expectedRows[Object.keys(reservedPaSchema).indexOf(samePaExecutionTables.total)].push(...value.totals.map(samePaExecutionRow));same(ownedRows(),expectedRows);});
  };
  return Object.freeze({acceptTotalSet,readTotalSet,readPrefix:(id:string)=>read('prefix',id) as SamePaEmptyWorkPrefix|null,readTotal:(id:string)=>read('total',id) as SamePaCumulativeTotal|null,readView:(id:string)=>read('view',id) as SamePaExecutionView|null,
    acceptPrefix:(id:string)=>accept('prefix',id) as SamePaEmptyWorkPrefix|Pending,acceptTotal:(id:string)=>accept('total',id) as SamePaCumulativeTotal|Pending,
    acceptView:(id:string)=>accept('view',id) as SamePaExecutionView|Pending,close(){if(!closed){db.close();closed=true;}}});
};
