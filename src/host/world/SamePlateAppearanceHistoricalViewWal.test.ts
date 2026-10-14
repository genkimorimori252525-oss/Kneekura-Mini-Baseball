import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect,it,vi } from 'vitest';
import { executionViewFixture,reference } from './SamePlateAppearanceExecutionView.test-support';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
it('HI07 a historical proof cannot retain its common state after an in-proof Native mutation',()=>{
  const f=executionViewFixture(),p=f.prepare(),view=f.owner.acceptView(p.viewSource.sourceId);if(view.kind!=='basis_prepared')throw new Error('fixture view missing');
  const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const descriptor=Object.getOwnPropertyDescriptor(Native.prototype,'prepare')!,prepare=descriptor.value as DatabaseSync['prepare'];let reached=false;
  Object.defineProperty(Native.prototype,'prepare',{...descriptor,value:function(this:DatabaseSync,sql:string){const statement=prepare.call(this,sql);
    if(!reached&&this===f.db&&sql.startsWith('SELECT * FROM reserved_pa_total_assessments WHERE source_id=')){
      const all=statement.all;Object.defineProperty(statement,'all',{configurable:true,value:(...args:unknown[])=>{
        const rows=Reflect.apply(all,statement,args);reached=true;f.db.exec('PRAGMA query_only=0');
        const row=f.db.prepare("SELECT source_json FROM world_player_workload_baselines WHERE player_id='away-2'").get()!,source=JSON.parse(String(row.source_json));source.sourceVersion='changed-inside-proof';
        f.db.prepare("UPDATE world_player_workload_baselines SET source_json=? WHERE player_id='away-2'").run(json(source));f.db.exec('PRAGMA query_only=1');return rows;
      }});
    }return statement;
  }});
  f.db.exec('BEGIN; PRAGMA query_only=1');
  try{let error:unknown;try{readHistoricalSamePaExecutionView(f.db,reference('reserved_pa_execution_views',view));}catch(e){error=e;}
    expect(reached).toBe(true);expect(()=>{if(error)throw error;}).toThrow(/proof|changed|expired/);}
  finally{Object.defineProperty(Native.prototype,'prepare',descriptor);if(f.db.isTransaction)f.db.exec('ROLLBACK');f.db.exec('PRAGMA query_only=0');f.close();vi.restoreAllMocks();}
});
