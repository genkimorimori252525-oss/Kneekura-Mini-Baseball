# The game's records cut like mlb-tunnel.py: whiff/swing by inches outside Savant's zone widened by the ball, per pitch group,
# with the misread share of the swings and the whiff on a misread and on a right read; and by where the decision saw the pitch
# (judge.est) against where it ended.
# usage: python -I -X utf8 sim-tunnel.py <records folder> <tag>... [--seeds=7101-7112,7201-7212]
import collections, glob, json, math, os, sys
R = .0366; I = 1 / .0254
GROUP = {'fastball': 'FB', 'sinker': 'FB', 'cutter': 'FB', 'slider': 'BR', 'sweeper': 'BR', 'curve': 'BR', 'knuckle_curve': 'BR',
         'slurve': 'BR', 'changeup': 'OS', 'splitter': 'OS'}
def out(x, y, z):
    dx = abs(x) - z['half'] - R; dz = max(z['low'] - R - y, y - z['high'] - R)
    if dx <= 0 and dz <= 0: return I * max(dx, dz)
    return I * math.hypot(max(dx, 0), max(dz, 0))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
keep = None if 'seeds' not in opt else {s for r in opt['seeds'].split(',') for s in range(int(r.split('-')[0]), int(r.split('-')[-1]) + 1)}
BINS = [(-99, -3), (-3, 0), (0, 2), (2, 4), (4, 7), (7, 10), (10, 99)]
for tag in args[1:]:
    P = []
    for f in sorted(glob.glob(f'{args[0]}/g-{tag}-*.jsonl')):
        if f.count('.jsonl') > 1 or keep is not None and int(f.rsplit('-', 1)[1].split('.')[0]) not in keep: continue
        for l in open(f, encoding='utf8'):
            r = json.loads(l)
            if r['x'] is None or not r['zone'] or r['pitch'] not in GROUP or r.get('call') == 'hit_by_pitch': continue
            j = (r.get('judge') or {}).get('est')
            P.append(dict(g=GROUP[r['pitch']], sw=r['swing'], wh=r['swing'] and not r['foulOrContact'], out=out(r['x'], r['y'], r['zone']),
                          look=out(j['x'], j['y'], r['zone']) if j else None, mis=bool(r.get('recog')) and not r['recog']['ok']))
    print(f'#### {tag}: pitches {len(P)}')
    def line(name, a):
        s = [o for o in a if o['sw']]; m = [o for o in s if o['mis']]; k = [o for o in s if not o['mis']]
        return (f"{name:22} n {len(a):6}  swing {len(s) / max(1, len(a)):.3f}  whiff/swing {sum(o['wh'] for o in s) / max(1, len(s)):.3f}"
                f"  misread {len(m) / max(1, len(s)):.2f} wh|mis {sum(o['wh'] for o in m) / max(1, len(m)):.3f} wh|ok {sum(o['wh'] for o in k) / max(1, len(k)):.3f}")
    for g in ('FB', 'BR', 'OS', 'all'):
        a = [o for o in P if g == 'all' or o['g'] == g]
        print(f'== {g}'); print(line('in zone', [o for o in a if o['out'] <= 0])); print(line('out of zone', [o for o in a if o['out'] > 0]))
        for lo, hi in BINS: print(' ', line(f'[{lo},{hi})', [o for o in a if lo <= o['out'] < hi]))
        b = [o for o in a if o['look'] is not None]
        for ln, lf in (('seen in', lambda o: o['look'] <= 0), ('seen out', lambda o: o['look'] > 0)):
            for en, ef in (('ended in', lambda o: o['out'] <= 0), ('ended out', lambda o: o['out'] > 0)):
                print(' ', line(f'{ln}, {en}', [o for o in b if lf(o) and ef(o)]))
