"""Freeze the tested camera workbench and the unchanged current Core inputs."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path('.')
outputs = Path('../../outputs')
dest = Path('docs/demos/releases/v55')
sha = lambda data: hashlib.sha256(data).hexdigest()
names = {'game.html': 'ばせぼーるlv55_TBD_vs_LAD_打球追尾調整版.html',
         'camera-workbench.html': 'カメラワーク調整室_v55.html'}
payload = {}
reports = {}
for target, name in names.items():
    data = (outputs / name).read_bytes()
    report = json.loads((outputs / (name + '.build.json')).read_text(encoding='utf-8'))
    assert sha(data) == report['sha256']
    assert report['sourceInputCount'] == 113 and report['readOnlyCamera']
    payload[target] = data
    payload[target + '.build.json'] = (outputs / (name + '.build.json')).read_bytes()
    reports[target] = report
pins_bytes = Path('dist/native-match-core-browser.js.inputs.json').read_bytes()
pins = json.loads(pins_bytes)
assert sha(Path('dist/native-match-core-browser.js').read_bytes()) == pins['entrySha256']
for report in reports.values():
    assert report['sourceCoreSha256'] == pins['entrySha256']
    assert report['sourceGameSha256'] == sha(Path('docs/demos/releases/v54/game.html').read_bytes())
    assert report['cameraHelperSha256'] == sha(Path('tools/browser-bridge/live-camera-tuning-batter-view.js').read_bytes())
    assert report['workbenchDriverSha256'] == sha(Path('tools/browser-bridge/camera-workbench-v55.js').read_bytes())
    assert report['workbenchTemplateSha256'] == sha(Path('tools/browser-bridge/camera-workbench-v55.html').read_bytes())
payload['game.html.bundle-inputs.json'] = pins_bytes
proofs = [('verification-v55-normal-final', 'normal-check.json'), ('verification-v55-workbench-final', 'workbench-check.json')]
for directory, filename in proofs:
    proof = json.loads((outputs / directory / filename).read_text(encoding='utf-8'))
    assert proof['pass'], (directory, filename)
    expected = reports['game.html' if filename == 'normal-check.json' else 'camera-workbench.html']['sha256']
    assert proof['sha256'] == expected, 'browser proof is from an older artifact'
for filename in ['LICENSE-CODE.md', 'LICENSE-DATA.md', 'license.txt']:
    payload[filename] = Path('docs/demos/releases/v54', filename).read_bytes()
source_paths = set(pins['inputs'])
source_paths.update(['dist/native-match-core-browser.js', 'dist/native-match-core-browser.js.inputs.json',
                     'docs/demos/releases/v54/game.html', 'docs/demos/releases/v54/SHA256.json'])
source_paths.update(str(path).replace('\\', '/') for path in Path('tools/browser-bridge').glob('*v55*') if path.is_file())
source_paths.add('tools/browser-bridge/live-camera-tuning-batter-view.js')
source_paths.add('tools/browser-bridge/check-camera-tuning-batter-view.mjs')
for path, digest in pins['inputs'].items():
    assert sha(Path(path).read_bytes()) == digest, path
dest.mkdir(parents=True, exist_ok=True)
targets = [dest / name for name in [*payload, 'tested-camera-inputs.zip', 'SHA256.json']]
assert not any(path.exists() for path in targets), 'refuse to overwrite a frozen release'
for name, data in payload.items():
    (dest / name).write_bytes(data)
archive = dest / 'tested-camera-inputs.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as z:
    for path in sorted(source_paths):
        z.writestr(path, Path(path).read_bytes())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for path in sorted(source_paths):
        assert z.read(path) == Path(path).read_bytes(), path
hashes = {name: sha((dest / name).read_bytes()) for name in [*payload, archive.name]}
(dest / 'SHA256.json').write_text(json.dumps(hashes, indent=2) + '\n', encoding='utf-8')
verification = Path('docs/verification/releases/v55')
verification.mkdir(parents=True, exist_ok=True)
for directory, _ in proofs:
    shutil.copytree(outputs / directory, verification / ('normal' if 'normal' in directory else 'workbench'))
report = {'pass': True, 'gameSha256': reports['game.html']['sha256'], 'workbenchSha256': reports['camera-workbench.html']['sha256'],
          'sourceCoreSha256': pins['entrySha256'], 'sourceInputs': len(pins['inputs']), 'zipEntries': len(source_paths),
          'allZipBytesAndCrcVerified': True, 'sourceAfterTestNormalization': False, 'coreChanged': False}
(verification / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
