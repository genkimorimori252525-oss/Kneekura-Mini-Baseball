// Frozen-presentation seam check only: no compiler, output file or Core run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const read=path=>readFileSync(path,'utf8'),sha=b=>createHash('sha256').update(b).digest('hex'),
 source=read('tools/browser-bridge/build-field-body-release-v105.mjs'),
 base=read('../../outputs/ばせぼーるlv104_TBD_vs_LAD_捕球視線版.html'),
 scripts=html=>[...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi)].map(m=>({tag:m[1],body:m[2],close:m[3]})),
 sourceScripts=scripts(base),oldCoreScripts=sourceScripts.filter(s=>s.body.includes('var KneekuraNativeMatchCore =')),
 frozenGaze=sourceScripts.find(s=>s.tag==='<script id="field-gaze-v99">').body,
 frozenCatalog=sourceScripts.find(s=>s.tag==='<script id="v40-roster-catalog" type="application/json">').body,
 effectiveCatalog=JSON.parse(read('docs/demos/live-game-roster-catalog-v105.json')),
 effectiveGaze=read('tools/browser-bridge/live-field-gaze-v99.js')+'\n'+read('tools/browser-bridge/fielder-body-presentation-v105.js')+'\n'+read('tools/browser-bridge/field-gaze-controls-v99.js')+'\n';
assert.equal(sha(base),'e463dee5435757b23fb8ab6bc3e1ca475ede86ac004df2abec6bb3053feab6e4','Frozen V104 input');
function once(text,before,after,label){const at=text.indexOf(before);assert(at>=0,label+' missing');assert.equal(text.indexOf(before,at+before.length),-1,label+' unique');return text.slice(0,at)+after+text.slice(at+before.length);}
const scope={assert,Buffer,Script:vm.Script,base,oldCoreScripts,sourceScripts,
 core:'// Static seam probe only; this is never emitted.\nvar KneekuraNativeMatchCore = {};',
 frozenGaze,effectiveGaze,frozenCatalog,effectiveCatalog,encode:value=>JSON.stringify(value).replaceAll('<','\\u003c'),scripts,once,sha};
vm.createContext(scope);const from=source.indexOf('let game=base;'),through=source.indexOf('const historicalSourceMapsV104',from);
assert(from>=0&&through>from,'Production patch block must exist');
vm.runInContext(source.slice(from,through)+`
globalThis.proof={reverseMatch:reverse===base,changes:presentationChanges.map(c=>c.label),scriptCount:scripts(game).length};
for(const [i,s] of scripts(game).entries())if(!s.tag.includes('application/json'))new Script(s.body,{filename:'game script '+i});`,scope);
console.log(JSON.stringify({...scope.proof,pass:true,authority:'FROZEN_PRESENTATION_SEAMS_ONLY_NOT_NATIVE_BUILD_OR_BROWSER_RENDER'}));
