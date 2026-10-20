"""Freeze maker-only v86 after exact-source, precision and browser checks."""
from pathlib import Path
import hashlib
import json

sha = lambda b: hashlib.sha256(b).hexdigest()
artifact = Path('../../outputs/にーくら野球メーカー_v86_入力確定とエラー復帰版.html')
dest = Path('docs/demos/releases/v86')
proof = Path('docs/verification/releases/v86')
blobs = {'maker.html' + suffix: Path(str(artifact) + suffix).read_bytes()
         for suffix in ['', '.build.json', '.bundle-inputs.json']}
meta = json.loads(blobs['maker.html.build.json'])
old = json.loads(Path('docs/demos/releases/v84/maker.html.build.json').read_bytes())
assert meta['sha256'] == sha(blobs['maker.html'])
assert meta['makerValidationVersion'] == 86
assert meta['makerGuidesVersion'] == 85 and meta['unspunComparisonDefault'] is False
for key in ['coreSha256', 'referenceSha256', 'referenceClips', 'liveRosterSha256',
            'liveRosterCatalogSha256', 'embeddedMatchRendererSha256', 'embeddedPitcherRendererSha256',
            'matchRendererSourceSha256', 'presentationVersion', 'frequencyScale', 'qualityScale',
            'pitchFrequencyMultiplier', 'battedFrequencyMultiplier']:
    assert meta[key] == old[key], 'Unintended baseline change: ' + key
pins = {}
def pin(path, expected=None):
    actual = sha(Path(path).read_bytes())
    assert expected is None or expected == actual, path
    assert path not in pins or pins[path] == actual, path
    pins[path] = actual

manifest = json.loads(blobs['maker.html.bundle-inputs.json'])
assert manifest['entrySha256'] == meta['coreSha256']
assert len(manifest['inputs']) == meta['bundleInputCount']
for path, expected in manifest['inputs'].items():
    pin(path, expected)
for group in ['makerGuideSources', 'makerRecoverySources', 'makerValidationSources']:
    for path, expected in meta[group].items():
        pin(path, expected)
for path in ['tools/browser-bridge/build-maker.mjs', 'tools/browser-bridge/build-maker-release-v86.mjs',
             'tools/browser-bridge/maker-presentation-bridge-v84.js',
             'tools/browser-bridge/maker-match-renderer-v84.js', 'tools/browser-bridge/maker-pitcher-renderer-v84.js',
             'tools/browser-bridge/check-maker-guides-v85.mjs', 'tools/browser-bridge/check-maker-field-matrix-v86.mjs',
             'tools/browser-bridge/check-maker-actions-v86.mjs', 'tools/browser-bridge/check-maker-drafts-v86.mjs',
             'tools/browser-bridge/swing-input-recovery-v86.test.mjs', 'tools/browser-bridge/check-pitch-comparison-v86.mjs',
             'tools/browser-bridge/maker-guides-v85.test.mjs', 'tools/browser-bridge/pitcher-comparison-v86.test.mjs',
             'tools/browser-bridge/check-rebuild-v86.mjs', 'tools/browser-bridge/package-maker-v86.py']:
    pin(path)
historical = {}
for version in ['v82', 'v84', 'v85']:
    folder = Path('docs/demos/releases', version)
    expected_files = json.loads((folder / 'SHA256.json').read_bytes())
    for name, expected in expected_files.items():
        assert sha((folder / name).read_bytes()) == expected, f'Changed frozen {version}/{name}'
    historical[version] = expected_files
pin(meta['matchRendererSourcePath'], meta['matchRendererSourceSha256'])
reports = {}
for name, key in [('guides-final2/report.json', 'sha256'),
                  ('comparison-final2/report.json', 'artifactSha256'),
                  ('maker-recovery-final2/maker-internal-recovery-check.json', 'sha256'),
                  ('pitch-recovery-final/report.json', 'artifactSha256'),
                  ('traits-final2/traits-check.json', 'sha256'),
                  ('drafts-browser-final2/report.json', 'artifactSha256'),
                  ('field-matrix-final2/report.json', 'sha256'),
                  ('actions-final2/report.json', 'sha256')]:
    raw = (proof / name).read_bytes()
    report = json.loads(raw)
    # Comparison harness records its artifact hash as sha256 on older runs.
    assert report['pass'] is True and report.get(key, report.get('sha256')) == meta['sha256'], name
    reports[name] = sha(raw)
raw = (proof / 'swing-final2/proof.json').read_bytes()
r = json.loads(raw)
assert r['passed'] == 2 and r['failed'] == 0 and r['artifactSha256'] == meta['sha256']
pin('docs/demos/baseball-maker-swing-v86.js', r['sourceSha256'])
pin('tools/browser-bridge/swing-input-recovery-v86.test.mjs', r['testSha256'])
reports['swing-final2/proof.json'] = sha(raw)
raw = (proof / 'rebuild.json').read_bytes()
assert json.loads(raw)['pass'] is True
reports['rebuild.json'] = sha(raw)
contract = {'version': 86, 'scope': 'Maker-only draft recovery and local validation. Physics, source JSON and v84 renderers unchanged.',
            'inputs': pins, 'reports': reports, 'inheritedReleases': historical,
            'limitations': ['Seam/knuckle model remains an uncalibrated surrogate.',
                            'Gyro summary is an authored-axis estimate, not measured Active Spin.',
                            'Comparison off hides the line; baseline trajectory still serves metrics.',
                            'v84 actual FPS and real-device validation limitations remain.']}
blobs['source-contract.json'] = (json.dumps(contract, ensure_ascii=False, indent=2) + '\n').encode()
dest.mkdir(parents=True, exist_ok=True)
for name, raw in blobs.items():
    target = dest / name
    if target.exists():
        assert target.read_bytes() == raw, 'Refuse to replace frozen ' + name
    else:
        target.write_bytes(raw)
(dest / 'SHA256.json').write_text(json.dumps({name: sha(raw) for name, raw in blobs.items()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'makerSha256': meta['sha256'], 'currentSourcePins': len(pins), 'reports': len(reports)}))
