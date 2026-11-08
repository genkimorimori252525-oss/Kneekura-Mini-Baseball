# Per pitcher and pitch type (swings >= --min), how the game's misread share and whiff/swing follow the pitch's usage, against
# how the real whiff follows the real usage (Savant, pitches >= 100), within the fastball, breaking and offspeed groups.
# usage: python -I -X utf8 usage-whiff.py <truth.json> <pitcher-year.csv (lahman_id, mlbam_id)> <mlb_pitch_type_player_year.csv>
#        <records folder> <tag>... [--min=30]
import collections, csv, glob, json, math, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
truth_path, ids_path, types_path, folder, *tags = args
least = int(opt.get('min', 30))
truth = json.load(open(truth_path, encoding='utf8'))
ids = {r['lahman_id']: r['mlbam_id'] for r in csv.DictReader(open(ids_path, encoding='utf8'))}
year = {t.get('year', '2024') for t in truth.values()}.pop()
savant = {(r['mlbam_id'], r['pitch_type']): r for r in csv.DictReader(open(types_path, encoding='utf8'))
          if r['year'] == year and r['sample'] == 'pitches>=100'}
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH',
        'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV'}
GROUP = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
def corr(x, y):
    if len(x) < 3: return math.nan
    mx, my = sum(x) / len(x), sum(y) / len(y); d = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / d if d else math.nan
for tag in tags:
    rows = []
    for slot in sorted(truth):
        lg, pid = slot.split('/'); mid = ids[truth[slot]['source']]; c = collections.defaultdict(collections.Counter); n = 0
        for f in glob.glob(f'{folder}/g-{tag}-{lg}-*.jsonl'):
            if f.count('.jsonl') > 1: continue
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                n += 1; k = CODE.get(r['pitch'], r['pitch']); c[k]['n'] += 1
                if r['swing']: c[k]['sw'] += 1; c[k]['wh'] += not r['foulOrContact']; c[k]['mis'] += bool(r.get('recog')) and not r['recog']['ok']
        for k, x in c.items():
            s = savant.get((mid, k))
            if x['sw'] < least or not s or not s.get('whiff_pct_savant') or k not in GROUP: continue
            rows.append(dict(g=GROUP[k], use=x['n'] / n, mis=x['mis'] / x['sw'], wh=x['wh'] / x['sw'],
                             ruse=float(s['usage_pct']) / 100, rwh=float(s['whiff_pct_savant']) / 100))
    print(f'#### {tag}')
    for g in ('FB', 'BR', 'OS', 'all'):
        r = [x for x in rows if g == 'all' or x['g'] == g]
        col = lambda k: [x[k] for x in r]
        print(f'  {g:3} pairs {len(r):3} | game: misread~usage {corr(col("mis"), col("use")):+.2f} whiff~usage {corr(col("wh"), col("use")):+.2f}'
              f' | real whiff~usage {corr(col("rwh"), col("ruse")):+.2f} | game whiff~real {corr(col("wh"), col("rwh")):+.2f}'
              f' | mean whiff game {sum(col("wh")) / max(1, len(r)):.3f} real {sum(col("rwh")) / max(1, len(r)):.3f}')
