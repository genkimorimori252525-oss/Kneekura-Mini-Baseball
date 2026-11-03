"""Freeze the three tested, self-contained v68 artifacts and their source pins."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
out = Path('../../outputs')
dest = Path('docs/demos/releases/v68')
proof = Path('docs/verification/releases/v68')
names = {
    'game.html': 'ばせぼーるlv68_TBD_vs_LAD_弾道と実測フォーム接続版.html',
    'camera-workbench.html': 'カメラワーク調整室_v68.html',
    'maker.html': 'にーくら野球メーカー_v68.html',
}
artifacts = {}
inputs = {}
for target, name in names.items():
    path = out / name
    data = path.read_bytes()
    meta_bytes = Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert len(data) < 100_000_000 and sha(data) == meta['sha256'], target
    if target == 'maker.html':
        assert meta['measuredLibrary'] and meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
        for key, source in [
            ('uiSha256', 'docs/demos/baseball-maker-ui.mjs'),
            ('swingUiSha256', 'docs/demos/baseball-maker-swing-v68.js'),
            ('helpUiSha256', 'docs/demos/baseball-maker-help-v68.js'),
            ('lightCssSha256', 'docs/demos/baseball-maker-light-v68.css'),
            ('templateSha256', 'docs/demos/baseball-maker.html'),
            ('referenceSha256', 'docs/demos/measured-bat-library-v1.json'),
            ('libraryDecoderSha256', 'tools/browser-bridge/measured-bat-library-v1.js'),
        ]:
            assert sha(Path(source).read_bytes()) == meta[key], source
    else:
        assert meta['presentationVersion'] == 68 and meta['optionalImpactTrajectoryConnected']
        assert meta['impactTrajectory']['collisionAndRenderingSameReference']
        assert meta['measuredBatLibrary']['trials'] == 673
        assert meta['ballDisplayDefaults'] == {'perspective': 1, 'overhead': 1, 'overheadHeightEmphasis': 2}
        for helper, expected in meta['helpers'].items():
            assert sha(Path('tools/browser-bridge', helper).read_bytes()) == expected, helper
        for key, source in [
            ('workbenchDriverSha256', 'tools/browser-bridge/camera-workbench-v68.js'),
            ('workbenchTemplateSha256', 'tools/browser-bridge/camera-workbench-v68.html'),
            ('builderSha256', 'tools/browser-bridge/build-v68.mjs'),
        ]:
            assert sha(Path(source).read_bytes()) == meta[key], source
        library = meta['measuredBatLibrary']
        assert sha(Path(library['path']).read_bytes()) == library['sha256']
        assert sha(Path(library['decoderPath']).read_bytes()) == library['decoderSha256']
    pin_bytes = None
    if target != 'camera-workbench.html':
        bundle = Path('dist/native-match-core-browser.js' if target == 'game.html' else 'dist/batting-workbench-core.js')
        pin_bytes = Path(str(path) + '.bundle-inputs.json').read_bytes()
        pins = json.loads(pin_bytes)
        assert sha(bundle.read_bytes()) == pins['entrySha256']
        assert pins['entrySha256'] == meta['sourceCoreSha256' if target == 'game.html' else 'coreSha256']
        assert bundle.read_bytes().decode('utf-8') in data.decode('utf-8')
        for source, expected in pins['inputs'].items():
            assert sha(Path(source).read_bytes()) == expected, source
            assert source not in inputs or inputs[source] == expected, source
            inputs[source] = expected
    artifacts[target] = (data, meta_bytes, pin_bytes)

game = artifacts['game.html'][0].decode('utf-8')
lab = artifacts['camera-workbench.html'][0].decode('utf-8')
encoded = lab.split('const CAMERA_LAB_GAME_HTML=', 1)[1].split('\n', 1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1]) == game
game_report = json.loads((proof / 'game/game-check.json').read_bytes())
maker_report = json.loads((proof / 'maker/maker-check.json').read_bytes())
assert game_report['pass'] and game_report['normalSha256'] == sha(artifacts['game.html'][0])
assert game_report['workbenchSha256'] == sha(artifacts['camera-workbench.html'][0])
assert maker_report['pass'] and maker_report['sha256'] == sha(artifacts['maker.html'][0])

older_count = 0
for manifest in Path('docs/demos/releases').glob('*/SHA256.json'):
    if manifest.parent == dest:
        continue
    for name, expected in json.loads(manifest.read_bytes()).items():
        assert sha((manifest.parent / name).read_bytes()) == expected, str(manifest.parent / name)
        older_count += 1

dest.mkdir(parents=True, exist_ok=True)
for target, (data, meta_bytes, pin_bytes) in artifacts.items():
    (dest / target).write_bytes(data)
    (dest / (target + '.build.json')).write_bytes(meta_bytes)
    if pin_bytes:
        (dest / (target + '.bundle-inputs.json')).write_bytes(pin_bytes)
(dest / 'source-inputs-union.json').write_text(json.dumps(inputs, indent=2) + '\n', encoding='utf-8')
index = {path.name: sha(path.read_bytes()) for path in dest.iterdir()
         if path.is_file() and path.name not in ['README.md', 'SHA256.json']}
(dest / 'SHA256.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
report = {'pass': True, 'normalSha256': index['game.html'], 'workbenchSha256': index['camera-workbench.html'],
          'makerSha256': index['maker.html'], 'sourceUnionCount': len(inputs), 'oldFrozenFilesVerified': older_count,
          'oneExactEmbeddedGame': True, 'eachHtmlBelow100MB': True, 'initial20ProfilesPreserved': True,
          'wholeOriginalPlanComplete': False, 'charterApproval': 'UNAPPROVED_HOLD_RETAINED'}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
