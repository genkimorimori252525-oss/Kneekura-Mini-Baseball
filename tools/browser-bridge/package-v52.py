"""Package presentation-only v52 without changing the tested v51 Core bytes."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT.parent.parent / 'outputs/ばせぼーるlv52_TBD_vs_LAD_視点追従調整版.html'
RELEASE = ROOT / 'docs/demos/releases/v52'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    payloads = {'game.html': GAME.read_bytes(),
                'game.html.build.json': Path(str(GAME) + '.build.json').read_bytes(),
                'game.html.bundle-inputs.json': Path(str(GAME) + '.bundle-inputs.json').read_bytes()}
    build = json.loads(payloads['game.html.build.json'])
    pins = json.loads(payloads['game.html.bundle-inputs.json'])
    prior = json.loads((ROOT / 'docs/demos/releases/v51/game.html.bundle-inputs.json').read_bytes())
    require(build['presentationVersion'] == 52 and len(pins['inputs']) == 108, 'v52/108 input build required')
    require(pins == prior, 'v52 must retain exact v51 Core source manifest')
    require(sha(payloads['game.html']) == build['sha256'], 'HTML/build SHA mismatch')
    native = (ROOT / 'dist/native-match-core-browser.js').read_bytes()
    require(sha(native) == pins['entrySha256'] == build['nativeBundleSha256'], 'Core SHA mismatch')
    require(native in payloads['game.html'], 'current compiled Core is not embedded')
    for path, expected in pins['inputs'].items():
        source = (ROOT / path).resolve(strict=True)
        require(source.is_relative_to(ROOT / 'src'), 'source path escapes repository src: ' + path)
        require(sha(source.read_bytes()) == expected, 'tested v51 source changed: ' + path)
    for key, name in [('continuousViewSha256', 'live-soft-pitch-batter-view.js'),
                      ('pitcherReactionViewSha256', 'live-pitcher-reaction-view.js')]:
        data = (ROOT / 'tools/browser-bridge' / name).read_bytes()
        require(sha(data) == build[key] and data in payloads['game.html'], 'observer bytes mismatch: ' + name)
    qa = json.loads((ROOT / 'docs/verification/releases/v52/cameras/v52-camera-check.json').read_bytes())
    require(qa['pass'] and qa['sha256'] == build['sha256'] and qa['nativeBundleSha256'] == pins['entrySha256'],
            'new HTML browser verification required')
    for name in ('LICENSE-CODE.md', 'LICENSE-DATA.md', 'license.txt'):
        payloads[name] = (ROOT / 'docs/demos/releases/v51' / name).read_bytes()
    hashes = {name: sha(data) for name, data in sorted(payloads.items())}
    payloads['SHA256.json'] = (json.dumps(hashes, indent=2) + '\n').encode('utf-8')
    require(not any((RELEASE / name).exists() or (RELEASE / name).is_symlink() for name in payloads),
            'refusing to overwrite release outputs')
    RELEASE.mkdir(parents=True, exist_ok=True)
    require(RELEASE.resolve().is_relative_to(ROOT), 'release output escapes repository')
    for name, data in payloads.items():
        with (RELEASE / name).open('xb') as output:
            output.write(data)
        require((RELEASE / name).read_bytes() == data, 'written byte mismatch: ' + name)
    print(json.dumps({'pass': True, 'gameSha256': build['sha256'], 'nativeBundleSha256': pins['entrySha256'],
                      'sourceInputsUnchanged': 108, 'sharedCoreSnapshot': '../v51/tested-core-inputs.zip'}))


if __name__ == '__main__':
    main()
