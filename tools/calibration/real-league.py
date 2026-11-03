# Puts 18 real NPB hitters of one season into the standard league, spread over power and strikeouts,
# to check the ability conversion player by player.
# usage: python -I real-league.py <abilities.jsonl> <batting.csv> <year> <base-config.json> <out-config.json> <out-truth.json>
import csv
import json
import sys

abil_path, batting_path, year, base_path, out_path, truth_path = sys.argv[1:]
abilities = [json.loads(l) for l in open(abil_path, encoding='utf8') if l.startswith('{')]
batting = {}
for r in csv.DictReader(open(batting_path, encoding='utf8')):
    if r['yearID'] == year:
        row = batting.setdefault(r['playerID'], {k: 0. for k in ('PA', 'AB', 'H', '2B', '3B', 'HR', 'BB', 'SO', 'HBP', 'SF')})
        for k in row:
            row[k] += float(r[k] or 0)
pool = [p for p in abilities if p['pa'] >= 400]
iso = lambda p: (lambda b: (b['2B'] + 2 * b['3B'] + 3 * b['HR']) / b['AB'])(batting[p['playerId']])
k_rate = lambda p: batting[p['playerId']]['SO'] / batting[p['playerId']]['PA']
picked = []
for group in (sorted(pool, key=iso, reverse=True), sorted(pool, key=iso), sorted(pool, key=k_rate, reverse=True), sorted(pool, key=k_rate)):
    taken = 0
    for p in group:
        if taken < 5 and p not in picked:
            picked.append(p)
            taken += 1
picked = picked[:18]
config = json.load(open(base_path, encoding='utf8'))
ids = [b for t in config['teams'] for b in t['battingOrder']]
by = {p['playerId']: p for p in config['players']}
truth = {}
for pid, p in zip(ids, picked):
    player = by[pid]
    player['name'] = p['name']
    player['heightMeters'] = p['heightMeters']
    if p['bats'] in ('R', 'L'):
        player['bats'] = p['bats']
    for key in ('timingStdSeconds', 'aimStdMeters', 'plateVision', 'targetSweetSpotSpeedMps', 'maximumSweetSpotSpeedMps', 'topSpeedMps', 'attackAngleDegrees'):
        player['physical'][key] = p[key]
    b = batting[p['playerId']]
    hits = b['H']
    truth[pid] = {'source': p['playerId'], 'name': p['name'], 'pa': b['PA'], 'avg': hits / b['AB'], 'iso': iso(p), 'k': b['SO'] / b['PA'], 'bb': b['BB'] / b['PA'],
                  'hr': b['HR'] / b['PA'], 'babip': (hits - b['HR']) / (b['AB'] - b['SO'] - b['HR'] + b['SF'])}
json.dump(config, open(out_path, 'w', encoding='utf8'), ensure_ascii=False)
json.dump(truth, open(truth_path, 'w', encoding='utf8'), ensure_ascii=False)
print('players', len(truth))
