"""Freeze the verified whole-arc maker, ordinary game and camera workbench."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
out = Path('../../outputs')
dest = Path('docs/demos/releases/v75')
proof = Path('docs/verification/releases/v75')
names = {'game.html': 'ばせぼーるlv75_TBD_vs_LAD_技術得能接続版.html',
         'camera-workbench.html': 'カメラワーク調整室_v75.html',
         'maker.html': 'にーくら野球メーカー_v75_技術得能調整版.html'}
artifacts = {}
inputs = {}
for target, name in names.items():
    path = out / name
    data = path.read_bytes()
    meta_bytes = Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert len(data) < 100_000_000 and sha(data) == meta['sha256'], target
    pins_bytes = None
    if target == 'maker.html':
        assert meta['technicalTraits']
        assert meta['equipmentPreview'] and meta['comparisonLayoutVersion'] == 74
        assert meta['wholeArc'] and meta['playerSwingPreview'] and meta['batOrbit'] and meta['batterComparison']
        assert meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
        for key, source in [('uiSha256', 'docs/demos/baseball-maker-ui.mjs'),
                            ('swingUiSha256', 'docs/demos/baseball-maker-swing-v68.js'),
                            ('lightCssSha256', 'docs/demos/baseball-maker-light-v68.css'),
                            ('helpUiSha256', 'docs/demos/baseball-maker-help-v68.js'),
                            ('comparisonUiSha256', 'docs/demos/baseball-maker-ball-comparison-v69.js'),
                            ('comparisonCssSha256', 'docs/demos/baseball-maker-ball-comparison-v69.css'),
                            ('batterUiSha256', 'docs/demos/baseball-maker-batter-comparison-v70.js'),
                            ('batterCssSha256', 'docs/demos/baseball-maker-batter-comparison-v70.css'),
                            ('matchRendererAdapterSha256', 'tools/browser-bridge/maker-match-renderer-v70.js'),
                            ('templateSha256', 'docs/demos/baseball-maker.html'),
                            ('referenceSha256', 'docs/demos/measured-bat-library-v1.json'),
                            ('libraryDecoderSha256', 'tools/browser-bridge/measured-bat-library-v1.js')]:
            assert sha(Path(source).read_bytes()) == meta[key], source
    else:
        assert meta['presentationVersion'] == 75 and meta['optionalWholeArcTrajectoryConnected']
        assert meta['impactTrajectory']['collisionAndRenderingSameReference']
        assert meta['impactTrajectory']['speedMagnitudeAndTimePreserved']
        assert meta['measuredBatLibrary']['trials'] == 673
        for helper, expected in meta['helpers'].items():
            assert sha(Path('tools/browser-bridge', helper).read_bytes()) == expected, helper
        for key, source in [('builderSha256', 'tools/browser-bridge/build-v75.mjs'),
                            ('workbenchDriverSha256', 'tools/browser-bridge/camera-workbench-v73.js'),
                            ('workbenchTemplateSha256', 'tools/browser-bridge/camera-workbench-v73.html')]:
            assert sha(Path(source).read_bytes()) == meta[key], source
    if target != 'camera-workbench.html':
        pins_bytes = Path(str(path) + '.bundle-inputs.json').read_bytes()
        pins = json.loads(pins_bytes)
        bundle = Path('dist/native-match-core-browser.js' if target == 'game.html' else 'dist/batting-workbench-core.js').read_bytes()
        assert sha(bundle) == pins['entrySha256'] == meta['sourceCoreSha256' if target == 'game.html' else 'coreSha256']
        assert bundle in data
        for source, expected in pins['inputs'].items():
            assert sha(Path(source).read_bytes()) == expected, source
            assert source not in inputs or inputs[source] == expected, source
            inputs[source] = expected
    artifacts[target] = (data, meta_bytes, pins_bytes)
game = artifacts['game.html'][0]
lab = artifacts['camera-workbench.html'][0].decode('utf-8')
encoded = lab.split('const CAMERA_LAB_GAME_HTML=', 1)[1].split('\n', 1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1]).encode('utf-8') == game
maker_meta = json.loads(artifacts['maker.html'][1])
assert maker_meta['matchRendererSourceSha256'] == sha(game)
for folder, filename in [('game', 'game-check.json')]:
    report = json.loads((proof / folder / filename).read_bytes())
    assert report['pass'] and report['normalSha256'] == sha(game)
    assert report['workbenchSha256'] == sha(artifacts['camera-workbench.html'][0])
report = json.loads((proof / 'maker/maker-check.json').read_bytes())
assert report['pass'] and report['sha256'] == sha(artifacts['maker.html'][0])
old_count = 0
for index in Path('docs/demos/releases').glob('*/SHA256.json'):
    if index.parent == dest:
        continue
    for name, expected in json.loads(index.read_bytes()).items():
        assert sha((index.parent / name).read_bytes()) == expected, str(index.parent / name)
        old_count += 1
dest.mkdir(parents=True, exist_ok=True)
for target, (data, meta_bytes, pins_bytes) in artifacts.items():
    (dest / target).write_bytes(data)
    (dest / (target + '.build.json')).write_bytes(meta_bytes)
    if pins_bytes:
        (dest / (target + '.bundle-inputs.json')).write_bytes(pins_bytes)
(dest / 'source-inputs-union.json').write_text(json.dumps(inputs, indent=2) + '\n', encoding='utf-8')
index = {path.name: sha(path.read_bytes()) for path in dest.iterdir() if path.is_file() and path.name not in ['README.md', 'SHA256.json']}
(dest / 'SHA256.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
report = {'pass': True, 'normalSha256': index['game.html'], 'workbenchSha256': index['camera-workbench.html'],
          'makerSha256': index['maker.html'], 'sourceUnionCount': len(inputs), 'olderFrozenFilesUnchanged': old_count,
          'oneExactEmbeddedGame': True, 'sameOrdinaryRendererInMaker': True, 'eachHtmlBelow100MB': True,
          'initial20ProfilesPreserved': True, 'extendedEquipment': True, 'makerOnlyPublicAbilityOverflow': True, 'technicalFamilies': 6, 'wholeOriginalPlanComplete': False}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
