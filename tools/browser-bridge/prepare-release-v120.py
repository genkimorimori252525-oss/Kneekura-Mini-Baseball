from pathlib import Path
import json

p=Path('tools/browser-bridge')
source=(p/'build-field-release-v119.mjs').read_text(encoding='utf-8')
source=source.replace('v119','v120').replace('lv119','lv120').replace('Version:119','Version:120')
source=source.replace('接触停止と守備連携修正','複数追球と連続ダイビング').replace('接触停止と守備連携修正版','複数追球と連続ダイビング版')
source=source.replace('守備連携修正版 119','守備連携修正版 120').replace('複数追球と連続ダイビング版 119','複数追球と連続ダイビング版 120')
new=[f'src/core/sim/fielding/{name}.ts' for name in ['LiveFieldPursuitV1','LiveFieldCommitmentV1','LiveAthleticClearanceV1','LiveFieldCoordinationV2','LivePostActionArrivalV1','LiveObservedRecoveryV120']]
changed=new+['src/core/sim/fielding/LiveFieldDecisionV1.ts','src/core/sim/fielding/LiveFieldPlayV1.ts','src/core/sim/fielding/LiveRelayPlanV1.ts','src/core/sim/fielding/LiveDefenseControlEstimateV95.ts','src/core/sim/fielding/LiveFieldForecastV1.ts','src/core/sim/ball/SourceFreeBallKernel.ts','src/core/sim/ball/BaseballAerodynamicCoefficientProfile.ts','src/core/sim/ball/BaseballAerodynamics.ts','src/core/sim/pitching/AerodynamicPitchTrajectory.ts','src/core/sim/ball/SourceFreeBallSpeedBound.ts','src/core/sim/ball/VersionedBattedBallPhysics.ts','src/core/sim/locomotion/LiveLocomotionV84.ts']
changed.append('src/core/sim/fielding/LiveFielderAvoidanceV1.ts')
source=source.replace('const newNativePaths=[','const v120Paths='+json.dumps(new)+',v120Changes='+json.dumps(changed)+';\nconst newNativePaths=[...v120Paths,',1)
source=source.replace("length,169,'V118 integrates", "length,175,'V120 integrates")
source=source.replace('const allowedNativeChanges=new Set([','const allowedNativeChanges=new Set([...v120Changes,',1)
source=source.replace('const allowedV118NativeChanges=new Set([','const allowedV118NativeChanges=new Set([...v120Changes,',1)
source=source.replace('[...Object.keys(v116Pins.inputs),...[' , '[...Object.keys(v116Pins.inputs),...v120Paths,...[',1)
start=source.index('const baselineV119=')
end=source.index('\nlet game=base;',start)
source=source[:start]+'''const baselineV120=JSON.parse(await textInput('docs/verification/cooperative-defense-v120/performance/configuration.json'));
assert.equal(Object.keys(baselineV120.nativeInputs).length,169,'Frozen V119 native count');
assert.deepEqual(Object.keys(pins.inputs).sort(),[...Object.keys(baselineV120.nativeInputs),...v120Paths].sort(),'Only declared V120 native additions');
for(const [path,hash]of Object.entries(pins.inputs))if(hash!==baselineV120.nativeInputs[path])
 assert(v120Changes.includes(path),'Unexpected native change from V119: '+path);
for(const row of baselineV120.protectedArtifacts)assert.equal(sha(await readFile(row.destination)),row.sha256,'Old V119 retained');
const baselineV119=JSON.parse(await textInput('docs/verification/releases/v119/baseline.json'));
for(const row of baselineV119.oldPublished)assert.equal(sha(await readFile(row.destination)),row.sha256,'Old V118 retained');
''' +source[end:]
source=source.replace('meta={...inherited,releaseVersion:120,','meta={...inherited,cooperativePursuitVersion:120,continuousAthleticClearanceVersion:120,postActionArrivalVersion:120,psychologyConnectionV120:"NOT_CONNECTED",releaseVersion:120,',1)
source=source.replace('ballPhysicsKernelChanged:false','ballPhysicsKernelChanged:true,ballPhysicsNumericsChanged:false,exactSourceQueryMemoVersion:120,poseMemoVersion:120,arrivalMemoVersion:120,locomotionMemoVersion:120')
(p/'build-field-release-v120.mjs').write_text(source,encoding='utf-8')
for stem in ['check-field-release','check-field-authoring','check-athletic']:
 text=(p/(stem+'-v119.mjs')).read_text(encoding='utf-8').replace(stem+'-v119.mjs',stem+'-v120.mjs')
 text=text.replace('baseline?110:119','baseline?110:120').replace('version=119','version=120').replace('version:119','version:120').replace('メーカー_v119_','メーカー_v120_')
 text=text.replace('115|116|117|118','115|116|117|118|119|120')
 (p/(stem+'-v120.mjs')).write_text(text,encoding='utf-8')
print('Prepared separate V120 builder and verification selectors; V119 files unchanged')
