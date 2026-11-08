# pitchTargetPlanV2's swing rows for each of the 12 counts and each pitch family: the season table (heart / edge / chase /
# waste) for the level, the one-day pitch sample for the shape of the bands past 12 cm within waste (by strikes).
# usage: python -I fit-target-plan-v2-swing.py <mlb_count_region_by_year.csv> <statcast day.csv> [year]
import csv, sys, collections
table, day = sys.argv[1], sys.argv[2]; year = sys.argv[3] if len(sys.argv) > 3 else '2024'
S = collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(table, encoding='utf8')):
    if r['year'] != year or r['pitcher_hand'] != 'ALL' or r['batter_hand'] != 'ALL' or r['count'] == 'ALL': continue
    a = S[(r['pitch_group'], int(r['balls']), int(r['strikes']), r['region'])]
    a['n'] += int(r['pitches']); a['sw'] += int(r['swings'])
SW = {"swinging_strike","swinging_strike_blocked","foul","foul_tip","hit_into_play","foul_bunt","missed_bunt","bunt_foul_tip"}
FT = .3048; HALF, R = .7083 * FT, .1201 * FT; EDGES = [.12, .20, .30, .45, 9]
D = collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(day, encoding='utf-8-sig')):
    if not r['plate_x'] or not r['sz_top'] or r['pitch_type'] in ('PO', 'IN', ''): continue
    x, z, top, bot = (float(r[k]) * FT for k in ('plate_x', 'plate_z', 'sz_top', 'sz_bot'))
    d = max(abs(x) - HALF - R, bot - R - z, z - top - R)
    if d < .12: continue
    s = int(r['strikes']); band = next(i for i in range(4) if d < EDGES[i + 1])
    for key in ((s, band), (s, 'w')): D[key]['n'] += 1; D[key]['sw'] += r['description'] in SW
for fam in ['ALL', 'FB', 'BR', 'OFF']:
    rows = []
    for b in range(4):
        for s in range(3):
            v = [S[(fam, b, s, g)]['sw'] / max(1, S[(fam, b, s, g)]['n']) for g in ('heart', 'edge', 'chase', 'waste')]
            w = D[(s, 'w')]['sw'] / D[(s, 'w')]['n']
            far = [D[(s, i)]['sw'] / max(1, D[(s, i)]['n']) * v[3] / w for i in range(4)]
            rows.append('[' + ','.join(('%.3f' % x).lstrip('0') if x > 0 else '0' for x in v[:3] + [v[2]] + far) + ']')
    print('  %s:[%s],' % (fam, ','.join(rows)))
