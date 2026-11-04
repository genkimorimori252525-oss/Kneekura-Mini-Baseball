# Ability <-> stat response surfaces from random-ability leagues, and the inverse for a real player.
# fit:    python -I ability-fit.py fit <abilities.json> "<records glob with {league}>" <table.json> <surface.json> [--role=pitcher]
#         the ability keys come from abilities.json; --role=pitcher groups plate appearances by pitcher instead of batter.
#         records for league i are found by replacing {league} with i (e.g. K:/kbm-work/rec/g-rand{league}-*.jsonl).
# invert: python -I ability-fit.py invert <surface.json> <targets.json> <out.json>
#         targets.json: {"<id>": {"pa": 600, "k": .2, "bb": .08, "iso": .15, "babip": .3, "hr": .03, "fixed": {"run": 92}}}
# The surface is a full quadratic in the abilities (standardised), fitted by least squares weighted by plate appearances;
# --degree=3 adds the cubic terms, for leagues drawn wide enough that a quadratic bends too little;
# --bats adds the batting side as an ability 'left' (0/1), which real players keep fixed.
import glob
import importlib.util
import json
import math
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('ot', os.path.join(here, 'outcome-table.py'))
ot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ot)
KEYS = ['contact', 'power', 'vision', 'run', 'attackAngleDegrees']
STATS = ['k', 'bb', 'iso', 'babip', 'hr', 'gb', 'fb']   # gb, fb: shares of balls in play under 10 and at 25-50 degrees


DEGREE = 2
BATS = False
LOG_STATS = set()


def terms(x, degree=None):
    degree = degree or DEGREE
    out = [1.0] + list(x)
    for i in range(len(x)):
        for j in range(i, len(x)):
            out.append(x[i] * x[j])
            if degree >= 3:
                for k in range(j, len(x)):
                    out.append(x[i] * x[j] * x[k])
    return out


def solve(a, b):
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        if abs(m[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] if abs(m[i][i]) > 1e-12 else 0 for i in range(n)]


def batter_stats(files, predict, role='batter'):
    acc = {}
    for f in files:
        for line in open(f):
            r = json.loads(line)
            s = r.get('scoring')
            if not s or s == 'plate_appearance_continues' or s == 'unresolved' and not r.get('exit'):
                continue
            a = acc.setdefault(r[role], dict(pa=0, k=0, bb=0, hbp=0, hits=0.0, bases=0.0, hr=0.0, bip=0.0, gb=0, fb=0, air=0))
            a['pa'] += 1
            if s == 'strikeout': a['k'] += 1
            elif s == 'walk': a['bb'] += 1
            elif s == 'hit_by_pitch': a['hbp'] += 1
            elif r.get('exit'):
                if abs(r['exit']['spray']) > 45:
                    a['bip'] += 1
                    continue
                la = r['exit']['launch']; a['air'] += 1; a['gb'] += la < 10; a['fb'] += 25 <= la < 50
                p = predict(*ot.key(r))
                a['hits'] += 1 - p[0]; a['bases'] += sum(i * p[i] for i in range(5)); a['hr'] += p[4]; a['bip'] += 1
    out = {}
    for pid, a in acc.items():
        ab = a['pa'] - a['bb'] - a['hbp']
        if a['pa'] < 10 or ab <= 0:
            continue
        out[pid] = dict(pa=a['pa'], k=a['k'] / a['pa'], bb=a['bb'] / a['pa'], iso=(a['bases'] - a['hits']) / ab,
                        babip=(a['hits'] - a['hr']) / max(1, a['bip'] - a['hr']), hr=a['hr'] / a['pa'],
                        gb=a['gb'] / max(1, a['air']), fb=a['fb'] / max(1, a['air']))
    return out


def fit(abil_path, pattern, table_path, out_path, role='batter'):
    global KEYS
    abilities = json.load(open(abil_path))
    KEYS = list(next(iter(next(iter(abilities.values())).values())).keys())
    if BATS:
        # Batting side as a 0/1 ability ('left'), read from the league configs next to abilities.json: the game's left- and
        # right-handed swings differ, and a real player keeps his own side.
        folder = os.path.dirname(os.path.abspath(abil_path))
        for league, players in abilities.items():
            cfg = json.load(open(os.path.join(folder, f'league-{league}.json'), encoding='utf8'))
            side = {p['playerId']: p.get('bats') for p in cfg['players']}
            for pid in players:
                players[pid] = {**players[pid], 'left': 1.0 if side.get(pid) == 'L' else 0.0}
        KEYS = KEYS + ['left']
    predict = ot.predictor(json.load(open(table_path)))
    rows = []
    for league, players in abilities.items():
        stats = batter_stats(glob.glob(pattern.replace('{league}', str(league))), predict, role)
        for pid, st in stats.items():
            if pid in players:
                rows.append(([players[pid][k] for k in KEYS], st))
    mean = [sum(r[0][i] for r in rows) / len(rows) for i in range(len(KEYS))]
    sd = [math.sqrt(sum((r[0][i] - mean[i]) ** 2 for r in rows) / len(rows)) or 1 for i in range(len(KEYS))]
    coef = {}
    for stat in STATS:
        t = [terms([(x - m) / s for x, m, s in zip(r[0], mean, sd)]) for r in rows]
        w = [r[1]['pa'] for r in rows]
        a = [[sum(w[n] * t[n][i] * t[n][j] for n in range(len(t))) for j in range(len(t[0]))] for i in range(len(t[0]))]
        # --log fits log(stat + .01) for ISO and home runs, which grow about as a product of the abilities.
        f, g = (lambda y: math.log(y + .01), lambda y: math.exp(y) - .01) if stat in LOG_STATS else (lambda y: y, lambda y: y)
        b = [sum(w[n] * t[n][i] * f(rows[n][1][stat]) for n in range(len(t))) for i in range(len(t[0]))]
        coef[stat] = solve(a, b)
        pred = [g(sum(c * v for c, v in zip(coef[stat], tt))) for tt in t]
        resid = [(rows[n][1][stat] - pred[n]) for n in range(len(t))]
        # Residual against what pure sampling noise allows, so a surface that fits as well as chance shows about 1.
        # Sampling variance from the fitted rate, so a hitter with no walks in a short sample is not taken as exact. ISO's per-PA
        # variance grows with power (extra bases of 1-3 per hit): about .1 + 1.6 ISO (.35 at the MLB ISO of .156).
        noise = [max(1e-6, min(max(pred[n], .002), .998) * (1 - min(max(pred[n], .002), .998)) / rows[n][1]['pa']) for n in range(len(t))] if stat != 'iso' else [max(1e-6, (.1 + 1.6 * max(pred[n], 0)) / rows[n][1]['pa']) for n in range(len(t))]
        print(stat, 'batters', len(rows), 'RMS z', round(math.sqrt(sum(r * r / v for r, v in zip(resid, noise)) / len(resid)), 2))
    lo = [min(r[0][i] for r in rows) for i in range(len(KEYS))]
    hi = [max(r[0][i] for r in rows) for i in range(len(KEYS))]
    json.dump({'keys': KEYS, 'mean': mean, 'sd': sd, 'coef': coef, 'degree': DEGREE, 'lo': lo, 'hi': hi, 'log': sorted(LOG_STATS)}, open(out_path, 'w'), indent=1)


def evaluate(surface, x):
    z = [(v - m) / s for v, m, s in zip(x, surface['mean'], surface['sd'])]
    t = terms(z, surface.get('degree', 2))
    logs = set(surface.get('log', []))
    return {stat: (math.exp(y) - .01 if stat in logs else y) for stat, y in ((stat, sum(c * v for c, v in zip(coef, t))) for stat, coef in surface['coef'].items())}


def invert(surface_path, targets_path, out_path):
    surface = json.load(open(surface_path))
    targets = json.load(open(targets_path))
    # Search only where the leagues put players: past the drawn range the fitted surface is extrapolation.
    lo = surface.get('lo') or [m - 2 * s for m, s in zip(surface['mean'], surface['sd'])]
    hi = surface.get('hi') or [m + 2 * s for m, s in zip(surface['mean'], surface['sd'])]
    # Vision is the Core's absolute 1-100 value; the group abilities have no upper cap but stay inside the fitted range.
    if 'vision' in surface['keys']:
        i = surface['keys'].index('vision'); lo[i], hi[i] = max(1, lo[i]), min(100, hi[i])
    out = {}
    for pid, t in targets.items():
        # Regress toward the league mean by plate appearances, then fit by coordinate search.
        # A measured ability can also be a prior ("prior": {"power": [centre, sd]}): the search stays near the measurement and
        # leaves it only as far as the stats demand, so what the game's physics lacks is covered without dropping the measurement.
        prior = [(surface['keys'].index(k), c, d) for k, (c, d) in t.get('prior', {}).items()]
        def loss(x):
            p = evaluate(surface, x)
            return sum(((p[s] - t[s]) / max(.005, math.sqrt(max(t[s], .01) * (1 - min(t[s], .99)) / max(t.get('pa', 400), 50)))) ** 2 for s in STATS if s in t) \
                + sum(((v - m) / s) ** 2 for v, m, s in zip(x, surface['mean'], surface['sd'])) * 0.05 \
                + sum(((x[i] - c) / d) ** 2 for i, c, d in prior)
        # Abilities measured directly (run from sprint speed) stay fixed; the search moves the rest.
        fixed = {surface['keys'].index(k): v for k, v in t.get('fixed', {}).items()}
        x = [fixed.get(i, m) for i, m in enumerate(surface['mean'])]
        step = [s for s in surface['sd']]
        for _ in range(60):
            improved = False
            for i in range(len(x)):
                if i in fixed:
                    continue
                for d in (step[i], -step[i]):
                    y = x[:]; y[i] = min(hi[i], max(lo[i], y[i] + d))
                    if loss(y) < loss(x):
                        x = y; improved = True
            if not improved:
                step = [s / 2 for s in step]
                if max(step) < 0.05:
                    break
        out[pid] = {'abilities': dict(zip(surface['keys'], [round(v, 4) for v in x])), 'predicted': {k: round(v, 4) for k, v in evaluate(surface, x).items()}, 'target': t}
    json.dump(out, open(out_path, 'w'), ensure_ascii=False, indent=1)
    print('players', len(out))


if __name__ == '__main__':
    if sys.argv[1] == 'fit':
        role = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--role=')), 'batter')
        DEGREE = int(next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--degree=')), '2'))
        BATS = '--bats' in sys.argv
        LOG_STATS = {'iso', 'hr'} if '--log' in sys.argv else set()
        fit(*[a for a in sys.argv[2:] if not a.startswith('--')][:4], role=role)
    else:
        invert(*sys.argv[2:5])
