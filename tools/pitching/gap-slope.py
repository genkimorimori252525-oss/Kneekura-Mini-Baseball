# Offspeed (or breaking) swings: the slope of whiff on the speed gap to the pitcher's own fastball (per mph, swings with the gap in
# [lo, hi)), pitch by pitch, with a bootstrap over pitchers (90% interval); the game's records (the fastball is the pitcher's more
# used of fastball and sinker in that league over the tag's games) or MLB Statcast pitch files (the more used of FF and SI).
# Paired arms on the same leagues and seeds: the difference of each later arm's slope from the first, resampling the same pitchers.
# usage: python -I -X utf8 gap-slope.py mlb <folder with p*.csv> | game <records folder> <tag>...  [--group=OS] [--range=4,13]
import collections, csv, glob, json, random, statistics, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
want = opt.get('group', 'OS'); lo, hi = map(float, opt.get('range', '4,13').split(','))
G_MLB = {'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
G_GAME = {'slider': 'BR', 'sweeper': 'BR', 'curve': 'BR', 'knuckle_curve': 'BR', 'slurve': 'BR', 'changeup': 'OS', 'splitter': 'OS'}
def slope(rows):
    n = len(rows)
    if n < 3: return float('nan')
    mx = sum(g for g, _ in rows) / n; my = sum(w for _, w in rows) / n
    sxx = sum((g - mx) ** 2 for g, _ in rows)
    return sum((g - mx) * (w - my) for g, w in rows) / sxx if sxx else float('nan')
def boot(by, keys, rng, reps=1000):
    out = []
    for _ in range(reps):
        pick = [rng.choice(keys) for _ in keys]
        out.append(slope([x for k in pick for x in by[k]]))
    out.sort(); return out[int(.05 * reps)], out[int(.95 * reps)]
def game(folder, tag):
    files = collections.defaultdict(list)
    for f in glob.glob(f'{folder}/g-{tag}-*.jsonl'):
        if f.count('.jsonl') > 1: continue
        files[f.rsplit('-', 2)[1]].append(f)
    by = collections.defaultdict(list)
    for league, fs in files.items():
        R = [json.loads(l) for f in fs for l in open(f, encoding='utf8')]
        fb = collections.defaultdict(lambda: collections.defaultdict(list))
        for r in R:
            if r['pitch'] in ('fastball', 'sinker'): fb[r['pitcher']][r['pitch']].append(r['kmh'] / 1.609344)
        v = {p: statistics.mean(max(d.values(), key=len)) for p, d in fb.items()}
        for r in R:
            if G_GAME.get(r['pitch']) == want and r['swing'] and r['pitcher'] in v:
                gap = v[r['pitcher']] - r['kmh'] / 1.609344
                if lo <= gap < hi: by[(league, r['pitcher'])].append((gap, float(not r['foulOrContact'])))
    return by
if args[0] == 'mlb':
    rows, seen = [], set(); fb = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in sorted(glob.glob(args[1] + '/p*.csv')):
        for r in csv.DictReader(open(f, encoding='utf-8-sig')):
            k = (r['game_pk'], r['at_bat_number'], r['pitch_number'])
            if k in seen or not r['release_speed']: continue
            seen.add(k); rows.append(r)
            if r['pitch_type'] in ('FF', 'SI'): fb[r['pitcher']][r['pitch_type']].append(float(r['release_speed']))
    v = {p: statistics.mean(max(d.values(), key=len)) for p, d in fb.items() if sum(map(len, d.values())) >= 20}
    SW = {'foul', 'foul_tip', 'hit_into_play', 'swinging_strike', 'swinging_strike_blocked'}
    by = collections.defaultdict(list)
    for r in rows:
        if G_MLB.get(r['pitch_type']) == want and r['pitcher'] in v and r['description'] in SW:
            gap = v[r['pitcher']] - float(r['release_speed'])
            if lo <= gap < hi: by[r['pitcher']].append((gap, float(r['description'] in ('swinging_strike', 'swinging_strike_blocked'))))
    keys = sorted(by); a, b = boot(by, keys, random.Random(1))
    print(f'MLB {want} gap [{lo:g},{hi:g}): swings {sum(map(len, by.values()))} pitchers {len(keys)} slope {slope([x for k in keys for x in by[k]]):+.4f}/mph  90% [{a:+.4f}, {b:+.4f}]')
else:
    arms = [(t, game(args[1], t)) for t in args[2:]]
    for t, by in arms:
        keys = sorted(by); a, b = boot(by, keys, random.Random(1))
        print(f'{t} {want} gap [{lo:g},{hi:g}): swings {sum(map(len, by.values()))} pitchers {len(keys)} slope {slope([x for k in keys for x in by[k]]):+.4f}/mph  90% [{a:+.4f}, {b:+.4f}]')
    base_t, base = arms[0]
    for t, by in arms[1:]:
        keys = sorted(set(base) & set(by)); rng = random.Random(2); d = []
        for _ in range(1000):
            pick = [rng.choice(keys) for _ in keys]
            d.append(slope([x for k in pick for x in by[k]]) - slope([x for k in pick for x in base[k]]))
        d.sort()
        print(f'  {t} - {base_t}: {slope([x for k in keys for x in by[k]]) - slope([x for k in keys for x in base[k]]):+.4f}/mph  90% [{d[50]:+.4f}, {d[950]:+.4f}]  P(lower) {sum(x < 0 for x in d) / len(d):.2f}')
