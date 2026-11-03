import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

// This program consumes saved Source states. It never imports or executes a
// Source simulator, a game Core bundle, or a flight factory.
const root=resolve('.'),base='docs/verification/realism-debug-20261027/',task='MB-20261027-REALISM-DEBUG-PLAN',
  output=process.argv[2]??base+'net-trajectory-matrix-v174-01',out=resolve(output),
  category='NET_INITIAL_TANGENT_TRAJECTORY_ORDER_RESEARCH_ONLY',
  sha=value=>createHash('sha256').update(value).digest('hex'),
  pin=bytes=>({bytes:bytes.length,sha256:sha(bytes)}),
  inside=(parent,path)=>{const r=relative(parent,path);return r!==''&&!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep);},
  pins={},artifacts={},receipts=[],MAX_BYTES=64*1024*1024;
assert(process.argv.length<=3&&inside(root,out),'one new project output folder required');
const physicalRoot=await realpath(root),physicalParent=await realpath(dirname(out));
assert(inside(physicalRoot,physicalParent),'output parent must resolve inside project');
await mkdir(out);
async function readPinned(path,expected){
  const absolute=resolve(path),physical=await realpath(absolute);
  assert(inside(root,absolute)&&inside(physicalRoot,physical)&&!inside(out,absolute),'input escaped project or entered new output');
  assert((await stat(absolute)).size<=MAX_BYTES,'input size bound');
  const bytes=await readFile(absolute),actual=pin(bytes);
  if(typeof expected==='string')assert.equal(actual.sha256,expected,path);
  else if(expected!==undefined)assert.deepEqual(actual,expected,path);
  if(pins[absolute])assert.deepEqual(actual,pins[absolute],'input changed while reading');
  pins[absolute]=actual;return bytes;
}
async function save(name,value){
  const path=resolve(out,name);assert(inside(out,path));
  const text=stringifyDebugRecord(value),bytes=Buffer.from(text+'\n');assert(bytes.length<=MAX_BYTES);
  await writeFile(path,bytes,{flag:'wx'});artifacts[path]=pin(bytes);
  const restored=parseDebugRecord((await readFile(path)).toString('utf8'));
  assert.equal(stringifyDebugRecord(restored),text,'saved JSON exact roundtrip '+name);
  return {path,bytes:bytes.length,sha256:sha(bytes)};
}
async function receipt(path,expected){
  const r=JSON.parse((await readPinned(path,expected)).toString('utf8'));
  assert.equal(r.task_id,task);assert.equal(r.result,'PASS');assert.equal(r.exit_code,0);
  await readPinned(r.output_path,r.output_sha256);
  receipts.push({path,receiptId:r.receipt_id,logSha256:r.output_sha256});return r;
}
async function loadStudy(folder,expectedReport,receiptId,expectedReceipt){
  const report=JSON.parse((await readPinned(folder+'/report.json',expectedReport)).toString('utf8'));
  assert.equal(report.pass,true);assert.equal(report.endPinsEqual,true);
  await receipt('docs/ai-continuity/verification-receipts/'+task+'_'+receiptId+'.json',expectedReceipt);
  return {folder,report};
}
const started=Date.now(),report={pass:false,category,scope:'SAVED_80_SOURCE_SAMPLE_NET_OBSERVATIONS_ONLY',
  newSourceFlights:0,oldSourceFlightsReexecuted:0,currentGameCoreExecuted:false,currentPhysicsAsserted:false,
  runtime:process.version,nativeAdmission:false,skillAdmission:false,uiSelectionImplemented:false,
  legacySelectionV171Changed:false,ownTimingStatus:'POINT_MEASURED_TIMING_NOT_OBSERVED',
  thresholds:{absoluteAmountDifferenceMeters:.02,relativeAmountDifference:.05,directionDifferenceDegrees:5,
    oldReferenceScreenP50Fraction:.05,oldReferenceScreenLate20Fraction:.05,newPerceptionThresholdAdded:false},
  rank:'MAX_MIN_ADJACENT_P10_DELAY_AND_WIDTH_SHORTENING_SECONDS_THEN_MAX_MIN_LATE20_INCREASE_THEN_MIN_MAX_RELATIVE_AMOUNT_DIFFERENCE_THEN_ORDERED_IDS',
  ordering:'STABLE_INCREASING_NET_LATE20',unknowns:['OWN_PLANE_NET_TIME_SERIES_NOT_SAVED',
    'NO_NEW_BROWSER_PARITY_FOR_V172_OBSERVER','NO_HUMAN_PERCEPTION_OR_REAL_PITCH_CALIBRATION','OLD_SOURCE_PINS_NOT_ASSERTED_CURRENT']};

try{
  for(const path of [fileURLToPath(import.meta.url),'tools/verification/live-debug-record.mjs',
    'docs/agent-decisions/2026-10-28-net-trajectory-matrix-v174.md'])await readPinned(path);
  const v169=await loadStudy(base+'kire-gyro-domain-v169-01','81e7ba44e51e4eef1c130b93b666e750ff93e7705dcfccbbe5cda03d5ef9511a',
    '99c626670d5a4a509dcb9f9904301611','adedbeafac9125748761c94732a51e8f6d947bce1596a35c9342626e2a29a7ed'),
    v165=await loadStudy(base+'kire-saved-onset-v165-01','cd0cb5cf769f12eb77628f83a624e04c5e0da60bcafc8d615ca3686c762bc423',
      'fb5920e169714677ad1aff3f0e44cbb2','3d2238183b5a2e3ebf72348ea9799f7f05c839251d927aa387c9094bef79fb18');
  const oldArtifacts={};
  for(const key of ['cases','provenance']){
    const p=v165.report.artifactPins[key];oldArtifacts[key]=parseDebugRecord((await readPinned(p.path,{bytes:p.bytes,sha256:p.sha256})).toString('utf8'));
  }
  assert.equal(oldArtifacts.cases.length,56);assert.equal(v169.report.cases.length,24);
  const parents=new Map();
  for(const spec of oldArtifacts.provenance.parents){
    const p=JSON.parse((await readPinned(spec.reportPath,oldArtifacts.provenance.inputPins[spec.reportPath])).toString('utf8'));
    assert(p.pass&&p.endPinsEqual);await receipt(spec.receiptPath,oldArtifacts.provenance.inputPins[spec.receiptPath]?.sha256);
    parents.set(spec.folder,p);
  }
  const reference=parseDebugRecord((await readPinned(oldArtifacts.provenance.parents[0].referencePath,
    oldArtifacts.provenance.inputPins[oldArtifacts.provenance.parents[0].referencePath])).toString('utf8'));
  const T=reference.referenceElapsedSeconds,initialPV={position:reference.sourceDescriptor.initial.ball.position,
    velocity:reference.sourceDescriptor.initial.ball.velocity};
  assert(Number.isFinite(T)&&T>0);
  const built=await build({entryPoints:['src/integration/browser/PitchTrajectoryShapeV172.ts'],bundle:true,write:false,
    metafile:true,format:'esm',platform:'node',logLevel:'silent'});
  report.observerInputs={};
  for(const path of Object.keys(built.metafile.inputs))report.observerInputs[path]=pin(await readPinned(path));
  const moduleBytes=Buffer.from(built.outputFiles[0].text);report.observerBundleSha256=sha(moduleBytes);
  const {observePitchTrajectoryShapeV172}=await import('data:text/javascript;base64,'+moduleBytes.toString('base64'));
  const loaded=[],duplicates=[];
  async function loadRow(folder,detail,oldOrigin){
    assert.equal(detail.run,'nominal');assert(detail.parity.workerFullTextExact&&detail.parity.jsonFullTextExact);
    const texts={};
    for(const channel of ['input','main','worker','json']){
      const path=resolve(folder,detail.files[channel]);assert(inside(resolve(folder),path));
      const bytes=await readPinned(path,v169.report.artifactPins[path]),text=bytes.toString('utf8').trimEnd();
      assert.equal(sha(text),detail.sha256[channel],path);
      if(channel!=='input')assert.equal(Buffer.byteLength(text),detail.bytes[channel]);
      texts[channel]=text;
    }
    assert.equal(texts.main,texts.worker);assert.equal(texts.main,texts.json);
    if(oldOrigin){assert.equal(sha(texts.main),oldOrigin.mainSha256);assert.equal(sha(texts.input),oldOrigin.inputSha256);}
    const input=parseDebugRecord(texts.input),record=parseDebugRecord(texts.main);
    assert.equal(stringifyDebugRecord(input.reference),stringifyDebugRecord(reference));
    assert.equal(stringifyDebugRecord(input.item.descriptor),stringifyDebugRecord(record.descriptor));
    assert.equal(record.id,input.item.id);assert.equal(record.id,detail.id);
    assert.equal(input.observationIntervals,160);assert.equal(record.observation.referenceElapsedSeconds,T);
    assert.equal(record.descriptor.profile.air.integrationStepTicks,5000);assert.equal(record.effectiveIntegrationStepTicks,5000);
    const samples=record.observation.sourceSamples;
    assert.equal(samples.length,161);assert.equal(samples[0].elapsedSeconds,0);assert.equal(samples.at(-1).elapsedSeconds,T);
    for(const field of ['position','velocity']){
      assert.equal(stringifyDebugRecord(record.descriptor.initial.ball[field]),stringifyDebugRecord(initialPV[field]));
      assert.equal(stringifyDebugRecord(samples[0][field]),stringifyDebugRecord(initialPV[field]));
    }
    return {id:record.id,input,record,origin:{folder,index:detail.index,files:detail.files,sha256:detail.sha256},recordText:texts.main};
  }
  for(const saved of oldArtifacts.cases){
    let first;
    for(const origin of saved.origins){
      const parent=parents.get(origin.parent);assert(parent);
      const matches=parent.cases.filter(x=>x.run==='nominal'&&x.index===origin.index&&x.id===saved.id);assert.equal(matches.length,1);
      const item=await loadRow(origin.parent,matches[0],origin);
      if(first){assert.equal(item.recordText,first.recordText);assert.equal(stringifyDebugRecord(item.input),stringifyDebugRecord(first.input));duplicates.push(item.origin);}
      else first=item;
    }
    loaded.push(first);
  }
  for(const detail of v169.report.cases)loaded.push(await loadRow(v169.folder,detail));
  assert.equal(loaded.length,80);assert.equal(new Set(loaded.map(x=>x.id)).size,80);assert.equal(duplicates.length,3);
  function actualGround(g){
    if(!g||typeof g.actualGroundObserved!=='boolean'||typeof g.actualMarkedCounterfactual!=='boolean'||!Array.isArray(g.actualGroundEventSeconds))
      return {status:'UNKNOWN',parent:g??null};
    return {status:g.actualMarkedCounterfactual?'ACTUAL_MARKED_COUNTERFACTUAL':g.actualGroundObserved||g.actualGroundEventSeconds.length>0?'GROUND_OBSERVED':'NO_ACTUAL_GROUND_REPORTED',
      actualGroundObserved:g.actualGroundObserved,actualMarkedCounterfactual:g.actualMarkedCounterfactual,
      actualGroundEventSeconds:g.actualGroundEventSeconds,parent:g,
      referenceFlagsMeaning:'BASELINE_VIRTUAL_AIR_ONLY_AND_GROUND_IGNORED_DESCRIBE_ANALYTIC_REFERENCE_NOT_ACTUAL_BALL'};
  }
  function endpoint(position,t,frame){
    assert(Number.isFinite(t)&&t>0&&['x','y','z'].every(k=>Number.isFinite(position?.[k])));
    const q=Object.fromEntries(['x','y','z'].map(k=>[k,position[k]-frame.origin[k]-frame.initialVelocity[k]*t])),
      dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,along=dot(q,frame.unitTangent),
      normal=Object.fromEntries(['x','y','z'].map(k=>[k,q[k]-frame.unitTangent[k]*along])),
      coordinates={u:dot(normal,frame.normalU),v:dot(normal,frame.normalV)},amountMeters=Math.hypot(coordinates.u,coordinates.v);
    return {elapsedSeconds:t,position,normalDisplacementWorld:normal,normalCoordinates:coordinates,amountMeters,
      direction:amountMeters>0?{u:coordinates.u/amountMeters,v:coordinates.v/amountMeters}:null};
  }
  const cases=[];
  for(const item of loaded){
    const {record}=item,before=stringifyDebugRecord(record.observation.sourceSamples),
      net=observePitchTrajectoryShapeV172({sourceSamples:record.observation.sourceSamples,referenceElapsedSeconds:T});
    assert.equal(stringifyDebugRecord(record.observation.sourceSamples),before,'saved samples mutated');
    const commonGround=actualGround(record.observation.timingAtReference.groundClassification),
      ownGround=actualGround(record.observation.ownPlate.timingAtOwnPlate?.groundClassification),
      own=record.observation.ownPlate.metrics,
      ownEndpoint=own?.platePosition&&Number.isFinite(own?.flightSeconds)?endpoint(own.platePosition,own.flightSeconds,net.frame):null,
      finalCoordinates=net.raw.at(-1).normalCoordinates,amount=net.timing.finalNormalDisplacementMeters,
      direction=amount>0?{u:finalCoordinates.u/amount,v:finalCoordinates.v/amount}:null;
    cases.push({id:item.id,factors:record.factors,origin:item.origin,sourceDescriptor:record.descriptor,
      netTrajectory:net,commonTime:{status:net.status,actualGround:commonGround,amountMeters:amount,direction,
        p10:net.timing.percentTimes.p10?.elapsedSeconds??null,p50:net.timing.percentTimes.p50?.elapsedSeconds??null,
        p90:net.timing.percentTimes.p90?.elapsedSeconds??null,transitionIntervalSeconds:net.timing.transitionIntervalSeconds,
        late20Fraction:net.timing.late20Percent.projectedFraction},
      ownPlane:{status:'POINT_MEASURED_TIMING_NOT_OBSERVED',endpoint:ownEndpoint,actualGround:ownGround,
        timing:null,fullNetTimeSeriesAvailable:false,parentInducedTimingStatus:record.observation.ownPlate.timingAtOwnPlate?.status??null},
      oldInducedObservationPreserved:{comparison:record.comparison,timingAtReference:record.observation.timingAtReference},
      authority:{newFlight:false,skillAdmission:false,nativeAdmission:false}});
  }
  const relativeDifference=(a,b)=>a===null||b===null||a<1e-6||b<1e-6?null:Math.abs(a-b)/((a+b)/2),
    angle=(a,b)=>a===null||b===null?null:Math.acos(Math.max(-1,Math.min(1,
      (a.u*b.u+a.v*b.v)/(Math.hypot(a.u,a.v)*Math.hypot(b.u,b.v)))))*180/Math.PI,
    pairKey=(i,j)=>i<j?i+':'+j:j+':'+i,pairs=[],pairMap=new Map();
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
    const a=cases[i],b=cases[j],c=a.commonTime,d=b.commonTime,e=a.ownPlane.endpoint,f=b.ownPlane.endpoint,
      commonAbsolute=Math.abs(c.amountMeters-d.amountMeters),commonRelative=relativeDifference(c.amountMeters,d.amountMeters),
      commonAngle=angle(c.direction,d.direction),ownAbsolute=e&&f?Math.abs(e.amountMeters-f.amountMeters):null,
      ownRelative=e&&f?relativeDifference(e.amountMeters,f.amountMeters):null,ownAngle=e&&f?angle(e.direction,f.direction):null,
      commonClassified=c.status==='CLASSIFIED'&&d.status==='CLASSIFIED',
      actualGroundKnownClear=[c.actualGround,d.actualGround,a.ownPlane.actualGround,b.ownPlane.actualGround].every(x=>x.status==='NO_ACTUAL_GROUND_REPORTED'),
      endpointAvailable=e!==null&&f!==null&&ownRelative!==null&&ownAngle!==null,
      absoluteAmountMatched=commonAbsolute<=.02&&ownAbsolute!==null&&ownAbsolute<=.02,
      relativeAmountMatched=commonRelative!==null&&commonRelative<=.05&&ownRelative!==null&&ownRelative<=.05,
      directionMatched=commonAngle!==null&&commonAngle<=5&&ownAngle!==null&&ownAngle<=5,
      near=commonClassified&&actualGroundKnownClear&&endpointAvailable&&absoluteAmountMatched&&relativeAmountMatched&&directionMatched,
      p50Difference=c.p50===null||d.p50===null?null:Math.abs(c.p50-d.p50)/T,
      late20Difference=c.late20Fraction===null||d.late20Fraction===null?null:Math.abs(c.late20Fraction-d.late20Fraction),
      oldScreen=(p50Difference!==null&&p50Difference>=.05)||(late20Difference!==null&&late20Difference>=.05),
      row={caseIndices:[i,j],caseIds:[a.id,b.id],commonClassified,actualGroundKnownClear,ownEndpointAvailable:endpointAvailable,
        commonAbsoluteAmountDifferenceMeters:commonAbsolute,commonRelativeAmountDifference:commonRelative,commonDirectionDifferenceDegrees:commonAngle,
        ownAbsoluteAmountDifferenceMeters:ownAbsolute,ownRelativeAmountDifference:ownRelative,ownDirectionDifferenceDegrees:ownAngle,
        absoluteAmountMatched,relativeAmountMatched,directionMatched,nearAmountAndDirection:near,
        p50FractionDifference:p50Difference,late20FractionDifference:late20Difference,legacyExploratoryScreen:oldScreen,
        ownTimingMeasured:false,skillAdmission:false};
    pairMap.set(pairKey(i,j),row);pairs.push(row);
  }
  const fields=['nearAmountAndDirection','withinCasePercentileOrder','late20StrictlyIncreasing','p10StrictlyIncreasing',
    'transitionIntervalStrictlyDecreasing','legacyAdjacentScreen','netOrderedResearchCandidate'],
    tripleRows=[],nearRows=[],candidateRows=[],legacyRows=[];
  let best=null;
  function triple(indices){
    const pairRows=[[indices[0],indices[1]],[indices[0],indices[2]],[indices[1],indices[2]]].map(([a,b])=>pairMap.get(pairKey(a,b))),
      rows=indices.map(i=>cases[i]),lateAvailable=rows.every(x=>x.commonTime.late20Fraction!==null),
      ordered=lateAvailable?[...indices].sort((a,b)=>cases[a].commonTime.late20Fraction-cases[b].commonTime.late20Fraction):null,
      obs=ordered===null?null:ordered.map(i=>cases[i].commonTime),
      percentilesAvailable=obs!==null&&obs.every(x=>[x.p10,x.p50,x.p90,x.transitionIntervalSeconds].every(Number.isFinite)),
      nearAmountAndDirection=pairRows.every(x=>x.nearAmountAndDirection),
      withinCasePercentileOrder=percentilesAvailable&&obs.every(x=>0<=x.p10&&x.p10<=x.p50&&x.p50<=x.p90&&x.p90<=T),
      late20StrictlyIncreasing=obs!==null&&obs[0].late20Fraction<obs[1].late20Fraction&&obs[1].late20Fraction<obs[2].late20Fraction,
      p10StrictlyIncreasing=percentilesAvailable&&obs[0].p10<obs[1].p10&&obs[1].p10<obs[2].p10,
      transitionIntervalStrictlyDecreasing=percentilesAvailable&&obs[0].transitionIntervalSeconds>obs[1].transitionIntervalSeconds&&obs[1].transitionIntervalSeconds>obs[2].transitionIntervalSeconds,
      legacyAdjacentScreen=ordered!==null&&pairMap.get(pairKey(ordered[0],ordered[1])).legacyExploratoryScreen&&pairMap.get(pairKey(ordered[1],ordered[2])).legacyExploratoryScreen,
      netOrderedResearchCandidate=nearAmountAndDirection&&withinCasePercentileOrder&&late20StrictlyIncreasing&&p10StrictlyIncreasing&&transitionIntervalStrictlyDecreasing,
      score=percentilesAvailable?{minimumAdjacentFourSeconds:Math.min(obs[1].p10-obs[0].p10,obs[2].p10-obs[1].p10,
        obs[0].transitionIntervalSeconds-obs[1].transitionIntervalSeconds,obs[1].transitionIntervalSeconds-obs[2].transitionIntervalSeconds),
        minimumAdjacentLate20Increase:Math.min(obs[1].late20Fraction-obs[0].late20Fraction,obs[2].late20Fraction-obs[1].late20Fraction),
        maximumPairRelativeAmountDifference:pairRows.every(x=>x.commonRelativeAmountDifference!==null&&x.ownRelativeAmountDifference!==null)?
          Math.max(...pairRows.flatMap(x=>[x.commonRelativeAmountDifference,x.ownRelativeAmountDifference])):null}:null;
    return {caseIndices:indices,orderedCaseIndices:ordered,caseIds:indices.map(i=>cases[i].id),orderedCaseIds:ordered?.map(i=>cases[i].id)??null,
      nearAmountAndDirection,withinCasePercentileOrder,late20StrictlyIncreasing,p10StrictlyIncreasing,transitionIntervalStrictlyDecreasing,
      legacyAdjacentScreen,netOrderedResearchCandidate,score,ownTimingMeasured:false,skillAdmission:false};
  }
  function better(a,b){
    if(b===null)return true;
    for(const [key,direction] of [['minimumAdjacentFourSeconds',1],['minimumAdjacentLate20Increase',1],['maximumPairRelativeAmountDifference',-1]]){
      if(a.score[key]!==b.score[key])return direction*(a.score[key]-b.score[key])>0;
    }
    return JSON.stringify(a.orderedCaseIds)<JSON.stringify(b.orderedCaseIds);
  }
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++)for(let k=j+1;k<cases.length;k++){
    const full=triple([i,j,k]);let flags=0;
    fields.forEach((key,bit)=>{assert.equal(typeof full[key],'boolean');if(full[key])flags|=1<<bit;});
    const packed=[i,j,k,...(full.orderedCaseIndices??[-1,-1,-1]),flags],index=tripleRows.length;
    const restored=triple(packed.slice(0,3));
    assert.deepEqual(restored.orderedCaseIndices,packed[3]===-1?null:packed.slice(3,6));
    fields.forEach((key,bit)=>assert.equal(restored[key],(flags&(1<<bit))!==0));
    assert.equal(stringifyDebugRecord(full),stringifyDebugRecord(restored),'lossless all-triple numeric reconstruction');
    tripleRows.push(packed);
    if(full.nearAmountAndDirection)nearRows.push(index);
    if(full.netOrderedResearchCandidate){candidateRows.push(index);if(better(full,best))best=full;}
    if(full.netOrderedResearchCandidate&&full.legacyAdjacentScreen)legacyRows.push(index);
  }
  assert.equal(pairs.length,3160);assert.equal(tripleRows.length,82160);
  await save('reference.json',{reference,initialPV,referenceElapsedSeconds:T});
  await save('cases.json',cases);await save('pairs.json',pairs);
  await save('all-triples-packed.json',{version:'lossless_net_trajectory_triples_v174',category,
    caseIds:cases.map(x=>x.id),rowFields:['i','j','k','orderedI','orderedJ','orderedK','flags'],flagBits:fields,
    numericReconstruction:'EXACT_UNROUNDED_CASE_AND_PAIR_VALUES_WITH_TRIPLE_FUNCTION_IN_PINNED_SCRIPT',
    tripleRows,nearRows,candidateRows,legacyRows,losslessEveryTripleTextExact:true,roundingApplied:false});
  const selected=best===null?null:{...best,selected:best.orderedCaseIndices.map((i,index)=>({role:['KIRE_CIRCLE_RESEARCH_INPUT','KIRE_DOUBLE_CIRCLE_RESEARCH_INPUT','THREATENING_DOUBLE_CIRCLE_RESEARCH_INPUT'][index],
    id:cases[i].id,factors:cases[i].factors,sourceDescriptor:cases[i].sourceDescriptor,origin:cases[i].origin,commonTime:cases[i].commonTime,
    ownPlane:cases[i].ownPlane})),authority:'UNREFINED_SAVED_NET_ORDER_ONLY_NOT_SKILL_OR_UI_ADMISSION',
    legacySelectionV171Replaced:false,newFlightPlannedByThisScript:false};
  await save('ranked-research-inputs.json',{category,rank:report.rank,selected,skillAdmission:false,nativeAdmission:false,
    limitations:report.unknowns});
  report.summary={caseCount:cases.length,pairCount:pairs.length,tripleCount:tripleRows.length,
    commonStatusCounts:cases.reduce((a,c)=>(a[c.commonTime.status]=(a[c.commonTime.status]??0)+1,a),{}),
    ownTimingMeasuredCount:0,ownEndpointMeasuredCount:cases.filter(x=>x.ownPlane.endpoint!==null).length,
    commonGroundCounts:cases.reduce((a,c)=>(a[c.commonTime.actualGround.status]=(a[c.commonTime.actualGround.status]??0)+1,a),{}),
    ownGroundCounts:cases.reduce((a,c)=>(a[c.ownPlane.actualGround.status]=(a[c.ownPlane.actualGround.status]??0)+1,a),{}),
    nearPairCount:pairs.filter(x=>x.nearAmountAndDirection).length,nearTripleCount:nearRows.length,
    netOrderedResearchCandidateCount:candidateRows.length,alsoLegacyExploratoryScreenCount:legacyRows.length,
    selected:best===null?null:{orderedCaseIds:best.orderedCaseIds,score:best.score,legacyAdjacentScreen:best.legacyAdjacentScreen}};
  report.inputReuse={oldUniqueCases:56,newV169SavedCases:24,duplicateParentRowsVerified:duplicates.length,
    allParentMainWorkerJsonExact:true,commonInitialPVAndTrefExact:true,nominalIntegrationStepTicks:5000,sourceSamplesPerCase:161,
    actualGroundParentFlagsSeparateFromAnalyticReference:true};
  report.receipts=receipts;report.inputPins=pins;
  for(const [path,expected]of Object.entries({...pins,...artifacts}))assert.deepEqual(pin(await readFile(path)),expected,'end pin '+path);
  report.endPinsEqual=true;report.pass=true;report.elapsedMilliseconds=Date.now()-started;
  report.artifactPins=artifacts;
  await save('report.json',report);
  console.log(JSON.stringify({pass:true,category,newSourceFlights:0,...report.summary,elapsedMilliseconds:report.elapsedMilliseconds}));
}catch(error){
  report.error=String(error.stack??error);report.inputPins=pins;report.receipts=receipts;report.elapsedMilliseconds=Date.now()-started;
  await save('failure-report.json',report);throw error;
}
