# Two arms of the real pitchers' leagues (real-pitcher-spec.py, the same leagues and seeds) against each other and the real
# numbers: the league line (K, BB, whiff/swing, zone and in/out-of-zone swing and whiff, Savant's zone widened by the ball),
# per pitcher K and whiff/swing against the real with a paired bootstrap of the difference (pitchers and, within each, the
# seeds resampled, 2000 times), and per pitcher and pitch type how the whiff follows the pitch: within the fastball, breaking
# and offspeed groups, the correlation of the whiff, the misread share and the whiff when read right with speed, horizontal
# and vertical break and the real whiff.
# usage: python -I -X utf8 arm-compare.py <truth.json> <pitcher-year.csv (lahman_id, mlbam_id)> <mlb_pitch_type_player_year.csv>
#        <mlb_pitch_type_zone_player_year.csv> "<arm A records glob with {league}>" "<arm B ...>" [--leagues=0,1,...] [--min=30]
import collections, csv, glob, json, math, random, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
truth_path, ids_path, types_path, zone_path, *arms = args
truth = json.load(open(truth_path, encoding='utf8'))
keep = set(opt['leagues'].split(',')) if 'leagues' in opt else None
least = int(opt.get('min', 30))
R = .0366
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH',
        'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV'}
GROUP = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
mlbam = {r['lahman_id']: r['mlbam_id'] for r in csv.DictReader(open(ids_path, encoding='utf8'))}
year = {t.get('year', '2024') for t in truth.values()}.pop()
savant = {(r['mlbam_id'], r['pitch_type']): r for r in csv.DictReader(open(types_path, encoding='utf8'))
          if r['year'] == year and r['sample'] == 'pitches>=100'}
real_ws = collections.Counter()
for r in csv.DictReader(open(zone_path, encoding='utf8')):
    if r['year'] == year and r['pitch_type'] not in ('ALL', '*ALL') and r['swings']:
        real_ws[(r['lahman_id'], 'sw')] += float(r['swings']); real_ws[(r['lahman_id'], 'wh')] += float(r['whiffs'] or 0)
slots = sorted(s for s in truth if keep is None or s.split('/')[0] in keep)

def corr(x, y):
    if len(x) < 3: return math.nan
    mx, my = sum(x) / len(x), sum(y) / len(y); d = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / d if d else math.nan

def read(pattern):
    games = collections.defaultdict(collections.Counter)   # (slot, seed) -> counts for that pitcher
    pairs = collections.defaultdict(collections.Counter)   # (mlbam, type) -> counts
    league = collections.Counter()
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(pattern.replace('{league}', lg)):
            seed = f.rsplit('-', 1)[1].split('.')[0]
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                g = games[(slot, seed)]; s = r['scoring']; whiff = r['swing'] and not r['foulOrContact']
                if s and s != 'plate_appearance_continues': g['pa'] += 1; g['k'] += s == 'strikeout'; g['bb'] += s == 'walk'
                g['sw'] += r['swing']; g['wh'] += whiff
                if r['x'] is not None and r['zone']:
                    z = r['zone']; side = 'z' if abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R else 'o'
                    g[side] += 1; g[side + 'sw'] += r['swing']; g[side + 'wh'] += whiff
                p = pairs[(mlbam[truth[slot]['source']], CODE.get(r['pitch'], r['pitch']))]; p['n'] += 1
                if r['swing']:
                    mis = bool(r.get('recog')) and not r['recog']['ok']
                    p['sw'] += 1; p['wh'] += whiff; p['mis'] += mis; p['whmis'] += mis and whiff
    for g in games.values(): league.update(g)
    return games, pairs, league

data = [read(a) for a in arms]
seeds = sorted({seed for (slot, seed) in data[0][0]} & {seed for (slot, seed) in data[1][0]})
print('slots', len(slots), 'seeds', len(seeds))
for a, (_, _, c) in zip(arms, data):
    print(a.split('/')[-1], 'PA %d K %.3f BB %.3f wh/sw %.3f | zone %.3f z-sw %.3f z-wh %.3f o-sw %.3f o-wh %.3f' % (
        c['pa'], c['k'] / c['pa'], c['bb'] / c['pa'], c['wh'] / c['sw'], c['z'] / (c['z'] + c['o']), c['zsw'] / c['z'],
        c['zwh'] / c['zsw'], c['osw'] / c['o'], c['owh'] / c['osw']))

def stats(games, picks):
    k, ws, rk, rws, tot = [], [], [], [], collections.Counter()
    for slot, ss in picks:
        c = collections.Counter()
        for s in ss: c.update(games.get((slot, s), {}))
        if not c['pa'] or not c['sw']: continue
        src = truth[slot]['source']
        k.append(c['k'] / c['pa']); ws.append(c['wh'] / c['sw']); rk.append(truth[slot]['k'])
        rws.append(real_ws[(src, 'wh')] / real_ws[(src, 'sw')] if real_ws[(src, 'sw')] else math.nan); tot.update(c)
    ok = [i for i, v in enumerate(rws) if v == v]
    return dict(cK=corr(k, rk), cWS=corr([ws[i] for i in ok], [rws[i] for i in ok]), K=tot['k'] / tot['pa'], WS=tot['wh'] / tot['sw'],
                maeK=sum(abs(a - b) for a, b in zip(k, rk)) / len(k))

full = [(slot, seeds) for slot in slots]
base = [stats(d[0], full) for d in data]
rng = random.Random(1); draws = collections.defaultdict(list)
for _ in range(2000):
    picks = [(slot, [rng.choice(seeds) for _ in seeds]) for slot in (rng.choice(slots) for _ in slots)]
    a, b = stats(data[0][0], picks), stats(data[1][0], picks)
    for key in a: draws[key].append(b[key] - a[key])
print('\nper pitcher (20 real pitchers), B - A with the 90% interval')
for key, name in (('cK', 'corr K'), ('cWS', 'corr wh/sw'), ('K', 'mean K'), ('WS', 'mean wh/sw'), ('maeK', 'MAE K')):
    d = sorted(v for v in draws[key] if v == v); lo, hi = d[int(.05 * len(d))], d[int(.95 * len(d))]
    print(f'{name:11} A {base[0][key]:.3f}  B {base[1][key]:.3f}  B-A {base[1][key] - base[0][key]:+.3f}  [{lo:+.3f}, {hi:+.3f}]  P(B>A) {sum(v > 0 for v in d) / len(d):.2f}')

f = lambda r, k: float(r[k]) if r.get(k) else math.nan
for a, (_, pairs, _) in zip(arms, data):
    rows = []
    for key, p in pairs.items():
        s = savant.get(key)
        if p['sw'] < least or not s or not s.get('whiff_pct_savant'): continue
        rows.append(dict(g=GROUP.get(key[1], '?'), real=f(s, 'whiff_pct_savant') / 100, sim=p['wh'] / p['sw'], mis=p['mis'] / p['sw'],
                         whmis=p['whmis'] / max(1, p['mis']), whok=(p['wh'] - p['whmis']) / max(1, p['sw'] - p['mis']),
                         mph=f(s, 'speed_avg'), h=abs(f(s, 'hmov_in')), v=f(s, 'vmov_in')))
    print(f"\n{a.split('/')[-1]}: pitcher x type pairs {len(rows)}, corr real-sim {corr([r['real'] for r in rows], [r['sim'] for r in rows]):+.2f}")
    for g in ('FB', 'BR', 'OS'):
        rs = [r for r in rows if r['g'] == g]
        if len(rs) < 3: continue
        for k in ('sim', 'mis', 'whok'):
            print(f"  {g} {len(rs):2} {k:5} mean {sum(r[k] for r in rs) / len(rs):.3f}  corr with",
                  ' '.join(f"{v} {corr([r[k] for r in rs], [r[v] for r in rs]):+.2f}" for v in ('mph', 'h', 'v', 'real')))
        print(f"  {g}    real  mean {sum(r['real'] for r in rs) / len(rs):.3f}  corr with",
              ' '.join(f"{v} {corr([r['real'] for r in rs], [r[v] for r in rs]):+.2f}" for v in ('mph', 'h', 'v')))
