"""Derive a separate opt-in V123 builder; preserve frozen V122 artifacts."""
from pathlib import Path
import hashlib
import json

source = Path('tools/browser-bridge/build-field-release-v122.mjs').read_bytes()
assert hashlib.sha256(source).hexdigest() == 'b9f28591ead64a07d8d87f7b60b319b128166ce4dbe838a8e1d82414c902a393'
text = source.decode('utf-8')

def once(old, new):
    global text
    assert text.count(old) == 1, old[:120]
    text = text.replace(old, new)

paths = ['src/core/world/traits/SpinTechniqueV123.ts', 'src/core/sim/contact/BattedBallSpinObservationV123.ts',
         'src/integration/browser/LiveSpinControlV123.ts']
once('Usage: node tools/browser-bridge/build-field-release-v122.mjs', 'Usage: node tools/browser-bridge/build-field-release-v123.mjs')
once("builderPaths=['tools/browser-bridge/build-field-release-v122.mjs'", "builderPaths=['tools/browser-bridge/build-field-release-v123.mjs','tools/browser-bridge/prepare-release-v123.py','docs/demos/baseball-maker-spin-control-v123.js'")
once("const names={game:'ばせぼーるlv122_TBD_vs_LAD_連続スイングと状況実行版.html',maker:'にーくら野球メーカー_v122_連続スイングと状況実行版.html',lab:'カメラワーク調整室_v122_連続スイングと状況実行版.html'}",
     "const names={game:'ばせぼーるlv123_TBD_vs_LAD_打球回転技術版.html',maker:'にーくら野球メーカー_v123_打球回転技術版.html',lab:'カメラワーク調整室_v123_打球回転技術版.html'}")
once('const v122Paths=[', 'const v123Paths='+json.dumps(paths)+',\n v122Paths=[...v123Paths,')
once("length,192,'V122 declares nine additional native modules'", "length,195,'V123 adds three runtime modules without Native practice history'")
once('for(const row of baselineV120.protectedArtifacts)',
     "const priorV122=JSON.parse(await textInput('docs/verification/traits-spin-continuation-v123/baseline-v122-native-inputs.json'));\nassert.equal(priorV122.entrySha256,'ae895ce42361d82920e6ede5c86d97ffd0edee63e7b462b8280c936a8042d3db');\nassert.deepEqual(Object.keys(pins.inputs).sort(),[...Object.keys(priorV122.inputs),...v123Paths].sort());\nconst changedV123=new Set([...v123Paths,'src/integration/browser/LivePitchV1.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/index.ts']);\nfor(const [path,hash]of Object.entries(pins.inputs))if(priorV122.inputs[path]!==hash)assert(changedV123.has(path),'Undeclared V123 native change '+path);\nfor(const row of baselineV120.protectedArtifacts)")
text = text.replace('releaseVersion:122', 'releaseVersion:123').replace('_fresh-maker-v122', '_fresh-maker-v123')
text = text.replace('build-sources-v122.json', 'build-sources-v123.json').replace('build-report-v122.json', 'build-report-v123.json')
text = text.replace('v122 連続スイングと状況実行', 'v123 打球回転技術').replace('<small>v122</small>', '<small>v123</small>')
text = text.replace("sourceSnapshot['tools/browser-bridge/build-field-release-v122.mjs']", "sourceSnapshot['tools/browser-bridge/build-field-release-v123.mjs']")
once('meta={...inherited,swingExecutionVersion:122', 'meta={...inherited,spinControlVersion:123,spinBoundary:"LOCAL_AUTHORING_ONLY",swingExecutionVersion:122')
once("await textInput('docs/demos/baseball-maker-swing-execution-v122.js')+'\\n</script>",
     "await textInput('docs/demos/baseball-maker-swing-execution-v122.js')+'\\n'+await textInput('docs/demos/baseball-maker-spin-control-v123.js')+'\\n</script>")

baseline = Path('docs/verification/traits-spin-continuation-v123/baseline-v122-native-inputs.json')
previous = Path('../../outputs/_candidate_v122_20261026_02/ばせぼーるlv122_TBD_vs_LAD_連続スイングと状況実行版.html.bundle-inputs.json').read_bytes()
pins = json.loads(previous)
assert pins['entrySha256'] == 'ae895ce42361d82920e6ede5c86d97ffd0edee63e7b462b8280c936a8042d3db' and len(pins['inputs']) == 192
if baseline.exists():
    assert baseline.read_bytes() == previous
else:
    baseline.write_bytes(previous)
target = Path('tools/browser-bridge/build-field-release-v123.mjs')
if target.exists():
    assert target.read_bytes() == text.encode('utf-8'), 'existing V123 builder differs'
else:
    target.write_bytes(text.encode('utf-8'))
print(json.dumps({'builder': str(target), 'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest()}))
