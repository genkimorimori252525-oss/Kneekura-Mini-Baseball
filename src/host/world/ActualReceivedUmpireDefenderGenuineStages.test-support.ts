/** TEST ONLY. Pinned, separately released continuation of closed Native evidence.
 * No original-owner fixture construction or caller-supplied dependency facade. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { ReceivedEnrollmentSource, ReceivedAvailabilitySource, ReceivedReplanSource } from './ActualReceivedUmpireDefender';
import type { ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';

export const receivedGenuineStages = ['enrollment','null-process','availability','revision-two',
  'reopen-enrollment','reopen-null-process','reopen-availability','reopen-revision-two'] as const;
export type ReceivedGenuineStage = typeof receivedGenuineStages[number];
export type ReceivedGenuinePin = Readonly<{path:string;sha256:string}>;
export type ReceivedGenuineSidecar = Readonly<{suffix:string;exists:boolean;bytes?:number;sha256?:string}>;
export type ReceivedGenuineCheckpoint = Readonly<{stage:ReceivedGenuineStage;database:ReceivedGenuinePin;receipt:ReceivedGenuinePin;
  terminal:ReceivedGenuinePin;report:ReceivedGenuinePin;inspection:ReceivedGenuinePin;sidecars:readonly ReceivedGenuineSidecar[]}>;
export type ReceivedGenuineInput = Readonly<{schema:'received_live_genuine_stage_input_v1';state:'released_for_received_live_genuine_stage';
  stage:ReceivedGenuineStage;reviewedImplementationHead:string;reviewedImplementationSrc:string;root:ReceivedGenuinePin;
  historicalEnrollment:Readonly<{checkpoint:ReceivedGenuinePin;config:ReceivedGenuinePin;input:ReceivedGenuinePin}>;
  predecessor:Readonly<{database:ReceivedGenuinePin;sidecars:readonly ReceivedGenuineSidecar[]}>;history:readonly ReceivedGenuineCheckpoint[]}>;
export const receivedGenuineSha=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
export const receivedGenuineCanonical=(value:unknown):string=>JSON.stringify(value,(_key,item:unknown)=>item!==null&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
export const receivedGenuineHash=(value:unknown)=>receivedGenuineSha(receivedGenuineCanonical(value));
export const receivedGenuineFile=(pin:ReceivedGenuinePin)=>{
  expect(isAbsolute(pin.path)).toBe(true);expect(realpathSync(pin.path)).toBe(pin.path);
  const bytes=readFileSync(pin.path);expect(receivedGenuineSha(bytes)).toBe(pin.sha256);return bytes;
};
export const receivedGenuineSidecars=(database:ReceivedGenuinePin,sidecars:readonly ReceivedGenuineSidecar[])=>{
  expect(sidecars.map(s=>s.suffix)).toEqual(['','-wal','-shm','-journal']);
  receivedGenuineFile(database);
  for(const sidecar of sidecars){const path=database.path+sidecar.suffix;expect(existsSync(path)).toBe(sidecar.exists);
    if(sidecar.exists){expect(statSync(path).size).toBe(sidecar.bytes);expect(receivedGenuineSha(readFileSync(path))).toBe(sidecar.sha256);}}
  for(const suffix of ['-wal','-journal']){const entry=sidecars.find(s=>s.suffix===suffix)!;expect(entry.exists?entry.bytes:0).toBe(0);}
};
const readJson=(pin:ReceivedGenuinePin)=>JSON.parse(receivedGenuineFile(pin).toString('utf8'));
export const receivedGenuineSources=()=>{
  const references={physicalPitchSourceId:'pitch-0',playerId:'home-1',observationSourceId:'received-input-after',currentExecutionSourceId:'received-input-reception-cut',
    predecessorDecisionSourceId:'scheduled-decision-home-1',predecessorMotorSourceId:'scheduled-motor-home-1',predecessorAdoptionSourceId:'field-race-real-motor'};
  const enrollment:ReceivedEnrollmentSource={sourceId:'received-live-enrollment-home-1',sourceVersion:'genuine-received-continuation-v1',
    capability:'received_umpire_defender_enrollment_v1',runtimeSourceId:'live-play-runtime',...references};
  const first:ReceivedReplanSource={sourceId:'received-live-process-home-1-1',sourceVersion:'genuine-received-continuation-v1',
    capability:'received_umpire_defender_replan_v2',enrollmentSourceId:enrollment.sourceId,...references,policySourceId:null,previousReplanSourceId:null};
  const availability:ReceivedAvailabilitySource={sourceId:'received-live-policy-home-1',sourceVersion:'genuine-received-continuation-v1',
    capability:'received_umpire_defender_policy_availability_v1',provenance:'accepted_at_current_actual_observation_v1',enrollmentSourceId:enrollment.sourceId,
    policyDataSourceId:'received-input-policy-data-synthetic-v1',physicalPitchSourceId:references.physicalPitchSourceId,playerId:references.playerId,
    observationSourceId:references.observationSourceId,currentExecutionSourceId:references.currentExecutionSourceId};
  const second:ReceivedReplanSource={...first,sourceId:'received-live-process-home-1-2',policySourceId:availability.sourceId,previousReplanSourceId:first.sourceId};
  return {enrollment,first,availability,second};
};
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';
export const receivedGenuineCensus=(db:DatabaseSync)=>({
  schema:db.prepare('SELECT rowid AS __rowid,* FROM main.sqlite_master ORDER BY type,name').all(),
  tables:db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>({name:String(row.name),
    rows:db.prepare(`SELECT rowid AS __rowid,* FROM main.${quote(String(row.name))}`).all().map(receivedGenuineCanonical).sort()})),
});
export type ReceivedGenuineCensus=ReturnType<typeof receivedGenuineCensus>;
// Independent schema oracle copied from the reviewed contract, not imported from
// the production schema installer. No trigger, view or extra index is admitted.
const identity='source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL';
const archive='source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL';
export const receivedGenuineLayouts={
  actual_received_umpire_defender_enrollments:`${identity},runtime_source_id TEXT NOT NULL,call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,legacy_prefix_count INTEGER NOT NULL,legacy_prefix_digest TEXT NOT NULL,${archive},UNIQUE(physical_pitch_source_id,player_id),UNIQUE(runtime_source_id,player_id)`,
  actual_received_umpire_defender_policy_availabilities:`${identity},enrollment_source_id TEXT NOT NULL UNIQUE,policy_data_source_id TEXT NOT NULL,observation_source_id TEXT NOT NULL,current_execution_source_id TEXT NOT NULL,${archive}`,
  actual_received_umpire_defender_replans:`${identity},enrollment_source_id TEXT NOT NULL,call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,origin_process_source_id TEXT NOT NULL,previous_source_id TEXT,policy_source_id TEXT,revision INTEGER NOT NULL,${archive},UNIQUE(enrollment_source_id,revision),UNIQUE(physical_pitch_source_id,player_id,revision)`,
  actual_received_umpire_defender_replan_heads:'physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL UNIQUE,source_id TEXT NOT NULL UNIQUE,origin_process_source_id TEXT NOT NULL,call_source_id TEXT NOT NULL,origin_communication_source_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id)',
  actual_received_umpire_defender_admissions:'enrollment_source_id TEXT NOT NULL,sequence INTEGER NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,runtime_source_id TEXT NOT NULL,owner TEXT NOT NULL,source_id TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,legacy_prefix_count INTEGER NOT NULL,legacy_prefix_digest TEXT NOT NULL,previous_receipt_hash TEXT,receipt_hash TEXT NOT NULL,PRIMARY KEY(enrollment_source_id,sequence),UNIQUE(owner,source_id)',
} as const;
export const receivedGenuineTables=Object.keys(receivedGenuineLayouts);
const expectedIndexes=[3,2,3,3,2];
export const receivedGenuineBaseline=(census:ReceivedGenuineCensus)=>({schema:census.schema.filter(row=>!receivedGenuineTables.includes(String(row.tbl_name))),
  tables:census.tables.filter(table=>!receivedGenuineTables.includes(table.name))});
export const receivedGenuineCheckCensus=(before:ReceivedGenuineCensus,after:ReceivedGenuineCensus,index:number,policyProof:{beforeCensusSha256:string;afterCensusSha256:string})=>{
  const baseline=receivedGenuineBaseline(after);
  expect(receivedGenuineHash(baseline)).toBe(policyProof.afterCensusSha256);expect(baseline.tables).toHaveLength(70);
  expect(baseline.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(136);
  const original={schema:baseline.schema.filter(row=>row.tbl_name!=='world_received_umpire_defender_policy_data'),tables:baseline.tables.filter(t=>t.name!=='world_received_umpire_defender_policy_data')};
  expect(receivedGenuineHash(original)).toBe(policyProof.beforeCensusSha256);expect(original.tables).toHaveLength(69);expect(original.tables.reduce((n,t)=>n+t.rows.length,0)).toBe(135);
  expect(baseline).toEqual(receivedGenuineBaseline(before));
  const counts=[[1,0,0,0,1],[1,0,1,1,2],[1,1,1,1,3],[1,1,2,1,4]][Math.min(index,3)];
  expect(after.tables.map(t=>t.name)).toEqual([...baseline.tables.map(t=>t.name),...receivedGenuineTables].sort());
  for(const [i,table] of receivedGenuineTables.entries()){
    const added=after.schema.filter(row=>row.tbl_name===table);expect(added).toHaveLength(1+expectedIndexes[i]);
    expect(added.map(row=>row.name).sort()).toEqual([table,...Array.from({length:expectedIndexes[i]},(_,n)=>`sqlite_autoindex_${table}_${n+1}`)].sort());
    const declaration=added.find(row=>row.name===table)!;expect(declaration.type).toBe('table');
    expect(String(declaration.sql).replace(/\s/g,'')).toBe(`CREATE TABLE ${table}(${receivedGenuineLayouts[table as keyof typeof receivedGenuineLayouts]})`.replace(/\s/g,''));
    for(const row of added.filter(row=>row.name!==table))expect(row).toMatchObject({type:'index',tbl_name:table,sql:null});
    const old=before.tables.find(t=>t.name===table)?.rows??[],next=after.tables.find(t=>t.name===table)!.rows;expect(next).toHaveLength(counts[i]);
    if(index===3&&table==='actual_received_umpire_defender_replan_heads'){
      expect(old).toHaveLength(1);const oldRow=JSON.parse(old[0]),newRow=JSON.parse(next[0]);
      expect(newRow).toEqual({...oldRow,source_id:receivedGenuineSources().second.sourceId,revision:2});
    }else for(const row of old)expect(next).toContain(row);
  }
  if(index>0)expect(after.schema).toEqual(before.schema);
  if(index>=4)expect(after).toEqual(before);
};
export const receivedGenuineReadInput=(path:string)=>{
  expect(isAbsolute(path)).toBe(true);expect(realpathSync(path)).toBe(path);
  const input=JSON.parse(readFileSync(path,'utf8')) as ReceivedGenuineInput;
  expect(input.schema).toBe('received_live_genuine_stage_input_v1');expect(input.state,'runtime release required before any database copy/open').toBe('released_for_received_live_genuine_stage');
  expect(input.reviewedImplementationHead).toBe('231b1a7fcfcb769d095caf64a304919e3b740c29');expect(input.reviewedImplementationSrc).toBe('2d22221b289fba2e59919c8b689ec546c23413ff');
  const index=receivedGenuineStages.indexOf(input.stage);expect(index).toBeGreaterThanOrEqual(0);expect(input.history).toHaveLength(index);
  // The accepted enrollment keeps its exact old implementation/harness lineage.
  // This continuation may neither relabel that receipt nor reconstruct stage zero.
  expect(index).toBeGreaterThanOrEqual(1);
  const inherited=input.historicalEnrollment;
  expect(inherited.checkpoint.sha256).toBe('92e22dc1562d3be6953debf1af457b14c4347f7934755ac847105e46582f640a');
  expect(inherited.config.sha256).toBe('0b9dcabe64e0dd8bceef0d10c07838386f74386473c003e0545b7e914d1ebebe');
  expect(inherited.input.sha256).toBe('69be2f26ed54d9c4a40030af3491a3433ce9cd3f7054a9ea62e7ef547f63d711');
  const historicalCheckpoint=readJson(inherited.checkpoint),historicalConfig=readJson(inherited.config),historicalInput=readJson(inherited.input);
  expect(input.history[0]).toEqual(historicalCheckpoint);
  expect(historicalInput).toMatchObject({stage:'enrollment',reviewedImplementationHead:'83d365e9c51dae2dd966324cd31222e086e06ffd',
    reviewedImplementationSrc:'9bc84012aecef8f1016589eede5be04eeea058cb',candidateHead:'0c1a5820975e1692d40e98a5d6eab9cdafd932e9',candidateSrc:'6641a61d87fcd89027a6d913a391ace50aceaa43'});
  expect(historicalConfig.sourceIdentity).toMatchObject({reviewedHead:historicalInput.reviewedImplementationHead,reviewedSrc:historicalInput.reviewedImplementationSrc,
    candidateHead:historicalInput.candidateHead,candidateSrc:historicalInput.candidateSrc});
  expect(historicalConfig.artifactEnvironment.BASEBALL_RECEIVED_LIVE_INPUT).toBe(inherited.input.path);
  expect(readJson(historicalCheckpoint.terminal)).toMatchObject({configSha256:inherited.config.sha256,
    before:{source:{sha256:historicalConfig.inputs.source.sha256}},reviewedSourceAuthentication:{head:historicalInput.reviewedImplementationHead,src:historicalInput.reviewedImplementationSrc,files:1971}});
  const root=readJson(input.root),policyProof=readJson(root.receipt),terminal=readJson(root.terminal),policyInput=readJson(root.policyInputPlan);
  expect(root.schema).toBe('received_live_genuine_root_v1');
  expect(root.database.sha256).toBe('3e21f81b1cbaef5cc1148b1e7c39d38ab70d5e24bc89535ed739486067779158');expect(root.receipt.sha256).toBe('25ce28e8eeff879168a32068a27e741b43fd3bc903872f8cac9a16a472a4090c');
  expect(root.terminal.sha256).toBe('75c00f46d4037df4f716d8f7f820fc84cf494b6014e7d80267de491205db90d5');expect(root.inspection.sha256).toBe('5fbd60defd056403abb5eb300184801c793066438eb847277ebd09b703854f9c');readJson(root.inspection);
  expect(terminal).toMatchObject({status:'passed',originalChildExit:0,failures:[],remainingOwnedProcesses:[],tests:{passedCases:1,expectedFailedCases:0,skipped:[],reportSha256:root.report.sha256}});
  expect(readJson(root.report)).toMatchObject({success:true,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0});
  expect(policyProof).toMatchObject({outputDatabaseSha256:root.database.sha256,originalTablesPreserved:69,originalRowsPreserved:135,originalAdmissionsPreserved:24,addedRows:1,liveAvailabilityCredit:0,receivedProcessCredit:0,motorRenewalCredit:0});
  expect(root.originalLineage).toHaveLength(36);expect(root.originalLineage).toEqual(policyInput.lineagePins);
  receivedGenuineFile(root.sourcePinFile);receivedGenuineFile(root.originAuthentication);
  for(const pin of root.originalLineage)receivedGenuineFile(pin);
  receivedGenuineSidecars(root.database,root.sidecars);
  const expected=readJson(root.expectedInputReceipt).expected.after as {source:unknown;input:ReceivedUmpireDefenderReplanInput};
  expect(expected.input.currentCut).toEqual({originTick:11180360,elapsedSeconds:0.849942,tick:12030302});
  const receipts=input.history.map((checkpoint,position)=>{
    expect(checkpoint.stage).toBe(receivedGenuineStages[position]);
    const prior=readJson(checkpoint.receipt),closed=readJson(checkpoint.terminal),inspection=readJson(checkpoint.inspection),report=readJson(checkpoint.report);
    receivedGenuineSidecars(checkpoint.database,checkpoint.sidecars);
    expect(prior.acceptedJson).toBe(receivedGenuineCanonical(prior.accepted));expect(prior.acceptedHash).toBe(receivedGenuineHash(prior.accepted));
    expect(prior.originalRolesPreserved).toBe(50);
    if(position===0){expect(prior.originalRoleSeal).toMatchObject({participants:10,roleCount:50,currentExecutionSourceId:'received-input-reception-cut'});
      expect(prior.originalRoleSealJson).toBe(receivedGenuineCanonical(prior.originalRoleSeal));expect(prior.originalRoleSealHash).toBe(receivedGenuineHash(prior.originalRoleSeal));}
    else {expect(prior.originalRoleSeal).toBeNull();expect(prior.originalRoleSealJson).toBeNull();expect(prior.originalRoleSealHash).toBe(readJson(input.history[0].receipt).originalRoleSealHash);}
    expect(prior).toMatchObject({schema:'received_live_genuine_stage_receipt_v1',stage:checkpoint.stage,outputDatabaseSha256:checkpoint.database.sha256,rootReceiptSha256:root.receipt.sha256,
      reviewedImplementationHead:position===0?historicalInput.reviewedImplementationHead:input.reviewedImplementationHead,
      reviewedImplementationSrc:position===0?historicalInput.reviewedImplementationSrc:input.reviewedImplementationSrc,newMotorOrAdoption:false,physicalAdvancement:false,closureCredit:0});
    expect(prior.inputDatabaseSha256).toBe(position?input.history[position-1].database.sha256:root.database.sha256);
    expect(prior.predecessorReceiptSha256).toBe(position?input.history[position-1].receipt.sha256:root.receipt.sha256);
    expect(closed).toMatchObject({status:'passed',originalChildExit:0,failures:[],remainingOwnedProcesses:[],tests:{passedCases:1,expectedFailedCases:0,skipped:[],reportSha256:checkpoint.report.sha256}});
    expect(report).toMatchObject({success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0});
    expect(inspection).toMatchObject({schema:'received_live_genuine_independent_inspection_v1',stage:checkpoint.stage,outputDatabaseSha256:checkpoint.database.sha256,receiptSha256:checkpoint.receipt.sha256,terminalSha256:checkpoint.terminal.sha256,originalRowsPreserved:135,originalAdmissionsPreserved:24});
    return prior;
  });
  expect(input.predecessor.database).toEqual(index?input.history[index-1].database:root.database);
  expect(input.predecessor.sidecars).toEqual(index?input.history[index-1].sidecars:root.sidecars);
  receivedGenuineSidecars(input.predecessor.database,input.predecessor.sidecars);
  return {input,index,root,policyProof,policyInput,expected,receipts};
};
