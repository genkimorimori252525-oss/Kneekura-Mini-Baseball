import {spawnSync} from 'node:child_process';
const commands=[['tools/browser-bridge/build-native.mjs'],['tools/browser-bridge/build-maker.mjs','../../outputs/にーくら野球メーカー_得能編集版.html','--traits'],['tools/browser-bridge/build-v53.mjs','../../outputs/ばせぼーるlv53_TBD_vs_LAD_飛球走塁と得能版.html']];
for(const args of commands){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
