import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {verifyPinnedLiveCore} from './live-debug-core.mjs';

// Recovery metadata/integrity only. This never reruns or relabels game trials.
const base='docs/verification/realism-debug-20261027',task='MB-20261027-REALISM-DEBUG-PLAN',
  read=path=>readFile(resolve(path)),json=async path=>JSON.parse(await read(path)),
  sha=bytes=>createHash('sha256').update(bytes).digest('hex'),checks=[];
function check(name,condition){assert(condition,name);checks.push(name);}
const [current,archive,workflow,natural,failed,runner,passedRunner,agents,plan]=await Promise.all([
  read('docs/ai-continuity/CURRENT.md'),read('docs/ai-continuity/CURRENT_ARCHIVE/2026-10-28-realism-v159-before-v160.md'),
  json(base+'/workflow-recovery-checkpoint-v160.json'),json(base+'/first-pitch-intent-v160-01/report.json'),
  json(base+'/first-pitch-intent-v160-02-swing/report.json'),read('tools/verification/check-first-pitch-intent-v160.mjs'),
  read(resolve(homedir(),'.codex/tmp/mini-baseball-realism-v160/probe-01/harness-source.mjs')),read('AGENTS.md'),
  read('docs/superpowers/plans/2026-10-27-maker-intent-pitch-break-fast-verification.md')]);
const body=current.toString(),start=body.indexOf('## 2026-10-27 新goal:'),end=body.indexOf('## 2026-10-27 V148:',start),section=body.slice(start,end);
check('active task retained',body.includes('current_task: "'+task+'"'));
check('bounded active recovery section',start>=0&&end>start&&section.split('\n').length<=20);
check('old section exact bytes retained',archive.length===15337&&sha(archive)==='19ecb945852cf0e480cc167e8e4b76846d256d8b998c0a1d93d1d81beb78c48f');
check('workflow remains active step007',workflow.status==='active'&&workflow.currentStep.stepId==='step-007'&&workflow.currentStep.status==='in_progress'&&workflow.stateVersion===20);
check('current and workflow next action exact',section.includes('**次の具体操作:** '+workflow.nextAction.description));
check('next action advances to V161-R1',workflow.nextAction.description.startsWith('V161-R1だけを進める。'));
check('completed natural probe not scheduled again',workflow.nextAction.description.includes('V160自然probe/UI監査/強制swing枝は再実行しない'));
check('scope and final GitHub requirement retained',section.includes('最終最新設計GitHub照合')&&section.includes('SIGN自動認定/命名はペナントへ延期'));
check('freshness rule and reopen conditions installed',agents.includes('If a receipt is newer')&&agents.includes('Record that reason before rerunning')&&agents.includes('Do not repeat previously reported explanations'));
check('stale initial Task1 instruction removed',!plan.includes('最初の実行点はTask1の既存harness'));
check('natural diagnostic retains original success scope',natural.pass===true&&natural.comparisons.length===26&&natural.comparisons.every(item=>item.equal)&&natural.traces.length===3&&natural.endPinsEqual===true);
check('initial pitch observation limit retained',natural.traces[0].swingOffered===false&&natural.traces[0].actualContact===null&&natural.traces[2].classification==='foul');
check('failed forced branch retained as failure',failed.pass===false&&failed.error.includes('invalid manager command')&&failed.endPinsEqual===true);
check('runner exact to originally executed source',runner.equals(passedRunner)&&sha(runner)==='707bd142f6febb43cc79e5a94badbb40a90de22aea21fafea122f34085e0b269');
check('runner syntactically valid',spawnSync(process.execPath,['--check','tools/verification/check-first-pitch-intent-v160.mjs'],{encoding:'utf8'}).status===0);
for(const [id,result] of [['f2b74d331f444ac2b37baa799eadb911','PASS'],['17bbe1ea23ac46bfad260385823a78ef','FAIL']]){
  const receipt=await json('docs/ai-continuity/verification-receipts/'+task+'_'+id+'.json'),output=await read(receipt.output_path);
  check('original receipt/log intact '+id,receipt.task_id===task&&receipt.result===result&&sha(output)===receipt.output_sha256);
}
for(const path of ['candidate-pitch-time-shape-native-v159-01','candidate-pitch-time-shape-workbench-v159-01']){
  await verifyPinnedLiveCore({manifestPath:resolve(base,path,'manifest.json')});checks.push('existing source manifest intact '+path);
}
const result={kind:'RECOVERY_METADATA_AND_INTEGRITY_AUDIT_ONLY',pass:true,gameTrialsRerun:0,workflowStateVersion:workflow.stateVersion,
  activeRecoveryLines:section.trimEnd().split('\n').length,archiveSha256:sha(archive),naturalReceipt:'f2b74d331f444ac2b37baa799eadb911',
  forcedBranchRetainedFailure:'17bbe1ea23ac46bfad260385823a78ef',runnerSha256:sha(runner),checks};
await writeFile(resolve(base,'workflow-recovery-v160.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({kind:result.kind,pass:true,checks:checks.length,gameTrialsRerun:0,workflowStateVersion:workflow.stateVersion}));
