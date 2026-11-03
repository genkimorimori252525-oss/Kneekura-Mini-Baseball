import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,'..'),directory=resolve(process.argv[2]??'');
const kind=process.argv[3]??'model';
const entry={model:'tools/verification/native-game/measured-model-readback.ts',reservation:'tools/verification/native-game/reservation-readback.ts',
  observed_launch:'tools/verification/native-game/observed-launch-readback.ts',observed_cut_native:'tools/verification/native-game/observed-cut-native.ts',
  observed_cut_readback:'tools/verification/native-game/observed-cut-readback.ts',authored_initial_native:'tools/verification/native-game/authored-initial-pitch-native.ts',
  observed_motor_preparation:'tools/verification/native-game/observed-motor-preparation-native.ts',
  observed_initial_decision:'tools/verification/native-game/observed-initial-decision-native.ts',
  initial_bat_control_preparation:'tools/verification/native-game/initial-bat-control-preparation-native.ts',
  coupled_pelvis_study:'tools/verification/native-game/coupled-pelvis-native-study.ts',
  owned_coupled_body:'tools/verification/native-game/owned-coupled-body-native.ts',
  owned_pitch_hand_hold:'tools/verification/native-game/owned-pitch-hand-hold-native.ts',
  owned_joint_control_readback:'tools/verification/native-game/owned-joint-control-readback.ts',
  owned_joint_physical_query:'tools/verification/native-game/owned-joint-physical-query-native.ts',
  owned_joint_physical_execution:'tools/verification/native-game/owned-joint-physical-execution-native.ts',
  owned_joint_execution_readback:'tools/verification/native-game/owned-joint-physical-execution-readback.ts',
  owned_joint_execution_guards:'tools/verification/native-game/owned-joint-execution-guards-native.ts',
  owned_joint_workload:'tools/verification/native-game/owned-joint-workload-native.ts',
  post_impact_joint_world:'tools/verification/native-game/post-impact-joint-world-native.ts',
  owned_joint_recovery:'tools/verification/native-game/owned-joint-recovery-native.ts'}[kind];
if(!entry)throw new Error('unsupported Native readback kind');
const inside=relative(work,directory);
if(!inside||inside.startsWith('..')||isAbsolute(inside)||existsSync(directory))throw new Error('requires a new workspace work/ directory');
mkdirSync(directory);
const outfile=resolve(directory,'readback.mjs');
const result=await build({absWorkingDir:root,entryPoints:[entry],outfile,
  bundle:true,platform:'node',format:'esm',target:'node22',external:['node:*'],metafile:true,logLevel:'silent'});
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest={entrySha256:sha(outfile),inputs:Object.fromEntries(Object.keys(result.metafile.inputs).map(name=>[name,sha(resolve(root,name))]))};
writeFileSync(resolve(directory,'build.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({outfile,inputCount:Object.keys(manifest.inputs).length,sha256:manifest.entrySha256})+'\n');
