# Swing and contact by distance past the zone widened by the ball (bands in metres) and strikes, from Statcast pitch CSVs.
# usage: python -I statcast-bands.py <statcast.csv>...
import csv, sys, collections
SW = {"swinging_strike","swinging_strike_blocked","foul","foul_tip","hit_into_play","foul_bunt","missed_bunt","bunt_foul_tip"}
WH = {"swinging_strike","swinging_strike_blocked","foul_tip","missed_bunt"}
FT = .3048; HALF, R = 0.7083 * FT, 0.1201 * FT
EDGES = [0, .06, .12, .20, .30, .45, 9]
acc = collections.defaultdict(collections.Counter)
for path in sys.argv[1:]:
    for r in csv.DictReader(open(path, encoding='utf-8-sig')):
        if not r['plate_x'] or not r['sz_top'] or r['pitch_type'] in ('PO', 'IN', ''): continue
        x, z, top, bot = (float(r[k]) * FT for k in ('plate_x', 'plate_z', 'sz_top', 'sz_bot'))
        d = max(abs(x) - HALF - R, bot - R - z, z - top - R)
        if d <= 0: continue
        band = next(i for i in range(len(EDGES) - 1) if d < EDGES[i + 1])
        s = int(r['strikes']); g = '3-0' if r['balls'] == '3' and s == 0 else 's%d' % s
        a = acc[(g, band)]; desc = r['description']
        a['n'] += 1; a['sw'] += desc in SW; a['wh'] += desc in WH
        a['foul'] += desc.startswith('foul') and desc not in WH; a['bip'] += desc == 'hit_into_play'; a['woba'] += float(r['woba_value'] or 0) * (desc == 'hit_into_play')
print('bands (m past the widened zone):', EDGES)
for g in ['s0', 's1', 's2', 'ALL']:
    cells = []
    for b in range(len(EDGES) - 1):
        a = acc[(g, b)] if g != 'ALL' else sum((acc[(h, b)] for h in ['s0', 's1', 's2', '3-0']), collections.Counter())
        cells.append('%.3f/%.2f(%d)' % (a['sw'] / max(1, a['n']), 1 - a['wh'] / max(1, a['sw']), a['n']))
    print(g, ' '.join(cells))
