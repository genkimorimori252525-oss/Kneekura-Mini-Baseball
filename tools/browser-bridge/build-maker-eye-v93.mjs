import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),basePath=resolve('../../outputs/にーくら野球メーカー_v92_変化量と後方軌道版.html'),
 output=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v93_投手目線の軌道版.html'),base=await readFile(basePath,'utf8'),previous=JSON.parse(await readFile(basePath+'.build.json'));
assert.equal(sha(base),previous.sha256);assert.equal(previous.pitcherViewsVersion,92);
const oldPath='docs/demos/baseball-maker-pitcher-views-v92.js',viewPath='docs/demos/baseball-maker-pitcher-views-v93.js',headPath='tools/browser-bridge/live-pitcher-body-head-view-v77.js',
 old=await readFile(oldPath,'utf8'),view=await readFile(viewPath,'utf8'),head=await readFile(headPath,'utf8');
const normal=await readFile(previous.matchRendererSourcePath,'utf8');assert.equal(sha(normal),previous.matchRendererSourceSha256);
assert.equal(sha(old),previous.pitchViewsUiSha256);assert(normal.includes(head),'ordinary renderer must contain the same head helper');assert(!/<\/script/i.test(head+view));
const once=(text,from,to)=>{assert.equal(text.split(from).length,2,'unique marker: '+from.slice(0,70));return text.replace(from,()=>to);};
const html=once(once(base,old,head+'\n'+view),'<title>にーくら野球メーカー v92</title>','<title>にーくら野球メーカー v93</title>'),
 updateMap=map=>Object.fromEntries(Object.entries(map).map(([path,hash])=>path===oldPath?[viewPath,sha(view)]:[path,hash]));
const metadata={...previous,output,bytes:Buffer.byteLength(html),sha256:sha(html),pitcherViewsVersion:93,pitcherEyeVersion:93,
 baseMakerPath:basePath,baseMakerSha256:sha(base),baseRenderedTemplateSha256:previous.renderedTemplateSha256,
 pitchViewsUiSha256:sha(view),makerGuideSources:updateMap(previous.makerGuideSources),pitchMovementSources:updateMap(previous.pitchMovementSources),
 pitcherEyeSources:{[viewPath]:sha(view),[headPath]:sha(head)},pitcherEyeBasis:'FIXED_RELEASE_EYE_SHARED_NORMAL_PITCHER_HEAD',
 sourceCoreChanged:false,builderSha256:sha(await readFile('tools/browser-bridge/build-maker-eye-v93.mjs'))};
delete metadata.renderedTemplateSha256; // This edition postprocesses the recorded v92 artifact, not its template.
await writeFile(output,html);await writeFile(output+'.build.json',JSON.stringify(metadata,null,2)+'\n');
await writeFile(output+'.bundle-inputs.json',await readFile(basePath+'.bundle-inputs.json'));
console.log(JSON.stringify({path:output,sha256:metadata.sha256,coreUnchanged:true,baseMakerSha256:metadata.baseMakerSha256}));
