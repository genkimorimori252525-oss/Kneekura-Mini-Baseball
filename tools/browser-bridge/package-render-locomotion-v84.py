"""Freeze v84 only after current-source and actual browser evidence checks."""
from pathlib import Path
import hashlib
import json
import re

sha = lambda value: hashlib.sha256(value).hexdigest()
out, dest, proof = Path('../../outputs'), Path('docs/demos/releases/v84'), Path('docs/verification/releases/v84')
names = {'game.html': 'ばせぼーるlv84_TBD_vs_LAD_描画と接地移動版.html',
         'camera-workbench.html': 'カメラワーク調整室_v84_描画と接地移動.html',
         'maker.html': 'にーくら野球メーカー_v84_描画と接地移動版.html'}
artifacts, inputs, hashes = {}, {}, {}
def pin(path, expected):
    assert sha(Path(path).read_bytes()) == expected, path
    assert path not in inputs or inputs[path] == expected, 'Mixed source generations: ' + path
    inputs[path] = expected

for name, filename in names.items():
    path = out / filename
    data, meta_bytes = path.read_bytes(), Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert sha(data) == meta['sha256'] and meta['presentationVersion'] == 84
    assert meta['frequencyScale'] == 2 and meta['qualityScale'] == 1.2
    assert meta['pitchFrequencyMultiplier'] == 2.5 and meta['battedFrequencyMultiplier'] == 2
    artifacts[name], artifacts[name + '.build.json'] = data, meta_bytes
    hashes[name] = sha(data)
    if name != 'camera-workbench.html':
        pins_bytes = Path(str(path) + '.bundle-inputs.json').read_bytes()
        manifest = json.loads(pins_bytes)
        assert manifest['entrySha256'] == meta['coreSha256' if name == 'maker.html' else 'sourceCoreSha256']
        for source, expected in manifest['inputs'].items():
            pin(source, expected)
        artifacts[name + '.bundle-inputs.json'] = pins_bytes
    if name == 'game.html':
        for source, expected in meta['renderLocomotionSources'].items():
            pin(source, expected)
        pin('tools/browser-bridge/home-run-watch-v83.js', meta['homeRunWatchSources']['tools/browser-bridge/home-run-watch-v83.js'])
        assert meta['homeRunWatchMs'] == 1750 and not meta['nativeDefenderMotionChanged']
        assert meta['sourceInputCount'] == len(manifest['inputs'])
    if name == 'maker.html':
        assert meta['makerRecoveryVersion'] == 82 and meta['referenceClips'] == 673
        assert meta['matchRendererSourceSha256'] == hashes['game.html']
        for source, expected in meta['makerRecoverySources'].items():
            pin(source, expected)
        for source, key in [('tools/browser-bridge/maker-presentation-bridge-v84.js', 'presentationBridgeSha256'),
                            ('tools/browser-bridge/maker-match-renderer-v84.js', 'matchRendererAdapterSha256'),
                            ('tools/browser-bridge/maker-pitcher-renderer-v84.js', 'pitcherAdapterSha256'),
                            ('docs/demos/baseball-maker-batter-comparison-v84.js', 'batterUiSha256')]:
            pin(source, meta[key])

game = artifacts['game.html'].decode('utf-8')
core = next(s[:-1] for s in re.findall(r'<script[^>]*>([\s\S]*?)</script>', game) if 'var KneekuraNativeMatchCore =' in s)
assert sha(core.encode()) == json.loads(artifacts['game.html.build.json'])['sourceCoreSha256']
assert '<script id="v84-live-actor-stride">' in game
encoded = artifacts['camera-workbench.html'].decode().split('const CAMERA_LAB_GAME_HTML=', 1)[1].split('\n', 1)[0].rstrip()
assert json.loads(encoded[:-1]) == game
reports = {}
for path, target, field in [('normal-nine-final/report.json', 'game.html', 'artifactSha256'),
                            ('render-quality-final/report.json', 'game.html', 'artifactSha256'),
                            ('maker-recovery-final/maker-internal-recovery-check.json', 'maker.html', 'sha256'),
                            ('maker-pitch-final/report.json', 'maker.html', 'artifactSha256'),
                            ('maker-traits-final/traits-check.json', 'maker.html', 'sha256'),
                            ('hr-watch/report.json', 'game.html', 'sha256')]:
    raw = (proof / path).read_bytes()
    report = json.loads(raw)
    assert report['pass'] is True and report[field] == hashes[target], path
    reports[path] = sha(raw)
surface_bytes = (proof / 'presentation-surfaces-final/report.json').read_bytes()
surface = json.loads(surface_bytes)
assert surface['pass'] and surface['hashes'] == {k: hashes[v] for k, v in [('normal', 'game.html'), ('lab', 'camera-workbench.html'), ('maker', 'maker.html')]}
reports['presentation-surfaces-final/report.json'] = sha(surface_bytes)
for name in ['cadence-idle-comparison/report.json', 'fielding-matrix-final/report.json', 'rebuild.json']:
    raw = (proof / name).read_bytes()
    assert json.loads(raw)['pass'], name
    reports[name] = sha(raw)
for scenario in json.loads((proof / 'normal-nine-final/report.json').read_bytes())['scenarios']:
    assert scenario['complete']['allFieldComplete'] and scenario['complete']['finished']
for version in ['v81', 'v82', 'v83']:
    for name, expected in json.loads(Path('docs/demos/releases', version, 'SHA256.json').read_bytes()).items():
        assert sha(Path('docs/demos/releases', version, name).read_bytes()) == expected

dest.mkdir(parents=True, exist_ok=True)
for name, data in artifacts.items():
    target = dest / name
    if target.exists():
        assert target.read_bytes() == data, 'Do not replace frozen release ' + name
    else:
        target.write_bytes(data)
contract = {'version': 84, 'inputs': inputs, 'reports': reports,
            'scope': 'Whole-scene cadence/density and live locomotion; movement outcomes intentionally differ. Native historical motor unchanged.',
            'limitations': ['Author control coefficients are not measured calibration.', 'RAF/display and CPU bound actual FPS.',
                            'Tactical arrival estimate is not a physical contact proof.', 'Real-device performance and full Native world certification remain unverified.']}
contract_bytes = (json.dumps(contract, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
(dest / 'source-contract.json').write_bytes(contract_bytes)
artifacts['source-contract.json'] = contract_bytes
(dest / 'SHA256.json').write_text(json.dumps({name: sha(data) for name, data in artifacts.items()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'artifacts': hashes, 'currentSourcePins': len(inputs), 'reports': len(reports)}))
