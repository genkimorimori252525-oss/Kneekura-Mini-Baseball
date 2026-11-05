# Mean pitch location by pitch type in the match (toward the pitcher's arm side in metres, above the zone's middle in zone
# half-heights), from playthrough records with each records glob paired to its league config for the pitchers' hands.
# usage: python -I -X utf8 loc-centroid.py "<records glob>::<config.json>"...
import collections, glob, json, sys
c = collections.defaultdict(lambda: [0, 0.0, 0.0])
for pair in sys.argv[1:]:
    rec, cfg = pair.split('::')
    throws = {p['playerId']: p.get('throws', 'R') for p in json.load(open(cfg, encoding='utf8'))['players']}
    for f in glob.glob(rec):
        for l in open(f):
            r = json.loads(l)
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; t = c[r['pitch']]
            t[0] += 1; t[1] += -r['x'] if throws.get(r['pitcher'], 'R') == 'R' else r['x']; t[2] += (r['y'] - (z['low'] + z['high']) / 2) / ((z['high'] - z['low']) / 2)
for k, (n, a, u) in sorted(c.items(), key=lambda kv: -kv[1][0]):
    print(f'  {k:14} n {n:6}  arm {a / n:+.3f} m  up {u / n:+.3f}')
