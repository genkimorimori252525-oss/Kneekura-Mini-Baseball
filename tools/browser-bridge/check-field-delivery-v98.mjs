import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const [directory,uiReport,output]=process.argv.slice(2).map(p=>resolve(p)),
 sha=b=>createHash('sha256').update(b).digest('hex'),
 names=['ばせぼーるlv98_TBD_vs_LAD_生成待ち改善と守備初動版.html','にーくら野球メーカー_v98_守備練習統合版.html','カメラワーク調整室_v98_性能改善と守備初動.html'],
 performance=JSON.parse(await readFile('docs/verification/releases/v98/performance-equal-work-isolated/report.json')),
 fullGame=JSON.parse(await readFile('docs/verification/releases/v98/normal-game-candidate-d/report.json')),
 ui=JSON.parse(await readFile(uiReport)),artifacts=[];
assert.equal(performance.pass,true);assert.equal(performance.fullRecordExactAndEqualWork,true);
assert.equal(fullGame.pass,true);assert.equal(fullGame.configuration.regulationInnings,9);
assert.equal(ui.pass,true);assert(ui.cases.some(c=>c.width===1200));assert(ui.cases.some(c=>c.width===390));
for(const name of names){
 const path=resolve(directory,name),bytes=await readFile(path),meta=JSON.parse(await readFile(path+'.build.json'));
 assert.equal(sha(bytes),meta.sha256);assert.equal(meta.releaseVersion,98);
 assert.equal(meta.sourceCoreSha256,performance.pins.candidate.embeddedCoreSha256,'same measured NativeCore');
 if(name===names[0])assert.equal(meta.sha256,fullGame.artifacts[0].sha256,'identical to the HTML that completed nine innings');
 if(name===names[1]){
  assert.equal(meta.sha256,ui.sha256,'identical maker HTML bytes to the final UI browser test');
  assert.equal(resolve(ui.file),path,'UI test must exercise the delivered file');
 }
 artifacts.push({name,path,bytes:bytes.length,sha256:meta.sha256,sourceCoreSha256:meta.sourceCoreSha256,
  fieldPracticeSources:meta.fieldPracticeSources??null});
}
const report={pass:true,scope:'Artifact linkage only: final NativeCore equals the measured performance candidate; normal HTML bytes equal the completed nine-inning test; maker HTML bytes equal the final UI browser test at both widths. Current source pins and camera browser checks are recorded separately.',
 uiReport,performanceReport:'docs/verification/releases/v98/performance-equal-work-isolated/report.json',
 fullGameReport:'docs/verification/releases/v98/normal-game-candidate-d/report.json',artifacts};
await mkdir(output,{recursive:true});await writeFile(resolve(output,'artifact-linkage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,artifacts:artifacts.map(a=>({name:a.name,sha256:a.sha256}))}));
