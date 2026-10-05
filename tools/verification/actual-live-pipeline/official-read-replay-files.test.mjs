import assert from 'node:assert/strict';
import test from 'node:test';
import { readOfficialReadReplayEvidence } from './official-read-replay-files.mjs';
import { assertOfficialReadReplayEvidence } from './official-read-replay-evidence.mjs';
import { replayInputs, CONTROLS } from './official-read-replay-files-fixture.test-support.mjs';
import { FILES } from './official-read-replay-fixture.test-support.mjs';
import { clone, hash } from './inherited-files-fixture.test-support.mjs';
const run=x=>readOfficialReadReplayEvidence(x.proof.config,x.proof.officialEvidence.producerReference,x.proof.currentSourceManifest,x.io);
const reject=(name,mutate,reason,inspect=()=>{})=>test(`replay files reject ${name}`,()=>{
 const x=replayInputs();mutate(x);assert.throws(()=>run(x),typeof reason==='string'?{message:`inherited replay files: ${reason}`}:reason);inspect(x);
});
const noBytes=x=>assert(!x.reads.some(r=>['readBytes','fileHash','walBytes'].includes(r.operation)),'resolve all authorized pins before reading bytes');
test('invented replay fixture has coherent actual byte pins and independently valid semantics',()=>{
 const x=replayInputs();assert.doesNotThrow(()=>assertOfficialReadReplayEvidence(x.proof));
 for(const ref of [...Object.values(x.files),...Object.values(x.proof.config.inheritedOfficial.files)])assert.equal(hash(x.bytes.get(ref.path)),ref.sha256);
});
test('loads six replay files and original eight with measured observations and semantic validity',()=>{
 const x=replayInputs(),result=run(x);assert.doesNotThrow(()=>assertOfficialReadReplayEvidence(result));
 for(const [name,field]of Object.entries(x.fields))assert.deepEqual(result[field],x.proof[field],name);
 assert.deepEqual(result.observed,x.proof.observed);assert.equal(result.officialEvidence.referencedFiles.length,8);
 assert.deepEqual(result.referencedFiles,[...Object.values(x.files),...Object.values(x.proof.config.inheritedOfficial.files)]);
});
test('returns detached immutable measured references',()=>{
 const x=replayInputs(),result=run(x),saved=clone(result.referencedFiles);assert(Object.isFrozen(result.referencedFiles));assert(result.referencedFiles.every(Object.isFrozen));
 x.files.receipt.sha256='0'.repeat(64);assert.deepEqual(result.referencedFiles,saved);
});
test('uses one pinned byte read per replay JSON and streams the original artifact hash',()=>{
 const x=replayInputs(),read=x.io.readBytes,seen=new Set(),jsonPaths=new Set(Object.values(x.files).map(ref=>ref.path));
 const artifact=x.proof.config.inheritedOfficial.files.artifact.path;
 x.io.readBytes=path=>{assert.notEqual(path,artifact);if(jsonPaths.has(path)){assert(!seen.has(path));seen.add(path);}return read(path);};
 run(x);assert.equal(seen.size,6);assert(x.reads.some(r=>r.operation==='fileHash'&&r.path===artifact));
});
test('audits all original, replay and current Source bytes and runtime control modules',()=>{
 const x=replayInputs();run(x);
 for(const m of [x.proof.officialEvidence.priorSourceManifest,x.proof.replaySourceManifest,x.proof.currentSourceManifest]){
  for(const op of ['sourceHead','sourceTree','sourceFilePaths','sourceChangedPaths'])assert(x.reads.some(r=>r.operation===op&&r.path===m.sourceRoot));
  for(const row of m.files)assert(x.reads.some(r=>r.operation==='readBytes'&&r.path===`${m.sourceRoot}/${row.path}`));
 }
 for(const path of Object.values(CONTROLS))assert(x.reads.some(r=>r.path===`${x.proof.replaySourceManifest.sourceRoot}/${path}`));
});
for(const name of FILES)reject(`missing ${name}`,x=>{delete x.files[name];},'file bindings',noBytes);
reject('an unknown file role',x=>{x.files.extra=clone(x.files.receipt);},'file bindings',noBytes);
reject('a path aliased to original official evidence',x=>{x.files.receipt=clone(x.proof.config.inheritedOfficial.files.receipt);},'file bindings',noBytes);
reject('a noncanonical path',x=>{x.files.receipt.path='/replay/../receipt.json';},'file bindings',noBytes);
reject('an invalid digest',x=>{x.files.receipt.sha256='A'.repeat(64);},'file bindings',noBytes);
for(const name of ['receipt','sourceManifest'])reject(`resolved ${name} alias`,x=>{x.realPaths.set(x.files[name].path,'/different');},'file bindings',noBytes);
reject('an original official artifact alias before replay JSON',x=>{x.realPaths.set(x.proof.config.inheritedOfficial.files.artifact.path,'/different');},'file bindings',noBytes);
for(const name of FILES)reject(`changed ${name} bytes`,x=>{x.bytes.set(x.files[name].path,Buffer.concat([x.bytes.get(x.files[name].path),Buffer.from(' ')]));},'file hash');
for(const name of FILES)reject(`repinned publication projection ${name}`,x=>{x.pinJson(x.files[name],{...x.proof[x.fields[name]],publicationProjection:true});},'raw replay evidence');
reject('foreign original bindings declared by replay configuration',x=>{x.proof.replayConfig.inheritedOfficial.files.receipt.path='/foreign/receipt.json';x.pinJson(x.files.configuration,x.proof.replayConfig);},'file bindings');
reject('nonempty official WAL',x=>{x.wals.set(x.proof.config.inheritedOfficial.files.artifact.path,1);},/inherited official files: output WAL/);
reject('changed replay HEAD',x=>{x.sources.get(x.proof.replaySourceManifest.sourceRoot).head='0'.repeat(40);},'prior Source');
reject('missing replay Source file',x=>{x.sources.get(x.proof.replaySourceManifest.sourceRoot).paths.pop();},'prior Source');
reject('changed replay Source bytes',x=>{const m=x.proof.replaySourceManifest;x.bytes.set(`${m.sourceRoot}/${m.files[0].path}`,Buffer.from('changed'));},'prior Source');
reject('repinned unsafe replay manifest child',x=>{x.proof.replaySourceManifest.files[0].path='../escape.ts';x.reseal();},'prior Source');
reject('changed current Source bytes',x=>{const m=x.proof.currentSourceManifest;x.bytes.set(`${m.sourceRoot}/${m.files[0].path}`,Buffer.from('changed'));},'current Source');
reject('an unpinned control module',x=>{x.proof.replayConfig.controlHashes.launcher='0'.repeat(64);x.pinJson(x.files.configuration,x.proof.replayConfig);},'replay controls');
