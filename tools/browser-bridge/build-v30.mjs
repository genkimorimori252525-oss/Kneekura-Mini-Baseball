import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { transformV30, V30_CAPTURE_OBSERVER_INSERTION } from '../../docs/demos/v30-presentation.mjs';

const baseline=process.argv[2]??'C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html';
const output=resolve(process.argv[3]??'dist/ばせぼーるlv30_TBD_vs_LAD_ドット球と名前修正版.html');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(baseline),source=bytes.toString('utf8');
if(sha(bytes)!=='c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f')throw new Error('Approved v27 SHA mismatch');
let html=transformV30(source);
const native=await readFile('dist/native-match-core-browser.js','utf8');
if(native.includes('</script>'))throw new Error('Unexpected Native closing script token');
if(!native.includes('REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS'))throw new Error('Latest Native profile export unavailable');
const oldNative=/<script id="v24-exact-native-core">[\s\S]*?<\/script>/;
if(!oldNative.test(html))throw new Error('Native bundle boundary missing');
html=html.replace(oldNative,()=>'<script>'+native+'\n</script>');
const masks=input=>input.match(/^const APPROVED_PLAYER_MASKS=.*$/m)?.[0];
const font=input=>input.match(/@font-face[^}]+}/)?.[0];
const engine=input=>{const start=input.indexOf('/* Kneekura Browser Match Slice v23');return input.slice(start,input.indexOf('</script>',start));};
if(!masks(source)||masks(source)!==masks(html)||!font(source)||font(source)!==font(html))throw new Error('Approved PNG masks/font changed');
if(engine(html).replace(V30_CAPTURE_OBSERVER_INSERTION,'')!==engine(source))throw new Error('Legacy computation changed');
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html);
const report={output,sha256:sha(Buffer.from(html)),baselineSha256:sha(bytes),nativeBundleSha256:sha(Buffer.from(native)),
  approvedPngMasksSha256:sha(Buffer.from(masks(source))),approvedFontSha256:sha(Buffer.from(font(source))),
  legacyEngineBeforeSha256:sha(Buffer.from(engine(source))),legacyEngineAfterSha256:sha(Buffer.from(engine(html))),
  engineChange:'Read-only capture metadata plus first-ground/capture fair observability tick; no gameplay computation changes',
  renderChanges:'Overhead labels stay at projected anchor; runners paint last; source-oriented 4px dot ball; actual distance projection except batter/catcher pitch readability; smaller batted POV glyph; existing legacy capture/first-ground fair source hides mound zone',
  nativeReferenceProfile:'Same REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS (including spinDecay) in pitch and free continuation; experimental source, not calibrated player ability',
  unchanged:'Bat trajectory remains v29 pending separate approved tuning/body tool work; FPS/cadence, world logic and Native pending boundary unchanged',
  boundary:'Legacy game remains separate from Native free-field observer; Native official nine innings incomplete'};
await writeFile(output+'.build.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
