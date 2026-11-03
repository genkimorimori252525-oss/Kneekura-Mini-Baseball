"""Create a separate V133 delivery builder; never rewrite the V124 source."""
from pathlib import Path
import hashlib

source_path = Path('tools/browser-bridge/build-field-release-v124.mjs')
source = source_path.read_bytes()
assert hashlib.sha256(source).hexdigest() == '067dd881ae590dd9731e46b99be3e173d26d426dfa9cca0b8767925ccd4092db'
text = source.decode('utf-8')

def once(old, new):
    global text
    assert text.count(old) == 1, old[:100]
    text = text.replace(old, new)

once('Usage: node tools/browser-bridge/build-field-release-v124.mjs',
     'Usage: node tools/browser-bridge/build-field-release-v133.mjs')
once("builderPaths=['tools/browser-bridge/build-field-release-v124.mjs'",
     "builderPaths=['tools/browser-bridge/build-field-release-v133.mjs','tools/browser-bridge/prepare-release-v133.py','tools/browser-bridge/build-field-release-v124.mjs'")
once("const names={game:'ばせぼーるlv124_TBD_vs_LAD_回転技術の試打版.html',maker:'にーくら野球メーカー_v124_回転技術の試打版.html',lab:'カメラワーク調整室_v124_回転技術の試打版.html'}",
     "const names={game:'ばせぼーるlv133_TBD_vs_LAD_スイング準備と振り抜き版.html',maker:'にーくら野球メーカー_v133_スイング準備と振り抜き版.html',lab:'カメラワーク調整室_v133_スイング準備と振り抜き版.html'}")

# Declare every browser addition/change against each retained historical pin.
# Native Node/SQLite practice owners are deliberately absent from this bundle.
once('const v123Paths=[',
     "const v133Paths=['src/core/sim/contact/ReferenceBatEnvelopeV133.ts','src/integration/browser/LiveSwingEnvelopeV133.ts'],\n"
     " v133Changes=[...v133Paths,'src/core/sim/contact/ReferenceBatC1V122.ts','src/core/sim/contact/ReferenceBatMotorV121.ts','src/core/sim/contact/ReferenceBatKinematicsV1.ts','src/integration/browser/LivePitchV1.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/LiveBatPlaybackV88.ts'],\n"
     ' v123Paths=[...v133Paths,')
once('v121Changes=[...v121Paths,', 'v121Changes=[...v133Changes,...v121Paths,')
once("assert.equal(Object.keys(pins.inputs).length,195,'V123 adds three runtime modules without Native practice history');",
     "assert.equal(Object.keys(pins.inputs).length,197,'V133 adds only the two declared browser envelope modules');")
once('const changedV122=new Set([', 'const changedV122=new Set([...v133Changes,')
once('const changedV123=new Set([', 'const changedV123=new Set([...v133Changes,')
once('for(const row of [...priorV123.artifacts,...priorV123.delivery])',
     "const priorV124=JSON.parse(await textInput('docs/verification/spin-trial-v124/integrity.json'));\n"
     'for(const row of [...priorV124.artifacts,...priorV124.delivery])assert.equal(sha(await readFile(row.path)),row.sha256,\'Protected V124 artifact\');\n'
     'for(const row of [...priorV123.artifacts,...priorV123.delivery])')

text = text.replace('releaseVersion:124', 'releaseVersion:133')
text = text.replace('_fresh-maker-v124', '_fresh-maker-v133')
text = text.replace('build-sources-v124.json', 'build-sources-v133.json')
text = text.replace('build-report-v124.json', 'build-report-v133.json')
text = text.replace('v124 回転技術の試打', 'v133 スイング準備と振り抜き')
text = text.replace('<small>v124</small>', '<small>v133</small>')
once('meta={...inherited,spinTrialVersion:124', 'meta={...inherited,swingEnvelopeVersion:133,spinTrialVersion:124')
once("builderSha256:sourceSnapshot['tools/browser-bridge/build-field-release-v124.mjs']",
     "builderSha256:sourceSnapshot['tools/browser-bridge/build-field-release-v133.mjs']")

target = Path('tools/browser-bridge/build-field-release-v133.mjs')
result = text.encode('utf-8')
if target.exists():
    assert target.read_bytes() == result, 'existing V133 builder differs'
else:
    target.write_bytes(result)
print({'builder':str(target),'sha256':hashlib.sha256(result).hexdigest()})
