# The real pitchers' leagues (real-pitcher-spec.py) against those pitchers' own 2024 season, not the MLB mean: K, whiff per
# swing, swing and whiff in and out of Savant's zone (ball centre in the zone widened by the ball), the share of in-zone pitches
# that are fastballs, and the share of swings on misread pitches. Real numbers are the 20 pitchers' pitch type zone rows summed;
# the match's are pooled the same way, then both as the mean over pitchers (each pitcher counts once, as in compare-real-pitchers).
# usage: python -I -X utf8 real-zone-whiff.py <truth.json> <mlb_pitch_type_zone_player_year.csv> "<records glob with {league}>" [year=2024]
import csv, glob, json, math, sys, collections
R = .0366
FB = {'fastball', 'sinker', 'cutter'}
FB_CODE = {'FF', 'SI', 'FC'}
truth = json.load(open(sys.argv[1], encoding='utf8'))
year = sys.argv[4] if len(sys.argv) > 4 else '2024'
real = collections.defaultdict(collections.Counter)
src = {t['source']: slot for slot, t in truth.items()}
for row in csv.DictReader(open(sys.argv[2], encoding='utf8')):
    if row['year'] != year or row['lahman_id'] not in src: continue
    c = real[src[row['lahman_id']]]; f = lambda k: float(row[k] or 0)
    c['zn'] += f('zone_n'); c['on'] += f('out_n'); c['zsw'] += f('z_swing'); c['osw'] += f('o_swing'); c['zwh'] += f('z_whiff'); c['owh'] += f('o_whiff')
    c['sw'] += f('swings'); c['wh'] += f('whiffs')
    if row['pitch_type'] in FB_CODE: c['zfb'] += f('zone_n')
sim = collections.defaultdict(collections.Counter)
for league in sorted({k.split('/')[0] for k in truth}):
    for f in glob.glob(sys.argv[3].replace('{league}', league)):
        for l in open(f):
            r = json.loads(l); c = sim[f"{league}/{r['pitcher']}"]; s = r['scoring']
            if s and s != 'plate_appearance_continues': c['pa'] += 1; c['k'] += s == 'strikeout'
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; inz = abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R
            sw, wh = r['swing'], r['swing'] and not r['foulOrContact']
            c['zn'] += inz; c['on'] += not inz; c['sw'] += sw; c['wh'] += wh
            c['zsw'] += sw and inz; c['osw'] += sw and not inz; c['zwh'] += wh and inz; c['owh'] += wh and not inz
            c['zfb'] += inz and r['pitch'] in FB
            c['mis'] += sw and r.get('recog') is not None and not r['recog']['ok']
both = [s for s in truth if s in sim and s in real]
def rates(c):
    return {'zSw': c['zsw'] / c['zn'], 'oSw': c['osw'] / c['on'], 'wh/sw': c['wh'] / c['sw'], 'zWh': c['zwh'] / c['zsw'], 'oWh': c['owh'] / c['osw'], 'zoneFB': c['zfb'] / c['zn']}
def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    d = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / d if d else float('nan')
keys = ['zSw', 'oSw', 'wh/sw', 'zWh', 'oWh', 'zoneFB']
print('slot'.ljust(8), 'K real/sim'.rjust(11), '  '.join(f'{k:>11}' for k in keys), 'misread  (real/sim)')
per = {}
for s in both:
    rr, ss = rates(real[s]), rates(sim[s]); per[s] = (rr, ss)
    print(s.ljust(8), f"{truth[s]['k']:.3f}/{sim[s]['k'] / sim[s]['pa']:.3f}", '  '.join(f'{rr[k]:.3f}/{ss[k]:.3f}' for k in keys), f"{sim[s]['mis'] / sim[s]['sw']:.2f}")
tr, ts = collections.Counter(), collections.Counter()
for s in both: tr.update(real[s]); ts.update(sim[s])
rr, ss = rates(tr), rates(ts)
print('pooled'.ljust(8), f"{sum(truth[s]['k'] * truth[s]['bf'] for s in both) / sum(truth[s]['bf'] for s in both):.3f}/{ts['k'] / ts['pa']:.3f}",
      '  '.join(f'{rr[k]:.3f}/{ss[k]:.3f}' for k in keys), f"{ts['mis'] / ts['sw']:.2f}")
print('mean'.ljust(8), f"{sum(truth[s]['k'] for s in both) / len(both):.3f}/{sum(sim[s]['k'] / sim[s]['pa'] for s in both) / len(both):.3f}",
      '  '.join(f"{sum(per[s][0][k] for s in both) / len(both):.3f}/{sum(per[s][1][k] for s in both) / len(both):.3f}" for k in keys))
print('corr'.ljust(8), f"{corr([truth[s]['k'] for s in both], [sim[s]['k'] / sim[s]['pa'] for s in both]):11.2f}",
      '  '.join(f"{corr([per[s][0][k] for s in both], [per[s][1][k] for s in both]):11.2f}" for k in keys))
