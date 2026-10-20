import { spawnSync } from 'node:child_process';
const game=process.argv[2]??'../../outputs/ばせぼーるlv49_TBD_vs_LAD_守備責任と走塁裁定修正版.html';
for(const [script,...args] of [
 ['tools/browser-bridge/build-native.mjs'],
 ['tools/browser-bridge/build-v49.mjs',game],
]){
 const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(script+' exited '+result.status);
}
