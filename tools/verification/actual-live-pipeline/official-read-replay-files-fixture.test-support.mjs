import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, FILES, OWNER, BEFORE, AFTER, repinPasses } from './official-read-replay-fixture.test-support.mjs';
import { storage, sealOfficial, hash, clone } from './inherited-files-fixture.test-support.mjs';

// Invented in-memory receipt/artifact bytes, never a database or real replay.
// The exact reviewed owner pair is real Source text only, never imported here.
const after = readFileSync(new URL('../../../src/host/world/SqliteActualRoleWorkloadStore.ts', import.meta.url));
const before = Buffer.from(after.toString().replace("readAcceptedActivity:sourceId=>transaction('BEGIN',()=>activityPlan(db,sourceId).participant.activity)",
  'readAcceptedActivity:sourceId=>activityPlan(db,sourceId).participant.activity'));
assert.equal(hash(after), AFTER); assert.equal(hash(before), BEFORE);
export const CONTROLS = { launcher: 'tools/verification/actual-live-pipeline/run-official-read-replay.py',
  runtimeProbe: 'tools/verification/actual-live-pipeline/runtime-probe.cjs', replayRunner: 'tools/verification/actual-live-pipeline/official-read-replay.mjs' };
export const fields = { receipt: 'receipt', stageTerminal: 'stageTerminal', supervisorTerminal: 'supervisorTerminal',
  outerTerminal: 'outerTerminal', configuration: 'replayConfig', sourceManifest: 'replaySourceManifest' };
export const replayInputs = () => {
  const x = storage(), proof = fixture(), official = proof.officialEvidence, files = proof.config.officialReadReplay.files;
  for (const path of Object.values(CONTROLS)) proof.replaySourceManifest.files.push({path,sha256:'0'.repeat(64)});
  proof.currentSourceManifest = {...clone(proof.replaySourceManifest),sourceRoot:'/fixed/consumer',sourceCommit:'3'.repeat(40),sourceTree:'4'.repeat(40)};
  for (const manifest of [official.priorSourceManifest, proof.replaySourceManifest, proof.currentSourceManifest]) {
    x.source(manifest); const bytes=manifest===official.priorSourceManifest?before:after;
    x.bytes.set(`${manifest.sourceRoot}/${OWNER}`,bytes);manifest.files.find(row=>row.path===OWNER).sha256=hash(bytes);
  }
  x.pinBytes(official.config.inheritedOfficial.files.artifact,Buffer.from('invented original official artifact, not SQLite\n'));
  x.wals.set(official.config.inheritedOfficial.files.artifact.path,0);
  proof.replayConfig.controlHashes=Object.fromEntries(Object.entries(CONTROLS).map(([name,path])=>[name,hash(x.bytes.get(`${proof.replaySourceManifest.sourceRoot}/${path}`))]));
  proof.config.sourceRoot=proof.currentSourceManifest.sourceRoot;proof.config.sourceCommit=proof.currentSourceManifest.sourceCommit;
  proof.config.sourceManifestPath='/consumer/source-manifest.json';
  const reseal = () => {
    sealOfficial(official,x);proof.config.inheritedOfficial=clone(official.config.inheritedOfficial);
    proof.replayConfig.inheritedOfficial=clone(proof.config.inheritedOfficial);
    x.pinJson(files.sourceManifest,proof.replaySourceManifest);
    proof.replayConfig.sourceManifestSha256=files.sourceManifest.sha256;
    const identity={sourceRoot:proof.replaySourceManifest.sourceRoot,sourceCommit:proof.replaySourceManifest.sourceCommit,
      sourceTree:proof.replaySourceManifest.sourceTree,sourceManifestSha256:files.sourceManifest.sha256};
    const transition={...proof.config.sourceTransition,fromSourceIdentity:clone(official.officialReceipt.sourceIdentity),toSourceIdentity:clone(identity)};
    proof.config.sourceTransition=clone(transition);proof.replayConfig.sourceTransition=clone(transition);
    x.pinJson(files.configuration,proof.replayConfig);
    Object.assign(proof.receipt,{sourceIdentity:clone(identity),inheritedSourceIdentity:clone(official.officialReceipt.sourceIdentity),
      sourceTransition:clone(transition),originalOfficialBinding:clone(proof.config.inheritedOfficial),
      originalOfficialReceipt:clone(proof.config.inheritedOfficial.files.receipt),inheritedFaultReceipt:clone(proof.config.inheritedOfficial.files.receipt)});
    for(const pass of proof.receipt.passes){pass.artifactSha256Before=pass.artifactSha256After=official.officialReceipt.output.sha256;pass.observation.artifact=clone(official.officialReceipt.output);}
    repinPasses(proof);x.pinJson(files.receipt,proof.receipt);
    const sealed={stage:'official-read-replay',...clone(files.receipt)},inherited=[{stage:'01-official',...clone(proof.config.inheritedOfficial.files.receipt)}];
    Object.assign(proof.stageTerminal,{sourceIdentity:clone(identity),phaseReceipts:[clone(sealed)],inheritedStageReceipts:clone(inherited)});
    x.pinJson(files.stageTerminal,proof.stageTerminal);
    proof.supervisorTerminal.controlHashes=clone(proof.replayConfig.controlHashes);
    Object.assign(proof.supervisorTerminal.sourceInputAndReceiptAudit,{preservedPhaseReceipts:[clone(sealed)],originalOfficialBinding:clone(proof.config.inheritedOfficial),sourceTransition:clone(transition)});
    x.pinJson(files.supervisorTerminal,proof.supervisorTerminal);
    Object.assign(proof.outerTerminal,{sourceCommit:identity.sourceCommit,sourceManifestSha256:identity.sourceManifestSha256,
      configSha256:files.configuration.sha256,references:Object.fromEntries(['receipt','stageTerminal','supervisorTerminal'].map(name=>[name,clone(files[name])]))});
    x.pinJson(files.outerTerminal,proof.outerTerminal);
    const currentPin={path:proof.config.sourceManifestPath};x.pinJson(currentPin,proof.currentSourceManifest);proof.config.sourceManifestSha256=currentPin.sha256;
    official.config=clone(proof.config);official.currentSourceManifest=clone(proof.currentSourceManifest);
    proof.observed={hashes:Object.fromEntries(FILES.map(name=>[name,files[name].sha256])),replaySourceFilesUnchanged:true,currentSourceFilesUnchanged:true,
      controlHashes:clone(proof.replayConfig.controlHashes),artifactSha256:official.officialReceipt.output.sha256,artifactWalBytes:0};
  };
  reseal();return {...x,proof,files,fields,reseal};
};
