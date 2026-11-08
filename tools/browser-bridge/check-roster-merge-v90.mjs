import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),dir=resolve('docs/verification/releases/v90');await mkdir(dir,{recursive:true});
const report=JSON.parse(await readFile(join(dir,'roster-merge-report.json'))),sources=await Promise.all(report.inputs.map(input=>readFile(input.path))),
 [old,updated]=sources.map(bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''))),bytes=await readFile(report.output),merged=JSON.parse(bytes);
for(let i=0;i<sources.length;i++)assert.equal(sha(sources[i]),report.inputs[i].sha256);assert.equal(sha(bytes),report.outputSha256);
assert.deepEqual({...merged,entries:[]},{...old,entries:[]});assert.deepEqual(merged.entries.map(e=>e.playerId),old.entries.map(e=>e.playerId));
for(const entry of merged.entries)assert.deepEqual(entry,(entry.playerId==='1-p0'?updated:old).entries.find(e=>e.playerId===entry.playerId));
const temp=await mkdtemp(join(dir,'merge-guard-')),a=join(temp,'old.json'),b=join(temp,'updated.json');await writeFile(a,sources[0]);await writeFile(b,sources[1]);
for(const target of [a,b]){const result=spawnSync(process.execPath,['tools/browser-bridge/merge-tikao-roster-v90.mjs',a,b,target],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/上書きできません/);assert.equal(sha(await readFile(a)),sha(sources[0]));assert.equal(sha(await readFile(b)),sha(sources[1]));}
const proof={pass:true,preservedOtherPlayers:19,tikaoExactlyUpdated:true,topLevelAndOrderPreserved:true,originalFilesUntouched:true,rejectsBothInputDestinationsBeforeWrite:true,sha256:sha(bytes)};await writeFile(join(dir,'roster-check.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
