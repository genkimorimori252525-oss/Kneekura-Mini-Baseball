"""Independent finite population comparison; no engine calls or record repair."""
import hashlib
import json
import pathlib
import sys

directories = [pathlib.Path(p).resolve() for p in sys.argv[1:]]
if len(directories) != 3:
    raise SystemExit('requires v1, v2 and v3 audit directories')
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
configs = [load(p / 'configuration.json') for p in directories]
summaries = [load(p / 'summary.json') for p in directories]
records = [[json.loads(line) for line in (p / 'pitch-records.ndjson').read_text(encoding='utf-8').splitlines()] for p in directories]
for key in ['count', 'datasetSha256', 'calibration', 'physics']:
    assert all(c[key] == configs[0][key] for c in configs), key
assert all(len(r) == configs[0]['count'] == 1000 for r in records)
keys = ['index', 'seed', 'side', 'batting', 'pitchType', 'clipId', 'contact', 'contactMoment', 'contactOrientation']
assert all(all(row[key] == group[0][key] for key in keys) for group in zip(*records) for row in group[1:])
assert [(s['contacts'], s['calls'], s['unsupported'], s['thrown']) for s in summaries] == [(623, 374, 3, 0), (623, 377, 0, 0), (623, 377, 0, 0)]
assert configs[2]['catcher'] == {'gloveSpeedMps': 11, 'gloveReachMeters': 1.35, 'gloveRadiusMeters': .11,
                              'retentionCapacityJ': 160, 'captureDissipationPowerW': 3000, 'pocketRadiusMeters': .14}
assert len(summaries[2]['byClip']) == 12
report = {'status': 'PASS_UNCHANGED_ORIGINAL_PITCH_AND_BAT_CONTACT_POPULATION', 'count': 1000,
          'equalRecordFields': keys, 'all12MeasuredClipsUsed': True, 'originalFailuresPreserved': summaries[0]['failures'],
          'hostCatcherSI': configs[2]['catcher'], 'fullMatchVerified': False, 'empiricalPopulationVerified': False,
          'inputs': [{'directory': str(p), 'configurationSha256': sha(p / 'configuration.json'),
                      'recordsSha256': sha(p / 'pitch-records.ndjson'), 'summarySha256': sha(p / 'summary.json')} for p in directories]}
destination = directories[2] / 'cross-model-comparison.json'
with destination.open('x', encoding='utf-8') as handle:
    json.dump(report, handle, ensure_ascii=False, indent=2)
    handle.write('\n')
print(json.dumps({'status': report['status'], 'report': str(destination), 'sha256': sha(destination)}, ensure_ascii=False))
