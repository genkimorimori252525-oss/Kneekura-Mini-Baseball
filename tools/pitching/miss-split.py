# Where the match's whiffs come from, in and out of Savant's zone (ball centre in the zone widened by the ball), from playthrough
# records made with --miss=1. Per swing: the batter's expected place at the commit (req), the late look's wanted and applied shift,
# the drawn aim error, the ball at the bat's contact plane and the bat's contact tick.
#   expect = ball - req (error of the commit-time expectation), left = expect - late (after the late look), resid = left - aim,
#   short = wanted - applied (what the late look could not close), dt = bat contact - ball arrival (s, + late).
# A whiff is put down to place when |resid| is past the contacts' 90th percentile, else to time when |dt| is, else "other".
# Then the in-zone whiff is split by pitch type against Savant's league rows (z_whiff / z_swing by type), with the composition
# effect (the match's per-type rates on Savant's in-zone swing mix) and the per-type excess.
# A ball met in front of the plane is placed at its centre at contact, with no dt (the time cut uses the contacts that have one).
# usage: python -I -X utf8 miss-split.py <mlb_pitch_type_zone_league_year.csv> "<records glob>"... [--year=2024]
import csv, glob, json, math, sys, collections
R, TPS = .0366, 1e6
FAM = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH', 'splitter': 'FS'}
args = [a for a in sys.argv[1:] if not a.startswith('--')]
year = next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--year=')), '2024')
sav = collections.defaultdict(collections.Counter)
for row in csv.DictReader(open(args[0], encoding='utf8')):
    if row['year'] != year: continue
    sav[row['pitch_type']]['zsw'] += float(row['z_swing'] or 0); sav[row['pitch_type']]['zwh'] += float(row['z_whiff'] or 0)
    sav[row['pitch_type']]['osw'] += float(row['o_swing'] or 0); sav[row['pitch_type']]['owh'] += float(row['o_whiff'] or 0)
rows = []
for g in args[1:]:
    for f in glob.glob(g):
        for l in open(f):
            r = json.loads(l); m = r.get('miss')
            if not r['swing'] or not m or not m['req'] or r['x'] is None or not r['zone']: continue
            # A ball met in front of the plane never reaches it: take the ball centre at contact and leave its dt out.
            b = m['ball'] or {'x': r['x'], 'y': r['y'], 'tick': None}
            z = r['zone']; inz = abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R
            q = m['req']; late = m['late'] or {'x': 0, 'y': 0}; want = m['lateReq'] or {'x': 0, 'y': 0}; aim = m['aimErr'] or {'x': 0, 'y': 0}
            ex, ey = b['x'] - q['x'], b['y'] - q['y']; lx, ly = ex - late['x'], ey - late['y']
            rows.append({'in': inz, 'wh': not r['foulOrContact'], 'type': FAM.get(r['pitch'], r['pitch']), 'ok': (r.get('recog') or {}).get('ok', True),
                         'expect': math.hypot(ex, ey), 'ey': ey, 'left': math.hypot(lx, ly), 'resid': math.hypot(lx - aim['x'], ly - aim['y']), 'ry': ly - aim['y'],
                         'short': math.hypot(want['x'] - late['x'], want['y'] - late['y']), 'dt': None if b['tick'] is None or m['batTick'] is None else (m['batTick'] - b['tick']) / TPS})
if not rows: sys.exit('no --miss records')
q90 = lambda xs: sorted(xs)[int(.9 * (len(xs) - 1))]
con = [r for r in rows if not r['wh']]
cut_place, cut_time = q90([r['resid'] for r in con]), q90([abs(r['dt']) for r in con if r['dt'] is not None])
print(f'swings {len(rows)}  contact 90th pct: |resid| {cut_place * 100:.1f} cm  |dt| {cut_time * 1000:.1f} ms')
def cause(r): return 'place' if r['resid'] > cut_place else 'time' if r['dt'] is not None and abs(r['dt']) > cut_time else 'other'
med = lambda xs: sorted(xs)[len(xs) // 2] if xs else float('nan')
for side, name in ((True, 'in zone'), (False, 'out of zone')):
    s = [r for r in rows if r['in'] == side]; w = [r for r in s if r['wh']]; c = [r for r in s if not r['wh']]
    print(f'\n== {name}: swings {len(s)} whiff/swing {len(w) / len(s):.3f}  misread share of swings {sum(not r["ok"] for r in s) / len(s):.2f}')
    for ok in (True, False):
        t = [r for r in s if r['ok'] == ok]
        if t: print(f'  read {"right" if ok else "wrong"}: swings {len(t)} whiff/swing {sum(r["wh"] for r in t) / len(t):.3f}')
    k = collections.Counter(cause(r) for r in w)
    print('  whiffs by cause: ' + '  '.join(f'{c_} {k[c_] / len(s):.3f}/swing ({k[c_] / len(w):.0%})' for c_ in ('place', 'time', 'other')))
    for lab, key in (('expect (cm)', 'expect'), ('after late (cm)', 'left'), ('late short (cm)', 'short'), ('resid (cm)', 'resid')):
        print(f'  median {lab:16} whiff {med([r[key] for r in w]) * 100:5.1f}  contact {med([r[key] for r in c]) * 100:5.1f}')
    print(f'  median |dt| ms     whiff {med([abs(r["dt"]) for r in w if r["dt"] is not None]) * 1000:5.1f}  contact {med([abs(r["dt"]) for r in c if r["dt"] is not None]) * 1000:5.1f}'
          f'   whiffs early {sum(r["dt"] is not None and r["dt"] < -cut_time for r in w) / max(1, len(w)):.0%} late {sum(r["dt"] is not None and r["dt"] > cut_time for r in w) / max(1, len(w)):.0%}')
    print(f'  place whiffs: ball under the bat {sum(r["ry"] < 0 for r in w if cause(r) == "place") / max(1, k["place"]):.0%}')
# In-zone by pitch type against Savant, and the composition effect.
zin = [r for r in rows if r['in']]
mt = collections.defaultdict(lambda: [0, 0])
for r in zin: mt[r['type']][0] += 1; mt[r['type']][1] += r['wh']
types = [t for t in FAM.values() if mt[t][0] and sav[t]['zsw']]
sv_share = {t: sav[t]['zsw'] / sum(sav[u]['zsw'] for u in types) for t in types}
m_share = {t: mt[t][0] / sum(mt[u][0] for u in types) for t in types}
m_rate = {t: mt[t][1] / mt[t][0] for t in types}; s_rate = {t: sav[t]['zwh'] / sav[t]['zsw'] for t in types}
print('\nin-zone by type  share of swings match/Savant  whiff/swing match/Savant (swings)')
for t in types: print(f'  {t}  {m_share[t]:.3f}/{sv_share[t]:.3f}  {m_rate[t]:.3f}/{s_rate[t]:.3f} ({mt[t][0]})')
a = sum(m_share[t] * m_rate[t] for t in types); b = sum(sv_share[t] * m_rate[t] for t in types); c_ = sum(sv_share[t] * s_rate[t] for t in types)
print(f'in-zone whiff/swing: match {a:.3f}, match rates on Savant mix {b:.3f}, Savant {c_:.3f}  -> composition {a - b:+.3f}, per-type excess {b - c_:+.3f}')
