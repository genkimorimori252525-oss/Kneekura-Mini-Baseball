import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { registerHooks } from 'node:module';

const configPath=process.argv[2];assert(isAbsolute(configPath) && normalize(configPath)===configPath && realpathSync(configPath)===configPath);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const configBytes=readFileSync(configPath), c=JSON.parse(configBytes.toString('utf8'));
const directory=dirname(fileURLToPath(import.meta.url));assert.equal(directory,join(c.sourceRoot,'tools/verification/actual-live-pipeline'));
assert.equal(process.version,'v26.10.0');assert.equal(getHeapStatistics().heap_size_limit/1024/1024,288);
assert.deepEqual(process.execArgv,['--max-old-space-size=192'],'unexpected admission CLI flags');
assert(!process.env.NODE_OPTIONS,'admission forbids unpinned preloads');
const retainedLocks=JSON.parse(process.env.BASEBALL_ADMISSION_LOCKS).map(({fd,path})=>{
  assert.equal(readlinkSync(`/proc/self/fd/${fd}`),path);const actual=fstatSync(fd),named=statSync(path);
  assert.equal(actual.dev,named.dev);assert.equal(actual.ino,named.ino);return {fd,path,device:actual.dev,inode:actual.ino};
});
assert.equal(retainedLocks.length,3);
assert.deepEqual(retainedLocks.map(lock=>lock.path).sort(),['/workspace/shared/baseball-light-check.lock','/workspace/shared/baseball-native-aux-check.lock','/workspace/shared/baseball-native-check.lock']);
const manifestBytes=readFileSync(c.sourceManifestPath);assert.equal(digest(manifestBytes),c.sourceManifestSha256);
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const names=['pipeline.mjs','pipeline-common.mjs','pipeline-scope.mjs','physical-producer-evidence.mjs','physical-producer-files.mjs',
  'known-profile-producer-evidence.mjs','known-profile-producer-files.mjs','inherited-official-files.mjs','inherited-official-evidence.mjs',
  'inherited-role-files.mjs','inherited-role-evidence.mjs','official-read-replay-files.mjs','official-read-replay-evidence.mjs'];
const modules=new Map(names.map(name=>{
  const relative=`tools/verification/actual-live-pipeline/${name}`, row=manifest.files.find(value=>value.path===relative);assert(row);
  return [pathToFileURL(join(directory,name)).href,row.sha256];
}));
const moduleBytes=()=>{for(const [url,expected] of modules)assert.equal(digest(readFileSync(fileURLToPath(url))),expected,'admission module changed');};
moduleBytes();
const builtins=new Set(['node:assert/strict','node:crypto','node:fs','node:child_process','node:path','node:util','node:url','node:v8','node:perf_hooks','node:module']);
const loaded=new Set();
registerHooks({resolve(specifier,context,nextResolve){const result=nextResolve(specifier,context);
  assert(modules.has(result.url)||builtins.has(result.url),`prohibited admission import: ${result.url}`);loaded.add(result.url);return result;}});
const runner=join(directory,'pipeline.mjs');process.argv=[process.execPath,runner,'--admission-only',configPath];
await import(pathToFileURL(runner).href);
moduleBytes();assert.equal(digest(readFileSync(configPath)),digest(configBytes));assert.equal(digest(readFileSync(c.sourceManifestPath)),digest(manifestBytes));
assert.equal([...loaded].filter(url=>modules.has(url)).length,names.length);
console.log(JSON.stringify({kind:'protected_actual_role_admission_passed',status:'passed',pid:process.pid,node:process.version,
  heapLimitMiB:getHeapStatistics().heap_size_limit/1024/1024,sourceCommit:c.sourceCommit,sourceManifestSha256:c.sourceManifestSha256,
  originalFileCount:Object.keys(c.inheritedOfficial.files).length,replayFileCount:Object.keys(c.officialReadReplay.files).length,retainedLocks,allowedImportsObserved:[...loaded].sort(),
  sqliteModuleLoaded:false,artifactHelpersImported:0,artifactHelpersExecuted:0,nativeArtifactsOpened:0,inputPinsUnchanged:true}));
