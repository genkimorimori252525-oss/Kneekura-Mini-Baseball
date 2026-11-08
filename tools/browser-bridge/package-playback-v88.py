"""Exact-artifact v88 release gate; retain earlier frozen files and failed receipts."""
from pathlib import Path
import hashlib
import json

sha = lambda raw: hashlib.sha256(raw).hexdigest()
proof = Path('docs/verification/releases/v88')
dest = Path('docs/demos/releases/v88')
paths = {'game': Path('../../outputs/ばせぼーるlv88_TBD_vs_LAD_空振りとHR見送り版.html'),
         'lab': Path('../../outputs/カメラワーク調整室_v88_空振りとHR見送り.html'),
         'maker': Path('../../outputs/にーくら野球メーカー_v88_空振りとHR見送り版.html')}
blobs, meta, pins, reports = {}, {}, {}, {}
def pin(path, expected=None):
    actual = sha(Path(path).read_bytes())
    assert expected is None or actual == expected, 'Source mismatch: ' + path
    assert path not in pins or pins[path] == actual, 'Conflicting source pin'
    pins[path] = actual
for kind, path in paths.items():
    for suffix in ['', '.build.json'] + (['.bundle-inputs.json'] if kind != 'lab' else []):
        blobs[kind + '.html' + suffix] = Path(str(path) + suffix).read_bytes()
    m = meta[kind] = json.loads(blobs[kind + '.html.build.json'])
    assert m['sha256'] == sha(blobs[kind + '.html']) and m['playbackVersion'] == 88
    assert [m[k] for k in ['frequencyScale', 'qualityScale', 'pitchFrequencyMultiplier', 'battedFrequencyMultiplier']] == [2, 1.2, 2.5, 2]
    for key, values in m.items():
        if key.endswith('Sources') and isinstance(values, dict):
            for source, expected in values.items():
                pin(source if '/' in source else 'tools/browser-bridge/' + source, expected)
    if kind != 'lab':
        manifest = json.loads(blobs[kind + '.html.bundle-inputs.json'])
        assert manifest['entrySha256'] == m['coreSha256' if kind == 'maker' else 'sourceCoreSha256']
        for source, expected in manifest['inputs'].items():
            pin(source, expected)
assert meta['game']['homeRunWatchRangeMs'] == [1500, 2000]
assert meta['maker']['matchRendererSourceSha256'] == meta['game']['sha256']
assert meta['maker']['referenceClips'] == 673
old_maker = json.loads(Path('docs/demos/releases/v87/maker.html.build.json').read_bytes())
for key in ['uiSha256', 'pitcherUiSha256', 'swingUiSha256', 'referenceSha256', 'referenceClips', 'liveRosterSha256', 'liveRosterCatalogSha256']:
    assert meta['maker'][key] == old_maker[key], 'Unintended authoring/data change: ' + key
text = blobs['lab.html'].decode()
assert text.count('const CAMERA_LAB_GAME_HTML=') == 1
embedded, _ = json.JSONDecoder().raw_decode(text.split('const CAMERA_LAB_GAME_HTML=', 1)[1])
assert embedded == blobs['game.html'].decode()
for path in ['tools/browser-bridge/build-playback-v88.mjs', 'tools/browser-bridge/build-maker-release-v88.mjs',
             'tools/browser-bridge/build-maker.mjs', 'tools/browser-bridge/home-run-watch-v88.js',
             'tools/browser-bridge/home-run-watch-v88.test.mjs', 'tools/browser-bridge/whiff-follow-through-v88.js',
             'tools/browser-bridge/whiff-follow-through-v88.test.mjs', 'tools/browser-bridge/check-playback-v88.mjs',
             'tools/browser-bridge/check-rebuild-v88.mjs', 'tools/browser-bridge/check-staged-v88.py',
             'tools/browser-bridge/check-publication-v88.py', 'tools/browser-bridge/package-playback-v88.py',
             'src/integration/browser/LiveBatPlaybackV88.test.ts']:
    pin(path)
historical = {}
for version in ['v82', 'v84', 'v85', 'v86', 'v87']:
    folder = Path('docs/demos/releases', version)
    files = json.loads((folder / 'SHA256.json').read_bytes())
    for name, expected in files.items():
        assert sha((folder / name).read_bytes()) == expected, 'Frozen release changed: ' + version + '/' + name
    historical[version] = files
for name in ['normal-nine-final/report.json', 'playback-final/report.json', 'presentation-final/report.json',
             'course-regression/report.json', 'rebuild.json']:
    raw = (proof / name).read_bytes()
    r = json.loads(raw)
    assert r['pass'], name
    if name.startswith('normal-nine'):
        assert r['artifactSha256'] == meta['game']['sha256']
        assert r['scenarios'][0]['innings'] == 9 and all(s['complete']['allFieldComplete'] for s in r['scenarios'])
    elif name.startswith('playback'):
        assert r['artifactSha256'] == meta['game']['sha256'] and len(r['cases']) == 2
    elif name.startswith('presentation'):
        assert r['hashes'] == {'normal': meta['game']['sha256'], 'lab': meta['lab']['sha256'], 'maker': meta['maker']['sha256']}
    elif name.startswith('course'):
        assert r['artifactSha256'] == meta['maker']['sha256']
    else:
        assert len(r['files']) == 8
    reports[name] = sha(raw)
contract = {'version': 88, 'scope': 'Finite registered whiff replay and seeded 1500..2000ms HR watch; decisive pitcher observer retained. No new check-swing action or ability.',
            'inputs': pins, 'reports': reports, 'inheritedReleases': historical,
            'limitations': ['Finite measured motion ends at the last original key; no invented later swing.',
                            'Third-out immediate bench remains higher priority than post-call bat display.',
                            'Per-player check-swing stopping success is not identifiable from ordinary public pitch outcomes.',
                            '2026 PCL challenge-selected events are public but have selection bias and no full attempt denominator.',
                            'Existing real-device, achieved-FPS, 100-game, aerodynamic calibration and Native admission limitations remain.']}
blobs['source-contract.json'] = (json.dumps(contract, ensure_ascii=False, indent=2) + '\n').encode()
dest.mkdir(parents=True, exist_ok=True)
for name, raw in blobs.items():
    target = dest / name
    if target.exists():
        assert target.read_bytes() == raw, 'Refuse to replace frozen ' + name
    else:
        target.write_bytes(raw)
(dest / 'SHA256.json').write_text(json.dumps({n: sha(b) for n, b in blobs.items()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'sourcePins': len(pins), 'reports': len(reports), 'artifacts': {k: m['sha256'] for k, m in meta.items()}}))
