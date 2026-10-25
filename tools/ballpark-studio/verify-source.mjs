import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),label=process.argv[2];
assert(/^[a-z0-9-]+$/.test(label??''));
const build=JSON.parse(await readFile('docs/ballpark-studio/evidence/build-'+label+'.json','utf8'));
const checked=[];
for(const [path,expected] of Object.entries({...build.sourceInputs,
 '../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html':'c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71',
 '../../outputs/球場設計室_v1.html':'0b97ab18f3639b2f086405e3574ff47cec9954780af58c2aa379aa3ceeb48a20',
 '../../outputs/球場設計室_v2_開閉式ドーム.html':'766a3495443c7480c33a38f7d2c51e55f49278fafa24fdbc306740efcf4173a5',
 [build.output]:build.sha256})){
 const actual=sha(await readFile(path));assert.equal(actual,expected,path);checked.push({path,sha256:actual});
}
const report={pass:true,checked};
await writeFile('docs/ballpark-studio/evidence/source-pins-'+label+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,checked:checked.length,productSha256:build.sha256}));
