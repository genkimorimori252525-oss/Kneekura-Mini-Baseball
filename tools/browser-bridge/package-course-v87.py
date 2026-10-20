"""Freeze v87 products only after their source, compatibility and exact-artifact checks."""
from pathlib import Path
import hashlib
import json

sha = lambda raw: hashlib.sha256(raw).hexdigest()
proof = Path('docs/verification/releases/v87')
destination = Path('docs/demos/releases/v87')
artifacts = {
    'game': Path('../../outputs/ばせぼーるlv87_TBD_vs_LAD_コース認識と打率版.html'),
    'lab': Path('../../outputs/カメラワーク調整室_v87_コース認識.html'),
    'maker': Path('../../outputs/にーくら野球メーカー_v87_コース打率と認識AI版.html')}
blobs, metadata, pins = {}, {}, {}

def pin(path, expected=None):
    raw = Path(path).read_bytes()
    actual = sha(raw)
    assert expected is None or actual == expected, 'Source pin differs: ' + path
    assert path not in pins or pins[path] == actual, 'Conflicting pin: ' + path
    pins[path] = actual

for kind, path in artifacts.items():
    suffixes = ['', '.build.json'] + (['.bundle-inputs.json'] if kind != 'lab' else [])
    for suffix in suffixes:
        blobs[kind + '.html' + suffix] = Path(str(path) + suffix).read_bytes()
    meta = metadata[kind] = json.loads(blobs[kind + '.html.build.json'])
    assert meta['sha256'] == sha(blobs[kind + '.html']) and meta['courseVersion'] == 87
    assert (meta['frequencyScale'], meta['qualityScale'], meta['pitchFrequencyMultiplier'], meta['battedFrequencyMultiplier']) == (2, 1.2, 2.5, 2)
    for group, values in meta.items():
        if group.endswith('Sources') and isinstance(values, dict):
            for source, expected in values.items():
                pin(source if '/' in source else 'tools/browser-bridge/' + source, expected)
    if kind != 'lab':
        manifest = json.loads(blobs[kind + '.html.bundle-inputs.json'])
        assert manifest['entrySha256'] == meta['coreSha256' if kind == 'maker' else 'sourceCoreSha256']
        for source, expected in manifest['inputs'].items():
            pin(source, expected)

assert metadata['game']['publicCourse9ZoneOnly'] is False and metadata['game']['publicCourse13Regions'] is True
assert metadata['maker']['makerValidationVersion'] == 86 and metadata['maker']['unspunComparisonDefault'] is False
assert metadata['maker']['referenceClips'] == 673
assert metadata['maker']['matchRendererSourceSha256'] == metadata['game']['sha256']
assert metadata['maker']['matchRendererSourcePath'] == str(artifacts['game']).replace('\\', '/') or Path(metadata['maker']['matchRendererSourcePath']).resolve() == artifacts['game'].resolve()
game_text = blobs['game.html'].decode('utf-8')
maker_text = blobs['maker.html'].decode('utf-8')
lab_text = blobs['lab.html'].decode('utf-8')
for name, digest in metadata['game']['helpers'].items():
    pin('tools/browser-bridge/' + name, digest)
assert 'course-charts-v79.js' not in metadata['game']['helpers']
for text in [game_text, maker_text]:
    assert 'zone_recognition_v87' in text and 'batter_course_profile_v87' in text
marker = 'const CAMERA_LAB_GAME_HTML='
assert lab_text.count(marker) == 1
embedded, end = json.JSONDecoder().raw_decode(lab_text.split(marker, 1)[1])
assert embedded == game_text, 'Lab must embed the exact current normal game'
assert metadata['lab']['sourceGameSha256'] == sha(blobs['game.html'])
for path in ['tools/browser-bridge/build-course-v87.mjs', 'tools/browser-bridge/build-maker.mjs',
             'tools/browser-bridge/build-maker-release-v87.mjs', 'tools/browser-bridge/check-rebuild-v87.mjs',
             'tools/browser-bridge/check-course-authoring-v87.mjs', 'tools/browser-bridge/check-course-integration-v87.mjs',
             'tools/browser-bridge/course-charts-v87.test.mjs',
             'src/integration/browser/BatterCourseProfileV87.test.ts', 'src/integration/browser/LiveSeasonCourseV87.test.ts',
             'src/integration/browser/ZoneRecognitionV87.test.ts', 'src/integration/browser/LivePitchRecognitionV87.test.ts',
             'tools/browser-bridge/package-course-v87.py', 'tools/browser-bridge/import-mlb-course-reference-v87.py',
             'tools/browser-bridge/test-mlb-course-reference-v87.py', 'tools/browser-bridge/check-staged-v87.py',
             'tools/browser-bridge/check-publication-v87.py',
             'docs/data/mlb-2025/mlb2025-zones-source-v87.zip']:
    pin(path)
historical = {}
for version in ['v82', 'v84', 'v85', 'v86']:
    folder = Path('docs/demos/releases', version)
    files = json.loads((folder / 'SHA256.json').read_bytes())
    for name, expected in files.items():
        assert sha((folder / name).read_bytes()) == expected, f'Changed frozen {version}/{name}'
    historical[version] = files

reports = {}
for name in ['course-authoring-grid-final/report.json', 'v86-field-matrix-grid-final/report.json',
             'v86-drafts-grid-final/report.json', 'v86-actions-grid-final/report.json']:
    raw = (proof / name).read_bytes()
    r = json.loads(raw)
    assert r['pass'] and r.get('artifactSha256', r.get('sha256')) == metadata['maker']['sha256'], name
    reports[name] = sha(raw)
for name in ['normal-nine-final/report.json', 'integration/report.json', 'presentation-grid-final/report.json', 'rebuild.json']:
    raw = (proof / name).read_bytes()
    r = json.loads(raw)
    assert r['pass'], name
    if name.startswith('normal-nine'):
        assert r['artifactSha256'] == metadata['game']['sha256']
        assert r['scenarios'][0]['innings'] == 9 and all(s['complete']['allFieldComplete'] for s in r['scenarios'])
    elif name.startswith('integration'):
        assert r['hashes'] == {k: metadata[k]['sha256'] for k in ['game', 'lab']}
    elif name.startswith('presentation'):
        assert r['hashes'] == {'normal': metadata['game']['sha256'], 'lab': metadata['lab']['sha256'], 'maker': metadata['maker']['sha256']}
    else:
        assert len(r['files']) == 8
    reports[name] = sha(raw)

contract = {'version': 87, 'scope': '13-region editable response/display and separate 63-cell role perception; legacy JSON retained; official MLB2025 reference only.',
            'inputs': pins, 'reports': reports, 'inheritedReleases': historical,
            'limitations': ['Authored perception and existing seam/knuckle coefficients are not measured/calibrated human models.',
                            '13/63 conversion uses overlap-area averages and is lossy; legacy original stays intact.',
                            'Official MLB2025 zone data has 10H/63AB missing from the 13 classified regions; kept separate.',
                            'Verified MLB fair-batted-ball direction denominator unavailable; no fabricated direction benchmark.',
                            'v84 achieved-FPS, real-device, 100-game and Native certification limitations remain.']}
blobs['source-contract.json'] = (json.dumps(contract, ensure_ascii=False, indent=2) + '\n').encode()
destination.mkdir(parents=True, exist_ok=True)
for name, raw in blobs.items():
    target = destination / name
    if target.exists():
        assert target.read_bytes() == raw, 'Refuse to replace frozen ' + name
    else:
        target.write_bytes(raw)
(destination / 'SHA256.json').write_text(json.dumps({name: sha(raw) for name, raw in blobs.items()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'sourcePins': len(pins), 'reports': len(reports), 'artifacts': {k: m['sha256'] for k, m in metadata.items()}}))
