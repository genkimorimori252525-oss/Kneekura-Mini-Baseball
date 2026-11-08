# Pitcher x pitch type: how the game's whiff/swing follows the real one (slope and correlation, by group), and which part of the
# game's whiff carries it: the misread share of swings, the whiff on a misread, the whiff on a right read.
# usage: python -I -X utf8 pair-slope.py <truth.json> <pitcher-year.csv> <mlb_pitch_type_player_year.csv> <arm glob with {league}>...
import collections, csv, glob, json, math, sys
truth_path, ids_path, types_path, *arms = sys.argv[1:]
truth = json.load(open(truth_path, encoding='utf8')); slots = sorted(truth)
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH', 'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV'}
GROUP = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
mlbam = {r['lahman_id']: r['mlbam_id'] for r in csv.DictReader(open(ids_path, encoding='utf8'))}
savant = {(r['mlbam_id'], r['pitch_type']): r for r in csv.DictReader(open(types_path, encoding='utf8')) if r['year'] == '2024' and r['sample'] == 'pitches>=100'}
def ols(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y); sxx = sum((a - mx) ** 2 for a in x); syy = sum((b - my) ** 2 for b in y); sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    return sxy / sxx, sxy / math.sqrt(sxx * syy)
for a in arms:
    pairs = collections.defaultdict(collections.Counter)
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(a.replace('{league}', lg)):
            if f.count('.jsonl') > 1: continue
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid or not r['swing']: continue
                p = pairs[(mlbam[truth[slot]['source']], CODE.get(r['pitch'], r['pitch']))]; mis = bool(r.get('recog')) and not r['recog']['ok']; wh = not r['foulOrContact']
                p['sw'] += 1; p['wh'] += wh; p['mis'] += mis; p['whmis'] += mis and wh
    print('==', a.split('/')[-1])
    for g in ('FB', 'BR', 'OS', 'all'):
        rows = []
        for key, p in pairs.items():
            s = savant.get(key)
            if p['sw'] < 30 or not s or not s.get('whiff_pct_savant') or g != 'all' and GROUP.get(key[1]) != g: continue
            rows.append((float(s['whiff_pct_savant']) / 100, p['wh'] / p['sw'], p['mis'] / p['sw'], p['whmis'] / max(1, p['mis']), (p['wh'] - p['whmis']) / max(1, p['sw'] - p['mis']), p['sw']))
        if len(rows) < 4: continue
        real = [r[0] for r in rows]
        noise = sum(r[1] * (1 - r[1]) / r[5] for r in rows) / len(rows); m = sum(r[1] for r in rows) / len(rows); var = sum((r[1] - m) ** 2 for r in rows) / (len(rows) - 1)
        mr = sum(real) / len(real); vr = sum((x - mr) ** 2 for x in real) / (len(real) - 1)
        out = ' '.join(f"{n} slope {ols(real, [r[i] for r in rows])[0]:+.2f} r {ols(real, [r[i] for r in rows])[1]:+.2f}" for i, n in ((1, 'whiff'), (2, 'misread'), (3, 'wh|mis'), (4, 'wh|ok')))
        print(f"  {g:3} pairs {len(rows):2}  real sd {math.sqrt(vr):.3f} game true sd {math.sqrt(max(0, var - noise)):.3f} | {out}")
