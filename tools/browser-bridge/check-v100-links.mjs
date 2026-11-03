import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=resolve(process.argv[2]),out=resolve(process.argv[3]),sha=b=>createHash('sha256').update(b).digest('hex'),names=['ばせぼーるlv100_TBD_vs_LAD_記録判定と状況音声版.html','にーくら野球メーカー_v100_記録判定と効果音版.html','カメラワーク調整室_v100_音声連携版.html'];
await mkdir(out,{recursive:true});const pins=JSON.parse(await readFile(resolve(dir,names[0]+'.bundle-inputs.json'))),rows=[];
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,'current Core input '+path);
for(const name of names){const bytes=await readFile(resolve(dir,name)),text=bytes.toString('utf8'),meta=JSON.parse(await readFile(resolve(dir,name+'.build.json')));
 assert.equal(sha(bytes),meta.sha256);assert.equal(meta.sourceCoreSha256,pins.entrySha256);assert.equal(meta.releaseVersion,100);assert.equal(meta.scoringVersion,100);assert.equal(meta.audioVersion,100);
 assert.equal(meta.sourceInputCount,Object.keys(pins.inputs).length);for(const [path,hash]of Object.entries(meta.v100Sources))assert.equal(sha(await readFile(path)),hash,path);
 assert.equal((text.match(/globalThis\.KneekuraAudioPackV100=/g)??[]).length,1,'one shared audio bank per document');
 if(name.includes('メーカー'))assert(text.includes('globalThis.KneekuraAudioPolicyV100={crowd:false}'));
 rows.push({name,sha256:sha(bytes),bytes:bytes.length,core:pins.entrySha256,inputs:meta.sourceInputCount});
}
const audioBytes=await readFile(resolve(dir,names[0]+'.audio-manifest.json')),gameMeta=JSON.parse(await readFile(resolve(dir,names[0]+'.build.json')));
assert.equal(sha(audioBytes),gameMeta.audioPackManifestSha256);assert.equal(Object.keys(JSON.parse(audioBytes).assets).length,20);
const preserved={'ばせぼーるlv99_TBD_vs_LAD_守備連携と送球判断版.html':'f839ee5e1f3ae3b43712c1123c660f967552d79ad8e223c30bab3bb4837ad6f8','にーくら野球メーカー_v99_信頼と送球動作版.html':'239c712a2c9077c9607358d89e5a59eca5b85a00ad9b67d7f9578e7073a808bc','カメラワーク調整室_v99_守備の視線版.html':'79c00eef7cb548728b7cb167a6781bfaaf74e3655a125e1dcba06849aa540019'};
for(const [name,hash]of Object.entries(preserved))assert.equal(sha(await readFile(resolve('../../outputs',name))),hash,'frozen v99');
await writeFile(resolve(out,'linkage.json'),JSON.stringify({pass:true,rows,v99Preserved:true},null,2)+'\n');console.log(JSON.stringify({pass:true,files:rows,sourceInputs:Object.keys(pins.inputs).length}));
