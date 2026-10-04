// Only the already validated physical graph is mocked. These assertions exercise real
// SQLite ownership metadata/discovery, not physical provenance or Native acceptance.
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
  const receiptId = json(['actual_live_rule_consumption_receipt_v1',ownershipKey,source.sourceId]);
  const capture = {owner:'batted_world_field_executions',sourceId:'capture',snapshotHash:'capture-hash'};
  const rule = {owner:'batted_world_field_executions',sourceId:'future-rule',snapshotHash:'future-hash'};
  const value = { source, history: [source], revision: 1, physicalPitchSourceId: 'pitch', scopeId: 'scope', ownershipKey,
    consumption: {kind:'first_base_rule_consumption',status:'consumed',receiptId,eventKey:'capture-event',successorKey,capture,rule},
    successor: {kind:'first_base_rule_result',status:'pending',pendingReason:'next_rule_consumer_unowned',basisReceiptId:receiptId,
      successorKey:json(['actual_live_rule_result_successor_v1',receiptId]),rule,result:{future:'opaque'}} };
  db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(source.sourceId,ownershipKey,json(source),hash(source),json(value),hash(value));
  state.queue = {scope:{scope:{physicalPitchSourceId:'pitch',scopeId:'scope',cut:{kind:'field_execution',baseFieldSourceId:'base',executionSourceId:'capture'},physicalReferences:[],at:{originTick:1,elapsedSeconds:1,tick:2}}},successors:[{kind:'rule_evidence',successorKey,basisEventKey:'capture-event',owner:capture}],consumptions:[]};
  return {db, source, value, ownershipKey};
}
it('rejects a future consumer ownership index mismatch before excluding its payload', () => {
  const {db} = fixture(); try {
    db.exec("UPDATE actual_live_rule_consumptions SET ownership_key='wrong-index'");
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity|claim/);
  } finally {db.close();}
});
it('rejects duplicate future history containers even when one is empty', () => {
  const {db,value} = fixture(); try {
    const malformed = json(value).replace('"history":', '"history":[],"history":');
    db.prepare('UPDATE actual_live_rule_consumptions SET snapshot_json=?').run(malformed);
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity|claim/);
  } finally {db.close();}
});
it('rejects a hidden acknowledgement Source alias outside its capture selector', () => {
  const {db,source,value} = fixture(); try {
    const forged = {...source,captureExecutionSourceId:'other-capture'};
    db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run('alias-row','other-key',json(forged),hash(forged),json({...value,source:forged,history:[forged],consumption:{capture:{sourceId:'other-capture'}}}), 'wrong-hash');
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity|claim/);
  } finally {db.close();}
});

import { actualLiveImmutableReceiptEvidenceFromSqlite } from './ActualLiveImmutableReceiptStore';
it('rejects hidden capture ownership consistently at writer and consumer boundaries', () => {
  const {db,source,value,ownershipKey} = fixture(); try {
    db.exec('DELETE FROM actual_live_rule_consumptions');
    const forged = {...source,sourceId:'unrelated-ack',captureExecutionSourceId:'other-capture'};
    const unrelated = {...value,source:forged,history:[forged],ownershipKey:'unrelated-key',consumption:{capture:{sourceId:'capture'}}};
    db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(forged.sourceId,'unrelated-key',json(forged),hash(forged),json(unrelated),hash(unrelated));
    const owner = {input:(raw:typeof source)=>raw, derive:()=>value,ownershipField:'captureExecutionSourceId' as const};
    expect(() => actualLiveImmutableReceiptEvidenceFromSqlite(db,'actual_live_rule_consumptions',owner).assertUnique(source,ownershipKey,0)).toThrow(/ownership|claim/);
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/metadata|ownership/);
  } finally {db.close();}
});

it('preserves opaque future result payloads with valid ownership metadata', () => {
  const {db} = fixture(); try {
    db.exec("UPDATE actual_live_rule_consumptions SET snapshot_json=json_set(snapshot_json,'$.successor.result',json('{}')),snapshot_hash='future-opaque'");
    expect(actualLivePlayQueueConsumersFromSqlite(db).derive({} as any).acceptedConsumptions).toEqual([]);
  } finally {db.close();}
});

it('discovers a successor ownership-key claim even when all capture references point elsewhere', () => {
  const {db,source,value} = fixture(); try {
    const hidden = {...source,captureExecutionSourceId:'other-capture'};
    const snapshot = {...value,source:hidden,history:[hidden],consumption:{capture:{sourceId:'other-capture'}}};
    db.prepare('UPDATE actual_live_rule_consumptions SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?').run(json(hidden),hash(hidden),json(snapshot),hash(snapshot));
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/metadata|ownership/);
    db.prepare('UPDATE actual_live_rule_consumptions SET ownership_key=?').run('other-index');
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/metadata|ownership/);
  } finally {db.close();}
});

it.each(['$.consumption.capture.sourceId','$.consumption.rule.sourceId','$.successor.rule.sourceId','$.consumption.successorKey'])(
  'rejects mismatched future ownership reference %s without reading its result', path => {
    const {db} = fixture(); try {
      db.prepare('UPDATE actual_live_rule_consumptions SET snapshot_json=json_set(snapshot_json,?,?)').run(path,'foreign');
      expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata/);
    } finally {db.close();}
  });
it.each(['sourceId','captureExecutionSourceId'] as const)('rejects a hidden %s claim in a mistyped history object', field => {
  const {db,source,value,ownershipKey} = fixture(); try {
    const unrelated = {...source,sourceId:'other-ack',captureExecutionSourceId:'other-capture'};
    const hidden = {...value,source:unrelated,ownershipKey:'other-key',history:{...unrelated,[field]:source[field]},
      consumption:{capture:{sourceId:'other-capture'}}};
    db.prepare('INSERT INTO actual_live_rule_consumptions VALUES(?,?,?,?,?,?)').run(unrelated.sourceId,'other-key',json(unrelated),hash(unrelated),json(hidden),hash(hidden));
    expect(() => actualLivePlayQueueConsumersFromSqlite(db).derive({} as any)).toThrow(/ownership|metadata|identity/);
    if (field === 'captureExecutionSourceId') {
      db.prepare('DELETE FROM actual_live_rule_consumptions WHERE source_id=?').run(source.sourceId);
      const owner = {input:(raw:typeof source)=>raw,derive:()=>value,ownershipField:'captureExecutionSourceId' as const};
      expect(() => actualLiveImmutableReceiptEvidenceFromSqlite(db,'actual_live_rule_consumptions',owner)
        .assertUnique(source,ownershipKey,0)).toThrow(/ownership|claim/);
    }
  } finally {db.close();}
});
