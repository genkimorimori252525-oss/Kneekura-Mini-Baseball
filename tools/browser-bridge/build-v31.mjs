import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {transformV31} from '../../docs/demos/v31-presentation.mjs';
import {V30_CAPTURE_OBSERVER_INSERTION} from '../../docs/demos/v30-presentation.mjs';

const baseline=process.argv[2]??'C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html';
const output=resolve(process.argv[3]??'dist/ばせぼーるlv31_TBD_vs_LAD_剛体バット描画版.html');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(baseline),source=bytes.toString('utf8');
if(sha(bytes)!=='c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f')throw new Error('Approved v27 SHA mismatch');
let html=transformV31(source);
const native=await readFile('dist/native-match-core-browser.js','utf8');
if(native.includes('</script>')||!native.includes('REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS'))throw new Error('Latest Native bundle unavailable');
const oldNative=/<script id="v24-exact-native-core">[\s\S]*?<\/script>/;
if(!oldNative.test(html))throw new Error('Native source boundary missing');
html=html.replace(oldNative,()=>'<script>'+native+'\n</script>');
const masks=input=>input.match(/^const APPROVED_PLAYER_MASKS=.*$/m)?.[0],font=input=>input.match(/@font-face[^}]+}/)?.[0];
const engine=input=>{const start=input.indexOf('/* Kneekura Browser Match Slice v23');return input.slice(start,input.indexOf('</script>',start));};
if(!masks(source)||masks(source)!==masks(html)||!font(source)||font(source)!==font(html))throw new Error('Approved PNG/font changed');
if(engine(html).replace(V30_CAPTURE_OBSERVER_INSERTION,'')!==engine(source))throw new Error('Legacy world/game computation changed');
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html);
const report={output,sha256:sha(Buffer.from(html)),baselineSha256:sha(bytes),nativeBundleSha256:sha(Buffer.from(native)),
 approvedPngMasksSha256:sha(Buffer.from(masks(source))),approvedFontSha256:sha(Buffer.from(font(source))),
 legacyEngineBeforeSha256:sha(Buffer.from(engine(source))),legacyEngineAfterSha256:sha(Buffer.from(engine(html))),
 change:'Legacy bat display interpolates grip and unit axis as one rigid pose at fixed first-source length; v30 dot ball/labels/zone/cadences retained',
 cameraPrinciple:'Source world happens first; all objects are observations through the same approved coarse camera; camera changes no physics',
 boundary:'Legacy match remains a physical approximation, separate from formal-Core two-tab maker/observer; no completed real-world match claim',
 unchanged:'Only the existing read-only capture/fair-observability metadata touches legacy engine bytes; original motion/collisions/counts/scoring unchanged'};
await writeFile(output+'.build.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
