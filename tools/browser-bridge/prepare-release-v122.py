"""Generate a separate V122 builder from the frozen V121 release process."""
from pathlib import Path
import hashlib
import json

source = Path('tools/browser-bridge/build-field-release-v121.mjs').read_bytes()
assert hashlib.sha256(source).hexdigest() == '2a40cbc3d96776201f3f0c7c1c54e73c1b23cc6ebc3ecce357e1fba3b6f415fd'
text = source.decode('utf-8')
target = Path('tools/browser-bridge/build-field-release-v122.mjs')
def once(old, new):
    global text
    assert text.count(old) == 1, old[:100]
    text = text.replace(old, new)

new_paths = ['src/core/decision/batting/BatterIntentV122.ts', 'src/core/sim/contact/ReferenceBatC1V122.ts',
 'src/integration/browser/LiveSwingExecutionV122.ts', 'src/integration/browser/LiveManagerCommunicationV122.ts',
 'src/integration/browser/LiveWorkloadExecutionV122.ts', 'src/integration/browser/LiveMatchWorkloadOwnerV122.ts',
 'src/core/sim/pitch/PitchFatigueExecution.ts', 'src/core/sim/pitch/PitchTimingModel.ts', 'src/core/world/development/PlayerWorkloadRecovery.ts']
once('Usage: node tools/browser-bridge/build-field-release-v121.mjs', 'Usage: node tools/browser-bridge/build-field-release-v122.mjs')
once("builderPaths=['tools/browser-bridge/build-field-release-v121.mjs'", "builderPaths=['tools/browser-bridge/build-field-release-v122.mjs','tools/browser-bridge/prepare-release-v122.py','docs/demos/baseball-maker-swing-execution-v122.js','tools/browser-bridge/live-execution-context-v122.js'")
once("const names={game:'ばせぼーるlv121_TBD_vs_LAD_スイング意図と球質表示版.html',maker:'にーくら野球メーカー_v121_スイング意図と球質表示版.html',lab:'カメラワーク調整室_v121_スイング意図と球質表示版.html'}",
 "const names={game:'ばせぼーるlv122_TBD_vs_LAD_連続スイングと状況実行版.html',maker:'にーくら野球メーカー_v122_連続スイングと状況実行版.html',lab:'カメラワーク調整室_v122_連続スイングと状況実行版.html'}")
once('const v121Paths=[', 'const v122Paths='+json.dumps(new_paths)+',\n v121Paths=[...v122Paths,')
once("v121Changes=[...v121Paths,", "v121Changes=[...v121Paths,'src/core/sim/contact/ReferenceBatImpactTrajectoryV1.ts',")
once("length,183,'V121 adds four modules and reuses the shared timing boundary'", "length,192,'V122 declares nine additional native modules'")
once('for(const row of baselineV120.protectedArtifacts)', "const priorV121=JSON.parse(await textInput('docs/verification/swing-remainder-v122/baseline-v121-native-inputs.json'));\nassert.equal(priorV121.entrySha256,'f42afc00a27bea55d93207e503c4b9b992de2fdea14ddaac356d6546dc2af822');\nconst changedV122=new Set([...v122Paths,'src/core/sim/contact/ReferenceBatImpactTrajectoryV1.ts','src/core/sim/contact/ReferenceBatKinematicsV1.ts','src/core/sim/contact/ReferenceBatMotorV121.ts','src/integration/browser/LiveBaseballMatchV1.ts','src/integration/browser/LivePitchV1.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/index.ts']);\nassert.deepEqual(Object.keys(pins.inputs).sort(),[...Object.keys(priorV121.inputs),...v122Paths].sort());\nfor(const [path,hash]of Object.entries(pins.inputs))if(priorV121.inputs[path]!==hash)assert(changedV122.has(path),'Undeclared V122 change '+path);\nfor(const row of baselineV120.protectedArtifacts)")
text = text.replace('releaseVersion:121', 'releaseVersion:122').replace('_fresh-maker-v121', '_fresh-maker-v122')
text = text.replace('build-sources-v121.json', 'build-sources-v122.json').replace('build-report-v121.json', 'build-report-v122.json')
text = text.replace('v120 複数追球と連続ダイビング', 'v122 連続スイングと状況実行')
text = text.replace('複数追球と連続ダイビング版 120', '連続スイングと状況実行版 122')
text = text.replace('v121 スイング意図と球質表示', 'v122 連続スイングと状況実行').replace('<small>v121</small>', '<small>v122</small>')
text = text.replace("sourceSnapshot['tools/browser-bridge/build-field-release-v120.mjs']", "sourceSnapshot['tools/browser-bridge/build-field-release-v122.mjs']")
once('meta={...inherited,swingIntentVersion:121', 'meta={...inherited,swingExecutionVersion:122,contextExecutionVersion:122,swingIntentVersion:121')
once("await textInput('docs/demos/baseball-maker-swing-policy-v121.js')+'\\n</script>", "await textInput('docs/demos/baseball-maker-swing-policy-v121.js')+'\\n'+await textInput('docs/demos/baseball-maker-swing-execution-v122.js')+'\\n</script>")
once("game=applyBackgroundMatchV116(game,await textInput('tools/browser-bridge/background-match-v116.js'));", "game=applyBackgroundMatchV116(game,await textInput('tools/browser-bridge/background-match-v116.js'));\ngame=once(game,'workerConfigurationV116={seed:','workerConfigurationV116=window.KneekuraLiveExecutionV122.decorate({seed:');\ngame=once(game,'park,measuredClips:measured.clips},\\n    nextHost=window.KneekuraBackgroundMatchV116.create','park,measuredClips:measured.clips}),\\n    nextHost=window.KneekuraBackgroundMatchV116.create');\ngame=once(game,'<script id=\"background-match-v116\">','<script>'+await textInput('tools/browser-bridge/live-execution-context-v122.js')+'</script>\\n<script id=\"background-match-v116\">');")

baseline = Path('docs/verification/swing-remainder-v122/baseline-v121-native-inputs.json')
if not baseline.exists():
    previous = Path('../../outputs/_candidate_v121_20261026_10/ばせぼーるlv121_TBD_vs_LAD_スイング意図と球質表示版.html.bundle-inputs.json').read_bytes()
    pins = json.loads(previous)
    assert pins['entrySha256'] == 'f42afc00a27bea55d93207e503c4b9b992de2fdea14ddaac356d6546dc2af822' and len(pins['inputs']) == 183
    baseline.parent.mkdir(parents=True, exist_ok=True)
    baseline.write_bytes(previous)
if target.exists():
    assert target.read_bytes() == text.encode('utf-8'), 'existing V122 builder differs from deterministic generator'
else:
    target.write_bytes(text.encode('utf-8'))
print(json.dumps({'builder':str(target),'sha256':hashlib.sha256(text.encode('utf-8')).hexdigest()}))
