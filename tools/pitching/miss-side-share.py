# The match's out-of-zone pitches by side (up, down, the pitcher's arm side, his glove side) for each pitch type, against MLB
# (fit-miss-direction.py --shares), and the in-zone share. Same widened zone and furthest-side rule as fetch-miss-direction.py;
# the arm side is x < 0 for a right-hander (catcher's view). Each records glob is paired with its league config for the pitchers' hands.
# usage: python -I -X utf8 miss-side-share.py "<records glob>::<config.json>"...
import collections, glob, json, sys
R = .0366
SIDES = ['up', 'down', 'arm', 'glove']
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH', 'splitter': 'FS', 'knuckle_curve': 'KC'}
c = collections.defaultdict(collections.Counter)
for pair in sys.argv[1:]:
    rec, cfg = pair.split('::')
    throws = {p['playerId']: p.get('throws', 'R') for p in json.load(open(cfg, encoding='utf8'))['players']}
    for f in glob.glob(rec):
        for l in open(f):
            r = json.loads(l)
            if r['x'] is None or not r['zone']: continue
            z, x, y = r['zone'], r['x'], r['y']
            side, up, down = abs(x) - (z['half'] + R), y - (z['high'] + R), (z['low'] - R) - y
            out = max(side, up, down); t = CODE.get(r['pitch'], r['pitch'])
            if out <= 0: c[t]['in'] += 1; continue
            c[t]['up' if out == up else 'down' if out == down else ('arm' if (x < 0) == (throws.get(r['pitcher'], 'R') == 'R') else 'glove')] += 1
for t, v in sorted(c.items(), key=lambda kv: -sum(kv[1].values())):
    o = sum(v[s] for s in SIDES)
    if o < 30: continue
    print(f"  {t}  n {sum(v.values()):6}  zone {v['in'] / (o + v['in']):.3f}  " + '  '.join(f'{s} {v[s] / o:.3f}' for s in SIDES))
