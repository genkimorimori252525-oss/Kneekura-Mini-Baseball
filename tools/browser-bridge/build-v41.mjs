import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {transformV31} from '../../docs/demos/v31-presentation.mjs';
import {V30_CAPTURE_OBSERVER_INSERTION} from '../../docs/demos/v30-presentation.mjs';
import {transformLiveV41} from './v41-live-presentation.mjs';
const output=resolve(process.argv[2]??'dist/ばせぼーるlv41_TBD_vs_LAD_公開能力メーカー連携版.html');
const baseline=resolve('docs/demos/assets/approved-v27-baseline.html');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(baseline),source=bytes.toString('utf8');
if(sha(bytes)!=='c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f')throw new Error('Approved v27 SHA mismatch');
const native=await readFile('dist/native-match-core-browser.js','utf8');
const inputManifestBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),inputManifest=JSON.parse(inputManifestBytes);
if(native.includes('</script>')||!native.includes('createLiveBaseballMatchV1')||inputManifest.entrySha256!==sha(Buffer.from(native)))
 throw new Error('Unchanged Core bundle/input manifest required');
const runtime=(await readFile('tools/browser-bridge/v40-live-runtime.js','utf8')).replace('個人能力・守備カバー接続版 40','公開能力メーカー連携版 41').replace('version:40,authority:','version:41,authority:'),chart=await readFile('tools/browser-bridge/v38-live-pitch-chart.js','utf8');
const fieldCamera=await readFile('tools/browser-bridge/live-field-camera.js','utf8');
const actorAnimation=await readFile('tools/browser-bridge/v40-live-actor-animation.js','utf8');
const playDescription=await readFile('tools/browser-bridge/live-play-description.js','utf8');
const rosterBytes=await readFile('docs/demos/live-game-roster-v2.json'),roster=JSON.parse(rosterBytes);
const catalogBytes=await readFile('docs/demos/live-game-roster-catalog-v2.json'),catalog=JSON.parse(catalogBytes);
if(chart.includes('</script>')||fieldCamera.includes('</script>')||actorAnimation.includes('</script>')||playDescription.includes('</script>'))throw new Error('Invalid observer helper');
const measuredBytes=await readFile('docs/demos/measured-bat-motions.json'),measured=JSON.parse(measuredBytes);
if(measured.authority!=='OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH'||!Array.isArray(measured.clips)||measured.clips.length<2)
 throw new Error('Measured OpenBiomechanics swing references unavailable');
let html=transformV31(source).replace(/<script id="v24-exact-native-core">[\s\S]*?<\/script>/,()=>'<script>'+native+'\n</script>');
html=transformLiveV41(html,runtime);
html=html.replace('<script id="v33-offline-core-match">',()=>'<script id="v33-measured-bats" type="application/json">'
 +JSON.stringify(measured).replaceAll('<','\\u003c')+'</script>\n<script id="v34-live-pitch-chart">\n'+chart+'\n</script>\n<script id="v36-field-camera">\n'+fieldCamera+'\n</script>\n<script id="v37-actor-animation">\n'+actorAnimation+'\n</script>\n<script id="v38-play-description">\n'+playDescription+'\n</script>\n<script id="v40-physical-roster" type="application/json">'+JSON.stringify(roster).replaceAll('<','\\u003c')+'</script>\n<script id="v40-roster-catalog" type="application/json">'+JSON.stringify(catalog).replaceAll('<','\\u003c')+'</script>\n<script id="v33-offline-core-match">');
const masks=input=>input.match(/^const APPROVED_PLAYER_MASKS=.*$/m)?.[0],font=input=>input.match(/@font-face[^}]+}/)?.[0];
const engine=input=>{const start=input.indexOf('/* Kneekura Browser Match Slice v23');return input.slice(start,input.indexOf('</script>',start));};
if(!masks(source)||masks(source)!==masks(html)||!font(source)||font(source)!==font(html))throw new Error('Approved PNG/font changed');
if(engine(html).replace(V30_CAPTURE_OBSERVER_INSERTION,'')!==engine(source))throw new Error('Legacy game computation changed');
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html);
const report={output,sha256:sha(Buffer.from(html)),presentationVersion:41,baselineSha256:sha(bytes),nativeBundleSha256:sha(Buffer.from(native)),
 runtimeSha256:sha(Buffer.from(runtime)),chartHelperSha256:sha(Buffer.from(chart)),fieldCameraHelperSha256:sha(Buffer.from(fieldCamera)),actorAnimationHelperSha256:sha(Buffer.from(actorAnimation)),playDescriptionHelperSha256:sha(Buffer.from(playDescription)),physicalRosterSha256:sha(rosterBytes),physicalCatalogSha256:sha(catalogBytes),bundleInputManifestSha256:sha(inputManifestBytes),
 bundleInputCount:Object.keys(inputManifest.inputs).length,approvedPngMasksSha256:sha(Buffer.from(masks(source))),approvedFontSha256:sha(Buffer.from(font(source))),
 primaryCanvas:'shared Core observations; public-ability maker SI import, independent zone-judgment error and preserved v40 game UI',nativeSqliteAdmission:false,legacyResultFallback:false,
 ordinaryCadenceMs:55,displayGridPixels:4,measuredReferenceSha256:sha(measuredBytes),measuredReferenceAuthority:measured.authority};
await writeFile(output+'.build.json',JSON.stringify(report,null,2)+'\n');
await writeFile(output+'.bundle-inputs.json',JSON.stringify({...inputManifest,measuredReferenceSha256:sha(measuredBytes)},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
