"""Freeze the narrowly verified Presentation change, preserving the v81 Core."""
from pathlib import Path
import hashlib
import json
import re

sha = lambda value: hashlib.sha256(value).hexdigest()
out, dest, proof = Path('../../outputs'), Path('docs/demos/releases/v83'), Path('docs/verification/releases/v83-hr-watch')
names = {'game.html': 'ばせぼーるlv83_TBD_vs_LAD_HR見送り延長版.html',
         'camera-workbench.html': 'カメラワーク調整室_v83_HR見送り.html'}
artifacts, inputs, hashes = {}, {}, {}
base_meta = json.loads(Path('docs/demos/releases/v81/game.html.build.json').read_bytes())
for name, filename in names.items():
    path = out / filename
    data, meta_bytes = path.read_bytes(), Path(str(path) + '.build.json').read_bytes()
    meta = json.loads(meta_bytes)
    assert sha(data) == meta['sha256'] and meta['homeRunWatchMs'] == 1750
    assert meta['sourceCoreSha256'] == base_meta['sourceCoreSha256'] and meta['sourceCoreChanged'] is False
    assert not any(meta[key] for key in ['ballDynamicsChanged', 'battingMotorChanged', 'playerMovementChanged', 'renderCadenceChanged', 'renderQualityChanged'])
    for source, expected in meta['homeRunWatchSources'].items():
        assert sha(Path(source).read_bytes()) == expected
        inputs[source] = expected
    artifacts[name], artifacts[name + '.build.json'] = data, meta_bytes
    hashes[name] = sha(data)
    if name == 'game.html':
        pins = Path(str(path) + '.bundle-inputs.json').read_bytes()
        assert pins == Path('docs/demos/releases/v81/game.html.bundle-inputs.json').read_bytes()
        artifacts[name + '.bundle-inputs.json'] = pins
game = artifacts['game.html'].decode('utf-8')
core = next(source[:-1] for source in re.findall(r'<script[^>]*>([\s\S]*?)</script>', game) if 'var KneekuraNativeMatchCore =' in source)
assert sha(core.encode('utf-8')) == base_meta['sourceCoreSha256']
encoded = artifacts['camera-workbench.html'].decode('utf-8').split('const CAMERA_LAB_GAME_HTML=', 1)[1].split('\n', 1)[0].rstrip()
assert json.loads(encoded[:-1]) == game
for name, expected in json.loads(Path('docs/demos/releases/v81/SHA256.json').read_bytes()).items():
    assert sha(Path('docs/demos/releases/v81', name).read_bytes()) == expected
reports = {}
for path, target, field in [('browser-final/report.json', 'game.html', 'sha256'), ('pixels/report.json', 'game.html', 'artifactSha256'),
                            ('history/report.json', 'game.html', 'artifactSha256'), ('lab/report.json', 'camera-workbench.html', 'sha256')]:
    raw = (proof / path).read_bytes()
    report = json.loads(raw)
    assert report['pass'] is True and report[field] == hashes[target], path
    reports[path] = sha(raw)
dest.mkdir(parents=True, exist_ok=True)
for name, data in artifacts.items():
    target = dest / name
    if target.exists():
        assert target.read_bytes() == data, 'Do not replace frozen release ' + name
    else:
        target.write_bytes(data)
contract = {'version': 83, 'coreSha256': base_meta['sourceCoreSha256'], 'presentationSources': inputs,
            'reports': reports, 'scope': 'HR camera watch only; FPS, quality and locomotion requests remain pending.'}
(dest / 'source-contract.json').write_text(json.dumps(contract, indent=2) + '\n', encoding='utf-8')
artifacts['source-contract.json'] = (dest / 'source-contract.json').read_bytes()
(dest / 'SHA256.json').write_text(json.dumps({name: sha(data) for name, data in artifacts.items()}, indent=2) + '\n', encoding='utf-8')
for source, name in [('work/v83-home-run-watch-crossing-red.log', 'unit-crossing-red.log'),
                     ('work/v83-home-run-watch-red.log', 'unit-initial-red.log'), ('work/v83-home-run-watch-green.log', 'unit-green.log')]:
    (proof / name).write_bytes(Path(source).read_bytes())
print(json.dumps({'pass': True, 'artifacts': hashes, 'sourceCoreUnchanged': True, 'reports': len(reports)}))
