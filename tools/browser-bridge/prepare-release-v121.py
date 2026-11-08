"""Produce a separately versioned builder; retain the V120 builder and all pins."""
from pathlib import Path

path = Path('tools/browser-bridge/build-field-release-v121.mjs')
if path.exists():
    raise SystemExit('V121 builder already exists')
text = Path('tools/browser-bridge/build-field-release-v120.mjs').read_text(encoding='utf-8')
def once(old, new):
    global text
    assert text.count(old) == 1, old[:100]
    text = text.replace(old, new)

once('Usage: node tools/browser-bridge/build-field-release-v120.mjs', 'Usage: node tools/browser-bridge/build-field-release-v121.mjs')
once("builderPaths=['tools/browser-bridge/build-field-release-v120.mjs'", "builderPaths=['tools/browser-bridge/build-field-release-v121.mjs','docs/demos/baseball-maker-bat-capacity-v121.js','docs/demos/baseball-maker-swing-policy-v121.js'")
once("const names={game:'ばせぼーるlv120_TBD_vs_LAD_複数追球と連続ダイビング版.html',maker:'にーくら野球メーカー_v120_複数追球と連続ダイビング版.html',lab:'カメラワーク調整室_v120_複数追球と連続ダイビング版.html'}", "const names={game:'ばせぼーるlv121_TBD_vs_LAD_スイング意図と球質表示版.html',maker:'にーくら野球メーカー_v121_スイング意図と球質表示版.html',lab:'カメラワーク調整室_v121_スイング意図と球質表示版.html'}")
once("const v120Paths=", "const v121Paths=['src/core/decision/batting/BatterApproachPolicyV121.ts','src/core/sim/contact/ReferenceBatMotorV121.ts','src/integration/browser/BatSwingCapacityV121.ts','src/integration/browser/PitchQualityV121.ts'],\n v121Changes=[...v121Paths,'src/core/sim/contact/ReferenceBatKinematicsV1.ts','src/integration/browser/LiveBatPlaybackV88.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/LivePitchV1.ts','src/integration/browser/PitcherWorkbenchV77.ts','src/integration/browser/WorkbenchPlayer.ts','src/integration/browser/index.ts'];\nconst v120Paths=")
once("length,175,'V120 integrates nine declared perception/decision/trace modules'", "length,179,'V121 integrates exactly four declared new native modules'")
text = text.replace('...v120Paths,', '...v120Paths,...v121Paths,').replace('...v120Paths]', '...v120Paths,...v121Paths]')
text = text.replace('...v120Changes,', '...v120Changes,...v121Changes,')
once("assert(v120Changes.includes(path),'Unexpected native change from V119: '+path)", "assert(v120Changes.includes(path)||v121Changes.includes(path),'Unexpected native change from V119: '+path)")
once("const newNativePaths=[...v120Paths,...v121Paths,", "const newNativePaths=[...v120Paths,...v121Paths,")
once("for(const row of baselineV120.protectedArtifacts)", "const priorV120=JSON.parse(await textInput('../../outputs/_candidate_v120_20261025_04/build-sources-v120.json'));\nfor(const [path,hash] of Object.entries(pins.inputs))if(priorV120.inputs[path]!==hash)assert(v121Changes.includes(path),'Undeclared V121 native change '+path);\nfor(const row of baselineV120.protectedArtifacts)")
text = text.replace('releaseVersion:120', 'releaseVersion:121')
text = text.replace('_fresh-maker-v120', '_fresh-maker-v121')
text = text.replace('build-sources-v120.json\'),JSON.stringify(snapshot', 'build-sources-v121.json\'),JSON.stringify(snapshot')
text = text.replace('build-report-v120.json', 'build-report-v121.json')
once("'<title>にーくら野球メーカー v120 複数追球と連続ダイビング</title>'", "'<title>にーくら野球メーカー v121 スイング意図と球質表示</title>'")
once("'<h1>カメラワーク調整室 <small>v120</small></h1>'", "'<h1>カメラワーク調整室 <small>v121</small></h1>'")
once("meta={...inherited,cooperativePursuitVersion", "meta={...inherited,swingIntentVersion:121,pitchQualityDisplayVersion:121,batCapacityVersion:121,lateEvidenceVersion:121,legacySwingPolicy:'RETAIN_UNTIL_EXPLICIT_AUTHOR_PROFILE',priorPerformanceGoal:'V120_ONE_SCENE_OPEN',cooperativePursuitVersion")
once("const embeddedProof=[];", "maker=once(maker,'</body>','<script>\\n'+await textInput('docs/demos/baseball-maker-bat-capacity-v121.js')+'\\n'+await textInput('docs/demos/baseball-maker-swing-policy-v121.js')+'\\n</script>\\n</body>');\nconst embeddedProof=[];")
text=text.replace("'src/integration/browser/PitchQualityV121.ts']", "'src/integration/browser/PitchQualityV121.ts','src/core/world/psychology/EmotionTypes.ts','src/core/world/psychology/EmotionValidation.ts','src/core/world/psychology/batting/BattingTiming.ts','src/core/world/psychology/execution/ExecutionValidation.ts']")
text=text.replace("'src/integration/browser/index.ts'];", "'src/integration/browser/index.ts','src/integration/browser/LiveBaseballMatchV1.ts'];")
text=text.replace("length,179,'V121 integrates exactly four declared new native modules'", "length,183,'V121 adds four modules and reuses the shared timing boundary'")
text=text.replace('../../outputs/_candidate_v120_20261025_04/build-sources-v120.json','docs/verification/swing-pitch-v121-2026-10-26/baseline-v120-native-inputs.json')
path.write_text(text, encoding='utf-8', newline='\n')
print(path)
