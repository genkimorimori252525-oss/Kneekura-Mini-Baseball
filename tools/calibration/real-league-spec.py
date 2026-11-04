# Picks 18 real hitters spread over power and strikeouts from a targets file, inverts their abilities on a response
# surface, and writes a kbm-maker spec that puts them into the 18 batting slots of the standard league.
# usage: python -I -X utf8 real-league-spec.py <targets.json> <surface.json> <base-config.json> <spec-out.json> <truth-out.json>
#        [--sprint=<csv> --year=Y] [--pick=<earlier truth.json> [--adjust="<earlier records glob>" --table=<table.json> --gain=1]]
#        [--attack-offset=2.8] [--batspeed=<csv>] [--soft=1 --power-offset=3.3 --power-sd=5 --attack-sd=3]  (targets with 'attack_angle' keep it; 'gb' and 'fb' are fitted when the surface has them)
import importlib.util
import json
import math
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('af', os.path.join(here, 'ability-fit.py'))
af = importlib.util.module_from_spec(spec)
sys.argv, args = ['x'], sys.argv[1:]
spec.loader.exec_module(af)
opts = dict(a[2:].split('=', 1) for a in args if a.startswith('--'))
targets_path, surface_path, base_path, spec_out, truth_out = [a for a in args if not a.startswith('--')]
# --sprint=<csv> --year=Y: run is fixed from Statcast sprint speed (ft/s), the maker's top speed being 8.1 m/s at 84 and
# 100 points a factor of e; the other abilities are then inverted around it.
sprint = {}
if 'sprint' in opts:
    import csv
    for row in csv.DictReader(open(opts['sprint'], encoding='utf8')):
        if row['year'] == opts.get('year') and row['lahman_playerID'] and row['sprint_speed_ftps']:
            sprint[row['lahman_playerID']] = float(row['sprint_speed_ftps'])
# --batspeed=<csv>: power is fixed from Statcast bat speed (mph, 2023-), the maker's aimed sweet-spot speed being 32 m/s at 84.
batspeed = {}
if 'batspeed' in opts:
    import csv
    for row in csv.DictReader(open(opts['batspeed'], encoding='utf8')):
        if row['year'] == opts.get('year') and row['lahman_id'] and row['avg_bat_speed'] and float(row['swings_competitive'] or 0) >= 100:
            batspeed[row['lahman_id']] = float(row['avg_bat_speed'])
targets = json.load(open(targets_path, encoding='utf8'))
surface = json.load(open(surface_path))
pool = [(pid, t) for pid, t in targets.items() if t['pa'] >= 400]
picked = []
for group in (sorted(pool, key=lambda x: -x[1]['iso']), sorted(pool, key=lambda x: x[1]['iso']), sorted(pool, key=lambda x: -x[1]['k']), sorted(pool, key=lambda x: x[1]['k'])):
    taken = 0
    for item in group:
        if taken < 5 and item[0] not in [p[0] for p in picked]:
            picked.append(item); taken += 1
picked = picked[:18]
# --pick=<truth.json> keeps an earlier run's hitters in their slots; with --adjust="<records glob>" every target moves by
# the mean gap that run left over its hitters (real minus game), so the next inversion corrects what the surface gets wrong
# for this league. --adjust-each=1 moves each hitter by his own gap instead; with a few hundred plate appearances a hitter's
# gap is mostly sampling noise, and following it made the second run worse (ISO correlation .94 -> .78).
if 'pick' in opts:
    earlier = json.load(open(opts['pick'], encoding='utf8'))
    picked = [(v['source'], targets[v['source']]) for v in earlier.values()]
STATS = [k for k in ('k', 'bb', 'iso', 'babip', 'hr', 'gb', 'fb') if k in surface['coef']]   # gb, fb only when the surface has them
tmp = {pid: {k: t[k] for k in ['pa'] + STATS if k in t} for pid, t in picked}
if 'adjust' in opts:
    import glob
    game = af.batter_stats(glob.glob(opts['adjust']), af.ot.predictor(json.load(open(opts['table']))))
    seen = [(v['source'], slot) for slot, v in earlier.items() if slot in game]
    gain = float(opts.get('gain', '1'))
    for k in [k for k in STATS if all(k in targets[pid] for pid, _ in seen)]:
        mean_gap = sum(targets[pid][k] - game[slot][k] for pid, slot in seen) / len(seen)
        for pid, slot in seen:
            gap = targets[pid][k] - game[slot][k] if opts.get('adjust-each') == '1' else mean_gap
            tmp[pid][k] = max(0.0, tmp[pid][k] + gain * gap)
for pid, t in picked:
    fixed = {}
    prior = {}
    if pid in batspeed:
        # --soft=1: measured power and attack angle become priors ([centre, sd]) instead of fixed values. The centre carries
        # --power-offset (3.3: free inversions sat that much above the bat-speed power, 2026-11-04).
        power = 84 + 100 * math.log(batspeed[pid] * .44704 / 32)
        if opts.get('soft') == '1':
            prior['power'] = [power + float(opts.get('power-offset', '0')), float(opts.get('power-sd', '5'))]
        else:
            fixed['power'] = power
    if pid in sprint:
        fixed['run'] = 84 + 100 * math.log(sprint[pid] * .3048 / 8.1)
    # --attack-offset=D: a measured Statcast attack angle (2023-) fixes the swing angle, the game's own angle at contact
    # running about D degrees under the authored one (2.8 measured on the standard league, 2026-11-04).
    if 'attack-offset' in opts and t.get('attack_angle') is not None:
        if opts.get('soft') == '1':
            prior['attackAngleDegrees'] = [t['attack_angle'] + float(opts['attack-offset']), float(opts.get('attack-sd', '3'))]
        else:
            fixed['attackAngleDegrees'] = t['attack_angle'] + float(opts['attack-offset'])
    if 'left' in surface['keys'] and t.get('bats') in ('R', 'L'):
        fixed['left'] = 1.0 if t['bats'] == 'L' else 0.0
    if fixed:
        tmp[pid]['fixed'] = fixed
    if prior:
        tmp[pid]['prior'] = prior
json.dump(tmp, open(truth_out + '.targets', 'w'))
af.invert(surface_path, truth_out + '.targets', truth_out + '.inv')
inv = json.load(open(truth_out + '.inv'))
base = json.load(open(base_path, encoding='utf8'))
slots = [b for team in base['teams'] for b in team['battingOrder']]
spec_doc, truth = {'players': {}}, {}
for slot, (pid, t) in zip(slots, picked):
    a = inv[pid]['abilities']
    spec_doc['players'][slot] = {'name': t['name'], **({'bats': t['bats']} if t.get('bats') in ('R', 'L') else {}),
                                 'abilities': {k: a[k] for k in ('contact', 'power', 'vision', 'run')}, 'attackAngleDegrees': a['attackAngleDegrees'],
                                 **({'physical': {'undercutAimMeters': a['undercut']}} if 'undercut' in a else {})}
    truth[slot] = {'source': pid, 'name': t['name'], **{k: t[k] for k in ('pa', 'k', 'bb', 'iso', 'babip', 'hr', 'avg', 'gb', 'fb') if k in t}, 'abilities': a, 'predicted': inv[pid]['predicted']}
json.dump(spec_doc, open(spec_out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(truth, open(truth_out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for slot, t in truth.items():
    print(slot, t['name'][:18].ljust(18), 'abil', {k: round(v) for k, v in t['abilities'].items()})
