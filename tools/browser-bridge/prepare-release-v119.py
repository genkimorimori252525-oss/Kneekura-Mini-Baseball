from pathlib import Path
p=Path('tools/browser-bridge')
source=(p/'build-field-release-v118.mjs').read_text(encoding='utf-8')
for before,after in [
 ('build-field-release-v118.mjs','build-field-release-v119.mjs'),
 ('_fresh-maker-v118','_fresh-maker-v119'),
 ('lv118_TBD_vs_LAD_個人判断と守備連携版','lv119_TBD_vs_LAD_接触停止と守備連携修正版'),
 ('v118_個人判断と守備連携版','v119_接触停止と守備連携修正版'),
 ('v118 個人判断と守備連携','v119 接触停止と守備連携修正'),
 ('<small>v118</small>','<small>v119</small>'),
 ('TBD対LAD 個人判断と守備連携版 118','TBD対LAD 接触停止と守備連携修正版 119'),
 ('releaseVersion:118','releaseVersion:119'),
 ('build-sources-v118.json','build-sources-v119.json'),
 ('build-report-v118.json','build-report-v119.json')]:
 assert before in source,before
 source=source.replace(before,after)
old='for(const path of nativeChangesFromV116)assert(allowedV118NativeChanges.has(path),\'Unexpected native change from frozen V116: \'+path);'
assert old in source
source=source.replace(old,old+'''
const baselineV119=JSON.parse(await textInput('docs/verification/releases/v119/baseline.json')),
 allowedV119Changes=new Set(['src/core/sim/fielding/LiveFieldDecisionV1.ts','src/integration/browser/LiveBaseballMatchV1.ts']);
assert.deepEqual(Object.keys(pins.inputs).sort(),Object.keys(baselineV119.nativeInputs).sort(),'No new V119 native dependency');
for(const [path,hash]of Object.entries(pins.inputs))if(hash!==baselineV119.nativeInputs[path])
 assert(allowedV119Changes.has(path),'Unexpected native change from V118: '+path);
for(const row of baselineV119.oldPublished)assert.equal(sha(await readFile(row.destination)),row.sha256,'Old V118 retained');
''')
(p/'build-field-release-v119.mjs').write_text(source,encoding='utf-8')
for stem in ['check-field-release','check-field-authoring','check-athletic']:
 text=(p/(stem+'-v118.mjs')).read_text(encoding='utf-8')
 # Only the release selector changes; existing V118 runtime API names stay.
 text=text.replace(stem+'-v118.mjs',stem+'-v119.mjs').replace('baseline?110:118','baseline?110:119').replace('version=118','version=119').replace('version:118','version:119').replace('メーカー_v118_','メーカー_v119_')
 (p/(stem+'-v119.mjs')).write_text(text,encoding='utf-8')
print('Prepared V119 builder and three existing browser verification entry points')
