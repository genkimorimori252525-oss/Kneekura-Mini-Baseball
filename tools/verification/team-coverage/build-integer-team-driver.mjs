import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
const outfile=resolve(process.argv[2]??'');assert.ok(process.argv[2],'explicit new bundle path required');
assert.ok(!existsSync(outfile)&&!existsSync(outfile+'.manifest.json'),'never replace a pinned bundle');mkdirSync(dirname(outfile),{recursive:true});
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),loaded=new Map();
const result=await build({entryPoints:['tools/verification/team-coverage/integer-team-driver.ts'],outfile,
  bundle:true,platform:'node',format:'esm',packages:'external',target:'node26',sourcemap:false,metafile:true,
  plugins:[{name:'pin-exact-loaded-source-bytes',setup(builder){builder.onLoad({filter:/\.(ts|js|mjs|json)$/},({path})=>{
    const bytes=readFileSync(path),sha256=createHash('sha256').update(bytes).digest('hex');
    const prior=loaded.get(resolve(path));if(prior)assert.equal(prior,sha256,'input changed during build');loaded.set(resolve(path),sha256);
    return {contents:bytes,loader:path.endsWith('.ts')?'ts':path.endsWith('.json')?'json':'js'};
  });}}]});
const files=Object.keys(result.metafile.inputs).sort().map(path=>{const absolute=resolve(path),sha256=loaded.get(absolute);
  assert.ok(sha256,'every input must have exact loaded byte evidence');assert.equal(sha(absolute),sha256,'source changed before manifest close');return {path:absolute,sha256};});
const manifest={bundlePath:outfile,bundleHash:sha(outfile),builtAt:new Date().toISOString(),files,sourceCount:files.length,
  authority:'BUILD_PIN_ONLY_NO_NATIVE_ADMISSION',runtime:process.version};
writeFileSync(outfile+'.manifest.json',JSON.stringify(manifest,null,2),{flag:'wx'});console.log(JSON.stringify({bundlePath:outfile,bundleHash:manifest.bundleHash,sourceCount:files.length}));
