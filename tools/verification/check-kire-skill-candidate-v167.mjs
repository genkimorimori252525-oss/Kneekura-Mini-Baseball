import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build, version as esbuildVersion } from 'esbuild';

// Saved metadata only. This runner never invokes a case factory, measurement,
// trajectory, Chrome or Source evaluation API.
assert.equal(process.argv.length,2,'usage: node tools/verification/check-kire-skill-candidate-v167.mjs');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),task='MB-20261027-REALISM-DEBUG-PLAN',
  base='docs/verification/realism-debug-20261027/',parentFolder=base+'kire-saved-onset-v165-01',
  output=base+'kire-skill-candidate-v167-01',out=resolve(root,output),
  receiptPath='docs/ai-continuity/verification-receipts/'+task+'_fb5920e169714677ad1aff3f0e44cbb2.json',
  helperPath='tools/verification/pitch-break-skill-candidate-v167.ts',
  sha=value=>createHash('sha256').update(value).digest('hex'),pins=new Map(),startedAt=new Date().toISOString();
const local=path=>relative(root,path).split(sep).join('/');
async function pinnedRead(path,expected){
  const absolute=resolve(root,path),bytes=await readFile(absolute),pin={bytes:bytes.length,sha256:sha(bytes)};
  if(typeof expected==='string')assert.equal(pin.sha256,expected,'pinned input hash changed: '+path);
  else if(expected!==undefined)assert.deepEqual(pin,expected,'pinned input bytes/hash changed: '+path);
  if(pins.has(absolute))assert.deepEqual(pin,pins.get(absolute),'input changed during diagnosis: '+path);
  pins.set(absolute,pin);return bytes;
}
const parentReportPath=parentFolder+'/report.json',
  parentReport=JSON.parse((await pinnedRead(parentReportPath,
    'cd0cb5cf769f12eb77628f83a624e04c5e0da60bcafc8d615ca3686c762bc423')).toString()),
  receipt=JSON.parse((await pinnedRead(receiptPath,
    '3d2238183b5a2e3ebf72348ea9799f7f05c839251d927aa387c9094bef79fb18')).toString());
assert(parentReport.pass&&parentReport.endPinsEqual,'completed unchanged V165 report required');
assert.equal(receipt.task_id,task);assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);
assert.equal(receipt.receipt_id,task+'_fb5920e169714677ad1aff3f0e44cbb2');
assert.deepEqual(receipt.command,['node','tools/verification/check-kire-saved-onset-v165.mjs']);
const parentStdout=JSON.parse((await pinnedRead(receipt.output_path,receipt.output_sha256)).toString().trim());
const expectedParent={sourceFlightSimulations:0,caseCount:56,pairCount:1540,tripleCount:27720,
  nearAmountDirectionTripleCount:311,primaryQualifiedTripleCount:3,onsetQualifiedTripleCount:0};
for(const [key,value] of Object.entries(expectedParent))assert.equal(parentReport[key],value,'unexpected preserved V165 result: '+key);
assert.equal(parentStdout.cases,56);assert.equal(parentStdout.pairs,1540);assert.equal(parentStdout.triples,27720);
assert.equal(parentStdout.nearTriples,311);assert.equal(parentStdout.primaryCandidates,3);assert.equal(parentStdout.onsetCandidates,0);
assert.equal(parentStdout.sourceFlightSimulations,0);assert.equal(parentStdout.pass,true);
const parentArtifacts={};
for(const [name,pin] of Object.entries(parentReport.artifactPins)){
  assert(pin.path.startsWith(parentFolder+'/'),'parent artifact must stay inside its study');
  const bytes=await pinnedRead(pin.path,{bytes:pin.bytes,sha256:pin.sha256});parentArtifacts[name]=JSON.parse(bytes.toString());
}
const savedCases=parentArtifacts.cases,oldNear=parentArtifacts.nearTriples,provenance=parentArtifacts.provenance;
assert.equal(savedCases.length,56);assert.equal(new Set(savedCases.map(item=>item.id)).size,56);assert.equal(oldNear.length,311);
assert.equal(parentArtifacts.candidates.length,0);assert.equal(parentArtifacts.primarySummary.qualifiedTripleCount,3);
assert.equal(Object.keys(provenance.sharedSourcePins).length,164);assert.equal(provenance.duplicates.length,3);
assert.equal(provenance.sourcePinComparison,'EXACT_SAME_164_SAVED_SOURCE_INPUTS');
assert.equal(provenance.referenceComparison,'EXACT_SAVED_REFERENCE_WITH_COMMON_RELEASE_PV_TREF_GRAVITY_AND_PLANE');
// Preserve the complete existing provenance chain, including original saved
// records. Reading/hashing them does not calculate another flight.
for(const [path,pin] of Object.entries(provenance.inputPins))await pinnedRead(path,pin);
const originalParent=provenance.parents[0],originalReport=JSON.parse((await pinnedRead(originalParent.reportPath)).toString()),
  inputs=savedCases.map(({id,comparison,percentTimes,referenceElapsedSeconds})=>({id,comparison,percentTimes,referenceElapsedSeconds}));
for(const item of inputs){
  assert.equal(item.id,item.comparison.id);assert.equal(item.referenceElapsedSeconds,parentReport.referenceElapsedSeconds);
}
await pinnedRead(fileURLToPath(import.meta.url));
const loaded=new Map(),bundled=await build({absWorkingDir:root,entryPoints:[helperPath],bundle:true,platform:'browser',format:'iife',
  globalName:'KneekuraPitchBreakSkillCandidateV167',target:['es2022'],write:false,metafile:true,legalComments:'none',minify:false,
  plugins:[{name:'pin-v167-saved-only-helper-inputs',setup(builder){
    builder.onLoad({filter:/\.(ts|js|mjs|json)$/},async({path})=>{
      const bytes=await pinnedRead(path),name=local(path),pin=pins.get(resolve(path));
      if(name!==helperPath){
        const expected=name.startsWith('src/')?provenance.sharedSourcePins[name]:originalReport.auxInputs[name];
        assert(expected,'only pinned shared Source or existing helper inputs allowed: '+name);
        assert.deepEqual(pin,expected,'helper dependency differs from saved Source/helper: '+name);
      }
      loaded.set(name,pin);return {contents:bytes,loader:path.endsWith('.ts')?'ts':path.endsWith('.json')?'json':'js'};
    });
  }}],
});
assert.equal(bundled.outputFiles.length,1);
for(const input of Object.keys(bundled.metafile.inputs))assert(loaded.has(input.split(sep).join('/')),'bundle input was not pinned: '+input);
const helperCode=bundled.outputFiles[0].text,context=vm.createContext({});
vm.runInContext(helperCode,context,{timeout:10000});context.__savedInputText=JSON.stringify(inputs);
const analysis=JSON.parse(vm.runInContext(
  'JSON.stringify(KneekuraPitchBreakSkillCandidateV167.analyzePitchBreakSkillCandidatesV167(JSON.parse(__savedInputText)))',context,{timeout:30000}));
assert.equal(analysis.summary.caseCount,56);assert.equal(analysis.pairs.length,1540);assert.equal(analysis.triples.length,27720);
assert.equal(analysis.summary.skillAdmission,false);assert.equal(analysis.summary.baselineGate,'NOT_EVALUATED');
const near=analysis.triples.filter(item=>item.nearAmountAndDirection),key=ids=>JSON.stringify([...ids].sort());
assert.equal(near.length,311);assert.equal(analysis.summary.nearAmountAndDirectionTripleCount,311);
assert.deepEqual(near.map(item=>key(item.caseIds)).sort(),oldNear.map(item=>key(item.caseIds)).sort(),
  'V167 must preserve every V165 near-amount/direction triple');
for(const item of analysis.triples){assert.equal(item.skillAdmission,false);assert.equal(typeof item.modelCandidate,'boolean');}
const candidates=near.filter(item=>item.modelCandidate).sort((a,b)=>key(a.orderedCaseIds).localeCompare(key(b.orderedCaseIds)));
assert.equal(candidates.length,analysis.summary.modelCandidateCount);
for(const [path,pin] of pins){
  const bytes=await readFile(path);assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},pin,'pinned input changed before output: '+path);
}
await mkdir(out); // Refuse replacement of a prior diagnostic.
const save=async(name,value)=>{
  const text=JSON.stringify(value,null,2)+'\n';await writeFile(resolve(out,name),text,{flag:'wx'});
  return {path:output+'/'+name,bytes:Buffer.byteLength(text),sha256:sha(text)};
};
const artifactPins={
  cases:await save('cases.json',inputs),nearTriples:await save('near-triples.json',near),
  candidates:await save('candidates.json',candidates),summary:await save('summary.json',analysis.summary),
  provenance:await save('input-provenance.json',{parentReportPath,parentReceiptPath:receiptPath,parentReceiptId:receipt.receipt_id,
    parentLogPath:receipt.output_path,parentLogSha256:receipt.output_sha256,
    parentResultsPreserved:expectedParent,inputPins:Object.fromEntries([...pins].map(([path,pin])=>[local(path),pin])),
    helperInputs:Object.fromEntries(loaded),inMemoryHelperBundle:{bytes:Buffer.byteLength(helperCode),sha256:sha(helperCode),esbuildVersion},
    invokedApis:['analyzePitchBreakSkillCandidatesV167'],sourceFlightSimulations:0}),
};
const topCandidates=candidates.slice(0,3).map(({orderedCaseIds,observations,reasons})=>({orderedCaseIds,observations,reasons})),
  report={pass:true,scope:'SAVED_NOMINAL_MODEL_CANDIDATE_DIAGNOSIS_NOT_SKILL_ADMISSION',startedAt,finishedAt:new Date().toISOString(),
    runtime:process.version,sourceFlightSimulations:0,caseCount:56,pairCount:1540,tripleCount:27720,
    nearAmountAndDirectionTripleCount:near.length,modelCandidateCount:candidates.length,skillAdmission:false,
    baselineGate:'NOT_EVALUATED',baselineComparison:{status:'UNKNOWN_SOURCE_MISMATCH',usedAsGate:false,
      savedReference:parentReport.originalPublicReference},
    oldV165ResultsPreserved:expectedParent,definition:'UNCHANGED_V158_CLASSIFICATION_AMOUNT_DIRECTION_AND_ADJACENT_TIMING_OR_SCREEN_WITH_P10_INCREASING_INTERVAL_P90_MINUS_P10_DECREASING_AND_LATE20_INCREASING',
    p50OrP90OrderRequired:false,newPerceptionThresholdsAdded:false,candidateOutputOrder:'LEXICOGRAPHIC_CASE_IDS_ONLY_NOT_A_QUALITY_RANK',
    endPinsEqual:true,artifactPins,topCandidates,
    limitations:['MODEL_CANDIDATE_IS_NOT_SKILL_ADMISSION','PERCENTILE_PROJECTION_TIMES_ARE_NOT_FORCE_ONSET',
      'NO_NEW_FLIGHT_NO_NUMERICAL_REFINEMENT_NO_ORDINARY_AUTHORING_OR_EMPIRICAL_VALIDATION']};
await save('report.json',report);
console.log(JSON.stringify({pass:true,sourceFlightSimulations:0,cases:56,pairs:1540,triples:27720,nearTriples:near.length,
  modelCandidates:candidates.length,skillAdmission:false,oldV165Primary:3,oldV165Onset:0,
  baselineComparison:'UNKNOWN_SOURCE_MISMATCH',topCandidates}));
