"""Freeze only the verified v81 products and their exact source contracts."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
out, dest, proof = Path('../../outputs'), Path('docs/demos/releases/v81'), Path('docs/verification/releases/v81')
names = {'game.html': 'ばせぼーるlv81_TBD_vs_LAD_無劣化性能改善版.html',
         'camera-workbench.html': 'カメラワーク調整室_v81.html', 'maker.html': 'にーくら野球メーカー_v81_無劣化性能改善版.html'}
artifacts, inputs = {}, {}
maker_sources = {'uiSha256': 'docs/demos/baseball-maker-ui.mjs', 'swingUiSha256': 'docs/demos/baseball-maker-swing-v68.js',
 'helpUiSha256': 'docs/demos/baseball-maker-help-v68.js', 'lightCssSha256': 'docs/demos/baseball-maker-light-v68.css',
 'comparisonUiSha256': 'docs/demos/baseball-maker-ball-comparison-v69.js', 'comparisonCssSha256': 'docs/demos/baseball-maker-ball-comparison-v69.css',
 'batterUiSha256': 'docs/demos/baseball-maker-batter-comparison-v81.js', 'batterCssSha256': 'docs/demos/baseball-maker-batter-comparison-v70.css',
 'matchRendererAdapterSha256': 'tools/browser-bridge/maker-match-renderer-v81.js', 'pitcherAdapterSha256': 'tools/browser-bridge/maker-pitcher-renderer-v81.js',
 'pitcherUiSha256': 'docs/demos/baseball-maker-pitcher-v78.js', 'pitcherCssSha256': 'docs/demos/baseball-maker-pitcher-v78.css',
 'pitchViewsUiSha256': 'docs/demos/baseball-maker-pitcher-views-v78.js', 'courseUiSha256': 'docs/demos/baseball-maker-course-v79.js',
 'courseCssSha256': 'docs/demos/baseball-maker-course-v79.css', 'courseChartsSha256': 'tools/browser-bridge/course-charts-v79.js',
 'seasonClientSha256': 'tools/browser-bridge/live-season-client-v79.js', 'pitchMenuUiSha256': 'docs/demos/baseball-maker-pitch-menu-v80.js',
 'pitchMenuCssSha256': 'docs/demos/baseball-maker-pitch-menu-v80.css', 'templateSha256': 'docs/demos/baseball-maker.html',
 'referenceSha256': 'docs/demos/measured-bat-library-v1.json', 'libraryDecoderSha256': 'tools/browser-bridge/measured-bat-library-v1.js',
 'liveRosterSha256': 'docs/demos/live-game-roster-v62.json', 'liveRosterCatalogSha256': 'docs/demos/live-game-roster-catalog-v77.json',
 'traitAvailabilitySha256': 'docs/demos/live-trait-availability-v77.json'}
for target, name in names.items():
    path = out / name
    data, meta_bytes = path.read_bytes(), Path(str(path)+'.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert len(data) < 100_000_000 and sha(data) == meta['sha256'], target
    assert meta['losslessPerformanceVersion'] == 81 and meta['fullMeasuredCatalogPreserved'] and meta['fullSceneCadence']
    if target == 'maker.html':
        assert meta['referenceClips'] == 673 and meta['gamePlayers'] == 20 and meta['pitchMenu'] and meta['courseSeasons'] and meta['pitchViews']
        assert meta['independentTraits'] and meta['technicalTraits'] and meta['wholeArc'] and meta['comparisonLayoutVersion'] == 74
        for key, source in maker_sources.items():
            assert sha(Path(source).read_bytes()) == meta[key], source
    else:
        assert meta['presentationVersion'] == 81 and not meta['ballDynamicsChanged'] and not meta['battingMotorChanged']
        for filename, expected in {**meta['helpers'], **meta['performanceSources']}.items():
            assert sha(Path('tools/browser-bridge', filename).read_bytes()) == expected, filename
        for key, filename in [('builderSha256','build-v81.mjs'),('workbenchDriverSha256','camera-workbench-v81.js'),('workbenchTemplateSha256','camera-workbench-v81.html')]:
            assert sha(Path('tools/browser-bridge',filename).read_bytes()) == meta[key], filename
    pins_bytes = None
    if target != 'camera-workbench.html':
        pins_bytes = Path(str(path)+'.bundle-inputs.json').read_bytes()
        pins = json.loads(pins_bytes)
        bundle = Path('dist/native-match-core-browser.js' if target == 'game.html' else 'dist/batting-workbench-core.js').read_bytes()
        assert sha(bundle) == pins['entrySha256'] == meta['sourceCoreSha256' if target == 'game.html' else 'coreSha256'] and bundle in data
        for source, expected in pins['inputs'].items():
            assert sha(Path(source).read_bytes()) == expected, source
            assert source not in inputs or inputs[source] == expected, source
            inputs[source] = expected
    artifacts[target] = (data, meta_bytes, pins_bytes)
game = artifacts['game.html'][0]
lab = artifacts['camera-workbench.html'][0].decode('utf-8')
encoded = lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip()
assert json.loads(encoded[:-1]).encode('utf-8') == game
maker_meta = json.loads(artifacts['maker.html'][1])
assert maker_meta['matchRendererSourceSha256'] == sha(game)
maker = artifacts['maker.html'][0].decode('utf-8')
for variable,key in [('KneekuraMakerMatchHtmlV70','embeddedMatchRendererSha256'),('KneekuraMakerPitcherMatchHtmlV77','embeddedPitcherRendererSha256')]:
    encoded = maker.split('globalThis.'+variable+'=',1)[1].split('\n',1)[0].rstrip()
    assert sha(json.loads(encoded[:-1]).encode('utf-8')) == maker_meta[key]
reports = [('scenes-final', 'report.json', 'artifactSha256', 'game.html'),
 ('maker-final','report.json','sha256','maker.html'), ('lab-final','report.json','sha256','camera-workbench.html'),
 ('full-history-v81-comparison','report.json','artifactSha256','game.html'),
 ('pitch-menu-corrected','report.json','sha256','maker.html'),
 ('pitch-views-final','pitch-views-check.json','sha256','maker.html'), ('traits-final','traits-check.json','sha256','maker.html'),
 ('course-final','report.json','sha256','maker.html')]
for folder, filename, key, target in reports:
    result = json.loads((proof / folder / filename).read_bytes())
    assert result['pass'] and result[key] == sha(artifacts[target][0]), folder
assert json.loads((proof/'raf-cadence/report.json').read_bytes())['pass']
for version in ['v79','v80']:
    for filename, expected in json.loads(Path('docs/demos/releases',version,'SHA256.json').read_bytes()).items():
        assert sha(Path('docs/demos/releases',version,filename).read_bytes()) == expected, (version,filename)
dest.mkdir(parents=True,exist_ok=True)
for target,(data,meta_bytes,pins_bytes) in artifacts.items():
    (dest/target).write_bytes(data)
    (dest/(target+'.build.json')).write_bytes(meta_bytes)
    if pins_bytes:
        (dest/(target+'.bundle-inputs.json')).write_bytes(pins_bytes)
(dest/'source-inputs-union.json').write_text(json.dumps(inputs,indent=2)+'\n',encoding='utf-8')
index = {p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
report = {'pass':True,'artifacts':{name:sha(value[0]) for name,value in artifacts.items()},'sourceUnionCount':len(inputs),
 'v79AndV80FrozenUnchanged':True,'embeddedGameAndAdapterPinsMatched':True,'full673AndInitial20Preserved':True,
 'allRequestedBrowserGuardsPassed':True,'actualMobileDeviceTested':False,'originalFullRoadmapComplete':False}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
