# The game's hitters by the same bands as statcast-bands.py (distance past the zone widened by the ball), from playthrough records:
# swing / contact per swing (count of pitches) for in-zone and each band, by strikes.
# usage: python -I game-bands.py "<records glob>"
import glob, json, sys, collections
R = .0366; EDGES = [0, .06, .12, .20, .30, .45, 9]
acc = collections.defaultdict(collections.Counter)
for f in glob.glob(sys.argv[1]):
    for line in open(f):
        r = json.loads(line)
        if r['x'] is None or not r['zone']: continue
        z = r['zone']; d = max(abs(r['x']) - z['half'] - R, z['low'] - R - r['y'], r['y'] - z['high'] - R)
        g = '3-0' if r['balls'] == 3 and r['strikes'] == 0 else 's%d' % r['strikes']
        band = 'in' if d <= 0 else next(i for i in range(len(EDGES) - 1) if d < EDGES[i + 1])
        a = acc[(g, band)]; a['n'] += 1; a['sw'] += r['swing']; a['wh'] += r['swing'] and not r['foulOrContact']
for g in ['s0', 's1', 's2']:
    print(g, ' '.join('%s %.3f/%.2f(%d)' % (b, acc[(g, b)]['sw'] / max(1, acc[(g, b)]['n']), 1 - acc[(g, b)]['wh'] / max(1, acc[(g, b)]['sw']), acc[(g, b)]['n']) for b in ['in', 0, 1, 2, 3, 4, 5]))
