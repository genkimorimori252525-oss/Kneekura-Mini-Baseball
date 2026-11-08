"""Audit official MLB2025 H/AB splits and publish a compact comparison only."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import zipfile

ZONE_IDS = list(range(1, 10)) + list(range(11, 15))
BASE = 'https://statsapi.mlb.com/api/v1/stats?stats='
sha = lambda raw: hashlib.sha256(raw).hexdigest()

def source_url(code):
    extra = 'season' if code == 'season' else 'statSplits&sitCodes=' + code
    return BASE + extra + '&group=hitting&season=2025&sportIds=1&playerPool=ALL&limit=5000&gameType=R'

def audit_split(raw, code):
    packet = json.loads(raw)
    assert len(packet['stats']) == 1, 'One stat group required: ' + code
    group = packet['stats'][0]
    rows = group['splits']
    assert rows and len(rows) == group['totalSplits'], 'Incomplete provider page: ' + code
    seen = set()
    hits = at_bats = 0
    for row in rows:
        key = row['player']['id']
        assert key not in seen, 'Duplicate player: ' + code
        seen.add(key)
        assert row['season'] == '2025' and row.get('sport', {}).get('id') == 1, 'Wrong season/sport'
        assert row.get('gameType', 'R') == 'R', 'Unexpected returned game type'
        if code != 'season':
            assert row['split']['code'] == code, 'Wrong split code'
        h, ab = row['stat']['hits'], row['stat']['atBats']
        assert type(h) is int and type(ab) is int and 0 <= h <= ab, 'Invalid H/AB'
        hits += h
        at_bats += ab
    return {'hits': hits, 'atBats': at_bats, 'average': hits / at_bats if at_bats else None, 'players': len(rows)}

def build(cache):
    raw_files, sources, zones = {}, [], []
    for code in [f'zn{i:02}' for i in ZONE_IDS] + ['season']:
        raw = cache[code + '.json'] if isinstance(cache, dict) else (cache / (code + '.json')).read_bytes()
        result = audit_split(raw, code)
        raw_files[code + '.json'] = raw
        sources.append({'code': code, 'url': source_url(code), 'sha256': sha(raw), 'players': result.pop('players')})
        if code != 'season':
            zones.append({'zoneId': int(code[2:]), **result})
        else:
            total = result
    assert total['hits'] == 40138 and total['atBats'] == 163664, '2025 season control totals differ'
    unknown = {'hits': total['hits'] - sum(z['hits'] for z in zones), 'atBats': total['atBats'] - sum(z['atBats'] for z in zones)}
    assert 0 <= unknown['hits'] <= unknown['atBats'], 'Overlapping or missing source aggregation'
    unknown['average'] = unknown['hits'] / unknown['atBats'] if unknown['atBats'] else None
    reference = {'version': 'mlb_course_reference_v87', 'season': 2025, 'gameType': 'R', 'perspective': 'catcher',
                 'authority': 'MLB_OFFICIAL_STAT_SPLITS_WEIGHTED_H_AB_REFERENCE_ONLY',
                 'semantics': 'Terminal plate-appearance H/AB grouped by recorded pitch zone; unknown positions remain separate.',
                 'zones': zones, 'total': total, 'unknown': unknown,
                 'sources': sources, 'copyright': json.loads(raw_files['season.json']).get('copyright', '')}
    data = (json.dumps(reference, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, raw in sorted(raw_files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, raw, compresslevel=9)
    return data, buffer.getvalue()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache')
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    if args.audit_only and not args.cache:
        with zipfile.ZipFile('docs/data/mlb-2025/mlb2025-zones-source-v87.zip') as original:
            expected = {f'zn{i:02}.json' for i in ZONE_IDS} | {'season.json'}
            assert set(original.namelist()) == expected, 'Archive contains unexpected source files'
            cache = {name: original.read(name) for name in sorted(expected)}
    else:
        cache = Path(args.cache or 'work/mlb-2025-course-research')
    data, archive = build(cache)
    files = {Path('docs/demos/mlb-2025-course-reference-v87.json'): data,
             Path('docs/data/mlb-2025/mlb2025-zones-source-v87.zip'): archive}
    for path, raw in files.items():
        if args.audit_only:
            assert path.read_bytes() == raw, 'Published reference differs: ' + str(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    ref = json.loads(data)
    print(json.dumps({'pass': True, 'zones': len(ref['zones']), 'season': ref['total'], 'unknown': ref['unknown'],
                      'files': {str(p): {'bytes': len(r), 'sha256': sha(r)} for p, r in files.items()}}))

if __name__ == '__main__':
    main()
