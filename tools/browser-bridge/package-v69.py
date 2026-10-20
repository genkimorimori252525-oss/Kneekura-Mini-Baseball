"""Freeze the tested maker; the ordinary match and camera lab stay at v68."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
artifact = Path('../../outputs/にーくら野球メーカー_v69_打球比較と拡大版.html')
dest = Path('docs/demos/releases/v69')
proof = Path('docs/verification/releases/v69')
data = artifact.read_bytes()
meta_bytes = Path(str(artifact) + '.build.json').read_bytes()
meta = json.loads(meta_bytes)
pins_bytes = Path(str(artifact) + '.bundle-inputs.json').read_bytes()
pins = json.loads(pins_bytes)
assert len(data) < 100_000_000 and sha(data) == meta['sha256']
assert meta['ballComparison'] and meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
core = Path('dist/batting-workbench-core.js').read_bytes()
assert sha(core) == meta['coreSha256'] == pins['entrySha256'] and core in data
for path, expected in pins['inputs'].items():
    assert sha(Path(path).read_bytes()) == expected, path
for key, path in [
    ('uiSha256', 'docs/demos/baseball-maker-ui.mjs'),
    ('swingUiSha256', 'docs/demos/baseball-maker-swing-v68.js'),
    ('helpUiSha256', 'docs/demos/baseball-maker-help-v68.js'),
    ('lightCssSha256', 'docs/demos/baseball-maker-light-v68.css'),
    ('comparisonUiSha256', 'docs/demos/baseball-maker-ball-comparison-v69.js'),
    ('comparisonCssSha256', 'docs/demos/baseball-maker-ball-comparison-v69.css'),
    ('templateSha256', 'docs/demos/baseball-maker.html'),
    ('referenceSha256', 'docs/demos/measured-bat-library-v1.json'),
    ('libraryDecoderSha256', 'tools/browser-bridge/measured-bat-library-v1.js'),
]:
    assert sha(Path(path).read_bytes()) == meta[key], path
test = json.loads((proof / 'maker/maker-check.json').read_bytes())
assert test['pass'] and test['sha256'] == sha(data)
zoom = json.loads((proof / 'main-zoom/zoom-check.json').read_bytes())
assert zoom['pass'] and zoom['uiSha256'] == meta['uiSha256']
# Only authoring/research code changes. Retain the normal game's exact source.
native = json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
assert native['entrySha256'] == '308d8e63c8c426e524a9f082e8e97b9ff9e127578f3f780855577d76eb30132e'
assert sha(Path('dist/native-match-core-browser.js').read_bytes()) == native['entrySha256']
for path, expected in native['inputs'].items():
    assert sha(Path(path).read_bytes()) == expected, path
old_count = 0
for index in Path('docs/demos/releases').glob('*/SHA256.json'):
    if index.parent == dest:
        continue
    for path, expected in json.loads(index.read_bytes()).items():
        assert sha((index.parent / path).read_bytes()) == expected, str(index.parent / path)
        old_count += 1
dest.mkdir(parents=True, exist_ok=True)
for name, content in [('maker.html', data), ('maker.html.build.json', meta_bytes), ('maker.html.bundle-inputs.json', pins_bytes)]:
    (dest / name).write_bytes(content)
index = {p.name: sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md', 'SHA256.json']}
(dest / 'SHA256.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
report = {'pass': True, 'sha256': sha(data), 'coreSha256': sha(core), 'sourceInputCount': len(pins['inputs']),
          'ordinaryCoreUnchanged': True, 'ordinarySourceInputs': len(native['inputs']), 'olderFrozenFilesUnchanged': old_count,
          'samePitchOnlyTrajectoryVaries': True, 'officialHitOrHomeRunNotAssigned': True,
          'wholeOriginalPlanComplete': False}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
