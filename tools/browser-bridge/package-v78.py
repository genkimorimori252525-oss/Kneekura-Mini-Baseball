"""Freeze the independently verified V78 game, maker and camera laboratory."""
import hashlib
import json
from pathlib import Path

sha = lambda b: hashlib.sha256(b).hexdigest()
out, dest, proof = Path('../../outputs'), Path('docs/demos/releases/v78'), Path('docs/verification/releases/v78')
names = {'game.html': 'ばせぼーるlv78_TBD_vs_LAD_球種と縫い目物理版.html',
         'camera-workbench.html': 'カメラワーク調整室_v78.html', 'maker.html': 'にーくら野球メーカー_v78_球種と縫い目物理版.html'}
artifacts, inputs = {}, {}
maker_sources = {'uiSha256': 'docs/demos/baseball-maker-ui.mjs', 'swingUiSha256': 'docs/demos/baseball-maker-swing-v68.js',
    'lightCssSha256': 'docs/demos/baseball-maker-light-v68.css', 'helpUiSha256': 'docs/demos/baseball-maker-help-v68.js',
    'comparisonUiSha256': 'docs/demos/baseball-maker-ball-comparison-v69.js', 'comparisonCssSha256': 'docs/demos/baseball-maker-ball-comparison-v69.css',
    'batterUiSha256': 'docs/demos/baseball-maker-batter-comparison-v70.js', 'batterCssSha256': 'docs/demos/baseball-maker-batter-comparison-v70.css',
    'matchRendererAdapterSha256': 'tools/browser-bridge/maker-match-renderer-v70.js', 'templateSha256': 'docs/demos/baseball-maker.html',
    'referenceSha256': 'docs/demos/measured-bat-library-v1.json', 'libraryDecoderSha256': 'tools/browser-bridge/measured-bat-library-v1.js',
    'pitcherUiSha256': 'docs/demos/baseball-maker-pitcher-v78.js', 'pitcherCssSha256': 'docs/demos/baseball-maker-pitcher-v78.css',
    'pitcherAdapterSha256': 'tools/browser-bridge/maker-pitcher-renderer-v77.js', 'traitAvailabilitySha256': 'docs/demos/live-trait-availability-v77.json',
    'liveRosterSha256': 'docs/demos/live-game-roster-v62.json', 'liveRosterCatalogSha256': 'docs/demos/live-game-roster-catalog-v77.json'}
for target, name in names.items():
    path = out / name
    data, meta_bytes = path.read_bytes(), Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert len(data) < 100_000_000 and sha(data) == meta['sha256'], target
    if target == 'maker.html':
        assert meta['independentTraits'] and meta['pitcherWorkbench'] and meta['pitchLibrary'] and meta['technicalTraits'] and meta['wholeArc']
        assert meta['comparisonLayoutVersion'] == 74 and meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
        for key, source in maker_sources.items():
            assert sha(Path(source).read_bytes()) == meta[key], source
    else:
        assert meta['presentationVersion'] == 78 and meta['independentTraitsConnected'] and meta['pitcherWorkbenchConnected']
        for helper, expected in meta['helpers'].items():
            assert sha(Path('tools/browser-bridge', helper).read_bytes()) == expected, helper
        for key, source in [('builderSha256', 'tools/browser-bridge/build-v78.mjs'),
                            ('workbenchDriverSha256', 'tools/browser-bridge/camera-workbench-v78.js'),
                            ('workbenchTemplateSha256', 'tools/browser-bridge/camera-workbench-v78.html')]:
            assert sha(Path(source).read_bytes()) == meta[key], source
    pins_bytes = None
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
game, lab = artifacts['game.html'][0], artifacts['camera-workbench.html'][0].decode('utf-8')
encoded = lab.split('const CAMERA_LAB_GAME_HTML=', 1)[1].split('\n', 1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1]).encode('utf-8') == game
maker_meta = json.loads(artifacts['maker.html'][1])
assert maker_meta['matchRendererSourceSha256'] == sha(game)
maker_text = artifacts['maker.html'][0].decode('utf-8')
for variable, key in [('KneekuraMakerMatchHtmlV70', 'embeddedMatchRendererSha256'),
                      ('KneekuraMakerPitcherMatchHtmlV77', 'embeddedPitcherRendererSha256')]:
    encoded = maker_text.split('globalThis.' + variable + '=', 1)[1].split('\n', 1)[0].rstrip()
    assert encoded.endswith(';') and sha(json.loads(encoded[:-1]).encode('utf-8')) == maker_meta[key], variable
for folder, filename, targets in [
    ('game', 'game-check.json', {'hashesAtStart.normal': 'game.html', 'hashesAtStart.lab': 'camera-workbench.html'}),
    ('traits', 'traits-check.json', {'sha256': 'maker.html'}),
    ('height', 'height-check.json', {'normalSha256': 'game.html', 'workbenchSha256': 'camera-workbench.html'}),
    ('pitcher-maker', 'pitcher-maker-check.json', {'sha256': 'maker.html'}),
]:
    report = json.loads((proof / folder / filename).read_bytes())
    assert report['pass'], folder
    if folder == 'game':
        assert report['hashesAtStart'] == report['hashesAtEnd']
        assert report['game']['finished'] and report['game']['allFieldComplete'] and not report['game']['fallback']
    for key, target in targets.items():
        observed = report
        for part in key.split('.'):
            observed = observed[part]
        assert observed == sha(artifacts[target][0]), folder + ': ' + key
consultation = json.loads(Path('docs/verification/releases/v78/consultation-check.json').read_bytes())
assert consultation['pass'] and consultation['sourceCoreSha256'] == json.loads(artifacts['game.html'][1])['sourceCoreSha256']
assert consultation['authoringCoreSha256'] == maker_meta['coreSha256']
contract = json.loads(Path('docs/design-consultation/runtime-contract-v78.json').read_bytes())
catalog = json.loads(Path('docs/demos/live-pitch-catalog-v78.json').read_bytes())
assert len(catalog['types']) == 15 and len(catalog['presets']) == 24 and len(contract['traits']) == 17
assert contract['sourceCoreSha256'] == consultation['sourceCoreSha256'] and contract['authoringCoreSha256'] == consultation['authoringCoreSha256']
old_catalog = json.loads(Path('docs/demos/live-game-roster-catalog-v62.json').read_bytes())
new_catalog = json.loads(Path('docs/demos/live-game-roster-catalog-v77.json').read_bytes())
assert old_catalog['players'] == new_catalog['players']
assert [f['path'] for f in old_catalog['fields']] == [f['path'] for f in new_catalog['fields']]
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
index = {p.name: sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md', 'SHA256.json']}
(dest / 'SHA256.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
report = {'pass': True, 'normalSha256': index['game.html'], 'workbenchSha256': index['camera-workbench.html'],
    'makerSha256': index['maker.html'], 'sourceUnionCount': len(inputs), 'olderFrozenFilesUnchanged': old_count,
    'sameEmbeddedGameInLab': True, 'sameOrdinaryRendererInBothMakerAdapters': True,
    'initialTwentyAndMeasuredLibraryPreserved': True, 'eachHtmlBelow100MB': True, 'wholeOriginalPlanComplete': False}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
