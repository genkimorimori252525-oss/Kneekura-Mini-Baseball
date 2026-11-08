import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

release = Path('docs/demos/releases/v47')
pins = json.loads((release / 'game.html.bundle-inputs.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(release / 'tested-core-inputs.zip') as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(pins['inputs']) + 2
    for path, expected in pins['inputs'].items():
        actual = archive.read(path)
        assert hashlib.sha256(actual).hexdigest() == expected, path
        assert actual == Path(path).read_bytes(), path
    bundle = archive.read('compiled/native-match-core-browser.js')
    assert hashlib.sha256(bundle).hexdigest() == pins['entrySha256']
    assert bundle == Path('dist/native-match-core-browser.js').read_bytes()
    manifest = json.loads(archive.read('native-match-core-browser.js.inputs.json'))
    assert manifest['inputs'] == pins['inputs']
    assert manifest['entrySha256'] == pins['entrySha256']
subprocess.run(['node', 'tools/browser-bridge/check-v47-release.mjs'], check=True)
print(json.dumps({'pass': True, 'sourceInputs': len(pins['inputs']), 'zipEntries': len(pins['inputs']) + 2}))
