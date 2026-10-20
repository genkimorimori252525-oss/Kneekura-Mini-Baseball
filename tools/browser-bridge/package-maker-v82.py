"""Freeze the verified maker; keep its Core distinct from the frozen v81 renderer."""
import hashlib
import json
from pathlib import Path

sha = lambda value: hashlib.sha256(value).hexdigest()
source = Path('../../outputs/にーくら野球メーカー_v82_削除と入力復帰版.html')
dest = Path('docs/demos/releases/v82')
proof = Path('docs/verification/releases/v82')
data = source.read_bytes()
meta_bytes = Path(str(source) + '.build.json').read_bytes()
pin_bytes = Path(str(source) + '.bundle-inputs.json').read_bytes()
meta, pins = json.loads(meta_bytes), json.loads(pin_bytes)
assert sha(data) == meta['sha256'] and sha(pin_bytes) == meta['bundleInputManifestSha256']
assert meta['makerRecoveryVersion'] == 82 and meta['losslessPerformanceVersion'] == 81
assert meta['referenceClips'] == 673 and meta['gamePlayers'] == 20 and meta['fullSceneCadence']
assert meta['pitchMenu'] and meta['courseSeasons'] and meta['independentTraits']
assert pins['entrySha256'] == meta['coreSha256'] == sha(Path('dist/batting-workbench-core.js').read_bytes())
assert Path('dist/batting-workbench-core.js').read_bytes() in data
inputs = dict(pins['inputs'])
for path, expected in meta['makerRecoverySources'].items():
    assert path not in inputs or inputs[path] == expected
    inputs[path] = expected
legacy = json.loads(Path('docs/demos/releases/v81/maker.html.build.json').read_bytes())
assert meta['matchRendererSourceSha256'] == legacy['matchRendererSourceSha256']
for key in ['embeddedMatchRendererSha256', 'embeddedPitcherRendererSha256', 'matchRendererAdapterSha256',
            'pitcherAdapterSha256', 'referenceSha256', 'liveRosterSha256', 'liveRosterCatalogSha256',
            'batterUiSha256', 'comparisonUiSha256', 'traitAvailabilitySha256']:
    assert meta[key] == legacy[key], key
html = data.decode('utf-8')
for variable, key in [('KneekuraMakerMatchHtmlV70', 'embeddedMatchRendererSha256'),
                      ('KneekuraMakerPitcherMatchHtmlV77', 'embeddedPitcherRendererSha256')]:
    encoded = html.split('globalThis.' + variable + '=', 1)[1].split('\n', 1)[0].rstrip()
    assert sha(json.loads(encoded[:-1]).encode('utf-8')) == meta[key]
for name, expected in json.loads(Path('docs/demos/releases/v81/SHA256.json').read_bytes()).items():
    assert sha(Path('docs/demos/releases/v81', name).read_bytes()) == expected, name
reports = [
    ('maker-recovery-release/maker-internal-recovery-check.json', 'sha256'),
    ('pitch-recovery-release/report.json', 'artifactSha256'),
    ('pitch-menu-release/report.json', 'sha256'),
    ('pitch-views-release/pitch-views-check.json', 'sha256'),
    ('pixels-release/report.json', 'sha256'),
    ('course-release/report.json', 'sha256'),
    ('traits-release/traits-check.json', 'sha256'),
]
report_pins = {}
for name, field in reports:
    path = proof / name
    raw = path.read_bytes()
    report = json.loads(raw)
    assert report['pass'] is True and report[field] == meta['sha256'], name
    report_pins[str(path).replace('\\', '/')] = sha(raw)
for path in ['tools/browser-bridge/build-maker.mjs', 'tools/browser-bridge/build-maker-release-v82.mjs',
             'tools/browser-bridge/package-maker-v82.py', 'docs/demos/baseball-maker.html']:
    inputs[path] = sha(Path(path).read_bytes())
for path, expected in inputs.items():
    assert sha(Path(path).read_bytes()) == expected, path
dest.mkdir(parents=True, exist_ok=True)
artifacts = {'maker.html': data, 'maker.html.build.json': meta_bytes, 'maker.html.bundle-inputs.json': pin_bytes}
for name, raw in artifacts.items():
    target = dest / name
    if target.exists():
        assert target.read_bytes() == raw, 'Do not replace a frozen release: ' + name
    else:
        target.write_bytes(raw)
release = {'version': 82, 'makerSha256': meta['sha256'], 'makerCoreSha256': meta['coreSha256'],
           'frozenNormalRendererSha256': meta['matchRendererSourceSha256'],
           'coreSourceCount': len(pins['inputs']), 'makerSources': inputs, 'acceptanceReports': report_pins,
           'scope': 'Maker authoring recovery only; inherited frozen v81 normal renderer is a separate bundle.'}
(dest / 'source-contract.json').write_text(json.dumps(release, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
artifacts['source-contract.json'] = (dest / 'source-contract.json').read_bytes()
(dest / 'SHA256.json').write_text(json.dumps({name: sha(raw) for name, raw in artifacts.items()}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'sha256': meta['sha256'], 'sourcePins': len(inputs), 'reports': len(reports)}, ensure_ascii=False))
