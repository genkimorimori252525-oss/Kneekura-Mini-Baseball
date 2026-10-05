import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { deriveActualDefensiveDecisionLiveWork } from '../../core/sim/liveAction/ActualDefensiveDecisionLiveWork';
import { clearKnownFirstBaseTrapOnDisposableCopy, knownFirstBaseSealTrapSql, requireOriginalArtifactFutureDecision } from './ActualFirstBaseArtifactGuards.test-support';
import type { OwnedActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it.each(['absent', 'known', 'other_sql'] as const)('removes only the exact known fixture trap on a disposable real-WAL copy: %s', kind => {
  const path=join(mkdtempSync(join(tmpdir(),'first-base-trap-copy-')),'copy.sqlite'),db=new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=wal;CREATE TABLE actual_live_play_fences(id TEXT);CREATE TABLE batted_world_field_executions(source_id TEXT,snapshot_hash TEXT);INSERT INTO batted_world_field_executions VALUES('actual-post-call-quantizer-tail','unchanged');");
  if(kind!=='absent')db.exec(kind==='known'?knownFirstBaseSealTrapSql:knownFirstBaseSealTrapSql.replace("snapshot_hash='changed-during-seal'","snapshot_hash='unexpected-other-change'"));
  const original=db.prepare('SELECT * FROM batted_world_field_executions').all();
  try{
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')!.file).toBe(path);
    if(kind==='other_sql')expect(()=>clearKnownFirstBaseTrapOnDisposableCopy(db)).toThrow(/unexpected.*trap/);
    else expect(clearKnownFirstBaseTrapOnDisposableCopy(db)).toBe(kind==='known'?'removed_known_trap':'absent');
    expect(db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(original);
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'").get()!.n).toBe(kind==='other_sql'?1:0);
  }finally{db.close();}
  const reopened=new DatabaseSync(path,{readOnly:true});try{expect(reopened.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(original);
    expect(reopened.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'").get()!.n).toBe(kind==='other_sql'?1:0);
  }finally{reopened.close();}
});
const scope={physicalPitchSourceId:'pitch',baseFieldSourceId:'field',ruleExecutionSourceId:'rule',throughTick:105,defenderIds:['home-1','home-2']};
const value=():OwnedActualDefensiveDecisionLiveWork=>({decisionSourceId:'scheduled-decision-home-2',decisionHash:'decision',observationHash:'observation',decisionModelSourceId:'model',decisionModelHash:'model-hash',planSourceId:'plan',planHash:'plan-hash',work:deriveActualDefensiveDecisionLiveWork({
  physicalPitchSourceId:'pitch',playerId:'home-2',originDecisionSourceId:'scheduled-decision-home-2',decisionSourceId:'scheduled-decision-home-2',revision:1,originObservationSourceId:'observation',ticksPerSecond:100,
  availableAt:{originTick:100,elapsedSeconds:0,tick:100},cut:{observationSourceId:'observation',baseFieldSourceId:'field',executionSourceId:'rule',at:{originTick:100,elapsedSeconds:0,tick:100}},
  scheduling:{startedAtTick:100,decisionDelayTicks:100,decisionTick:200,firstStepDelayTicks:0,movementStartTick:200},lifecycle:{status:'pending_decision',issuedAt:null,issuedBySourceId:null},intentKind:'hold',evidence:null,
})});
it('retains the already owned pending Source and its earlier original rule cut without creating a new decision',()=>{
 const original=value();expect(requireOriginalArtifactFutureDecision(original,scope)).toBe(original);
});
it.each(['missing','pitch','player','cut','due','issued'] as const)('refuses an absent or unrelated future decision: %s', kind=>{
 const original=value();const changed=kind==='missing'?null:{...original,work:{...original.work,...(kind==='pitch'?{physicalPitchSourceId:'other'}:{}),...(kind==='player'?{playerId:'foreign'}:{}),...(kind==='cut'?{cut:{...original.work.cut,executionSourceId:'other'}}:{}),...(kind==='due'?{deadlines:{...original.work.deadlines,decision:{originTick:100,elapsedSeconds:.05,tick:105}}}:{}),...(kind==='issued'?{phase:'issued' as const}:{})}};
 expect(()=>requireOriginalArtifactFutureDecision(changed,scope)).toThrow(/original.*future decision/);
});
