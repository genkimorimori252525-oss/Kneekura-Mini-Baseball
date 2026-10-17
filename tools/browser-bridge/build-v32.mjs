import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {transformV31} from '../../docs/demos/v31-presentation.mjs';
import {V30_CAPTURE_OBSERVER_INSERTION} from '../../docs/demos/v30-presentation.mjs';
import {transformExecutedFieldV32} from './v32-executed-field.mjs';
const [recordingArg,outputArg]=process.argv.slice(2);
if(!recordingArg)throw new Error('requires a Native owner-exported successor execution JSON');
const baseline='C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html';
const output=resolve(outputArg??'dist/ばせぼーるlv32_正式Core後続動作観測版.html');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(baseline),source=bytes.toString('utf8');
if(sha(bytes)!=='c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f')throw new Error('Approved v27 SHA mismatch');
const exportedBytes=await readFile(recordingArg),recording=JSON.parse(exportedBytes);
if(recording.kind!=='joint_field_successor_executed_v1'||recording.physicalExecutionAdmitted!==true||recording.motionIssued!==true
 ||recording.nextMotionAllowed!==false||recording.officialResult!==null)throw new Error('requires actual finite successor execution export, not conditional root/trace');
const native=await readFile('dist/native-match-core-browser.js','utf8');
if(native.includes('</script>')||!native.includes('createExecutedFieldWorldObserverV1'))throw new Error('Latest Native observation bundle unavailable');
let html=transformV31(source).replace(/<script id="v24-exact-native-core">[\s\S]*?<\/script>/,()=>'<script>'+native+'\n</script>');
const provenance={recordingSha256:sha(exportedBytes),nativeBundleSha256:sha(Buffer.from(native)),
 browserAuthentication:false,authority:'Native owner execution export; browser is read-only',
 scope:'finite executed field successor, no full-game or named-player calibration claim'};
html=transformExecutedFieldV32(html,recording,provenance);
const masks=input=>input.match(/^const APPROVED_PLAYER_MASKS=.*$/m)?.[0],font=input=>input.match(/@font-face[^}]+}/)?.[0];
const engine=input=>{const start=input.indexOf('/* Kneekura Browser Match Slice v23');return input.slice(start,input.indexOf('</script>',start));};
if(!masks(source)||masks(source)!==masks(html)||!font(source)||font(source)!==font(html))throw new Error('Approved PNG/font changed');
if(engine(html).replace(V30_CAPTURE_OBSERVER_INSERTION,'')!==engine(source))throw new Error('Legacy game computation changed');
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html);
const report={output,sha256:sha(Buffer.from(html)),baselineSha256:sha(bytes),...provenance,
 approvedPngMasksSha256:sha(Buffer.from(masks(source))),approvedFontSha256:sha(Buffer.from(font(source))),
 legacyEngineUnchanged:true,primaryCanvas:'Native exported execution',legacyFallback:false,
 requiresOfficialLiveBallResolution:true,officialResult:null,ordinaryCadenceMs:55,displayGridPixels:4};
await writeFile(output+'.build.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
