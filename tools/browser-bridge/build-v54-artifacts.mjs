import {spawnSync} from 'node:child_process';
const commands=[['tools/browser-bridge/build-native.mjs'],['tools/browser-bridge/build-maker.mjs','../../outputs/にーくら野球メーカー_得能接続版.html','--executable-traits'],['tools/browser-bridge/build-v54.mjs','../../outputs/ばせぼーるlv54_TBD_vs_LAD_得能と個人采配接続版.html']];
for(const args of commands){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
