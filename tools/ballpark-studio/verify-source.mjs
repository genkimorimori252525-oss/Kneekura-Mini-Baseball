import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),label=process.argv[2];
assert(/^[a-z0-9-]+$/.test(label??''));
const build=JSON.parse(await readFile('docs/ballpark-studio/evidence/build-'+label+'.json','utf8'));
const checked=[];
const accepted=build.version>=6?{
 '../../outputs/球場設計室_v3_局所密度版.html':'af2c00aa1cd56e596027af42eb3d547391a21322c8a9df75638194d907c8c1df',
 '../../outputs/球場設計室_v4_ドジャースタジアム版.html':'713d9fd7f8c9f92200967e739dd781c662198cdb6baee1335b0b15cd0ffa35a2',
 '../../outputs/球場設計室_v5_甲子園版.html':'967c69f7a75bccb21d7a54121cd4be4ba91e0dad2aced2d775ca04e83f808f2e'}:{};
for(const [path,expected] of Object.entries({...build.sourceInputs,
 ...accepted,
 ...(build.version>=25?{'../../outputs/球場設計室_v24_福岡グラウンド形状版.html':'f7a745af137d4f2ba52b46d8f92192da0d25b7f8353ca336ba67c1d267a5faf3'}:{}),
 ...(build.version>=24?{'../../outputs/球場設計室_v23_福岡パノラマビジョン版.html':'2536ecc45fd4337ba4e31fd3cbc765b42f07c1efc6b0ef984f40d20b7c433afb'}:{}),
 ...(build.version>=23?{'../../outputs/球場設計室_v22_福岡の黄と芝広告版.html':'999525397eb93c206974821e754c633a4600a08d3ba085668a666156bed4ecbf'}:{}),
 ...(build.version>=22?{'../../outputs/球場設計室_v21_福岡ドーム再制作版.html':'3e536fc53514223e379f90e07a9dcfc40a1813090a56585a7acfeef9cd80a339'}:{}),
 ...(build.version>=21?{'../../outputs/球場設計室_v19_実在球場の内野曲線版.html':'2c4dfddef9c0de77f6ed1c38c482a8849b85c646ab8b0e89787b91a8238546d9'}:{}),
 ...(build.version>=19?{'../../outputs/球場設計室_v18_内野席接近と曲線版.html':'ee09976eddfd035143fe6717e5138766f1637f2d7a29aed71bcdda0cb62db4c1'}:{}),
 ...(build.version>=18?{'../../outputs/球場設計室_v17_球場別カメラ登録版.html':'6f5c9432ca0ec0c5189ae5374fb8265dc61859dffaa9a3d8b39958871e42cbf6'}:{}),
 ...(build.version>=17?{'../../outputs/球場設計室_v16_表示設備と建築整列版.html':'357292b01f6d0213a72a654fa9b5a0303f4360116b2fbcc0d35cd0a15193764e'}:{}),
 ...(build.version>=16?{'../../outputs/球場設計室_v15_観客遠近法版.html':'3e75851a789526a23446b8cc2ac441103ab17492d187f329c28d17ad2c4ee5cf'}:{}),
 ...(build.version>=15?{'../../outputs/球場設計室_v14_大型年俸スコアボード版.html':'a6a0ed5766816f15092c4945af8d0688cc879773034098287649f5e38189d98a'}:{}),
 ...(build.version>=14?{'../../outputs/球場設計室_v13_満員観客版.html':'075934b3850894ae3307693cf3317bde4e01f73e3ee58420ec56a2710c4b16ad'}:{}),
 ...(build.version>=13?{'../../outputs/球場設計室_v12_アーチと入口と客席版.html':'0980d46ca2a4e13fc6b95cbb608dda63c01f1b01a4edc6b8ea6e423611b03d3d'}:{}),
 ...(build.version>=12?{'../../outputs/球場設計室_v11_にーくらドーム版.html':'2f65eff993bb3e063e0aaa79b49b1a8a1d28e75ee9af8a2057b52bc8bdf6fcc4'}:{}),
 ...(build.version>=11?{'../../outputs/球場設計室_v10_ドジャー外壁と入口版.html':'8358391c869df7d87a5c0029d7357e8afec3e713dad3c73351333a372db89dfa'}:{}),
 ...(build.version>=10?{'../../outputs/球場設計室_v9_ドジャー夜間照明版.html':'d293591c16f2b250b05836ccea441fcf6f61e850b0488eef61222adc7b085c85'}:{}),
 ...(build.version>=9?{'../../outputs/球場設計室_v8_風と旗版.html':'3091a5793facbde3a195a2ed0686f9b5036b423c51005bfedc035d01cabedb5e'}:{}),
 ...(build.version>=8?{'../../outputs/球場設計室_v7_昼夜と環境演出版.html':'d617d9af9e45ea8153427edf3911f2828382d0c1e50ef41db1196d935e348053'}:{}),
 ...(build.version>=7?{'../../outputs/球場設計室_v6_照明と花火版.html':'36f22464cfc0f0e38cb90f059edb89402d39815b23e8b420c7fe88b91561690c'}:{}),
 '../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html':'c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71',
 '../../outputs/球場設計室_v1.html':'0b97ab18f3639b2f086405e3574ff47cec9954780af58c2aa379aa3ceeb48a20',
 '../../outputs/球場設計室_v2_開閉式ドーム.html':'766a3495443c7480c33a38f7d2c51e55f49278fafa24fdbc306740efcf4173a5',
 [build.output]:build.sha256})){
 const actual=sha(await readFile(path));assert.equal(actual,expected,path);checked.push({path,sha256:actual});
}
const report={pass:true,checked};
await writeFile('docs/ballpark-studio/evidence/source-pins-'+label+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,checked:checked.length,productSha256:build.sha256}));
