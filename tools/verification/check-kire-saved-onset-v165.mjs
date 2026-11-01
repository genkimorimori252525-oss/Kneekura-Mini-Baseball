import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

// Saved-data diagnosis only. No factory, measurement, trajectory or Source
// evaluation API is called. The pinned parent bundle supplies its pure screen.
assert.equal(process.argv.length, 2, 'usage: node tools/verification/check-kire-saved-onset-v165.mjs');
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..'), task='MB-20261027-REALISM-DEBUG-PLAN',
  base='docs/verification/realism-debug-20261027/', output=base+'kire-saved-onset-v165-01', out=resolve(root,output),
  receiptBase='docs/ai-continuity/verification-receipts/', sha=value=>createHash('sha256').update(value).digest('hex'),
  pins=new Map(), parentSpecs=[
    {folder:base+'pitch-break-kire-levels-v162-01',count:40,receiptId:task+'_c5d17d988047434b826e77a34de12757',
      reportSha256:'964d40823ae90a54fbf5fe8811138ef2f2e20d9251e3c3b152102745ab8779ee',
      receiptSha256:'e827efb78281d7860b431b8cea665c4c9c9e1c4485ddf000fc3bcdbf986b36b8'},
    {folder:base+'pitch-break-kire-phase-calibration-v163-01',count:19,receiptId:task+'_dc3cf43adca544c0ae6f4d528453df0c',
      reportSha256:'181ba1c959e418362d341acb6cf4ae46307c929de265f5d5b47c4c3e3f803e00',
      receiptSha256:'2509255a342f5b821ca88c8e859b3ee6fda3464dd6b3b26df2b3002031308f1d'},
  ], startedAt=new Date().toISOString();
await mkdir(out); // A second run cannot overwrite the first diagnostic.
const save=async(name,value)=>{
  const text=JSON.stringify(value,null,2)+'\n';await writeFile(resolve(out,name),text,{flag:'wx'});
  return {path:output+'/'+name,bytes:Buffer.byteLength(text),sha256:sha(text)};
};
async function pinnedRead(path,expectedSha256){
  const absolute=resolve(root,path),bytes=await readFile(absolute),pin={bytes:bytes.length,sha256:sha(bytes)};
  if(expectedSha256!==undefined)assert.equal(pin.sha256,expectedSha256,'pinned bytes changed: '+path);
  if(pins.has(absolute))assert.deepEqual(pin,pins.get(absolute),'input changed during read: '+path);
  pins.set(absolute,pin);return bytes;
}
const sourcePins=report=>Object.fromEntries(Object.entries(report.auxInputs).filter(([path])=>path.startsWith('src/')).sort(([a],[b])=>a.localeCompare(b))),
  parents=[];
for(const spec of parentSpecs){
  const reportPath=spec.folder+'/report.json',report=JSON.parse((await pinnedRead(reportPath,spec.reportSha256)).toString()),
    receiptPath=receiptBase+spec.receiptId+'.json',receipt=JSON.parse((await pinnedRead(receiptPath,spec.receiptSha256)).toString());
  assert(report.pass&&report.endPinsEqual,'completed unchanged parent report required');
  assert.equal(receipt.task_id,task);assert.equal(receipt.receipt_id,spec.receiptId);assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);
  assert.equal(receipt.command.at(-1),spec.folder,'parent receipt must run the stated output');
  await pinnedRead(receipt.output_path,receipt.output_sha256);
  const referencePath=spec.folder+'/measurement-reference.json',referenceBytes=await pinnedRead(referencePath),
    reference=parseDebugRecord(referenceBytes.toString().trimEnd());
  assert.equal(Object.keys(sourcePins(report)).length,164,'same 164 Source inputs required');
  parents.push({...spec,report,reportPath,receiptPath,receipt,referencePath,reference});
}
assert.deepEqual(sourcePins(parents[0].report),sourcePins(parents[1].report),'saved parent Source inputs differ');
assert.equal(parents[0].report.nativeSha256,parents[1].report.nativeSha256);assert.equal(parents[0].report.workbenchSha256,parents[1].report.workbenchSha256);
assert.deepEqual(parents[0].reference,parents[1].reference,'same saved release PV, Tref, gravity and measurement plane required');
assert.equal(parents[1].report.parentProvenance.receiptId,parents[0].receiptId);
assert.equal(parents[1].report.parentProvenance.logSha256,parents[0].receipt.output_sha256);
for(const path of [parents[0].reportPath,parents[0].receiptPath,parents[0].receipt.output_path,parents[0].referencePath]){
  const expected=parents[1].report.startPins[resolve(root,path)];assert(expected,'child must pin parent provenance: '+path);
  assert.deepEqual(pins.get(resolve(root,path)),expected,'child parent-provenance pin differs: '+path);
}
const commonReference=parents[0].reference,records=new Map(),duplicates=[];
for(const parent of parents){
  const rows=parent.report.cases.filter(item=>item.run==='nominal');assert.equal(rows.length,parent.count);
  for(const row of rows){
    const inputPath=parent.folder+'/'+row.files.input,recordPath=parent.folder+'/'+row.files.main,
      inputBytes=await pinnedRead(inputPath),recordBytes=await pinnedRead(recordPath),
      inputText=inputBytes.toString().trimEnd(),recordText=recordBytes.toString().trimEnd();
    assert.equal(sha(inputText),row.sha256.input,'saved nominal input hash differs: '+row.id);
    assert.equal(sha(recordText),row.sha256.main,'saved nominal main hash differs: '+row.id);
    assert.equal(Buffer.byteLength(recordText),row.bytes.main);
    assert.equal(row.sha256.main,row.sha256.worker);assert.equal(row.sha256.main,row.sha256.json);
    const input=parseDebugRecord(inputText),record=parseDebugRecord(recordText);
    assert.deepEqual(input.reference,commonReference,'case uses different reference: '+row.id);
    assert.equal(input.observationIntervals,160);assert.equal(input.item.id,row.id);assert.equal(record.id,row.id);
    assert.deepEqual(record.descriptor,input.item.descriptor);assert.deepEqual(record.factors,input.item.factors);
    assert.equal(record.descriptor.profile.air.integrationStepTicks,5000);assert.equal(record.effectiveIntegrationStepTicks,5000);
    assert.equal(record.observation.referenceElapsedSeconds,commonReference.referenceElapsedSeconds);
    const timing=record.observation.timingAtReference,percentTimes=Object.fromEntries(['p10','p50','p90'].map(key=>
      [key,timing.percentTimes[key]===null?null:timing.percentTimes[key].elapsedSeconds]));
    assert.equal(record.comparison.commonTime.status,timing.status);
    assert.equal(record.comparison.commonTime.p50Fraction,percentTimes.p50===null?null:percentTimes.p50/commonReference.referenceElapsedSeconds);
    const entry={id:row.id,comparison:record.comparison,percentTimes,referenceElapsedSeconds:commonReference.referenceElapsedSeconds,
      origins:[{parent:parent.folder,recordPath,inputPath,index:row.index,mainSha256:row.sha256.main,inputSha256:row.sha256.input}],
      inputText,recordText,forceAtRelease:record.observation.forceSeries[0]};
    if(records.has(row.id)){
      const previous=records.get(row.id);assert.equal(previous.inputText,inputText,'duplicate ID has different input');
      assert.equal(previous.recordText,recordText,'duplicate ID has different actual observations');
      previous.origins.push(...entry.origins);duplicates.push({id:row.id,origins:previous.origins});
    }else records.set(row.id,entry);
  }
}
assert.equal(records.size,56);assert.equal(duplicates.length,3);
// Separate descriptive reference columns only; these values are never a gate
// for the unchanged three-case screen or the added percentile-order condition.
const originalFolder=base+'pitch-maker-time-shape-v159-02',
  originalReport=JSON.parse((await pinnedRead(originalFolder+'/report.json',
    'c5788d3e7be278f2a21a95edc8cff147d7fab6ca9ae61948b8fab682255587d7')).toString()),
  originalRecord=parseDebugRecord((await pinnedRead(originalFolder+'/main/original-reference-workbench.json',
    'a2453e8c45a1dba8bdb21790f0157eb4a878e0d542746e73bcb312cfb1db55d3')).toString().trimEnd()),
  original=originalRecord.data,originalTiming=original.result.metrics.breakTimingV155.commonTime.airlessGravity;
assert(originalReport.pass&&originalReport.endPinsEqual,'completed saved original public reference required');
assert.equal(original.referenceElapsedSeconds,commonReference.referenceElapsedSeconds,'reference comparison requires the same Tref');
for(const field of ['position','velocity'])assert.deepEqual(original.descriptor.initial.ball[field],commonReference.sourceDescriptor.initial.ball[field],
  'original public reference release PV differs');
const originalPublicReference={status:'SAVED_PUBLIC_REFERENCE_PINNED_NOT_RECOMPUTED',folder:originalFolder,
  recordPath:originalFolder+'/main/original-reference-workbench.json',referenceElapsedSeconds:original.referenceElapsedSeconds,
  percentTimes:Object.fromEntries(['p10','p50','p90'].map(key=>[key,originalTiming.percentTimes[key]?.elapsedSeconds??null])),
  late20Fraction:originalTiming.late20Percent.projectedFraction,finalAmountMeters:originalTiming.finalXY.normMeters,
  sameSavedSourcePins:JSON.stringify(sourcePins(originalReport))===JSON.stringify(sourcePins(parents[0].report)),
  interpretation:'DESCRIPTIVE_SEPARATE_COLUMNS_ONLY_FINAL_AMOUNTS_DIFFER_NO_OVERALL_IMPROVEMENT_INFERRED'};
for(const entry of records.values())entry.versusOriginalPublicReference={
  percentileDeltaSeconds:Object.fromEntries(['p10','p50','p90'].map(key=>[key,entry.percentTimes[key]===null||originalPublicReference.percentTimes[key]===null?
    null:entry.percentTimes[key]-originalPublicReference.percentTimes[key]])),
  late20Fraction:entry.comparison.commonTime.late20Fraction,late20DeltaFraction:entry.comparison.commonTime.late20Fraction===null||originalPublicReference.late20Fraction===null?
    null:entry.comparison.commonTime.late20Fraction-originalPublicReference.late20Fraction};
const bundlePath=parents[0].folder+'/pitch-break-kire-levels-v162.js',
  bundle=await pinnedRead(bundlePath,parents[0].report.auxSha256),bundlePin=parents[0].report.auxArtifactPins[resolve(root,bundlePath)];
assert.deepEqual(pins.get(resolve(root,bundlePath)),bundlePin,'saved analysis bundle artifact pin differs');
const codecPath='tools/verification/live-debug-record.mjs',codecPin=parents[0].report.startPins[resolve(root,codecPath)];
assert(codecPin,'parent must pin its inert-data codec');await pinnedRead(codecPath,codecPin.sha256);
await pinnedRead(fileURLToPath(import.meta.url));
const context=vm.createContext({}),comparisons=[...records.values()].map(item=>item.comparison);
vm.runInContext(bundle.toString(),context,{timeout:10000});
vm.runInContext('globalThis.__exact='+stringifyDebugRecord.toString()+';globalThis.__parse='+parseDebugRecord.toString()+';',context,{timeout:10000});
context.__comparisonText=stringifyDebugRecord(comparisons);
const primary=parseDebugRecord(vm.runInContext('__exact(KneekuraPitchBreakKireLevelsV162.analyzePitchBreakKireLevelsV162(__parse(__comparisonText)))',context,{timeout:30000}));
assert.equal(primary.summary.caseCount,56);assert.equal(primary.pairs.length,1540);assert.equal(primary.triples.length,27720);
const pairKey=ids=>JSON.stringify([...ids].sort()),pairByIds=new Map(primary.pairs.map(pair=>[pairKey([pair.caseAId,pair.caseBId]),pair])),
  nearTriples=primary.triples.filter(item=>item.nearAmountAndDirection).map(triple=>{
    const orderedCaseIds=triple.orderedCaseIds,ordered=orderedCaseIds===null?null:orderedCaseIds.map(id=>records.get(id)),
      percentOrder=Object.fromEntries(['p10','p50','p90'].map(key=>[key,ordered!==null&&ordered.every(item=>item.percentTimes[key]!==null)&&
        ordered[0].percentTimes[key]<ordered[1].percentTimes[key]&&ordered[1].percentTimes[key]<ordered[2].percentTimes[key]])),
      pairs=[[0,1],[0,2],[1,2]].map(([i,j])=>pairByIds.get(pairKey([triple.caseIds[i],triple.caseIds[j]]))),
      maximumRelativeAmountDifference=Math.max(...pairs.flatMap(pair=>[pair.commonTimeRelativeAmountDifference,pair.samePlaneRelativeAmountDifference])),
      qualified=triple.qualified&&Object.values(percentOrder).every(Boolean),reasons=[...triple.reasons];
    for(const key of ['p10','p50','p90'])if(!percentOrder[key])reasons.push(key.toUpperCase()+'_NOT_STRICTLY_INCREASING_IN_PRIMARY_STRENGTH_ORDER');
    return {...triple,primaryQualified:triple.qualified,qualified,percentOrder,maximumRelativeAmountDifference,reasons,
      orderedPercentTimes:ordered===null?null:ordered.map(item=>({id:item.id,...item.percentTimes,
        late20Fraction:item.comparison.commonTime.late20Fraction,versusOriginalPublicReference:item.versusOriginalPublicReference}))};
  }),candidates=nearTriples.filter(item=>item.qualified).sort((a,b)=>a.maximumRelativeAmountDifference-b.maximumRelativeAmountDifference||
    JSON.stringify(a.orderedCaseIds).localeCompare(JSON.stringify(b.orderedCaseIds)));
const artifactPins={
  cases:await save('cases.json',[...records.values()].map(({inputText,recordText,forceAtRelease,...item})=>({...item,
    forceAtRelease:{elapsedSeconds:forceAtRelease.elapsedSeconds,projected:forceAtRelease.projected}}))),
  nearTriples:await save('near-triples.json',nearTriples),candidates:await save('candidates.json',candidates),
  primarySummary:await save('primary-summary.json',primary.summary),
};
for(const [path,pin] of pins){
  const bytes=await readFile(path);assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},pin,'input changed during diagnosis: '+path);
}
const inputPins=Object.fromEntries([...pins].map(([path,pin])=>[relative(root,path).split(sep).join('/'),pin])),
  provenancePin=await save('input-provenance.json',{parents:parents.map(({folder,reportPath,receiptPath,receipt,referencePath})=>({
    folder,reportPath,receiptPath,receiptId:receipt.receipt_id,logPath:receipt.output_path,logSha256:receipt.output_sha256,referencePath,
  })),inputPins,duplicates,sharedSourcePins:sourcePins(parents[0].report),sourcePinComparison:'EXACT_SAME_164_SAVED_SOURCE_INPUTS',
    referenceComparison:'EXACT_SAVED_REFERENCE_WITH_COMMON_RELEASE_PV_TREF_GRAVITY_AND_PLANE',
    invokedParentApis:['analyzePitchBreakKireLevelsV162']}),
  report={pass:true,scope:'SAVED_NOMINAL_DATA_ONSET_ORDER_DIAGNOSIS_NOT_SKILL_OR_REAL_PITCH_ADMISSION',startedAt,finishedAt:new Date().toISOString(),
    runtime:process.version,sourceFlightSimulations:0,caseCount:56,readParentRows:59,duplicateCaseCount:3,pairCount:primary.pairs.length,
    tripleCount:primary.triples.length,nearAmountDirectionTripleCount:nearTriples.length,primaryQualifiedTripleCount:primary.summary.qualifiedTripleCount,
    onsetQualifiedTripleCount:candidates.length,addedCondition:'P10_P50_P90_ALL_STRICTLY_INCREASING_IN_EXISTING_LATE20_P50_STRENGTH_ORDER',
    thresholds:'UNCHANGED_PINNED_V162_ANALYZER_ABSOLUTE_AND_RELATIVE_AMOUNT_DIRECTION_AND_ADJACENT_TIMING_OR_SCREEN',
    candidateSort:'LOWEST_WORST_PAIR_RELATIVE_AMOUNT_DIFFERENCE_THEN_ORDERED_IDS',endPinsEqual:true,
    referenceElapsedSeconds:commonReference.referenceElapsedSeconds,originalPublicReference,artifactPins:{...artifactPins,provenance:provenancePin},
    limitations:['PERCENT_TIMES_ARE_PROJECTION_THRESHOLD_TIMES_NOT_FORCE_ONSET',
      'NO_NEW_FLIGHT_NO_DENSE_OR_HALF_STEP_NO_ORDINARY_AUTHORING_CONFIRMATION',
      'SAVED_SOURCE_MODEL_ONLY_NOT_EMPIRICAL_OR_GLOBAL_PITCH_CALIBRATION'],
    topCandidates:candidates.slice(0,5).map(({orderedCaseIds,orderedPercentTimes,maximumRelativeAmountDifference})=>({orderedCaseIds,orderedPercentTimes,maximumRelativeAmountDifference}))};
await save('report.json',report);
console.log(JSON.stringify({pass:true,sourceFlightSimulations:0,cases:report.caseCount,pairs:report.pairCount,triples:report.tripleCount,
  nearTriples:report.nearAmountDirectionTripleCount,primaryCandidates:report.primaryQualifiedTripleCount,onsetCandidates:report.onsetQualifiedTripleCount,
  topCandidates:candidates.slice(0,3).map(item=>({orderedCaseIds:item.orderedCaseIds,maximumRelativeAmountDifference:item.maximumRelativeAmountDifference,
    percentTimes:item.orderedPercentTimes.map(({p10,p50,p90,late20Fraction})=>({p10,p50,p90,late20Fraction}))}))}));
