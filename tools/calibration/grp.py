# Per-group batting from a mixed league. usage: python -I grp.py <map.json> <glob> [index]
import json, collections, glob, sys
m = json.load(open(sys.argv[1])); idx = int(sys.argv[3]) if len(sys.argv) > 3 else None
rows = [json.loads(l) for f in glob.glob(sys.argv[2]) for l in open(f)]
g = collections.defaultdict(list)
for r in rows:
    v = m[r['batter']]; g[v[idx] if idx is not None else v].append(r)
for v in sorted(g):
    L = g[v]; e = [r for r in L if r.get('scoring') and r['scoring'] not in ('plate_appearance_continues', 'unresolved')]
    c = collections.Counter(r['scoring'] for r in e); sw = [r for r in L if r['swing']]
    ab = len(e) - c['walk'] - c['hit_by_pitch'] - c['sacrifice_fly']; h = [r for r in e if (r['hitBases'] or 0) > 0]; tb = sum(r['hitBases'] for r in h)
    zone = [r for r in L if r['zone'] and r['x'] is not None]
    inz = lambda r: abs(r['x']) <= r['zone']['half'] + .0366 and r['zone']['low'] - .0366 <= r['y'] <= r['zone']['high'] + .0366
    o = [r for r in zone if not inz(r)]
    print(v, 'pa', len(e), 'k %.3f bb %.3f contact %.3f oSwing %.3f avg %.3f iso %.3f' % (c['strikeout'] / len(e), c['walk'] / len(e),
          sum(1 for r in sw if r['foulOrContact']) / len(sw), sum(1 for r in o if r['swing']) / len(o), len(h) / ab, (tb - len(h)) / ab))
