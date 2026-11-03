"""Package the frozen v51 product bytes; refuse existing product outputs.

The v47 maker is intentionally referenced by the release README rather than
duplicated. This command does not build, alter sources, or author the README.
"""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import zipfile


REPO = Path(__file__).resolve().parents[2]
RELEASE = REPO / 'docs/demos/releases/v51'
GAME = REPO.parent.parent / 'outputs/ばせぼーるlv51_TBD_vs_LAD_野手の回避と間隔改善版.html'
EXPECTED_INPUTS = 108
LICENSES = ('LICENSE-CODE.md', 'LICENSE-DATA.md', 'license.txt')
DESTINATIONS = (
    'game.html', 'game.html.build.json', 'game.html.bundle-inputs.json',
    'tested-core-inputs.zip', *LICENSES, 'SHA256.json',
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def read_source(name):
    path = PurePosixPath(name)
    require(isinstance(name, str) and '\\' not in name and str(path) == name
            and not path.is_absolute() and '..' not in path.parts
            and len(path.parts) > 1 and path.parts[0] == 'src',
            'invalid source manifest path: ' + str(name))
    resolved = (REPO / name).resolve(strict=True)
    require(resolved.is_relative_to(REPO), 'source escapes repository: ' + name)
    return resolved.read_bytes()


def zip_snapshot(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    data = buffer.getvalue()
    verify_zip(data, entries)
    return data


def verify_zip(data, entries):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        require(archive.testzip() is None, 'source snapshot CRC verification failed')
        names = archive.namelist()
        require(len(names) == EXPECTED_INPUTS + 2 and len(set(names)) == len(names)
                and set(names) == set(entries), 'source snapshot entry mismatch')
        for name, expected in entries.items():
            actual = archive.read(name)
            require(actual == expected and sha(actual) == sha(expected),
                    'source snapshot byte/SHA mismatch: ' + name)


def main():
    existing = [name for name in DESTINATIONS if (RELEASE / name).exists() or (RELEASE / name).is_symlink()]
    require(not existing, 'refusing to overwrite existing release outputs: ' + ', '.join(existing))
    payloads = {
        'game.html': GAME.read_bytes(),
        'game.html.build.json': Path(str(GAME) + '.build.json').read_bytes(),
        'game.html.bundle-inputs.json': Path(str(GAME) + '.bundle-inputs.json').read_bytes(),
    }
    build = json.loads(payloads['game.html.build.json'])
    pins = json.loads(payloads['game.html.bundle-inputs.json'])
    manifest_bytes = (REPO / 'dist/native-match-core-browser.js.inputs.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    native = (REPO / 'dist/native-match-core-browser.js').read_bytes()
    inputs = pins.get('inputs')
    require(isinstance(inputs, dict) and len(inputs) == EXPECTED_INPUTS,
            'v51 snapshot requires exactly 108 current source inputs')
    require(build.get('presentationVersion') == 51 and build.get('bundleInputCount') == EXPECTED_INPUTS,
            'v51 game build/version/input count mismatch')
    require(sha(payloads['game.html']) == build.get('sha256'), 'HTML/build SHA mismatch')
    require(sha(manifest_bytes) == build.get('bundleInputManifestSha256'), 'build/current manifest SHA mismatch')
    require(all(pins.get(key) == value for key, value in manifest.items()), 'HTML/current source manifest mismatch')
    require(sha(native) == pins.get('entrySha256') == build.get('nativeBundleSha256'),
            'compiled Core SHA mismatch')
    require(native in payloads['game.html'], 'HTML does not embed the tested compiled Core')
    require(pins.get('measuredReferenceSha256') == build.get('measuredReferenceSha256'),
            'measured reference SHA metadata mismatch')
    entries = {}
    for name, expected in sorted(inputs.items()):
        data = read_source(name)
        require(isinstance(expected, str) and len(expected) == 64 and sha(data) == expected,
                'current source SHA mismatch: ' + name)
        entries[name] = data
    entries['compiled/native-match-core-browser.js'] = native
    entries['native-match-core-browser.js.inputs.json'] = manifest_bytes
    payloads['tested-core-inputs.zip'] = zip_snapshot(entries)
    for name in LICENSES:
        payloads[name] = (REPO / 'docs/demos/releases/v48' / name).read_bytes()
    hashes = {name: sha(data) for name, data in sorted(payloads.items())}
    payloads['SHA256.json'] = (json.dumps(hashes, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
    # Complete preflight before creating any product file. Preserve the exact
    # tested working-tree bytes, including source and metadata line endings.
    for name, expected in inputs.items():
        require(sha(read_source(name)) == expected, 'source changed during packaging: ' + name)
    require((REPO / 'dist/native-match-core-browser.js').read_bytes() == native
            and (REPO / 'dist/native-match-core-browser.js.inputs.json').read_bytes() == manifest_bytes,
            'compiled Core or manifest changed during packaging')
    require(GAME.read_bytes() == payloads['game.html'], 'game changed during packaging')
    require(RELEASE.parent.resolve().is_relative_to(REPO), 'release parent escapes repository')
    RELEASE.mkdir(parents=True, exist_ok=True)
    require(RELEASE.resolve().is_relative_to(REPO), 'release output escapes repository')
    for name, data in payloads.items():
        # Exclusive creation also protects against a writer racing the preflight.
        with (RELEASE / name).open('xb') as output:
            output.write(data)
    for name, data in payloads.items():
        require((RELEASE / name).read_bytes() == data, 'written release byte mismatch: ' + name)
    verify_zip((RELEASE / 'tested-core-inputs.zip').read_bytes(), entries)
    require(json.loads((RELEASE / 'SHA256.json').read_bytes()) == hashes, 'written SHA index mismatch')
    print(json.dumps({'pass': True, 'release': str(RELEASE), 'sourceInputs': EXPECTED_INPUTS,
                      'zipEntries': len(entries), 'files': list(payloads),
                      'makerReference': '../v47/maker.html', 'hashes': hashes}, ensure_ascii=False))


if __name__ == '__main__':
    main()
