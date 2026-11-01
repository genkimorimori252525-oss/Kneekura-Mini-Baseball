import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve(process.argv[2]??'../../outputs/ばせぼーるlv91_TBD_vs_LAD_成績パネル配色版.html'),basePath='docs/demos/releases/v88/game.html',
 cssPath='tools/browser-bridge/match-course-theme-v91.css',sha=value=>createHash('sha256').update(value).digest('hex'),
 base=await readFile(basePath,'utf8'),previous=JSON.parse(await readFile(basePath+'.build.json')),css=await readFile(cssPath,'utf8');
assert.equal(sha(base),previous.sha256);assert.equal(base.split('</head>').length,2);assert(!/<\/style/i.test(css));
const tag='<style id="v91-match-course-theme">\n'+css+'\n</style>\n',
 game=base.replace('</head>',tag+'</head>').replace('<title>にーくらMINIbaseball v88 空振りとHR見送り</title>','<title>にーくらMINIbaseball v91 成績パネル配色</title>').replaceAll('空振りとHR見送り版 88','成績パネル配色版 91');
assert.equal(game.replace(tag,'').replace('<title>にーくらMINIbaseball v91 成績パネル配色</title>','<title>にーくらMINIbaseball v88 空振りとHR見送り</title>').replaceAll('成績パネル配色版 91','空振りとHR見送り版 88'),base,'only CSS and version labels may differ');
const pins=await readFile(basePath+'.bundle-inputs.json');
await mkdir(dirname(output),{recursive:true});await writeFile(output,game);await writeFile(output+'.bundle-inputs.json',pins);
await writeFile(output+'.build.json',JSON.stringify({...previous,themeVersion:91,sourceCoreChanged:false,basePresentationPath:basePath,basePresentationSha256:sha(base),
 sourceGamePath:output,sourceGameSha256:sha(game),sha256:sha(game),themeSources:{[cssPath]:sha(css)},builderSha256:sha(await readFile('tools/browser-bridge/build-match-theme-v91.mjs'))},null,2)+'\n');
console.log(JSON.stringify({output,sha256:sha(game),coreAndScriptsByteIdentical:true,themeVersion:91}));
