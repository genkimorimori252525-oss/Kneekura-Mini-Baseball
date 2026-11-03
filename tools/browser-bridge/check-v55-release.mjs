import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const sha=data=>createHash('sha256').update(data).digest('hex'),base='docs/demos/releases/v55/';
const index=JSON.parse(await readFile(base+'SHA256.json','utf8'));
for(const [path,hash]of Object.entries(index))assert.equal(sha(await readFile(base+path)),hash,path);
const game=await readFile(base+'game.html','utf8'),lab=await readFile(base+'camera-workbench.html','utf8'),old=await readFile('docs/demos/releases/v54/game.html','utf8');
const block=/<script id="v55-camera-tuning">[\s\S]*?<\/script>\n/g;
assert.equal([...game.matchAll(block)].length,1);
let restored=game.replace(block,'');
for(const [from,to]of [
 ['<title>Kneekura Mini Baseball — TBD対LAD カメラ追尾調整版 55</title>','<title>Kneekura Mini Baseball — TBD対LAD 剛体バット描画版 31</title>'],
 ['presentationVersion:55','presentationVersion:54'],['打球追尾調整版 55','得能と個人采配接続版 54'],['version:55,authority:','version:54,authority:']
]){assert.equal(restored.split(from).length,2,from);restored=restored.replace(from,to);}
assert.equal(restored,old,'normal match is byte-identical v54 outside the new camera and edition/version metadata');
const marker='const CAMERA_LAB_GAME_HTML=',markerAt=lab.indexOf(marker),start=markerAt+marker.length,end=lab.indexOf('\n',start),encoded=lab.slice(start,end).trimEnd();
assert(markerAt>=0&&end>start&&encoded.endsWith(';'));
assert.equal(JSON.parse(encoded.slice(0,-1)),game,'one exact embedded normal match');
const current=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
for(const [path,hash]of Object.entries(current.inputs))assert.equal(sha(await readFile(path)),hash,path);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),current.entrySha256);
const normal=JSON.parse(await readFile('docs/verification/releases/v55/normal/normal-check.json','utf8')),
 workbench=JSON.parse(await readFile('docs/verification/releases/v55/workbench/workbench-check.json','utf8'));
assert(normal.pass&&workbench.pass);assert.equal(normal.sha256,index['game.html']);assert.equal(workbench.sha256,index['camera-workbench.html']);
let links=0;
for(const path of [base+'README.md','docs/reports/2026-10-19-v55-camera-workbench.md','docs/handoffs/LATEST.md']){
 const text=await readFile(path,'utf8');for(const match of text.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)){
  const link=match[1];if(/^(?:https?:|#)/.test(link))continue;const file=resolve(dirname(path),decodeURIComponent(link.split('#')[0]));assert((await stat(file)).isFile(),link);links++;
 }
}
// Frozen older releases and the measured bat/maker are not replaced by this camera work.
for(const [path,hash]of Object.entries(JSON.parse(await readFile('docs/demos/releases/v54/SHA256.json','utf8'))))assert.equal(sha(await readFile('docs/demos/releases/v54/'+path)),hash,path);
const prior=JSON.parse(await readFile('docs/verification/releases/v55/release-check.json','utf8'));
const report={...prior,pass:true,normalRestoresV54Exactly:true,oneEmbeddedMatch:true,checkedLinks:links,oldV54ReleaseUnchanged:true,
 coreChanged:false,measuredBatChanged:false,physicsRulesAiChanged:false,wholeOriginalPlanComplete:false,statisticsCalibrated:false};
await writeFile('docs/verification/releases/v55/release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
