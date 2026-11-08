# Strikeouts, walks and whiff per swing by the time through the order (the batter's n-th plate appearance of the game against
# the same pitcher), from playthrough records where one pitcher works the whole game.
# usage: python -I tto-split.py "<records glob>"...
import collections, glob, json, sys
for pattern in sys.argv[1:]:
    a = collections.defaultdict(collections.Counter)
    for f in glob.glob(pattern):
        seen = collections.Counter(); current = {}
        for line in open(f):
            r = json.loads(line)
            key = (r['batter'], r['pitcher'])
            if key not in current: seen[key] += 1; current[key] = True
            t = min(3, seen[key]); x = a[t]
            x['sw'] += r['swing']; x['wh'] += r['swing'] and not r['foulOrContact']
            s = r['scoring']
            if s and s != 'plate_appearance_continues':
                x['pa'] += 1; x['k'] += s == 'strikeout'; x['bb'] += s == 'walk'; current.pop(key)
    print(pattern, ' | '.join('TTO%d PA %d K %.3f BB %.3f wh/sw %.3f' % (t, a[t]['pa'], a[t]['k'] / a[t]['pa'], a[t]['bb'] / a[t]['pa'], a[t]['wh'] / a[t]['sw']) for t in sorted(a)))
