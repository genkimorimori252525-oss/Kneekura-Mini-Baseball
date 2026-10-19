"""Freeze the display-only repair after focused browser verification."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
out = Path('../../outputs')
dest = Path('docs/demos/releases/v76')
proof = Path('docs/verification/releases/v76')
names = {'game.html': 'ばせぼーるlv76_TBD_vs_LAD_空中球とゴロの表示分離版.html',
         'camera-workbench.html': 'カメラワーク調整室_v76.html',
         'maker.html': 'にーくら野球メーカー_v76_ボール表示分離版.html'}
artifacts = {}
inputs = {}
for target, name in names.items():
    path = out / name
    data = path.read_bytes()
    meta_bytes = Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    old_meta = json.loads(Path('docs/demos/releases/v75', target + '.build.json').read_bytes())
    assert len(data) < 100_000_000 and sha(data) == meta['sha256'], target
    pins_bytes = None
    if target == 'maker.html':
        assert meta['ballDisplayFix'] and meta['technicalTraits'] and meta['equipmentPreview']
        assert meta['comparisonLayoutVersion'] == 74 and meta['wholeArc'] and meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
        # Every editable UI, reference, roster and Core input remains v75 exact.
        for key, value in old_meta.items():
            if key.endswith('Sha256') and key not in ['sha256', 'renderedTemplateSha256', 'matchRendererSourceSha256', 'embeddedMatchRendererSha256']:
                assert meta[key] == value, key
    else:
        assert meta['presentationVersion'] == 76 and meta['ballDisplayOnlyChanged']
        assert meta['sourceCoreSha256'] == old_meta['sourceCoreSha256']
        assert not meta['sourceCoreChanged'] and not meta['ballDynamicsRulesAiChanged']
        assert meta['technicalTraitsConnected'] and meta['extendedEquipmentConnected']
        for helper, expected in meta['helpers'].items():
            assert sha(Path('tools/browser-bridge', helper).read_bytes()) == expected, helper
        for key, source in [('builderSha256', 'tools/browser-bridge/build-v76.mjs'),
                            ('workbenchDriverSha256', 'tools/browser-bridge/camera-workbench-v73.js'),
                            ('workbenchTemplateSha256', 'tools/browser-bridge/camera-workbench-v73.html')]:
            assert sha(Path(source).read_bytes()) == meta[key], source
    if target != 'camera-workbench.html':
        pins_bytes = Path(str(path) + '.bundle-inputs.json').read_bytes()
        assert pins_bytes == Path('docs/demos/releases/v75', target + '.bundle-inputs.json').read_bytes()
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
assert json.loads(artifacts['maker.html'][1])['matchRendererSourceSha256'] == sha(game)
browser = json.loads((proof / 'browser/browser-check.json').read_bytes())
assert browser['pass']
for key, target in [('normalSha256', 'game.html'), ('workbenchSha256', 'camera-workbench.html'), ('makerSha256', 'maker.html')]:
    assert browser[key] == sha(artifacts[target][0]), key
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
          'coreInputsAndBytesUnchangedFromV75': True, 'sameEmbeddedGameInLab': True, 'sameOrdinaryRendererInMaker': True,
          'eachHtmlBelow100MB': True, 'physicsChanged': False, 'wholeOriginalPlanComplete': False}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
