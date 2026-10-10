// A pure derived owner isolates the real shared transaction and trigger rollback.
// Full physical Source rederivation is covered by the separate Native tests.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { openActualLiveImmutableReceiptStore } from './ActualLiveImmutableReceiptStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('rolls back the entire receipt delta when a trigger inserts a hidden capture-ownership claim', () => {
  const dir=mkdtempSync(join(tmpdir(),'review-live-metadata-')), path=join(dir,'receipt.db');
  const source={sourceId:'ack',captureExecutionSourceId:'capture'};
  const derive=(s:typeof source)=>({source:s,revision:1,physicalPitchSourceId:'pitch',ownershipKey:json(['capture',s.captureExecutionSourceId]),history:[s],consumption:{capture:{sourceId:s.captureExecutionSourceId}}});
  let privateDb: import('node:sqlite').DatabaseSync | null = null;
  const store=openActualLiveImmutableReceiptStore(path,'actual_live_rule_consumptions',ownerDb=>{
    privateDb=ownerDb;
    return { input:(s:typeof source)=>s, derive:(s:typeof source)=>{
      expect(ownerDb.isTransaction).toBe(true);
      expect(ownerDb.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
      return derive(s);
    }, ownershipField:'captureExecutionSourceId' as const };
  },()=>{
    expect(privateDb!.isTransaction).toBe(false);
    expect(privateDb!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    return source;
  });
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db=new DatabaseSync(path);
  try {
    // The shared rule-consumption writer requires this original-pitch index
    // before the metadata trigger can run; no physical derivation is claimed.
    db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL); INSERT INTO physical_pitch_progress_actions VALUES('pitch','game',1);");
    const other={sourceId:'hidden',captureExecutionSourceId:'other-capture'};
    const hidden={...derive(other),consumption:{capture:{sourceId:'capture'}}};
    const literal=(v:string)=>`'${v.replaceAll("'","''")}'`;
    db.exec(`CREATE TRIGGER hidden_capture_claim AFTER INSERT ON actual_live_rule_consumptions WHEN NEW.source_id='ack' BEGIN
      INSERT INTO actual_live_rule_consumptions VALUES(${[other.sourceId,hidden.ownershipKey,json(other),hash(other),json(hidden),hash(hidden)].map(literal).join(',')}); END;`);
    expect(() => store.accept(source.sourceId)).toThrow(/ownership|claim/);
    expect(db.prepare('SELECT source_id FROM actual_live_rule_consumptions').all()).toEqual([]);
    db.exec('DROP TRIGGER hidden_capture_claim');
    const saved = store.accept(source.sourceId);
    expect(saved).toEqual(derive(source));
    expect(store.read(source.sourceId)).toEqual(saved);
  } finally {db.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
