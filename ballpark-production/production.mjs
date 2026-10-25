import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(resolve(home,'SOURCE-MANIFEST.json'),'utf8'));
async function artifact(name){const entry=manifest.files.find(f=>f.path==='ballpark-production/artifacts/'+name);assert(entry);const compressed=await readFile(resolve(root,entry.path));assert.equal(sha(compressed),entry.sha256);const bytes=gunzipSync(compressed);assert.equal(sha(bytes),entry.expandedSha256);return bytes;}
async function output(bytes){const dir=resolve(home,'dist');await mkdir(dir,{recursive:true});const path=resolve(dir,'球場設計室_v3_局所密度版.html');
 let old=null;try{old=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(old){const accepted=manifest.files.find(f=>f.path.endsWith('accepted-studio-v3.html.gz'));let built=null;try{built=JSON.parse(await readFile(resolve(dir,'last-output.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}assert([accepted.expandedSha256,built?.sha256].includes(sha(old)),'Protect locally edited output');}
 await writeFile(path,bytes);await writeFile(resolve(dir,'last-output.json'),JSON.stringify({sha256:sha(bytes),bytes:bytes.length},null,2)+'\n');return path;
}
function execute(args,cwd=root){const r=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});assert.equal(r.status,0,'Command failed: '+args.join(' '));}
const command=process.argv[2];
if(command==='verify'){
 for(const f of manifest.files){const path=resolve(root,f.path);assert(!relative(root,path).startsWith('..'));const b=await readFile(path);assert.equal(b.length,f.bytes,f.path);assert.equal(sha(b),f.sha256,f.path);if(f.path.endsWith('.json'))JSON.parse(b.toString());}
 for(const name of ['frozen-v114.html.gz','accepted-studio-v3.html.gz'])await artifact(name);
 const {russianDomeDesign}=await import('../tools/ballpark-studio/model.mjs');assert.equal(russianDomeDesign().architecture.logo.brightness,.8);
 console.log(JSON.stringify({pass:true,files:manifest.files.length,artifacts:2,grassLogoBrightness:.8}));
}else if(command==='test'){
 const dir=resolve(root,'tools/ballpark-studio'),files=(await readdir(dir)).filter(p=>p.endsWith('.test.mjs')).map(p=>'tools/ballpark-studio/'+p).sort();execute(['--test',...files]);
}else if(command==='extract'){
 const bytes=await artifact('accepted-studio-v3.html.gz');console.log(JSON.stringify({pass:true,output:await output(bytes),sha256:sha(bytes),mode:'ORIGINAL_ACCEPTED_ARTIFACT'}));
}else if(command==='build'){
 const work=resolve(home,'.build/work/mini-baseball'),outputs=resolve(home,'.build/outputs');await mkdir(outputs,{recursive:true});await mkdir(work,{recursive:true});
 await cp(resolve(root,'tools/ballpark-studio'),resolve(work,'tools/ballpark-studio'),{recursive:true});
 await writeFile(resolve(outputs,'ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),await artifact('frozen-v114.html.gz'));
 const label='portable-'+Date.now();execute(['tools/ballpark-studio/build.mjs',label],work);
 const report=JSON.parse(await readFile(resolve(work,'docs/ballpark-studio/evidence/build-'+label+'.json'),'utf8'));
 const bytes=await readFile(report.output);assert.equal(sha(bytes),report.sha256);assert(report.exactRendererReverse);assert.equal(report.sourceCoreChanged,false);
 const path=await output(bytes);await writeFile(resolve(home,'dist/build-report.json'),JSON.stringify({...report,output:path},null,2)+'\n');
 console.log(JSON.stringify({pass:true,output:path,sha256:sha(bytes),mode:'REBUILT_FROM_PUBLISHED_SOURCE',sourceCoreChanged:false}));
}else throw Error('Use: node ballpark-production/production.mjs verify|test|extract|build');
