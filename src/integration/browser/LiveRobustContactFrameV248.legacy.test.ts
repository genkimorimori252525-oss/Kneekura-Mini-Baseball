import {it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

it.runIf(existsSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json'))('keeps default and V244 Host full records and continuation exact against pre-V248 Source',async()=>{
 const old=readFileSync('work/v248-live-pitch-baseline-01/source.start','utf8');expect(createHash('sha256').update(old).digest('hex')).toBe('1fc48dc6142e1dd5da87ff8d896eb8002a5fcef90725a05c3bf242b57d3a18c0');
 const bytes=readFileSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json');expect(createHash('sha256').update(bytes).digest('hex')).toBe('fd32dfd3fd70e8536d212bdea5e8dd7fd6dcf6961f1651f1803234d6efff2da7');
 // @ts-expect-error Existing lossless verification codec is JavaScript.
 const {parseDebugRecord,stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs'),saved=parseDebugRecord(bytes.toString('utf8'));
 const compile=async(legacy:boolean)=>{const result=await build({entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:legacy?[{name:'old-live-source',setup(b){b.onLoad({filter:/LivePitchV1\.ts$/},()=>({contents:old,loader:'ts'}));}}]:[]});const m={exports:{} as any};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,createRequire(import.meta.url));return m.exports;};
 const a=await compile(true),b=await compile(false);for(const command of [saved.step.normalRecord.command,saved.step.trialRecord.command]){const x=a.createLiveBaseballMatchWorkerV116(saved.capture.configuration,saved.step.before),y=b.createLiveBaseballMatchWorkerV116(saved.capture.configuration,saved.step.before);expect(stringifyDebugRecord(x.issuePitch(command))).toBe(stringifyDebugRecord(y.issuePitch(command)));expect(stringifyDebugRecord(x.captureContinuationV116())).toBe(stringifyDebugRecord(y.captureContinuationV116()));}
},180000);
