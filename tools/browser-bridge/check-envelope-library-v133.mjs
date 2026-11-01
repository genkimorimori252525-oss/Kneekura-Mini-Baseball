import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const folder=process.argv[2];assert(folder,'requires a new output directory');
const out=resolve(folder);await mkdir(out); // Do not overwrite prior evidence.
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile('docs/demos/measured-bat-library-v1.json'),sourceSha=sha(bytes);
assert.equal(sourceSha,'b53a8d687f663a5578315120445de1407fb82efec594cde27cc313c1ea5b106a');
const decode=new Function(await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')(),clips=decode(bytes.toString('utf8')).clips;
const compiled=await build({stdin:{contents:"export {createReferenceBatKinematicsV1} from './src/core/sim/contact/ReferenceBatKinematicsV1';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,
  format:'iife',globalName:'EnvelopeLibraryTest',platform:'browser',logLevel:'silent'}),api=new Function(compiled.outputFiles[0].text+';return EnvelopeLibraryTest;')();
const report={pass:false,boundary:'SYNTHETIC_BOUNDARY_KEY_PRESERVATION_NOT_HUMAN_POSE_OR_ABILITY_CALIBRATION',
  sourceSha,compiledHelperSha:sha(compiled.outputFiles[0].text),trials:0,keyChecks:0,minimumQuaternionNorm:1,
  accelerationBoundRatios:{minimum:Infinity,maximum:0},errors:[]};
for(const clip of clips){try{
  const frames=clip.frames.map(({tick,grip,orientation})=>({tick,grip,orientation})),first=frames[0],last=frames.at(-1),
    raw={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames,batLengthM:.84,sweetSpotT:.8,sourceTicksPerSecond:1e6,
      startTick:1e6,ticksPerSecond:1e6,playbackRate:1,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1},executionInterpolationV122:'cubic-c1'},
    original=JSON.stringify(raw),old=api.createReferenceBatKinematicsV1(raw),motion=api.createReferenceBatKinematicsV1({...raw,
      executionEnvelopeV133:{version:'reference_bat_envelope_v133',sourceId:'synthetic-library-boundary:'+clip.id,
        preparation:{durationSeconds:.2,grip:first.grip,orientation:first.orientation},recovery:{durationSeconds:.2,grip:last.grip,orientation:last.orientation}}});
  assert.equal(JSON.stringify(raw),original);assert(motion.minimumQuaternionNormV122>0);
  report.minimumQuaternionNorm=Math.min(report.minimumQuaternionNorm,motion.minimumQuaternionNormV122);
  const ratio=motion.maximumSweetSpotAccelerationMps2/old.maximumSweetSpotAccelerationMps2;
  assert(Number.isFinite(ratio));report.accelerationBoundRatios.minimum=Math.min(report.accelerationBoundRatios.minimum,ratio);
  report.accelerationBoundRatios.maximum=Math.max(report.accelerationBoundRatios.maximum,ratio);
  for(const f of frames){const sample=motion.sampleAtSourceTick(f.tick);for(const k of ['x','y','z'])assert(Math.abs(sample.state.pose.grip[k]-f.grip[k])<1e-10);report.keyChecks++;}
  for(const tick of [motion.motionStartTickV133,motion.motionThroughTickV133])assert(Math.hypot(...Object.values(motion.sampleContinuous(tick).sweetSpotVelocity))===0);
  report.trials++;
}catch(e){report.errors.push({clipId:clip.id,error:String(e.stack??e)});}}
assert.equal(sha(await readFile('docs/demos/measured-bat-library-v1.json')),sourceSha);
report.pass=report.trials===673&&report.keyChecks===92201&&report.errors.length===0;
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,errors:report.errors.slice(0,2)}));if(!report.pass)process.exitCode=1;
