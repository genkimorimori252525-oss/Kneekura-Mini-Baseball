"""Freeze the tested batter-comparison maker; ordinary v68 stays byte-exact."""
import hashlib
import json
from pathlib import Path

sha = lambda data: hashlib.sha256(data).hexdigest()
artifact = Path('../../outputs/にーくら野球メーカー_v70_打者視点比較版.html')
dest = Path('docs/demos/releases/v70')
proof = Path('docs/verification/releases/v70')
data = artifact.read_bytes()
meta_bytes = Path(str(artifact) + '.build.json').read_bytes()
meta = json.loads(meta_bytes)
pins_bytes = Path(str(artifact) + '.bundle-inputs.json').read_bytes()
pins = json.loads(pins_bytes)
assert len(data) < 100_000_000 and sha(data) == meta['sha256']
assert meta['batterComparison'] and meta['referenceClips'] == 673 and meta['gamePlayers'] == 20
assert meta['coreSha256'] == pins['entrySha256'] == 'ee7451940934e39c69cec0419badbc644c17768210e139ab50e0862e69f63223'
assert sha(Path('dist/batting-workbench-core.js').read_bytes()) == pins['entrySha256']
for path, expected in pins['inputs'].items():
    assert sha(Path(path).read_bytes()) == expected, path
for key, path in [
    ('uiSha256', 'docs/demos/baseball-maker-ui.mjs'),
    ('swingUiSha256', 'docs/demos/baseball-maker-swing-v68.js'),
    ('helpUiSha256', 'docs/demos/baseball-maker-help-v68.js'),
    ('lightCssSha256', 'docs/demos/baseball-maker-light-v68.css'),
    ('comparisonUiSha256', 'docs/demos/baseball-maker-ball-comparison-v69.js'),
    ('comparisonCssSha256', 'docs/demos/baseball-maker-ball-comparison-v69.css'),
    ('batterUiSha256', 'docs/demos/baseball-maker-batter-comparison-v70.js'),
    ('batterCssSha256', 'docs/demos/baseball-maker-batter-comparison-v70.css'),
    ('matchRendererAdapterSha256', 'tools/browser-bridge/maker-match-renderer-v70.js'),
    ('matchRendererSourceSha256', 'docs/demos/releases/v68/game.html'),
    ('templateSha256', 'docs/demos/baseball-maker.html'),
    ('referenceSha256', 'docs/demos/measured-bat-library-v1.json'),
    ('libraryDecoderSha256', 'tools/browser-bridge/measured-bat-library-v1.js'),
]:
    assert sha(Path(path).read_bytes()) == meta[key], path
test = json.loads((proof / 'maker/maker-check.json').read_bytes())
assert test['pass'] and test['sha256'] == sha(data)
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
(dest / 'SHA256.json').write_text(json.dumps({name: sha((dest / name).read_bytes()) for name in
    ['maker.html', 'maker.html.build.json', 'maker.html.bundle-inputs.json']}, indent=2) + '\n', encoding='utf-8')
report = {'pass': True, 'sha256': sha(data), 'bytes': len(data), 'coreSha256': pins['entrySha256'],
          'sourceInputCount': len(pins['inputs']), 'ordinaryCoreUnchanged': True,
          'ordinarySourceInputs': len(native['inputs']), 'olderFrozenFilesUnchanged': old_count,
          'ordinaryRendererSourceSha256': meta['matchRendererSourceSha256'],
          'wholeOriginalPlanComplete': False}
(proof / 'release-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
