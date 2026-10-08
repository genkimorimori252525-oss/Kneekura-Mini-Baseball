import { createRequire } from 'node:module';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { deriveReceivedUmpireDefenderReplan } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { receivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
// Isolates SQLite owner/transaction mechanics. This is not original-owner or
// genuine received-call authentication credit; that separate gate stays held.
const seam = vi.hoisted(() => ({ value: null as unknown, input: null as unknown, policy: null as unknown, fail: false, calls: 0 }));
vi.mock('./ActualReceivedUmpireDefenderEvidence', () => ({
  receivedEnrollmentEvidenceFromSqlite: () => ({
    derive: (source: unknown) => { seam.calls++; if (seam.fail) throw new Error('original-proof-failed'); return { value: { ...(seam.value as object), source }, bridge: { input: seam.input, dependencyHashes: {} }, context: {fieldingModel: (seam.policy as {fieldingModel:unknown}).fieldingModel} }; },
    qualifyCurrent: () => { if (seam.fail) throw new Error('current-proof-failed'); return 'open-state'; },
  }),
}));
vi.mock('./SqliteReceivedUmpireDefenderPolicyDataStore', () => ({ receivedUmpireDefenderPolicyDataEvidenceFromSqlite: () => ({read: () => seam.policy}) }));
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const source = { sourceId: 'enroll-a', sourceVersion: 'synthetic-state-machine-v1', capability: 'received_umpire_defender_enrollment_v1' as const,
  runtimeSourceId: 'runtime-a', physicalPitchSourceId: 'pitch-a', playerId: 'player-a', observationSourceId: 'observation-a',
  currentExecutionSourceId: 'execution-a', predecessorDecisionSourceId: 'decision-a', predecessorMotorSourceId: 'motor-a', predecessorAdoptionSourceId: 'adoption-a' };
const load = async () => {
  expect(existsSync(new URL('./SqliteActualReceivedUmpireDefenderEnrollmentStore.ts', import.meta.url)), 'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBe(true);
  return import('./SqliteActualReceivedUmpireDefenderEnrollmentStore');
};
const fixture = async () => {
  const m = await load(), directory = mkdtempSync(join(tmpdir(), 'received-enrollment-isolated-')), path = join(directory, 'state.sqlite');
  const db = new DatabaseSync(path); db.exec('CREATE TABLE untouched(value TEXT); INSERT INTO untouched VALUES(\'original\');');
  const ref = { sourceId: 'runtime-a', sourceHash: 'source', snapshotHash: 'snapshot' };
  seam.fail = false; seam.calls = 0;
  seam.value = { source, gameId: 'game-a', playId: 1, receiver: { careerId: 'career-a', playerId: 'player-a', personId: 'person-a', personLinkSourceId: 'link-a', fieldingModelSourceId: 'model-a', gameDay: 12 },
    cause: { physicalPitchSourceId: 'pitch-a', playerId: 'player-a', callSourceId: 'call-a', originCommunicationSourceId: 'send-a' },
    membership: { version: 'received_umpire_defender_membership_v1', playerId: 'player-a', receiverRole: 'defender', effectiveFrom: { originTick: 1000, elapsedSeconds: 0.2, tick: 1200 }, legacyCoverage: 'unchanged', physicalAdvancement: 'blocked_until_future_capability', producers: [] },
    anchor: { runtime: ref, legacyAdmissionPrefix: { count: 24, digest: 'prefix' } } };
  const at=(elapsedSeconds:number)=>({originTick:1000,elapsedSeconds,tick:1000+Math.round(elapsedSeconds*1000)});
  const calledAt=at(0.19), receivedAt=at(0.199), cut=at(0.2);
  const received={event:{sourceId:'umpire',targetScope:{kind:'nearby' as const},kind:'callout' as const,issuedAt:calledAt.tick,
    content:{callSourceId:'call-a',call:'out' as const,calledAt,onFieldCall:{callId:'call-on-field',tick:calledAt.tick,basisSnapshotId:'basis',basisEvidenceRevision:1,
      ruling:{outsAfter:1,basesAfter:{first:null,second:null,third:null},scoredRunnerIds:[] as const}}}},receivedAt:receivedAt.tick,confidence:0.8};
  seam.input={processSourceId:source.sourceId,physicalPitchSourceId:source.physicalPitchSourceId,playerId:source.playerId,receiverRole:'defender',ticksPerSecond:1000,currentCut:cut,
    communication:{sourceId:'received-a',hash:'received-hash',originCommunicationSourceId:'send-a',callSourceId:'call-a'},
    observation:{sourceId:source.observationSourceId,hash:'observation-hash',at:cut,reception:{kind:'received',receivedAt,order:null,received},
      perceived:{observerId:source.playerId,observationTime:cut.tick,attention:{target:{kind:'ball'},focusedSinceTick:1000},
        ball:{estimate:{position:{x:8,y:0.3,z:13},velocity:{x:1,y:0,z:2}},sourceObservedAt:1190,predictedAt:cut.tick,confidence:0.8},players:[],communications:[received],knownContext:null}},
    predecessor:{originDecisionSourceId:'decision-a',originObservationSourceId:'initial-observation',originObservationHash:'initial-hash',availability:at(0.1),informationOrder:null,
      observationSourceId:'initial-observation',observationHash:'initial-hash',observedThrough:at(0.11),decisionTick:1100,issuedAt:at(0.11),
      command:{sourceId:'decision-a',hash:'decision-hash',selected:{intent:{kind:'ball_handler'},localPriority:0.8,evidenceAvailableAt:1100,evidenceKinds:['observed_ball']},target:{x:4,z:9}},
      motor:{sourceId:'motor-a',hash:'motor-hash',adoptionSourceId:'adoption-a',adoptedAt:at(0.11)}},
    model:{sourceId:'decision-model',hash:'model-hash',situationalAwareness:0.5,firstStepAbility:0.5,minimumCueConfidence:0.1,communicationTrust:0.75,
      decisionTimingParameters:{minimumDecisionDelayTicks:0,maximumDecisionDelayTicks:0,fixedProcessingOffsetTicks:0},firstStepTimingParameters:{minimumFirstStepDelayTicks:0,maximumFirstStepDelayTicks:0,fixedMotorOffsetTicks:0}},
    contextualPlan:{sourceId:'plan-a',hash:'plan-hash',priorities:{ballPursuitPriority:1,baseCoverPriorities:[],relayPriority:0,backupPriority:0,deepCoveragePriority:0,holdPriority:0}},policy:null,previous:null} satisfies ReceivedUmpireDefenderReplanInput;
  seam.policy={source:{sourceId:'policy-data-a',sourceVersion:'synthetic-v1',capability:'received_umpire_defender_policy_data_v1',provenance:'explicit_imported_policy_data_v1',
    careerId:'career-a',playerId:'player-a',personLinkSourceId:'link-a',fieldingModelSourceId:'model-a',acceptedAtDay:12,
    profiles:{out:{ballPursuitPriority:0.1,holdPriority:0.9},safe:{ballPursuitPriority:0.9,holdPriority:0.1}}},
    fieldingModel:{source:{sourceId:'model-a',acceptedAtDay:10},person:{sourceId:'link-a',personId:'person-a'}}};
  const value=seam.value as {anchor:Record<string,unknown>}; Object.assign(value.anchor,{at:cut,observation:{sourceId:'observation-a',snapshotHash:'observation-hash'},
    execution:{sourceId:'execution-a',snapshotHash:'execution-hash'},fieldingModelHash:hash((seam.policy as {fieldingModel:unknown}).fieldingModel)});
  const accepted = new Map([[source.sourceId, source]]);
  const store = m.openSqliteActualReceivedUmpireDefenderEnrollmentStore(path, { readAcceptedEnrollment: id => accepted.get(id) ?? null });
  return { ...m, directory, path, db, store, accepted, close() { store.close(); db.close(); rmSync(directory, { recursive: true }); } };
};

it('keeps enrollment open read and failed Source lookup inert on a pristine namespace', async () => {
  const f = await fixture();
  try {
    expect(receivedOwnerSchema(f.db)).toBe('pristine'); expect(f.store.read('none')).toBeNull();
    expect(() => f.store.accept('none')).toThrow(/Source.*missing/i); expect(receivedOwnerSchema(f.db)).toBe('pristine');
  } finally { f.close(); }
});

it('atomically persists the enrollment and first journal row with an immediate pending obligation', async () => {
  const f = await fixture();
  try {
    const result = f.store.accept(source.sourceId); expect(result).toEqual(seam.value);
    const rows = f.db.prepare('SELECT * FROM actual_received_umpire_defender_enrollments').all(); expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source_id: source.sourceId, source_hash: hash(source), snapshot_hash: hash(result), legacy_prefix_count: 24, legacy_prefix_digest: 'prefix' });
    const admissions = f.db.prepare('SELECT * FROM actual_received_umpire_defender_admissions').all(); expect(admissions).toHaveLength(1);
    expect(admissions[0]).toMatchObject({ enrollment_source_id: source.sourceId, sequence: 1, owner: 'actual_received_umpire_defender_enrollments', source_id: source.sourceId, previous_receipt_hash: null });
    const { receipt_hash, ...journal } = admissions[0]; expect(receipt_hash).toBe(hash(journal));
    expect(f.db.prepare('SELECT * FROM actual_received_umpire_defender_replans').all()).toEqual([]);
    expect(f.db.prepare('SELECT * FROM untouched').all()).toEqual([{ value: 'original' }]);
  } finally { f.close(); }
});

it('reopens and retries historical enrollment without duplicate writes or accepted authority', async () => {
  const f = await fixture();
  try {
    const result = f.store.accept(source.sourceId); f.store.close();
    const reader = f.openSqliteActualReceivedUmpireDefenderEnrollmentStore(f.path);
    try { expect(reader.read(source.sourceId)).toEqual(result); expect(reader.accept(source.sourceId)).toEqual(result); }
    finally { reader.close(); }
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_admissions').get()!.n).toBe(1);
  } finally { f.close(); }
});

it('rolls the entire pristine bootstrap back when original proof fails inside acceptance', async () => {
  const f = await fixture();
  try {
    seam.fail = true; expect(() => f.store.accept(source.sourceId)).toThrow(/proof-failed/);
    expect(receivedOwnerSchema(f.db)).toBe('pristine');
  } finally { f.close(); }
});

it('rejects changed callbacks second enrollment and archive corruption instead of replacing ownership', async () => {
  const f = await fixture();
  try {
    f.store.accept(source.sourceId);
    f.accepted.set(source.sourceId, { ...source, sourceVersion: 'changed' }); expect(() => f.store.accept(source.sourceId)).toThrow(/frozen|Source/);
    const next = { ...source, sourceId: 'second' }; f.accepted.set(next.sourceId, next);
    expect(() => f.store.accept(next.sourceId)).toThrow(/enrollment|ownership|claim/);
    f.db.prepare('UPDATE actual_received_umpire_defender_enrollments SET snapshot_hash=?').run('corrupt');
    expect(() => f.store.read(source.sourceId)).toThrow(/archive|hash|journal/);
  } finally { f.close(); }
});

const live = async () => {
  for(const name of ['SqliteActualReceivedUmpireDefenderReplanStore','SqliteActualReceivedUmpireDefenderPolicyAvailabilityStore','ActualReceivedUmpireDefenderLiveWork'])
    expect(existsSync(new URL('./'+name+'.ts',import.meta.url)),'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBe(true);
  return {...await import('./SqliteActualReceivedUmpireDefenderReplanStore'),...await import('./SqliteActualReceivedUmpireDefenderPolicyAvailabilityStore'),...await import('./ActualReceivedUmpireDefenderLiveWork')};
};
const processSource=()=>{const {runtimeSourceId:_runtime,...references}=source;return {...references,sourceId:'process-1',capability:'received_umpire_defender_replan_v2' as const,enrollmentSourceId:source.sourceId,policySourceId:null as string|null,previousReplanSourceId:null as string|null};};
const availableSource=()=>({sourceId:'available-a',sourceVersion:'synthetic-v1',capability:'received_umpire_defender_policy_availability_v1' as const,provenance:'accepted_at_current_actual_observation_v1' as const,
  enrollmentSourceId:source.sourceId,policyDataSourceId:'policy-data-a',physicalPitchSourceId:source.physicalPitchSourceId,playerId:source.playerId,observationSourceId:source.observationSourceId,currentExecutionSourceId:source.currentExecutionSourceId});

it('persists one stable received process through null policy and exact-cut Core selection with renewal still pending',async()=>{
  const m=await live(),f=await fixture(); const first=processSource(),available=availableSource(),second={...first,sourceId:'process-2',previousReplanSourceId:first.sourceId,policySourceId:available.sourceId};
  const sources=new Map([[first.sourceId,first],[second.sourceId,second]]),processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:id=>sources.get(id)??null}),policies=m.openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(f.path,{readAcceptedAvailability:()=>available});
  try{
    const enrollment=f.store.accept(source.sourceId);
    f.db.exec('BEGIN');expect(m.actualReceivedUmpireDefenderLiveWorkFromSqlite(f.db).read(source.sourceId)).toMatchObject({kind:'received_enrollment_pending',reason:'process_not_admitted'});f.db.exec('COMMIT');
    const a=processes.accept(first.sourceId);expect(a.replan).toMatchObject({semantic:'call_profile_unavailable',selectedAt:null});expect(a.replan.work).toHaveLength(1);
    const p=policies.accept(available.sourceId),b=processes.accept(second.sourceId);
    expect(b.originProcessSourceId).toBe(first.sourceId);expect(b.input.processSourceId).toBe(first.sourceId);expect(b.replan).toEqual(deriveReceivedUmpireDefenderReplan(b.input));
    expect(b.replan).toMatchObject({phase:'renewal_due',selectedAt:{tick:1200},selected:{intent:{kind:'ball_handler'}}});
    expect(b.replan.work).toEqual([{kind:'renewal_adoption',sourceId:first.sourceId,cause:enrollment.cause,dueTick:1200}]);
    expect(b.input.policy).toEqual({sourceId:available.sourceId,hash:hash(p),availableAt:p.availableAt,profiles:p.policyData.source.profiles});
    expect(processes.read(first.sourceId)).toEqual(a);expect(processes.accept(second.sourceId)).toEqual(b);
    processes.close();policies.close();const reopened=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path);
    try{expect(reopened.read(first.sourceId)).toEqual(a);expect(reopened.accept(first.sourceId)).toEqual(a);expect(reopened.read(second.sourceId)).toEqual(b);expect(reopened.accept(second.sourceId)).toEqual(b);}finally{reopened.close();}
    f.db.exec('BEGIN');expect(m.actualReceivedUmpireDefenderLiveWorkFromSqlite(f.db).read(source.sourceId)).toMatchObject({kind:'received_process_work',originProcessSourceId:first.sourceId,revisionSourceId:second.sourceId,work:{kind:'renewal_adoption'}});f.db.exec('COMMIT');
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_admissions').get()!.n).toBe(4);
    expect(f.db.prepare('SELECT * FROM untouched').all()).toEqual([{value:'original'}]);
  }finally{processes.close();policies.close();f.close();}
});

it('rejects availability before null process and mismatched or future-day policy without journaling it',async()=>{
  const m=await live(),f=await fixture(),first=processSource(),available=availableSource();
  const processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:()=>first}),policies=m.openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(f.path,{readAcceptedAvailability:()=>available});
  try{
    f.store.accept(source.sourceId);expect(()=>policies.accept(available.sourceId)).toThrow(/stage|process/);processes.accept(first.sourceId);
    const policy=seam.policy as {source:Record<string,unknown>};seam.policy={...policy,source:{...policy.source,acceptedAtDay:13}};expect(()=>policies.accept(available.sourceId)).toThrow(/day|binding/);
    seam.policy={...policy,source:{...policy.source,acceptedAtDay:12,playerId:'other'}};expect(()=>policies.accept(available.sourceId)).toThrow(/binding/);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_admissions').get()!.n).toBe(2);
  }finally{processes.close();policies.close();f.close();}
});

it('rejects no-op Sources forks and revisions after the sole null-to-policy transition',async()=>{
  const m=await live(),f=await fixture(),first=processSource(),available=availableSource(),sources=new Map([[first.sourceId,first]]);
  const processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:id=>sources.get(id)??null}),policies=m.openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(f.path,{readAcceptedAvailability:()=>available});
  try{
    f.store.accept(source.sourceId);processes.accept(first.sourceId);
    const noop={...first,sourceId:'noop',previousReplanSourceId:first.sourceId};sources.set(noop.sourceId,noop);expect(()=>processes.accept(noop.sourceId)).toThrow(/transition|stage|policy/);
    policies.accept(available.sourceId);const second={...first,sourceId:'process-2',previousReplanSourceId:first.sourceId,policySourceId:available.sourceId};sources.set(second.sourceId,second);processes.accept(second.sourceId);
    for(const next of [{...second,sourceId:'fork'},{...second,sourceId:'third',previousReplanSourceId:second.sourceId}]){sources.set(next.sourceId,next);expect(()=>processes.accept(next.sourceId)).toThrow(/head|revision|stage|transition/);}
  }finally{processes.close();policies.close();f.close();}
});

it('preserves exact-tie Core semantics and keeps enrollment pending instead of manufacturing selection',async()=>{
  const m=await live(),f=await fixture(),first=processSource();
  const input=seam.input as ReceivedUmpireDefenderReplanInput;seam.input={...input,predecessor:{...input.predecessor,availability:input.observation.reception.kind==='received'?input.observation.reception.receivedAt:input.predecessor.availability,observedThrough:input.currentCut,issuedAt:input.currentCut,motor:{...input.predecessor.motor,adoptedAt:input.currentCut}}};
  const processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:()=>first});
  try{f.store.accept(source.sourceId);const a=processes.accept(first.sourceId);expect(a.replan).toMatchObject({semantic:'same_moment_order_unavailable',selectedAt:null,work:[]});
    f.db.exec('BEGIN');expect(m.actualReceivedUmpireDefenderLiveWorkFromSqlite(f.db).read(source.sourceId)).toMatchObject({kind:'received_enrollment_pending',reason:'no_core_work'});f.db.exec('COMMIT');
  }finally{processes.close();f.close();}
});

it('rejects an orphan enrollment journal instead of reporting absent ownership',async()=>{
  const f=await fixture();
  try{f.store.accept(source.sourceId);f.db.prepare('DELETE FROM actual_received_umpire_defender_enrollments WHERE source_id=?').run(source.sourceId);
    expect(()=>f.store.read(source.sourceId),'ORPHAN_ENROLLMENT_REPORTED_ABSENT').toThrow(/orphan|ownership|journal/);
  }finally{f.close();}
});

it('rolls availability back if its accepted Source changes after the real owner INSERT',async()=>{
  const m=await live(),f=await fixture(),first=processSource();let available=availableSource(),inserted=false;
  const processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:()=>first}),policies=m.openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(f.path,{readAcceptedAvailability:()=>available});
  const prepare=DatabaseSync.prototype.prepare;
  try{
    f.store.accept(source.sourceId);processes.accept(first.sourceId);
    DatabaseSync.prototype.prepare=function(this:InstanceType<typeof DatabaseSync>,sql:string){const stmt=prepare.call(this,sql);if(sql.startsWith('INSERT INTO actual_received_umpire_defender_policy_availabilities')){
      const run=stmt.run.bind(stmt);stmt.run=((...args:Parameters<typeof stmt.run>)=>{const result=run(...args);inserted=true;available={...available,sourceVersion:'changed-after-insert'};return result;}) as typeof stmt.run;
    }return stmt;} as typeof prepare;
    expect(()=>policies.accept(available.sourceId),'POST_INSERT_AVAILABILITY_SOURCE_DRIFT_ACCEPTED').toThrow(/callback|Source/);
    DatabaseSync.prototype.prepare=prepare;expect(inserted).toBe(true);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_policy_availabilities').get()!.n).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM actual_received_umpire_defender_admissions').get()!.n).toBe(2);
  }finally{DatabaseSync.prototype.prepare=prepare;processes.close();policies.close();f.close();}
});

const reviewedStageFour=async()=>{
  const m=await live(),f=await fixture(),first=processSource(),available=availableSource(),second={...first,sourceId:'process-2',previousReplanSourceId:first.sourceId,policySourceId:available.sourceId};
  const sources=new Map([[first.sourceId,first],[second.sourceId,second]]),processes=m.openSqliteActualReceivedUmpireDefenderReplanStore(f.path,{readAcceptedReplan:id=>sources.get(id)??null}),policies=m.openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore(f.path,{readAcceptedAvailability:()=>available});
  try{f.store.accept(source.sourceId);const original=processes.accept(first.sourceId);policies.accept(available.sourceId);processes.accept(second.sourceId);
    return {...f,first,second,original,processes,close(){processes.close();policies.close();f.close();}};
  }catch(error){processes.close();policies.close();f.close();throw error;}
};
const replaceLaterArchive=(f:Awaited<ReturnType<typeof reviewedStageFour>>,sourceValue:unknown,snapshotValue:unknown)=>{
  const sourceHash=hash(sourceValue),snapshotHash=hash(snapshotValue);
  f.db.prepare('UPDATE actual_received_umpire_defender_replans SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
    .run(JSON.stringify(sourceValue),sourceHash,JSON.stringify(snapshotValue),snapshotHash,f.second.sourceId);
  const row=f.db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? AND sequence=4').get(source.sourceId)!;
  const {receipt_hash:_hash,...receipt}=row;receipt.source_hash=sourceHash;receipt.snapshot_hash=snapshotHash;
  f.db.prepare('UPDATE actual_received_umpire_defender_admissions SET source_hash=?,snapshot_hash=?,receipt_hash=? WHERE enrollment_source_id=? AND sequence=4')
    .run(sourceHash,snapshotHash,hash(receipt),source.sourceId);
};

it('J01 rejects later owner scope and Source-version mirrors during earlier process read and retry',async()=>{
  const f=await reviewedStageFour();
  try{
    const row=f.db.prepare('SELECT * FROM actual_received_umpire_defender_replans WHERE source_id=?').get(f.second.sourceId)!;
    for(const [key,changed] of [['game_id','foreign-game'],['play_id',99],['physical_pitch_source_id','foreign-pitch'],['player_id','foreign-player'],['source_version','foreign-version']] as const){
      f.db.prepare(`UPDATE actual_received_umpire_defender_replans SET ${key}=? WHERE source_id=?`).run(changed,f.second.sourceId);
      expect(()=>f.processes.read(f.first.sourceId),'LATER_OWNER_MIRROR_DRIFT_IGNORED').toThrow(/metadata|mirror|scope|journal/);
      expect(()=>f.processes.accept(f.first.sourceId)).toThrow();
      f.db.prepare(`UPDATE actual_received_umpire_defender_replans SET ${key}=? WHERE source_id=?`).run(row[key],f.second.sourceId);
    }
    expect(f.processes.read(f.first.sourceId)).toEqual(f.original);
  }finally{f.close();}
});

it('J02 rejects resealed later Source predecessor and policy rebinding without evaluating its Core payload',async()=>{
  const f=await reviewedStageFour();
  try{
    const row=f.db.prepare('SELECT * FROM actual_received_umpire_defender_replans WHERE source_id=?').get(f.second.sourceId)!;
    for(const key of ['previousReplanSourceId','policySourceId']){
      const laterSource=JSON.parse(String(row.source_json)),later=JSON.parse(String(row.snapshot_json));laterSource[key]='unadmitted-reference';later.source=laterSource;
      later.replan='later Core payload must remain opaque';later.input='later Core input must remain opaque';replaceLaterArchive(f,laterSource,later);
      expect(()=>f.processes.read(f.first.sourceId),'LATER_SOURCE_LINEAGE_DRIFT_IGNORED').toThrow(/lineage|metadata|journal/);
      expect(()=>f.processes.accept(f.first.sourceId)).toThrow();
    }
  }finally{f.close();}
});

it('J03 checks later headers while keeping its resealed Core payload opaque to historical replay',async()=>{
  const f=await reviewedStageFour();
  try{
    const row=f.db.prepare('SELECT * FROM actual_received_umpire_defender_replans WHERE source_id=?').get(f.second.sourceId)!;
    const laterSource=JSON.parse(String(row.source_json)),later=JSON.parse(String(row.snapshot_json));
    later.replan='not executable Core result';later.input='not executable Core input';replaceLaterArchive(f,laterSource,later);
    expect(f.processes.read(f.first.sourceId)).toEqual(f.original);expect(f.processes.accept(f.first.sourceId)).toEqual(f.original);
    expect(()=>f.processes.read(f.second.sourceId)).toThrow(/archive/);
  }finally{f.close();}
});
