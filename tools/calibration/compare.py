# Real season vs simulated league, player by player. usage: python -I -X utf8 compare.py <truth.json> <records glob>
import collections
import glob
import json
import math
import sys

truth = json.load(open(sys.argv[1], encoding='utf8'))
rows = [json.loads(l) for f in glob.glob(sys.argv[2]) for l in open(f)]
by = collections.defaultdict(list)
for r in rows:
    if r.get('scoring') and r['scoring'] not in ('plate_appearance_continues', 'unresolved'):
        by[r['batter']].append(r)


def stats(e):
    c = collections.Counter(r['scoring'] for r in e)
    ab = len(e) - c['walk'] - c['hit_by_pitch'] - c['sacrifice_fly']
    h = [r for r in e if (r['hitBases'] or 0) > 0]
    tb = sum(r['hitBases'] for r in h)
    hr = sum(1 for r in h if r['hitBases'] == 4 or (r['homeRuns'] or 0) > 0)
    return {'pa': len(e), 'avg': len(h) / ab, 'iso': (tb - len(h)) / ab, 'k': c['strikeout'] / len(e), 'bb': c['walk'] / len(e), 'hr': hr / len(e),
            'babip': (len(h) - hr) / max(1, ab - c['strikeout'] - hr + c['sacrifice_fly'])}


def corr(xs, ys):
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))


keys = ('avg', 'iso', 'k', 'bb', 'hr', 'babip')
print('name'.ljust(8), 'PA ', '  '.join(f'{k:>11}' for k in keys), '(real/sim)')
sim = {}
for pid, t in truth.items():
    s = sim[pid] = stats(by[pid])
    print(t['name'][:6].ljust(8), str(s['pa']).rjust(3), '  '.join(f"{t[k]:.3f}/{s[k]:.3f}" for k in keys))
print('mean'.ljust(12), '  '.join(f"{sum(t[k] for t in truth.values()) / len(truth):.3f}/{sum(s[k] for s in sim.values()) / len(sim):.3f}" for k in keys))
print('corr'.ljust(12), '  '.join(f"{corr([truth[p][k] for p in truth], [sim[p][k] for p in truth]):>11.2f}" for k in keys))
