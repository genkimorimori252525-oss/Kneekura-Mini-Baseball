import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v94_投影と打席位置版.html');
const result=spawnSync(process.execPath,['tools/browser-bridge/build-maker.mjs',output,
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview',
 '--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library',
 '--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation','--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94',
 '--roster=docs/demos/live-game-roster-v62.json','--catalog=docs/demos/live-game-roster-catalog-v77.json',
 '--match-renderer=../../outputs/ばせぼーるlv94_TBD_vs_LAD_立体ゾーンと打席位置版.html'],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)throw Error('Maker v94 build failed');
