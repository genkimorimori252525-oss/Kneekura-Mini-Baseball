"""Separate V124 delivery. Preserve the previous V123 builder and artifacts."""
from pathlib import Path
import hashlib

source = Path('tools/browser-bridge/build-field-release-v123.mjs').read_bytes()
assert hashlib.sha256(source).hexdigest() == '0f9f445050b559136255024d393eb92184d27aee37955cb3ca2c4218605862e3'
text = source.decode('utf-8')

def once(old, new):
    global text
    assert text.count(old) == 1, old[:120]
    text = text.replace(old, new)

once('Usage: node tools/browser-bridge/build-field-release-v123.mjs', 'Usage: node tools/browser-bridge/build-field-release-v124.mjs')
once("builderPaths=['tools/browser-bridge/build-field-release-v123.mjs'", "builderPaths=['tools/browser-bridge/build-field-release-v124.mjs','tools/browser-bridge/prepare-release-v124.py','docs/demos/baseball-maker-spin-trial-v124.js'")
once("const names={game:'ばせぼーるlv123_TBD_vs_LAD_打球回転技術版.html',maker:'にーくら野球メーカー_v123_打球回転技術版.html',lab:'カメラワーク調整室_v123_打球回転技術版.html'}",
     "const names={game:'ばせぼーるlv124_TBD_vs_LAD_回転技術の試打版.html',maker:'にーくら野球メーカー_v124_回転技術の試打版.html',lab:'カメラワーク調整室_v124_回転技術の試打版.html'}")
once("const changedV123=new Set([...v123Paths,'src/integration/browser/LivePitchV1.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/index.ts']);",
     "const changedV123=new Set([...v123Paths,'src/integration/browser/LivePitchV1.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/index.ts','src/integration/browser/LiveBaseballMatchV1.ts']);")
once('for(const row of baselineV120.protectedArtifacts)',
     "const priorV123=JSON.parse(await textInput('docs/verification/traits-spin-continuation-v123/integrity.json'));\nfor(const row of [...priorV123.artifacts,...priorV123.delivery])assert.equal(sha(await readFile(row.path)),row.sha256,'Protected V123 artifact');\nfor(const row of baselineV120.protectedArtifacts)")
text = text.replace('releaseVersion:123', 'releaseVersion:124').replace('_fresh-maker-v123', '_fresh-maker-v124')
text = text.replace('build-sources-v123.json', 'build-sources-v124.json').replace('build-report-v123.json', 'build-report-v124.json')
text = text.replace('v123 打球回転技術', 'v124 回転技術の試打').replace('<small>v123</small>', '<small>v124</small>')
text = text.replace("sourceSnapshot['tools/browser-bridge/build-field-release-v123.mjs']", "sourceSnapshot['tools/browser-bridge/build-field-release-v124.mjs']")
once('meta={...inherited,spinControlVersion:123', 'meta={...inherited,spinTrialVersion:124,skillMotionSelectionVersion:124,spinControlVersion:123')
once("await textInput('docs/demos/baseball-maker-spin-control-v123.js')+'\\n</script>",
     "await textInput('docs/demos/baseball-maker-spin-control-v123.js')+'\\n'+await textInput('docs/demos/baseball-maker-spin-trial-v124.js')+'\\n</script>")
target = Path('tools/browser-bridge/build-field-release-v124.mjs')
if target.exists():
    assert target.read_bytes() == text.encode('utf-8'), 'existing V124 builder differs'
else:
    target.write_bytes(text.encode('utf-8'))
print({'builder':str(target),'sha256':hashlib.sha256(text.encode('utf-8')).hexdigest()})
