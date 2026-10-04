// Metadata path matrix uses real SQLite and an already-validated physical graph stub.
// It makes no full Native physics or generator-completeness claim.
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ queue: null as any }));
vi.mock('./ActualLivePlayQueueEvidenceFromSqlite', () => ({ actualLivePlayQueueEvidenceFromSqlite: () => ({ derive: () => state.queue }) }));
import { actualLivePlayQueueConsumersFromSqlite } from './ActualLivePlayQueueConsumersFromSqlite';

function fixture() {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE actual_live_rule_consumptions(source_id TEXT PRIMARY KEY,ownership_key TEXT UNIQUE,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_field_executions(source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT,base_field_source_id TEXT,revision INTEGER);
    INSERT INTO batted_world_field_executions VALUES('future-rule','pitch','base',3);`);
  const source = { sourceId: 'ack', sourceVersion: 'v1', capability: 'actual_first_base_rule_consumption_v1', captureExecutionSourceId: 'capture', ruleExecutionSourceId: 'future-rule' };
  const successorKey = 'successor';
  const ownershipKey = json(['actual_first_base_rule_consumption_v1','pitch',successorKey]);
  const receiptId=json(['actual_live_rule_consumption_receipt_v1',ownershipKey,source.sourceId]);
  const capture={owner:'batted_world_field_executions',sourceId:'capture',snapshotHash:'capture-hash'};
  const rule={owner:'batted_world_field_executions',sourceId:'future-rule',snapshotHash:'future-hash'};
  const value = { source, history: [source], revision: 1, physicalPitchSourceId: 'pitch', scopeId: 'scope', ownershipKey,
    consumption: { kind:'first_base_rule_consumption',status:'consumed',receiptId,eventKey:'capture-event',successorKey,capture,rule },
    successor: {kind:'first_base_rule_result',status:'pending',pendingReason:'next_rule_consumer_unowned',basisReceiptId:receiptId,
      successorKey:json(['actual_live_rule_result_successor_v1',receiptId]),rule,result:{future:'opaque'}} };
  db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(source.sourceId,ownershipKey,json(source),hash(source),json(value),hash(value));
  state.queue = {scope:{scope:{physicalPitchSourceId:'pitch',scopeId:'scope',cut:{kind:'field_execution',baseFieldSourceId:'base',executionSourceId:'capture'},physicalReferences:[],at:{originTick:1,elapsedSeconds:1,tick:2}}},successors:[{kind:'rule_evidence',successorKey,basisEventKey:'capture-event',owner:capture}],consumptions:[]};
  return {db, source, value, ownershipKey};
}

import { actualLiveImmutableReceiptEvidenceFromSqlite } from './ActualLiveImmutableReceiptStore';
const aliasRoutes = ['source','snapshotSource','historyArray','historyObject'] as const;
it.each(aliasRoutes)('rejects foreign-capture hidden Source identity through %s', route => {
  const {db,source,value} = fixture(); try {
    const foreign={...source,sourceId:'foreign-ack',captureExecutionSourceId:'foreign-capture'};
    let foreignSource:any=foreign;
    const snapshot:any={...value,source:foreign,history:[foreign],ownershipKey:'foreign-key',consumption:{capture:{sourceId:'foreign-capture'}}};
    if(route==='source') foreignSource={...foreign,sourceId:source.sourceId};
    if(route==='snapshotSource') snapshot.source={...foreign,sourceId:source.sourceId};
    if(route==='historyArray') snapshot.history=[{...foreign,sourceId:source.sourceId}];
    if(route==='historyObject') snapshot.history={...foreign,sourceId:source.sourceId};
    db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(foreign.sourceId,'foreign-key',json(foreignSource),hash(foreignSource),json(snapshot),hash(snapshot));
    const owner={input:(s:typeof source)=>s,derive:()=>value,ownershipField:'captureExecutionSourceId' as const};
    const evidence=actualLiveImmutableReceiptEvidenceFromSqlite(db,'actual_live_rule_consumptions',owner);
    expect(() => evidence.readMetadata(source.sourceId)).toThrow(/ownership|metadata|identity/);
    expect(() => evidence.read(source.sourceId)).toThrow(/ownership|metadata|identity/);
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity/);
  } finally {db.close();}
});
const captureRoutes=[...aliasRoutes,'consumptionCapture','snapshotKey','indexKey'] as const;
it.each(captureRoutes)('reconciles writer and consumer hidden capture ownership through %s', route=>{
  const {db,source,value,ownershipKey}=fixture();try {
    db.exec('DELETE FROM actual_live_rule_consumptions');
    const foreign={...source,sourceId:'foreign-ack',captureExecutionSourceId:'foreign-capture'};
    let foreignSource:any=foreign,index='foreign-key';
    const snapshot:any={...value,source:foreign,history:[foreign],ownershipKey:'foreign-key',consumption:{capture:{sourceId:'foreign-capture'}}};
    if(route==='source') foreignSource={...foreign,captureExecutionSourceId:source.captureExecutionSourceId};
    if(route==='snapshotSource') snapshot.source={...foreign,captureExecutionSourceId:source.captureExecutionSourceId};
    if(route==='historyArray') snapshot.history=[{...foreign,captureExecutionSourceId:source.captureExecutionSourceId}];
    if(route==='historyObject') snapshot.history={...foreign,captureExecutionSourceId:source.captureExecutionSourceId};
    if(route==='consumptionCapture') snapshot.consumption.capture.sourceId=source.captureExecutionSourceId;
    if(route==='snapshotKey') snapshot.ownershipKey=ownershipKey;
    if(route==='indexKey') index=ownershipKey;
    db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(foreign.sourceId,index,json(foreignSource),hash(foreignSource),json(snapshot),hash(snapshot));
    const owner={input:(s:typeof source)=>s,derive:()=>value,ownershipField:'captureExecutionSourceId' as const};
    expect(()=>actualLiveImmutableReceiptEvidenceFromSqlite(db,'actual_live_rule_consumptions',owner).assertUnique(source,ownershipKey,0)).toThrow(/ownership|metadata|identity/);
    expect(()=>actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity/);
  } finally {db.close();}
});
const duplicateCases=[['source','{}'],['source','[]'],['source','null'],['history','[]'],['history','{}'],['consumption','{}'],['capture','{}'],['successor','{}']] as const;
it.each(duplicateCases)('rejects duplicate %s container with %s', (key,empty)=>{
  const {db,source,value}=fixture();try {
    const malformed=json(value).replace(`"${key}":`,`"${key}":${empty},"${key}":`);
    db.prepare('UPDATE actual_live_rule_consumptions SET snapshot_json=?').run(malformed);
    const owner={input:(s:typeof source)=>s,derive:()=>value,ownershipField:'captureExecutionSourceId' as const};
    expect(()=>actualLiveImmutableReceiptEvidenceFromSqlite(db,'actual_live_rule_consumptions',owner).read(source.sourceId)).toThrow(/ownership|metadata|identity|archive/);
    expect(()=>actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity/);
  } finally {db.close();}
});
it.each(['sourceId','captureExecutionSourceId'])('rejects duplicate Source root identity %s', key=>{
 const {db,source}=fixture();try {
  const malformed=json(source).replace(`"${key}":`,`"${key}":"hidden","${key}":`);
  db.prepare('UPDATE actual_live_rule_consumptions SET source_json=?').run(malformed);
  expect(()=>actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/Source|ownership|metadata|archive/);
 }finally{db.close();}
});
it('does not inspect an opaque future rule result',()=>{
 const {db}=fixture();try {
  db.exec("UPDATE actual_live_rule_consumptions SET snapshot_json=json_set(snapshot_json,'$.successor.result',json('[{\"unknown\":true}]')),snapshot_hash='opaque'");
  expect(actualLivePlayQueueConsumersFromSqlite(db).derive({} as any).acceptedConsumptions).toEqual([]);
 }finally{db.close();}
});
