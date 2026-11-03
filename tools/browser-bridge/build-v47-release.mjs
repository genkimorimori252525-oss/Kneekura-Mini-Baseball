import { spawnSync } from 'node:child_process';
const game=process.argv[2]??'../../outputs/ばせぼーるlv47_TBD_vs_LAD_中継とベース旋回版.html';
const maker=process.argv[3]??'../../outputs/にーくら野球メーカー_中継とベース旋回調整版.html';
for(const [script,...args] of [
 ['tools/browser-bridge/build-native.mjs'],
 ['tools/browser-bridge/build-v47.mjs',game],
 ['tools/browser-bridge/build-maker.mjs','--public-abilities',maker],
]){
 const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(script+' exited '+result.status);
}
