import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'..'),manifest=JSON.parse(await readFile(resolve(home,'PACKAGE-MANIFEST.json'),'utf8'));
for(const f of manifest.files){const result=spawnSync('git',['cat-file','blob',':'+f.path],{cwd:root,maxBuffer:32*1024*1024});assert.equal(result.status,0,f.path);assert.equal(createHash('sha256').update(result.stdout).digest('hex'),f.sha256,'Staged bytes: '+f.path);}
console.log(JSON.stringify({pass:true,stagedFileHashes:manifest.files.length}));
