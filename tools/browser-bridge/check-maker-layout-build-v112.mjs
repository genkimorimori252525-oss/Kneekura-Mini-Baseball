import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {makerLayoutAssetsV112} from './maker-layout-v112.mjs';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});const stage=resolve('../../outputs/v112-generator-check');await mkdir(stage,{recursive:true});const path=resolve(stage,'fresh-maker.html');
const args=['tools/browser-bridge/build-maker.mjs',path,
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix',
 '--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation',
 '--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94',
 '--roster=docs/demos/live-game-roster-v98.json','--catalog=docs/demos/live-game-roster-catalog-v105.json',
 '--match-renderer=../../outputs/ばせぼーるlv111_TBD_vs_LAD_制球とカウント配球版.html'];
const child=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:8_000_000});await writeFile(resolve(out,'build.log'),child.stdout+'\n'+child.stderr);
assert.equal(child.status,0,child.stderr);const metadata=JSON.parse(await readFile(path+'.build.json','utf8')),assets=await makerLayoutAssetsV112(),html=await readFile(path,'utf8');
assert.equal(metadata.makerLayoutVersion,112);assert.deepEqual(metadata.makerLayoutSources,assets.hashes);assert.equal(html.split('id="maker-layout-script-v112"').length,2);
const actualPins=JSON.parse(await readFile(path+'.bundle-inputs.json','utf8')),frozenPins=JSON.parse(await readFile('../../outputs/にーくら野球メーカー_v111_制球とカウント配球版.html.bundle-inputs.json','utf8'));
assert.deepEqual(actualPins.inputs,frozenPins.inputs);assert.equal(actualPins.entrySha256,frozenPins.entrySha256,'UI-only work changed workbench Core');
await writeFile(resolve(out,'report.json'),JSON.stringify({pass:true,path,makerLayoutVersion:112,makerLayoutSources:assets.hashes,unchangedWorkbenchCore:true,coreSha256:actualPins.entrySha256},null,2)+'\n');console.log(JSON.stringify({pass:true,futureBuilder:true,unchangedWorkbenchCore:true}));
