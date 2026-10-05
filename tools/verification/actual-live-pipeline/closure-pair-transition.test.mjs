import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './official-read-replay-fixture.test-support.mjs';
import { assertOfficialReadReplayInput, assertOfficialReadReplayEvidence } from './official-read-replay-evidence.mjs';
import { assertInheritedOfficialEvidence } from './inherited-official-evidence.mjs';
const clone=value=>structuredClone(value);
const PAIR=[
 {path:'src/host/world/ActualLiveAdjudicationFromSqlite.ts',beforeSha256:'b6014827512d4ac75d67e95a5db42f56489f4d98bc1d01c1cad88fddf8b2d262',afterSha256:'c1aefae9c8e3f9ef29977dc24a8dcba56e8e5c913b91941fe2de476ae47c30f2'},
 {path:'src/host/world/ActualLivePlayClosureEvidenceFromSqlite.ts',beforeSha256:'cd169bfcec7325bb598500635b9998473366625433e4484f0d9908ddf2e98c03',afterSha256:'dbe67afbfcad315fe35c212bb640d199f60f80e152eec2b6a0de2540abd05c14'},
];
// Invented semantic receipts only. Exact reviewed Source pairs are required;
// these JSON controls represent no actual replay or domain success.
const paired=()=>{
 const v=fixture(),t=v.config.sourceTransition;
 t.purpose='role_callback_and_closure_paired_read';t.changedProductionFiles=[...clone(PAIR),...t.changedProductionFiles];
 for(const change of PAIR){
  v.officialEvidence.priorSourceManifest.files.push({path:change.path,sha256:change.beforeSha256});
  for(const manifest of [v.currentSourceManifest,v.replaySourceManifest])manifest.files.push({path:change.path,sha256:change.afterSha256});
 }
 v.replayConfig.sourceTransition=clone(t);v.receipt.sourceTransition=clone(t);v.supervisorTerminal.sourceInputAndReceiptAudit.sourceTransition=clone(t);
 v.config.expectedObservationSha256=v.replayConfig.expectedObservationSha256=v.receipt.passes[0].observationSha256;
 v.officialEvidence.config=clone(v.config);v.officialEvidence.currentSourceManifest=clone(v.currentSourceManifest);return v;
};
const input=v=>{v.config=clone(v.replayConfig);v.officialEvidence.config=clone(v.config);return {config:v.config,officialEvidence:v.officialEvidence,currentSourceManifest:v.currentSourceManifest,observed:{currentSourceFilesUnchanged:true,controlHashes:clone(v.config.controlHashes)}};};
const sync=v=>{v.replayConfig.sourceTransition=clone(v.config.sourceTransition);v.receipt.sourceTransition=clone(v.config.sourceTransition);v.supervisorTerminal.sourceInputAndReceiptAudit.sourceTransition=clone(v.config.sourceTransition);v.officialEvidence.config=clone(v.config);v.officialEvidence.currentSourceManifest=clone(v.currentSourceManifest);};
test('admits only the exact reviewed three-file paired input',()=>assert.doesNotThrow(()=>assertOfficialReadReplayInput(input(paired()))));
test('admits the exact paired receipt for a role continuation',()=>assert.doesNotThrow(()=>assertOfficialReadReplayEvidence(paired())));
test('admits the same exact paired receipt for next provenance',()=>{const v=paired();v.config.executionScope='next';sync(v);assert.doesNotThrow(()=>assertOfficialReadReplayEvidence(v));});
test('retains the callback-only input contract',()=>{const v=fixture();assert.doesNotThrow(()=>assertOfficialReadReplayInput(input(v)));});
test('retains the callback-only receipt contract',()=>assert.doesNotThrow(()=>assertOfficialReadReplayEvidence(fixture())));
test('ordinary production continuity still rejects the three-file transition',()=>assert.throws(()=>assertInheritedOfficialEvidence(paired().officialEvidence),/production Source continuity/));
const reject=(name,mutate)=>{
 for(const route of ['input','receipt'])test(`${route} rejects ${name}`,()=>{
  const v=paired(),before=clone(v);mutate(v);sync(v);assert.notDeepStrictEqual(v,before,'rejection must change fixture');
  assert.throws(()=>route==='input'?assertOfficialReadReplayInput(input(v)):assertOfficialReadReplayEvidence(v));
 });
};
reject('three files using the old callback-only purpose',v=>{v.config.sourceTransition.purpose='role_accepted_activity_read_transaction';});
reject('an additional current production path',v=>{v.currentSourceManifest.files.push({path:'src/extra-owner.ts',sha256:'0'.repeat(64)});v.replaySourceManifest.files.push({path:'src/extra-owner.ts',sha256:'0'.repeat(64)});});
for(const path of [...PAIR.map(c=>c.path),'src/host/world/SqliteActualRoleWorkloadStore.ts'])reject(`omitted reviewed path ${path}`,v=>{v.config.sourceTransition.changedProductionFiles=v.config.sourceTransition.changedProductionFiles.filter(c=>c.path!==path);});
for(const change of PAIR)for(const field of ['beforeSha256','afterSha256'])reject(`unreviewed ${change.path} ${field}`,v=>{v.config.sourceTransition.changedProductionFiles.find(c=>c.path===change.path)[field]='0'.repeat(64);});
reject('a repinned unreviewed old adjudication Source',v=>{v.config.sourceTransition.changedProductionFiles[0].beforeSha256='0'.repeat(64);v.officialEvidence.priorSourceManifest.files.find(r=>r.path===PAIR[0].path).sha256='0'.repeat(64);});
reject('a stale target closure owner',v=>{for(const m of [v.currentSourceManifest,v.replaySourceManifest])m.files.find(r=>r.path===PAIR[1].path).sha256=PAIR[1].beforeSha256;});
reject('an unreviewed callback implementation',v=>{v.config.sourceTransition.changedProductionFiles.at(-1).afterSha256='0'.repeat(64);for(const m of [v.currentSourceManifest,v.replaySourceManifest])m.files.find(r=>r.path==='src/host/world/SqliteActualRoleWorkloadStore.ts').sha256='0'.repeat(64);});
reject('a missing comparison observation digest',v=>{delete v.config.expectedObservationSha256;delete v.replayConfig.expectedObservationSha256;});
for(const value of [true,'g'.repeat(64),''])reject(`invalid comparison digest ${JSON.stringify(value)}`,v=>{v.config.expectedObservationSha256=v.replayConfig.expectedObservationSha256=value;});
test('receipt rejects an otherwise valid but wrong comparison digest',()=>{const v=paired();v.config.expectedObservationSha256=v.replayConfig.expectedObservationSha256='0'.repeat(64);sync(v);assert.throws(()=>assertOfficialReadReplayEvidence(v));});
test('receipt rejects differing consumer and replay comparison digests',()=>{const v=paired();v.config.expectedObservationSha256='0'.repeat(64);sync(v);assert.throws(()=>assertOfficialReadReplayEvidence(v));});
