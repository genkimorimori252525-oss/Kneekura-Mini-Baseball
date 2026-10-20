import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html');
const result=spawnSync(process.execPath,['tools/browser-bridge/build-maker.mjs',output,
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview',
 '--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library',
 '--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides',
 '--roster=docs/demos/live-game-roster-v62.json','--catalog=docs/demos/live-game-roster-catalog-v77.json',
 '--match-renderer=docs/demos/releases/v84/game.html'],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)throw Error('Maker v85 build failed');
