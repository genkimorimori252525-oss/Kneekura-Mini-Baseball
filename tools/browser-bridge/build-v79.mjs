import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),out=resolve(process.argv[2]??'../../outputs'),
 basePath='docs/demos/releases/v78/game.html',base=await readFile(basePath),previous=JSON.parse(await readFile(basePath+'.build.json')),
 core=await readFile('dist/native-match-core-browser.js'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
if(sha(base)!=='15804efd7eec66e8eea265c55cc3f3a73337c93d243ab71e386e8510dbe86b48')throw Error('Frozen V78 differs');
if(pins.entrySha256!==sha(core)||sha(core)===previous.sourceCoreSha256)throw Error('Compile V79 Core first');
for(const[path,expected]of Object.entries(pins.inputs))if(sha(await readFile(path))!==expected)throw Error('Source changed after bundle: '+path);
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('V79 marker differs: '+a.slice(0,120));return s.replace(a,()=>b);};
let game=base.toString('utf8');const oldCore=[...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='))?.slice(0,-1);
if(!oldCore||sha(oldCore)!==previous.sourceCoreSha256||core.includes(Buffer.from('</script>')))throw Error('Core boundary differs');
game=once(game,oldCore,core.toString('utf8'));const helpers={...previous.helpers};
for(const[name,expected]of Object.entries(helpers)){const bytes=await readFile('tools/browser-bridge/'+name);if(sha(bytes)!==expected||!game.includes(bytes.toString('utf8')))throw Error('Inherited helper differs: '+name);}
const scripts=[];
for(const name of ['live-season-client-v79.js','course-charts-v79.js','live-season-match-v79.js']){
 const source=await readFile('tools/browser-bridge/'+name,'utf8');if(/<\/script/i.test(source))throw Error('Closing-script token: '+name);scripts.push(source);helpers[name]=sha(source);
}
const css=await readFile('docs/demos/baseball-maker-course-v79.css','utf8');
game=once(game,'<script id="v33-offline-core-match">','<style id="v79-course-chart-style">'+css+'</style>\n<script id="v79-course-season-helpers">'+scripts.join('\n')+'</script>\n<script id="v33-offline-core-match">');
game=once(game,'pendingRoster=structuredClone(defaultRoster),activeRoster=null,physicalRosterAudit=null;',
 'pendingRoster=structuredClone(defaultRoster),activeRoster=null,physicalRosterAudit=null;\n const season=window.KneekuraLiveSeasonMatchV79.create({core,getAuthoredPlayers:()=>core.applyLivePhysicalRosterV1({players:basePlayers,roster:pendingRoster}).players});window.liveMatchSeasonsV79=season;');
game=once(game,"function createGame(randomize=false){\n  const configured=", "function createGame(randomize=false){\n  season.commitCompleted();const configured=");
game=once(game,"nextHost=core.createLiveBaseballMatchV1({seed:nextConfiguration.seed,innings:nextConfiguration.innings,\n    teams,players:configured.players,park,measuredClips:measured.clips});",
 "nextSeason=season.prepareGame({players:configured.players,seed:nextConfiguration.seed}),\n    nextHost=core.createLiveBaseballMatchV1({seed:nextConfiguration.seed,innings:nextConfiguration.innings,\n     teams,players:nextSeason.players,park,measuredClips:measured.clips});");
game=once(game,'players=configured.players;physicalRosterAudit=configured.audit;', 'players=nextSeason.players;physicalRosterAudit=configured.audit;');
game=once(game,'host=nextHost;draw();','host=nextHost;season.beginGame(nextSeason);draw();');
game=once(game,'records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});','season.acceptPitch(result);records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});');
game=once(game,'syncUi(result,sceneEnded(),currentFrame);','syncUi(result,sceneEnded(),currentFrame);\n  if(state.finished&&selected===records.length-1&&sceneEnded())season.playbackEnded();');
game=once(game,"calibration:'EXPLICIT_REFERENCE_SI_NOT_EMPIRICAL_NAMED_PLAYER_CALIBRATION'};", "calibration:'EXPLICIT_REFERENCE_SI_NOT_EMPIRICAL_NAMED_PLAYER_CALIBRATION',gameStatisticsV79:season.exportGame(),courseSeasons:season.getState()};");
game=once(game,'core.createLiveBaseballMatchV1({seed:hashSeed($(\'match-seed\').value),innings:Number($(\'inning-limit\').value)||9,',
 "const nextCourseSeasons=raw.courseSeasons===undefined?null:season.validateState(raw.courseSeasons);\n    core.createLiveBaseballMatchV1({seed:hashSeed($('match-seed').value),innings:Number($('inning-limit').value)||9,");
game=once(game,'teams,players:candidate.players,park,measuredClips:measured.clips});pendingRoster=structuredClone(migrated);',
 'teams,players:candidate.players,park,measuredClips:measured.clips});if(nextCourseSeasons)season.replaceState(nextCourseSeasons);pendingRoster=structuredClone(migrated);season.render();');
game=once(game,"if(file.size>2_000_000)throw new Error('能力JSONは2MB以内にしてください。');","if(file.size>256_000_000)throw Error('能力・シーズンJSONは256MB以内にしてください');");
game=once(game,"inspect:()=>({version:78,authority:'OFFLINE_HOST_SHARED_CORE'", "inspect:()=>({version:79,authority:'OFFLINE_HOST_SHARED_CORE'");
game=game.replaceAll('球種と縫い目物理版 78','63コースとシーズン成績版 79');
game=once(game,'安打・失策の公式採点、実選手の能力校正、実機スマートフォンの検証は未完です。',
 'コース成績はローカルの記録方針に基づき、判定不足は記録確認中として保持します。Native認証付き公式採点・実選手の校正・実機スマートフォン検証とは別です。');
const driverPath='tools/browser-bridge/camera-workbench-v79.js',templatePath='tools/browser-bridge/camera-workbench-v79.html',driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),
 metadata={...previous,presentationVersion:79,basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,helpers,
  course63Connected:true,publicCourse9ZoneOnly:true,localSeasonLedgerConnected:true,courseLearningPolicy:'local_course_learning_v79_1',directionIntentConnected:true,
  ballDynamicsChanged:false,battingMotorChanged:true,compatibleSessionCoreSha256:[],sessionMigration:'V79_REPLAY_REQUIRES_IDENTICAL_START_ROSTER_AND_NO_SEASON_RECORDING',
  courseChartCssSha256:sha(css),workbenchDriverSha256:sha(driver),workbenchTemplateSha256:sha(template),builderSha256:sha(await readFile('tools/browser-bridge/build-v79.mjs'))};
delete metadata.kind;delete metadata.sha256;
let lab=once(template,'__V73_METADATA__',JSON.stringify(metadata).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of[['ばせぼーるlv79_TBD_vs_LAD_63コースとシーズン成績版.html',game,'NORMAL_MATCH'],['カメラワーク調整室_v79.html',lab,'CAMERA_WORKBENCH']]){
 if(Buffer.byteLength(html)>=100_000_000)throw Error('HTML exceeds GitHub limit');const path=resolve(out,name);await writeFile(path,html);
 await writeFile(path+'.build.json',JSON.stringify({...metadata,kind,sha256:sha(html)},null,2)+'\n');if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes);
 console.log(JSON.stringify({path,kind,sha256:sha(html),sourceInputs:Object.keys(pins.inputs).length}));
}
