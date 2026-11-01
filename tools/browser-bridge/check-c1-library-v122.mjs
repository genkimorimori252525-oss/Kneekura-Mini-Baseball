import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile('docs/demos/measured-bat-library-v1.json'),originalSha=sha(bytes),
 decode=new Function(await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')(),clips=decode(bytes.toString('utf8')).clips;
const compiled=await build({stdin:{contents:"export {createReferenceBatKinematicsV1} from './src/core/sim/contact/ReferenceBatKinematicsV1';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,
 format:'iife',globalName:'C1LibraryTest',platform:'browser',logLevel:'silent'}),api=new Function(compiled.outputFiles[0].text+';return C1LibraryTest;')(),
 report={pass:false,measuredLibrarySha256:originalSha,trials:0,players:new Set(clips.map(c=>c.id.replace(/^obp-/, '').split('_')[0])).size,
 keyChecks:0,minimumQuaternionNorm:1,maximumCertifiedAccelerationMps2:0,sourceCoreSha256:sha(await readFile('dist/native-match-core-browser.js')),errors:[]};
for(const clip of clips){try{
 const frames=clip.frames.map(({tick,grip,orientation})=>({tick,grip,orientation})),reference=api.createReferenceBatKinematicsV1({provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames,
 batLengthM:.84,sweetSpotT:.8,sourceTicksPerSecond:1e6,startTick:1e6,ticksPerSecond:1e6,playbackRate:1,
 transform:{rotation:{w:1,x:0,y:0,z:0},translation:{x:0,y:0,z:0},scale:1},executionInterpolationV122:'cubic-c1'});
 assert(reference.minimumQuaternionNormV122>0);report.minimumQuaternionNorm=Math.min(report.minimumQuaternionNorm,reference.minimumQuaternionNormV122);
 report.maximumCertifiedAccelerationMps2=Math.max(report.maximumCertifiedAccelerationMps2,reference.maximumSweetSpotAccelerationMps2);
 for(const f of frames){const sample=reference.sampleAtSourceTick(f.tick);for(const k of ['x','y','z'])assert(Math.abs(sample.state.pose.grip[k]-f.grip[k])<1e-10);report.keyChecks++;}
 report.trials++;
}catch(e){report.errors.push({clipId:clip.id,error:String(e.stack??e)});}}
assert.equal(sha(await readFile('docs/demos/measured-bat-library-v1.json')),originalSha);assert.equal(originalSha,'b53a8d687f663a5578315120445de1407fb82efec594cde27cc313c1ea5b106a');
report.pass=report.errors.length===0&&report.trials===673&&report.players===98;
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,errors:report.errors.slice(0,2)}));if(!report.pass)process.exitCode=1;
