import assert from 'node:assert/strict';
import { stat, lstat, readFile, writeFile, mkdir, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { compilePinnedNativeEntry, fileState } from './verification/native-measurement-probe-support-v183.mjs';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
export const nativeContactReportUsageV192=`Native contact report (Node 26)
  export --database=PATH --career=ID --player=ID --output=REPORT.json
         [--model=MODEL.json] [--policy=POLICY.json] [--projection-revision=N] [--envelope]
  collect --database=PATH --career=ID --player=ID [--calendar-edition=ID]

export opens an existing database read-only and writes a new report file.
collect writes only observation metadata through its existing owner.
No measurement model or numerical calibration is supplied by default.
`;
export function parseNativeContactReportArgsV192(args){
  if(args.length===0||args.length===1&&args[0]==='--help')return {operation:'help'};
  const [operation,...options]=args;
  if(!['export','collect'].includes(operation))throw Error('Expected export or collect operation');
  const names=new Set(['database','career','player',...(operation==='export'?['output','model','policy','projection-revision']:['calendar-edition'])]),values={};
  for(const option of options){
    if(option==='--envelope' && operation==='export'){if(Object.hasOwn(values,'envelope'))throw Error('Duplicate argument: envelope');values.envelope=true;continue;}
    const at=option.indexOf('=');
    if(!option.startsWith('--')||at<3)throw Error('Expected --name=value argument');
    const name=option.slice(2,at),value=option.slice(at+1);
    if(!names.has(name)||Object.hasOwn(values,name)||!value.trim())throw Error('Unknown, duplicate or empty argument: '+name);
    values[name]=value;
  }
  for(const name of ['database','career','player',...(operation==='export'?['output']:[])])
    if(!Object.hasOwn(values,name))throw Error('Missing --'+name);
  const common={operation,database:values.database,career:values.career,player:values.player};
  if(operation==='collect')return {...common,...(values['calendar-edition']?{calendarEdition:values['calendar-edition']}:{})};
  const revision=values['projection-revision']??'0';
  if(!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision)))throw Error('Projection revision must be a nonnegative safe integer');
  return {...common,output:values.output,...(values.model?{model:values.model}:{}),...(values.policy?{policy:values.policy}:{}),projectionRevision:Number(revision),...(values.envelope?{envelope:true}:{})};
}
async function requireAbsent(path){
  try{await lstat(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw Error('Output already exists: '+path);
}
async function checkSourcePins(bundle){
  assert.deepEqual(await fileState(bundle.bundlePath),{exists:true,bytes:bundle.bytes,sha256:bundle.sha256},'compiled runtime changed');
  for(const [path,pin]of Object.entries(bundle.sourcePins))assert.deepEqual(await fileState(resolve(bundle.root,path)),
    {exists:true,bytes:pin.bytes,sha256:pin.sha256},'runtime Source changed: '+path);
}
export async function runNativeContactReportCliV192(args){
  const input=parseNativeContactReportArgsV192(args);
  if(input.operation==='help')return {operation:'help',usage:nativeContactReportUsageV192};
  const database=resolve(input.database),scope={careerId:input.career,playerId:input.player};
  if(!(await stat(database)).isFile())throw Error('An existing regular Native database file is required');
  const output=input.operation==='export'?resolve(input.output):null;
  if(output!==null)await requireAbsent(output);
  const model=input.model?JSON.parse(await readFile(resolve(input.model),'utf8')):null,
    policy=input.policy?JSON.parse(await readFile(resolve(input.policy),'utf8')):null;
  const parent=resolve(repositoryRoot,'dist');await mkdir(parent,{recursive:true});
  const cache=await mkdtemp(resolve(parent,'.native-contact-report-v192-')),bundlePath=resolve(cache,'runtime.mjs');
  let databaseHandle;
  try{
    const bundle=await compilePinnedNativeEntry({root:repositoryRoot,entryPath:'tools/native-contact-report-runtime-v192.ts',outputPath:bundlePath});
    assert(!Object.keys(bundle.sourcePins).some(path=>/\.(?:test|test-support)\.[cm]?[jt]s$/.test(path)),'normal report runtime must not import fixture or test code');
    const runtime=await import(pathToFileURL(bundlePath).href);
    let result;
    if(input.operation==='collect')result=runtime.collectNativeContactReportObservationsV192(database,{scope,
      ...(input.calendarEdition?{careerCalendarEditionId:input.calendarEdition}:{})});
    else{
      databaseHandle=new DatabaseSync(database,{readOnly:true});
      result=input.envelope?runtime.readNativeContactReportEnvelopeV229FromSqlite(databaseHandle,{scope,model,policy,worldRevision:input.projectionRevision})
        :runtime.readNativeContactReportV192FromSqlite(databaseHandle,{scope,model,policy,worldRevision:input.projectionRevision});
      databaseHandle.close();databaseHandle=undefined;
    }
    await checkSourcePins(bundle);
    if(output!==null)await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    const report=input.envelope?result.report:result;
    return {operation:input.operation,scope,...(output===null?{collection:result}:{output,status:report.status,reasons:report.reasons}),
      runtime:{sha256:bundle.sha256,sourceInputs:bundle.inputCount,nodeVersion:bundle.nodeVersion,fixtureImports:false}};
  }finally{
    if(databaseHandle)databaseHandle.close();
    // Only this invocation's one file and empty directory; never recursively remove a computed tree.
    try{await unlink(bundlePath);}catch(error){if(error.code!=='ENOENT')throw error;}
    await rmdir(cache);
  }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{const result=await runNativeContactReportCliV192(process.argv.slice(2));console.log(result.operation==='help'?result.usage:JSON.stringify(result));}
  catch(error){console.error(JSON.stringify({error:String(error.stack??error)}));process.exitCode=1;}
}
