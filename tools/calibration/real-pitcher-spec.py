# Puts real pitchers of one season into leagues of two starters each: the top speed is fixed from the Statcast fastball
# (average fastball + 1.1 mph, the game's pitches running about 0.99 of the top), control is inverted on the pitcher
# surface from the walk rate (and the rest), and a kbm-maker spec per league is written.
# usage: python -I -X utf8 real-pitcher-spec.py <pitcher-year.csv> <pitcher surface.json> <out dir> --year=2024 [--n=20] [--min-bf=500]
# Writes <out>/spec-<i>.json and <out>/truth.json ({"<league>/<slot>": {source, name, k, bb, hr, babip, bf, abilities, predicted}}).
# --list prints the picked pitchers' MLBAM ids and stops. --repertoire=<dir> gives each pitcher his own pitches from
# <dir>/pitcher-<mlbam_id>-<year>.json (tools/pitching/statcast-to-v78.ts --pitcher), with his release, written as physical;
# the top speed is then the larger of the fastball's average + 1.1 mph and his fastest pitch, and only control is inverted.
import csv
import importlib.util
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('af', os.path.join(here, 'ability-fit.py'))
af = importlib.util.module_from_spec(spec)
sys.argv, args = ['x'], sys.argv[1:]
spec.loader.exec_module(af)
opts = dict((a[2:].split('=', 1) + [''])[:2] for a in args if a.startswith('--'))
table_path, surface_path, out_dir = [a for a in args if not a.startswith('--')]
year, n, min_bf = opts.get('year', '2024'), int(opts.get('n', '20')), float(opts.get('min-bf', '500'))
rows = [r for r in csv.DictReader(open(table_path, encoding='utf8'))
        if r['year'] == year and r['fb_avg_speed'] and r['bfp'] and float(r['bfp']) >= min_bf]
# Spread the picks over fastball speed: sort by speed and take every k-th pitcher.
rows.sort(key=lambda r: float(r['fb_avg_speed']))
step = max(1, len(rows) // n)
picked = rows[::step][:n]
if 'list' in opts:
    print(' '.join(r['mlbam_id'] for r in picked))
    sys.exit(0)
owned = {}
if 'repertoire' in opts:
    for r in picked:
        path = os.path.join(opts['repertoire'], 'pitcher-%s-%s.json' % (r['mlbam_id'], year))
        if not os.path.exists(path):
            sys.exit('no repertoire for ' + r['mlbam_id'] + ': ' + path)
        owned[r['lahman_id']] = json.load(open(path, encoding='utf8'))
targets = {}
for r in picked:
    top_kmh = (float(r['fb_avg_speed']) + 1.1) * 1.609344
    if r['lahman_id'] in owned:
        top_kmh = max(top_kmh, max(p['releaseSpeedMps'] for p in owned[r['lahman_id']]['pitchRepertoireV78']['pitches']) * 3.6)
    targets[r['lahman_id']] = {'pa': float(r['bfp']), 'k': float(r['k_per_bf']), 'bb': float(r['bb_per_bf']), 'hr': float(r['hr_per_bf']),
                               'babip': float(r['babip_bf']), 'fixed': {'maxSpeedKmh': top_kmh}}
os.makedirs(out_dir, exist_ok=True)
json.dump(targets, open(os.path.join(out_dir, 'targets.json'), 'w'))
af.invert(surface_path, os.path.join(out_dir, 'targets.json'), os.path.join(out_dir, 'inv.json'))
inv = json.load(open(os.path.join(out_dir, 'inv.json')))
truth = {}
for i in range(0, len(picked) - 1, 2):
    league = i // 2
    spec_doc = {'players': {}}
    for slot, r in zip(('0-p0', '1-p0'), picked[i:i + 2]):
        a = inv[r['lahman_id']]['abilities']
        spec_doc['players'][slot] = {'name': r['name'], 'throws': r['throws'] if r['throws'] in ('R', 'L') else 'R',
                                     'abilities': {'maxSpeedKmh': round(a['maxSpeedKmh'], 1), 'control': a['control']}}
        if r['lahman_id'] in owned:
            o = owned[r['lahman_id']]
            # The fastest pitch may sit exactly on the top speed; a millimetre a second keeps rounding from putting it over.
            top = max(a['maxSpeedKmh'] / 3.6, max(p['releaseSpeedMps'] for p in o['pitchRepertoireV78']['pitches'])) + .001
            spec_doc['players'][slot]['abilities'] = {'control': a['control']}
            spec_doc['players'][slot]['physical'] = {'pitchRepertoireV78': o['pitchRepertoireV78'], 'maximumPitchSpeedMps': top, 'releaseSpeedMps': top * .97,
                                                     **{k: v for k, v in o['physical'].items() if k != 'throws'}}
        truth[f'{league}/{slot}'] = {'source': r['lahman_id'], 'name': r['name'], 'bf': float(r['bfp']), 'fb_avg_speed': float(r['fb_avg_speed']),
                                     **{k: targets[r['lahman_id']][k] for k in ('k', 'bb', 'hr', 'babip')},
                                     'abilities': a, 'predicted': inv[r['lahman_id']]['predicted']}
    json.dump(spec_doc, open(os.path.join(out_dir, f'spec-{league}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(truth, open(os.path.join(out_dir, 'truth.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('leagues', len(picked) // 2, 'pitchers', len(truth))
