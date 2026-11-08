import {build} from 'esbuild';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const directory=resolve(process.argv[2]);
if(!process.argv[2])throw new Error('requires NEW retained runtime directory');
await mkdir(directory,{recursive:false});
const outfile=resolve(directory,'live-match-audit.mjs');
const result=await build({entryPoints:['tools/verification/live-match-audit.ts'],outfile,bundle:true,
  platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'error'});
const verificationFile=resolve(directory,'verify-live-match-recordings.mjs');
const verification=await build({entryPoints:['tools/verification/verify-live-match-recordings.ts'],outfile:verificationFile,bundle:true,
  platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'error'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=[];
const harness=['tools/verification/build-live-match-audit.mjs','tools/verification/run-live-match-population.mjs','tools/verification/verify-live-match-population.mjs'];
for(const path of [...new Set([...Object.keys(result.metafile.inputs),...Object.keys(verification.metafile.inputs),...harness])].sort()){
  const bytes=await readFile(path),copy=resolve(directory,'source',path);
  await mkdir(dirname(copy),{recursive:true});await copyFile(path,copy);inputs.push({path,sha256:sha(bytes)});
}
const measured='docs/demos/measured-bat-motions.json',measuredBytes=await readFile(measured);
const measuredCopy=resolve(directory,'source',measured);await mkdir(dirname(measuredCopy),{recursive:true});await copyFile(measured,measuredCopy);
await writeFile(resolve(directory,'manifest.json'),JSON.stringify({kind:'retained-local-core-match-audit-runtime-v1',
  outfile,bundleSha256:sha(await readFile(outfile)),verificationFile,verificationSha256:sha(await readFile(verificationFile)),inputs,measured:{path:measured,sha256:sha(measuredBytes)},
  nativeAuthentication:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({directory,inputCount:inputs.length,bundleSha256:sha(await readFile(outfile))}));
