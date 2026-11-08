# Whiff per swing by pitcher and pitch type: the real pitchers' leagues (real-pitcher-spec.py) against Savant's own numbers.
# The match's whiffs should follow the pitch: correlation and slope over the pitcher-pitch pairs with enough swings.
# usage: python -I -X utf8 pitch-whiff-real.py <truth.json> <pitcher-year.csv (lahman_id, mlbam_id)> <mlb_pitch_type_player_year.csv>
#        "<records glob with {league}>" [min swings=40]
import collections
import csv
import glob
import json
import math
import sys

truth_path, ids_path, types_path, pattern = sys.argv[1:5]
least = int(sys.argv[5]) if len(sys.argv) > 5 else 40
truth = json.load(open(truth_path, encoding='utf8'))
mlbam = {r['lahman_id']: r['mlbam_id'] for r in csv.DictReader(open(ids_path, encoding='utf8'))}
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH',
        'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV'}
year = {t.get('year', '2024') for t in truth.values()}.pop()
savant = {(r['mlbam_id'], r['pitch_type']): float(r['whiff_pct_savant']) / 100
          for r in csv.DictReader(open(types_path, encoding='utf8')) if r['year'] == year and r.get('whiff_pct_savant')}
acc = collections.defaultdict(collections.Counter)
for slot, t in truth.items():
    league, pitcher = slot.split('/')
    for f in glob.glob(pattern.replace('{league}', league)):
        for line in open(f):
            r = json.loads(line)
            if r['pitcher'] != pitcher or not r['swing']:
                continue
            a = acc[(mlbam[t['source']], CODE.get(r['pitch'], r['pitch']))]
            a['sw'] += 1
            a['wh'] += not r['foulOrContact']
pairs = [(savant[k], a['wh'] / a['sw'], k[1]) for k, a in acc.items() if a['sw'] >= least and k in savant]
xs, ys = [p[0] for p in pairs], [p[1] for p in pairs]
mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
sxy, sxx, syy = (sum((a - mx) * (b - my) for a, b in zip(xs, ys)), sum((a - mx) ** 2 for a in xs), sum((b - my) ** 2 for b in ys))
print('pairs', len(pairs), 'corr %.2f slope %.2f  mean savant %.3f match %.3f  sd savant %.3f match %.3f' % (
    sxy / math.sqrt(sxx * syy), sxy / sxx, mx, my, math.sqrt(sxx / len(xs)), math.sqrt(syy / len(ys))))
