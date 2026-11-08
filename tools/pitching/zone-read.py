# In and out of Savant's zone (widened by the ball), by pitch group and by whether the hitter read the pitch: the share of
# swings, the misread share and the whiff, against Savant's league rows (z/o swing and whiff by pitch type, the match's type
# mix). Records from core-playthrough with pitchRecognitionV2.
# usage: python -I -X utf8 zone-read.py <mlb_pitch_type_zone_league_year.csv> "<records glob>"... [--year=2024]
import collections, csv, glob, json, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
year = next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--year=')), '2024')
R = .0366
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH',
        'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV'}
GROUP = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
mlb = {r['pitch_type']: r for r in csv.DictReader(open(args[0], encoding='utf8')) if r['year'] == year}
for pattern in args[1:]:
    c = collections.defaultdict(collections.Counter); mix = collections.defaultdict(collections.Counter)
    for f in glob.glob(pattern):
        for line in open(f, encoding='utf8'):
            r = json.loads(line)
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; side = 'in' if abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R else 'out'
            t = CODE.get(r['pitch'], r['pitch']); g = GROUP.get(t, '?'); whiff = r['swing'] and not r['foulOrContact']
            for key in ((side, g), (side, 'all')):
                x = c[key]; x['n'] += 1; x['sw'] += r['swing']; x['wh'] += whiff
                if r['swing'] and r.get('recog'):
                    mis = not r['recog']['ok']; x['mis'] += mis; x['whmis'] += mis and whiff
            mix[(side, g)][t] += 1; mix[(side, 'all')][t] += 1
    print(pattern.split('/')[-1])
    print('  side group  pitches  swing (MLB)    whiff (MLB)    misread  whiff|mis  whiff|ok')
    for side in ('in', 'out'):
        for g in ('FB', 'BR', 'OS', 'all'):
            x = c[(side, g)]
            if not x['sw']: continue
            m = mix[(side, g)]; pre = 'z' if side == 'in' else 'o'
            # Savant's rates on the match's type mix (pitches for the swing rate, swings for the whiff rate)
            n = sum(m[t] for t in m if t in mlb)
            msw = sum(m[t] * float(mlb[t][f'{pre}_swing_pct']) / 100 for t in m if t in mlb) / n if n else float('nan')
            sws = {t: m[t] * float(mlb[t][f'{pre}_swing_pct']) / 100 for t in m if t in mlb}
            mwh = sum(sws[t] * float(mlb[t][f'{pre}_whiff_per_swing']) / 100 for t in sws) / sum(sws.values()) if sws else float('nan')
            ok = x['sw'] - x['mis']
            print(f"  {side:4} {g:4} {x['n']:7}  {x['sw'] / x['n']:.3f} ({msw:.3f})  {x['wh'] / x['sw']:.3f} ({mwh:.3f})  "
                  f"{x['mis'] / x['sw']:.3f}    {x['whmis'] / max(1, x['mis']):.3f}     {(x['wh'] - x['whmis']) / max(1, ok):.3f}")
