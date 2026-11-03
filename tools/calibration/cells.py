# Batting and batted-ball shape per value of a mixed league (grid.py map), one line per value or cell.
# usage: python -I cells.py <map.json> "<records glob>" [index]   (index picks one key of a multi-key grid)
import collections
import glob
import json
import statistics as st
import sys

m = json.load(open(sys.argv[1]))
idx = int(sys.argv[3]) if len(sys.argv) > 3 else None
rows = [json.loads(l) for f in glob.glob(sys.argv[2]) for l in open(f)]
ended = lambda r: r.get('scoring') and r['scoring'] not in ('plate_appearance_continues', 'unresolved')


def summ(L):
    e = [r for r in L if ended(r)]
    c = collections.Counter(r['scoring'] for r in e)
    ab = len(e) - c['walk'] - c['hit_by_pitch'] - c['sacrifice_fly']
    h = [r for r in e if (r['hitBases'] or 0) > 0]
    tb = sum(r['hitBases'] for r in h)
    hr = sum(1 for r in h if r['hitBases'] == 4 or (r['homeRuns'] or 0) > 0)
    b = [r for r in e if r.get('exit') and r['play'] != 'foul']
    mph = [r['exit']['kmh'] / 1.609344 for r in b]
    la = [r['exit']['launch'] for r in b]
    return ('pa %4d avg %.3f iso %.3f babip %.3f hr %.3f k %.3f bb %.3f | EV %.1f 100+ %.2f LA %.1f GB %.2f LD %.2f FB %.2f PU %.2f' % (
        len(e), len(h) / ab, (tb - len(h)) / ab, (len(h) - hr) / max(1, ab - c['strikeout'] - hr), hr / len(e), c['strikeout'] / len(e), c['walk'] / len(e),
        st.mean(mph), sum(x >= 100 for x in mph) / len(mph), st.mean(la), sum(a < 10 for a in la) / len(la), sum(10 <= a < 25 for a in la) / len(la),
        sum(25 <= a < 50 for a in la) / len(la), sum(a >= 50 for a in la) / len(la)))


g = collections.defaultdict(list)
for r in rows:
    v = m[r['batter']]
    g[str(v[idx] if idx is not None else v)].append(r)
for v in sorted(g):
    print(v.ljust(16), summ(g[v]))
print('all'.ljust(16), summ(rows))
