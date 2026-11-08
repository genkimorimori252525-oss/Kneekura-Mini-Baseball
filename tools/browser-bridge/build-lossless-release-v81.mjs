// Reproducible current release entry. Future versions inherit these performance
// boundaries; packaging requires the independently executed acceptance reports.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]??'../../outputs');
const run=args=>{const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Release build failed: '+args[0]);};
run(['tools/browser-bridge/build-native.mjs']);
run(['tools/browser-bridge/build-v81.mjs',out]);
run(['tools/browser-bridge/build-maker.mjs',resolve(out,'にーくら野球メーカー_v81_無劣化性能改善版.html'),
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview',
 '--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library',
 '--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--roster=docs/demos/live-game-roster-v62.json',
 '--catalog=docs/demos/live-game-roster-catalog-v77.json','--match-renderer='+resolve(out,'ばせぼーるlv81_TBD_vs_LAD_無劣化性能改善版.html')]);
