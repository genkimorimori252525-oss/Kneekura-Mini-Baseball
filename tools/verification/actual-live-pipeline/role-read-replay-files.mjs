import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { inheritedFileAdmission, inheritedFileIO } from './inherited-official-files.mjs';
import { readReplayedRoleEvidence } from './inherited-role-files.mjs';

const FILES=['receipt','stageTerminal','supervisorTerminal','outerTerminal','configuration','sourceManifest'];
const CONTROLS={launcher:'run-role-read-replay.py',runtimeProbe:'runtime-probe.cjs',replayRunner:'role-read-replay.mjs'};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const absolute=value=>typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.includes('\0')
  &&posix.isAbsolute(value)&&posix.normalize(value)===value&&value!=='/'
  &&value.split('/').slice(1).every(part=>part&&part!=='.'&&part!=='..');
const keys=(value,names)=>record(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...names].sort());

/** Byte/Source boundary for the existing pure replay verifier. No database or
 * artifact helper is imported. Current Source and all thirty inherited pins
 * are observed independently; the caller must still invoke assertRoleReadReplayEvidence. */
export const readRoleReadReplayEvidence=(config,producerReference,currentSourceManifest,io=inheritedFileIO)=>{
  const a=inheritedFileAdmission('role replay',io),binding=config?.roleReadReplay;
  a.check(record(binding)&&binding.kind==='checked_role_read_replay_v1'&&keys(binding.files,FILES),'file bindings');
  const files=Object.fromEntries(FILES.map(name=>{
    const ref=binding.files[name];a.check(record(ref)&&absolute(ref.path)&&hash(ref.sha256),'file bindings');
    return [name,Object.freeze({path:ref.path,sha256:ref.sha256})];
  }));
  const officialBinding=a.bindings(config.inheritedOfficial,'official'),roleBinding=a.bindings(config.inheritedRole,'role');
  const oldReplay=config.officialReadReplay;
  a.check(record(oldReplay)&&oldReplay.kind==='checked_official_read_replay_v1'&&keys(oldReplay.files,FILES),'file bindings');
  const oldPins=FILES.map(name=>{const ref=oldReplay.files[name];a.check(record(ref)&&absolute(ref.path)&&hash(ref.sha256),'file bindings');return Object.freeze({path:ref.path,sha256:ref.sha256});});
  const currentPin={path:config.sourceManifestPath,sha256:config.sourceManifestSha256};
  a.check(absolute(currentPin.path)&&hash(currentPin.sha256),'file bindings');
  const refs=[...FILES.map(name=>files[name]),...Object.values(roleBinding.files),...Object.values(roleBinding.regressionArtifacts),...Object.values(officialBinding.files),...oldPins];
  a.resolved(refs);
  if(!refs.some(ref=>ref.path===currentPin.path))a.resolved([currentPin]);
  else a.check(refs.find(ref=>ref.path===currentPin.path).sha256===currentPin.sha256,'file bindings');
  const hashes={},documents=Object.fromEntries(FILES.map(name=>[name,a.json(files[name],hashes,name)]));
  for(const value of Object.values(documents))a.check(record(value)&&!['publicationProjection','originalRawReceiptSha256'].some(key=>Object.hasOwn(value,key)),'raw replay evidence');
  const {receipt,stageTerminal,supervisorTerminal,outerTerminal,configuration:replayConfig,sourceManifest:replaySourceManifest}=documents;
  a.check(isDeepStrictEqual(a.bindings(replayConfig.inheritedOfficial,'official'),officialBinding),'file bindings');
  a.check(isDeepStrictEqual(a.bindings(replayConfig.inheritedRole,'role'),roleBinding),'file bindings');
  for(const field of ['officialReadReplay','sourceTransition','expectedObservationSha256'])a.check(isDeepStrictEqual(replayConfig[field],config[field]),'file bindings');
  const replayIdentity=config.roleSourceTransition?.toSourceIdentity;
  a.check(record(replayIdentity)&&replayIdentity.sourceManifestSha256===files.sourceManifest.sha256,'prior Source');
  a.source({...replayIdentity,files},replaySourceManifest,replayConfig,receipt);
  try{
    const observed=currentPin.path===files.sourceManifest.path?replaySourceManifest:a.json(currentPin,{},'currentSourceManifest');
    a.check(isDeepStrictEqual(observed,currentSourceManifest),'current Source');
    a.source({sourceRoot:config.sourceRoot,sourceCommit:config.sourceCommit,sourceManifestSha256:currentPin.sha256,files:{sourceManifest:currentPin}},
      observed,config,{sourceIdentity:{sourceRoot:config.sourceRoot,sourceCommit:config.sourceCommit,
        sourceTree:observed.sourceTree,sourceManifestSha256:currentPin.sha256}});
  }catch(cause){throw new Error('inherited role replay files: current Source',{cause});}
  a.check(keys(replayConfig.controlHashes,Object.keys(CONTROLS)),'replay controls');
  const controlHashes=Object.fromEntries(Object.entries(CONTROLS).map(([name,file])=>{
    const path=`tools/verification/actual-live-pipeline/${file}`,entry=replaySourceManifest.files.find(row=>row.path===path);
    a.check(record(entry)&&hash(replayConfig.controlHashes[name]),'replay controls');
    const measured=io.fileHash(`${replaySourceManifest.sourceRoot}/${path}`);
    a.check(measured===entry.sha256&&measured===replayConfig.controlHashes[name],'replay controls');return [name,measured];
  }));
  const roleEvidence=readReplayedRoleEvidence(config,producerReference,currentSourceManifest,io);
  const observed={hashes,replaySourceFilesUnchanged:true,currentSourceFilesUnchanged:true,controlHashes,
    artifactSha256:roleEvidence.observed.hashes.artifact,artifactWalBytes:roleEvidence.observed.outputWalBytes};
  const referencedFiles=Object.freeze([...FILES.map(name=>Object.freeze({path:files[name].path,sha256:hashes[name]})),...roleEvidence.referencedFiles]);
  return {config,roleEvidence,currentSourceManifest,replaySourceManifest,replayConfig,receipt,stageTerminal,supervisorTerminal,outerTerminal,observed,referencedFiles};
};
