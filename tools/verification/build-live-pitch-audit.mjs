import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync,copyFileSync } from 'node:fs';
import { dirname,resolve,relative,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),work=resolve(root,'..'),directory=resolve(process.argv[2]??''),inside=relative(work,directory);
if(!inside||inside.startsWith('..')||isAbsolute(inside))throw new Error('new workspace work/ build directory required');
mkdirSync(directory);
const outfile=resolve(directory,'audit.mjs'),result=await build({absWorkingDir:root,entryPoints:['tools/verification/live-pitch-audit.ts'],outfile,
  platform:'node',format:'esm',bundle:true,target:'node22',external:['node:*'],metafile:true,logLevel:'silent'}),
  sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex'),inputs=Object.fromEntries(Object.keys(result.metafile.inputs).map(name=>[name,sha(resolve(root,name))]));
for(const [name,hash] of Object.entries(inputs)){const source=resolve(root,name),target=resolve(directory,'frozen-source',name);
  if(sha(source)!==hash)throw new Error('source drift during freeze: '+name);mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);}
writeFileSync(resolve(directory,'build.json'),JSON.stringify({entrySha256:sha(outfile),inputs},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({outfile,inputCount:Object.keys(inputs).length,sha256:sha(outfile)})+'\n');
