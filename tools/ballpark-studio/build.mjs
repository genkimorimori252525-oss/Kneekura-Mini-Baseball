import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {build as bundle} from 'esbuild';
import {patchDesignRenderer} from './renderer-patch.mjs';
const label=process.argv[2];assert(/^[a-z0-9-]{1,50}$/.test(label??''),'Unique evidence label required');
const dir='tools/ballpark-studio/',source=resolve('../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),
 output=resolve('../../outputs/球場設計室_v3_局所密度版.html'),evidence='docs/ballpark-studio/evidence',sha=b=>createHash('sha256').update(b).digest('hex'),
 paths=['model.mjs','architecture.mjs','stadium-mesh.mjs','scoreboard.mjs','material-lod.mjs','texture-filter.mjs','crowd.mjs','crowd-tiles.mjs','ground-logo.mjs','surface-layers.mjs','assets/wolf-gold-cutout-v1.png','geometry-window.mjs','studio.mjs','studio.html','studio.css','renderer-patch.mjs','preview-bridge.js','build.mjs'].map(p=>dir+p),
 bytes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await readFile(p)]))),pins=Object.fromEntries(Object.entries(bytes).map(([p,b])=>[p,sha(b)])),
 original=await readFile(source),sourceSha256=sha(original);
assert.equal(sourceSha256,'c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71','Frozen right-portrait V114');
const [appResult,geometryResult]=await Promise.all([
 bundle({entryPoints:[dir+'studio.mjs'],bundle:true,write:false,format:'iife',target:'es2022',logLevel:'silent'}),
 bundle({entryPoints:[dir+'geometry-window.mjs'],bundle:true,write:false,format:'iife',target:'es2022',logLevel:'silent'})]),
 app=appResult.outputFiles[0].text,geometry=geometryResult.outputFiles[0].text,bridge=bytes[dir+'preview-bridge.js'].toString('utf8'),
 patched=patchDesignRenderer(original.toString('utf8'));
const scripts=html=>[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]),
 beforeScripts=scripts(original.toString('utf8')),afterScripts=scripts(patched.html),
 core=beforeScripts.find(s=>s.includes('var KneekuraNativeMatchCore ='));
assert(core);assert(afterScripts.includes(core),'Core is byte-identical');assert.equal(beforeScripts.length,afterScripts.length);
const changed=beforeScripts.flatMap((s,i)=>s===afterScripts[i]?[]:[i]);assert.equal(changed.length,1);assert(beforeScripts[changed[0]].includes('function makeBroadcastRenderer('));
for(const s of [app,geometry,bridge]){assert(!s.includes('</script'));new Script(s);}
let engine=patched.html.replace('</head>','<script id="ballpark-geometry-v1">\n'+geometry+'\n</script>\n</head>')
 .replace('</body>','<script id="ballpark-preview-bridge-v1">\n'+bridge+'\n</script>\n</body>');
const buildInfo={version:3,sourceSha256,sourceCoreSha256:sha(core.endsWith('\n')?core.slice(0,-1):core),sourceCoreChanged:false,
 sharedNormalMatchChanged:false,sourceInputs:pins,rendererScriptIndex:changed[0],fixedGeometryPreserved:true,simulationIntegration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED'};
const encode=v=>JSON.stringify(v).replaceAll('<','\\u003c');
let html=bytes[dir+'studio.html'].toString('utf8');
for(const [key,value]of Object.entries({__STUDIO_CSS__:bytes[dir+'studio.css'].toString('utf8'),__ENGINE_HTML__:encode(engine),__BUILD_INFO__:encode(buildInfo),__LOGO_DATA__:encode('data:image/png;base64,'+bytes[dir+'assets/wolf-gold-cutout-v1.png'].toString('base64')),__STUDIO_APP__:app})){
 assert.equal(html.split(key).length,2,key);html=html.replace(key,()=>value);}
for(const js of scripts(html))new Script(js);
for(const [p,h]of Object.entries(pins))assert.equal(sha(await readFile(p)),h,'Build input stable '+p);
assert.equal(sha(await readFile(source)),sourceSha256);
let exists=false;try{const existing=await readFile(output),old=JSON.parse(await readFile(output+'.build.json','utf8'));assert.equal(sha(existing),old.sha256,'Protect external edits');assert.equal(old.kind,'BALLPARK_STUDIO_V3');exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
const report={pass:true,kind:'BALLPARK_STUDIO_V3',output,sha256:sha(html),bytes:Buffer.byteLength(html),...buildInfo,
 rendererChanges:patched.changes,exactRendererReverse:patched.exactReverse,htmlScriptSyntaxChecked:true};
await mkdir(evidence,{recursive:true});await writeFile(evidence+'/build-'+label+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(output,html,{flag:exists?'w':'wx'});await writeFile(output+'.build.json',JSON.stringify(report,null,2)+'\n',{flag:exists?'w':'wx'});
console.log(JSON.stringify({pass:true,output,sha256:report.sha256,sourceCoreSha256:buildInfo.sourceCoreSha256,rendererOnly:true}));
