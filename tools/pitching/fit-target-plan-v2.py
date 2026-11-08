# pitchTargetPlanV2's hitter: season table (heart / edge / chase / waste by count) for the level, the one-day pitch sample
# for the shape of the bands past 12 cm. Prints the constants. The plan takes contact, foul and runs from here (swing by
# count from fit-target-plan-v2-swing.py); waste's wOBA still holds the hit batters, so the plan uses the all-pitch .27 / 1.24 there.
# usage: python -I fit-target-plan-v2.py <mlb_count_region_by_year.csv> <statcast day.csv> [year] [pitch group ALL|FB|BR|OFF]
import csv, sys, collections
table, day = sys.argv[1], sys.argv[2]; year = sys.argv[3] if len(sys.argv) > 3 else '2024'; group = sys.argv[4] if len(sys.argv) > 4 else 'ALL'
G = lambda b, s: 3 if b == 3 and s == 0 else s
S = collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(table, encoding='utf8')):
    if r['year'] != year or r['pitcher_hand'] != 'ALL' or r['batter_hand'] != 'ALL' or r['pitch_group'] != group or r['count'] == 'ALL': continue
    b, s = int(r['balls']), int(r['strikes']); a = S[(G(b, s), r['region'])]
    for k in ('pitches', 'swings', 'whiffs', 'fouls', 'bip', 'called'): a[k] += int(r[k])
    a['woba'] += float(r['woba_sum'])
    if b == 3: a['walks'] += int(r['pitches']) - int(r['swings']) - int(r['called'])   # 3-ball takes outside the zone end in walks
    a['all'] += int(r['pitches'])
regions = ['heart', 'edge', 'chase', 'waste']
# One-day shape: swing / contact / foul for bands 12-20, 20-30, 30-45, >45 cm relative to the whole waste region.
SW = {"swinging_strike","swinging_strike_blocked","foul","foul_tip","hit_into_play","foul_bunt","missed_bunt","bunt_foul_tip"}
WH = {"swinging_strike","swinging_strike_blocked","foul_tip","missed_bunt"}
FT = .3048; HALF, R = .7083 * FT, .1201 * FT; EDGES = [.12, .20, .30, .45, 9]
D = collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(day, encoding='utf-8-sig')):
    if not r['plate_x'] or not r['sz_top'] or r['pitch_type'] in ('PO', 'IN', ''): continue
    x, z, top, bot = (float(r[k]) * FT for k in ('plate_x', 'plate_z', 'sz_top', 'sz_bot'))
    d = max(abs(x) - HALF - R, bot - R - z, z - top - R)
    if d < .12: continue
    g = G(int(r['balls']), int(r['strikes'])); band = next(i for i in range(4) if d < EDGES[i + 1])
    for key in ((g, band), (g, 'w')):
        a = D[key]; a['n'] += 1; a['sw'] += r['description'] in SW; a['wh'] += r['description'] in WH
swing, contact, foul, runs = [], [0] * 8, [0] * 8, [0] * 8
tot = collections.Counter()
for g in range(4):
    row = []
    for reg in regions:
        a = S[(g, reg)]; row.append(a['swings'] / a['pitches'])
        for k in a: tot[(reg, k)] += a[k]
    w = D[(g, 'w')]; wsw = w['sw'] / max(1, w['n'])
    far = [(D[(g, i)]['sw'] / max(1, D[(g, i)]['n'])) * (row[3] / wsw if wsw else 0) for i in range(4)]
    swing.append([round(row[0], 3), round(row[1], 3), round(row[2], 3), round(row[2], 3)] + [round(v, 3) for v in far])
for i, reg in enumerate(regions):
    sw, wh, fo, bip = tot[(reg, 'swings')], tot[(reg, 'whiffs')], tot[(reg, 'fouls')], tot[(reg, 'bip')]
    c, f, woba = 1 - wh / sw, fo / (sw - wh), (tot[(reg, 'woba')] - .69 * tot[(reg, 'walks')]) / bip
    print(reg, 'pitches', tot[(reg, 'pitches')], 'swing %.3f contact %.3f foul %.3f wOBAcon %.3f' % (sw / tot[(reg, 'pitches')], c, f, woba))
    contact[i], foul[i], runs[i] = round(c, 3), round(f, 3), round(woba / 1.24, 3)
# The bands: chase twice (0-6, 6-12 cm), the waste values for the four far bands, contact falling as the one-day shape.
dw = sum((D[(g, 'w')] for g in range(4)), collections.Counter()); cw = 1 - dw['wh'] / max(1, dw['sw'])
farc = []
for i in range(4):
    a = sum((D[(g, i)] for g in range(4)), collections.Counter()); farc.append((1 - a['wh'] / a['sw']) if a['sw'] else 0)
print('one-day far contact', [round(v, 2) for v in farc], 'waste', round(cw, 3))
C = contact[:3] + [contact[2]] + [round(min(.98, v * contact[3] / cw), 3) for v in farc]
F = foul[:3] + [foul[2]] + [foul[3]] * 4; Rn = runs[:3] + [runs[2]] + [runs[3]] * 4
print('V2_SWING=' + str(swing).replace(' ', '')); print('V2_CONTACT=' + str(C).replace(' ', '')); print('V2_FOUL=' + str(F).replace(' ', '')); print('V2_RUNS=' + str(Rn).replace(' ', ''))
