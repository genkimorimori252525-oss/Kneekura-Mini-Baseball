# MLB June 2024 (Statcast pitch level): how the whiff on a swing follows where the pitch ends (distance outside Savant's
# zone widened by the ball) and how far it leaves the pitcher's fastball path late (tunnel). Late departure: a pitch seen at
# t_d before the plate and carried on with the pitcher's own fastball acceleration lands at p_ext; the actual pitch lands
# .5 (a - a_FB) t_d^2 away. d_look is p_ext's distance outside the zone: where the pitch looked headed if read as a fastball.
# Also the miss distance of whiffs (bat tracking), in and out of the zone.
# usage: python -I -X utf8 mlb-tunnel.py <folder with p*.csv> [--td=0.175]
import collections, csv, glob, math, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
TD = float(opt.get('td', .175))
R = 1.45 / 12; HALF = 17 / 24 + R; YP = 17 / 12
GROUP = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS', 'SC': 'OS'}
SWING = {'foul', 'foul_tip', 'hit_into_play', 'swinging_strike', 'swinging_strike_blocked'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
rows, seen = [], set()
for f in sorted(glob.glob(args[0] + '/p*.csv')):
    for r in csv.DictReader(open(f, encoding='utf-8-sig')):
        k = (r['game_pk'], r['at_bat_number'], r['pitch_number'])
        if k in seen or r['pitch_type'] not in GROUP or not r['ax'] or not r['plate_x'] or not r['sz_top']: continue
        seen.add(k); rows.append(r)
F = lambda r, k: float(r[k])
# each pitcher's fastball: the more used of FF and SI, its mean acceleration
fb = collections.defaultdict(lambda: collections.defaultdict(list))
for r in rows:
    if r['pitch_type'] in ('FF', 'SI'): fb[r['pitcher']][r['pitch_type']].append((F(r, 'ax'), F(r, 'az')))
afb = {}
for p, d in fb.items():
    t = max(d, key=lambda k: len(d[k]))
    if len(d[t]) >= 20: afb[p] = (sum(a for a, _ in d[t]) / len(d[t]), sum(b for _, b in d[t]) / len(d[t]))
def out(x, z, bot, top):   # inches outside the widened zone (negative: depth inside)
    dx = abs(x) - HALF; dz = max(bot - R - z, z - top - R)
    if dx <= 0 and dz <= 0: return 12 * max(dx, dz)
    return 12 * math.hypot(max(dx, 0), max(dz, 0))
P = []
for r in rows:
    if r['pitcher'] not in afb or r['description'] not in SWING | {'ball', 'called_strike', 'blocked_ball'}: continue
    ax, az = afb[r['pitcher']]
    lx, lz = .5 * (F(r, 'ax') - ax) * TD ** 2, .5 * (F(r, 'az') - az) * TD ** 2   # ft
    x, z, bot, top = F(r, 'plate_x'), F(r, 'plate_z'), F(r, 'sz_bot'), F(r, 'sz_top')
    sw = r['description'] in SWING
    P.append(dict(g=GROUP[r['pitch_type']], p=r['pitcher'], sw=sw, wh=r['description'] in WHIFF, out=out(x, z, bot, top),
                  look=out(x - lx, z - lz, bot, top), late=12 * math.hypot(lx, lz), md=float(r['miss_distance']) if r['miss_distance'] else None,
                  mph=F(r, 'release_speed')))
print(f'pitches {len(P)}, pitchers with a fastball {len(afb)}, t_d {TD} s')
def line(name, a):
    s = [o for o in a if o['sw']]
    return f"{name:22} n {len(a):6}  swing {len(s) / max(1, len(a)):.3f}  whiff/swing {sum(o['wh'] for o in s) / max(1, len(s)):.3f}  (swings {len(s)})"
BINS = [(-99, -3), (-3, 0), (0, 2), (2, 4), (4, 7), (7, 10), (10, 99)]
for g in ('FB', 'BR', 'OS', 'all'):
    a = [o for o in P if g == 'all' or o['g'] == g]
    print(f'\n== {g}: late departure from the fastball path mean {sum(o["late"] for o in a) / len(a):.2f} in')
    print(line('in zone', [o for o in a if o['out'] <= 0])); print(line('out of zone', [o for o in a if o['out'] > 0]))
    print(' by inches outside (actual end)')
    for lo, hi in BINS: print(' ', line(f'[{lo},{hi})', [o for o in a if lo <= o['out'] < hi]))
    print(' looked (fastball read) x ended: in/out')
    for ln, lf in (('looked in', lambda o: o['look'] <= 0), ('looked out', lambda o: o['look'] > 0)):
        for en, ef in (('ended in', lambda o: o['out'] <= 0), ('ended out', lambda o: o['out'] > 0)):
            print(' ', line(f'{ln}, {en}', [o for o in a if lf(o) and ef(o)]))
    if g != 'FB':
        print(' by late departure (in), in zone | out of zone')
        for lo, hi in ((0, 3), (3, 5), (5, 7), (7, 9), (9, 99)):
            b = [o for o in a if lo <= o['late'] < hi]
            print(f"  [{lo},{hi}) " + line('in', [o for o in b if o['out'] <= 0])[22:] + ' | ' + line('out', [o for o in b if o['out'] > 0])[22:])
    w = [o for o in a if o['wh'] and o['md'] is not None]
    for name, f in (('in', lambda o: o['out'] <= 0), ('out', lambda o: o['out'] > 0)):
        m = sorted(o['md'] for o in w if f(o))
        if m: print(f" whiff miss distance {name:3} n {len(m):5}  median {m[len(m) // 2]:.1f}  mean {sum(m) / len(m):.1f}  share >6 in {sum(v > 6 for v in m) / len(m):.3f}")
# within pitcher and group: whiff on a swing against inches outside and late departure (linear, pitcher x group demeaned)
print('\nwithin pitcher x group, whiff/swing slopes (linear probability)')
def solve(A, b):
    n = len(b); M = [A[i][:] + [b[i]] for i in range(n)]
    for i in range(n):
        piv = M[i][i]
        for j in range(i, n + 1): M[i][j] /= piv
        for k in range(n):
            if k != i:
                f = M[k][i]
                for j in range(i, n + 1): M[k][j] -= f * M[i][j]
    return [M[i][n] for i in range(n)]
for g in ('BR', 'OS', 'FB'):
    by = collections.defaultdict(list)
    for o in P:
        if o['sw'] and o['g'] == g: by[o['p']].append(o)
    X = []
    for s in by.values():
        if len(s) < 5: continue
        feats = [[max(o['out'], 0), min(o['out'], 0), max(o['look'], 0), o['late']] for o in s]
        mf = [sum(f[i] for f in feats) / len(feats) for i in range(4)]; mw = sum(o['wh'] for o in s) / len(s)
        X += [([f[i] - mf[i] for i in range(4)], o['wh'] - mw) for f, o in zip(feats, s)]
    n = 4; A = [[sum(x[i] * x[j] for x, _ in X) for j in range(n)] for i in range(n)]; b = [sum(x[i] * y for x, y in X) for i in range(n)]
    beta = solve(A, b); res = [y - sum(bi * xi for bi, xi in zip(beta, x)) for x, y in X]; s2 = sum(e * e for e in res) / (len(X) - n)
    se = [math.sqrt(s2 * solve(A, [float(i == j) for j in range(n)])[i]) for i in range(n)]
    print(f'  {g} swings {len(X)}: outside {beta[0]:+.4f}/in (±{se[0]:.4f})  depth inside {beta[1]:+.4f}/in (±{se[1]:.4f})  looked outside {beta[2]:+.4f}/in (±{se[2]:.4f})  late {beta[3]:+.4f}/in (±{se[3]:.4f})')
