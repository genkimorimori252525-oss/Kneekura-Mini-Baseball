# MLB pitchers x pitch types (one year): how a pitch's whiff/swing follows its gap from the pitcher's own fastball (the more used
# of FF and SI): speed gap (mph), vertical and arm-side movement gap (in), release gap, and the pitch's own speed, by group.
# Multiple regression on the gaps, weighted by swings, with the pitch's own whiff noise noted.
# usage: python -I -X utf8 mlb-gap.py <mlb_pitch_type_player_year.csv> [--year=2024] [--min=50]
import csv, collections, math, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]; opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
year = opt.get('year', '2024'); least = int(opt.get('min', 50))
GROUP = {'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FC': 'FC'}
rows = collections.defaultdict(dict)
for r in csv.DictReader(open(args[0], encoding='utf8')):
    if r['year'] == year and r['sample'] == 'pitches>=100': rows[r['mlbam_id']][r['pitch_type']] = r
f = lambda r, k: float(r[k]) if r.get(k) not in (None, '') else math.nan
def solve(A, b):
    n = len(b); M = [A[i][:] + [b[i]] for i in range(n)]
    for i in range(n):
        piv = M[i][i]
        for j in range(i, n + 1): M[i][j] /= piv
        for k in range(n):
            if k != i:
                q = M[k][i]
                for j in range(i, n + 1): M[k][j] -= q * M[i][j]
    return [M[i][n] for i in range(n)]
data = collections.defaultdict(list)
for pid, types in rows.items():
    fbt = max((t for t in ('FF', 'SI') if t in types), key=lambda t: f(types[t], 'pitches'), default=None)
    if not fbt: continue
    fb = types[fbt]; arm = 1 if f(fb, 'hmov_in') >= 0 else -1
    for t, r in types.items():
        g = GROUP.get(t)
        if not g or f(r, 'swings') < least or math.isnan(f(r, 'whiff_pct')): continue
        x = [f(fb, 'speed_avg') - f(r, 'speed_avg'), f(r, 'vmov_in') - f(fb, 'vmov_in'), arm * (f(r, 'hmov_in') - f(fb, 'hmov_in')),
             math.hypot(f(r, 'rel_side_ft') - f(fb, 'rel_side_ft'), f(r, 'rel_height_ft') - f(fb, 'rel_height_ft')) * 12, f(fb, 'speed_avg')]
        if any(math.isnan(v) for v in x): continue
        data[g].append((x, f(r, 'whiff_pct') / 100, f(r, 'swings')))
names = ['speed gap mph', 'vertical gap in', 'arm-side gap in', 'release gap in', 'fastball mph']
for g, d in data.items():
    n = len(names) + 1; W = [w for _, _, w in d]
    X = [[1.0] + x for x, _, _ in d]; Y = [y for _, y, _ in d]
    A = [[sum(w * xi[i] * xi[j] for xi, w in zip(X, W)) for j in range(n)] for i in range(n)]; b = [sum(w * xi[i] * y for xi, y, w in zip(X, Y, W)) for i in range(n)]
    beta = solve(A, b); res = [y - sum(bi * xi for bi, xi in zip(beta, x)) for x, y in zip(X, Y)]
    s2 = sum(w * e * e for e, w in zip(res, W)) / (sum(W) * (len(d) - n) / len(d)); se = [math.sqrt(s2 * solve(A, [float(i == j) for j in range(n)])[i]) for i in range(n)]
    my = sum(Y) / len(Y); sd = math.sqrt(sum((y - my) ** 2 for y in Y) / len(Y))
    means = [sum(x[i] for x, _, _ in d) / len(d) for i in range(len(names))]
    print(f"{g}: pairs {len(d)}, whiff/swing mean {my:.3f} sd {sd:.3f}")
    for i, nm in enumerate(names):
        print(f"  {nm:16} mean {means[i]:+6.2f}  slope {beta[i + 1]:+.4f} (±{se[i + 1]:.4f})")
