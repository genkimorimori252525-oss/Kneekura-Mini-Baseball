# usage: python -I statcast-table.py <savant bip json {cols, rows} | bip csv> <table out.json> [--bw=ev_la_spray]
# The kernel width defaults to 4 mph, 5 deg, 10 deg; that width blurs the sharp hit-rate peak of liners at 12-16 deg, so MLB's own
# 10-20 deg balls score .606 against .702 actual. 4_1_5 on a full season (bip_2024.csv, 120k balls) scores .693 (2026-11-05).
# Outcome table from Statcast batted balls (exit speed mph, launch angle, spray, bases), in outcome-table.py's format,
# so a fielding-free run can be scored as if MLB fielders had played its balls. Spray: + toward right field, as in the game,
# with the usual 0.75 from hit coordinates to field angle.
import json, math, sys
B = {'single': 1, 'double': 2, 'triple': 3, 'home_run': 4}
BW = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--bw=')), '4_5_10').split('_'); sys.argv = [a for a in sys.argv if not a.startswith('--bw=')]
if sys.argv[1].endswith('.csv'):
    import csv
    num = lambda v: float(v) if v else None
    src = [(num(r['launch_speed']), num(r['launch_angle']), num(r['hc_x']), num(r['hc_y']), r['events']) for r in csv.DictReader(open(sys.argv[1], encoding='utf8'))]
else:
    d = json.load(open(sys.argv[1])); c = d['cols']
    src = [(r[c.index('ev')], r[c.index('la')], r[c.index('hc_x')], r[c.index('hc_y')], r[c.index('event')]) for r in d['rows']]
rows = []
for ev, la, x, y, ev_ in src:
    if None in (ev, la, x, y) or ev_ in ('sac_bunt', 'catcher_interf'): continue
    rows.append([ev, la, round(.75 * math.degrees(math.atan2(x - 125.42, 198.27 - y)), 2), B.get(ev_, 0)])
json.dump({'bandwidth': {'ev': float(BW[0]), 'la': float(BW[1]), 'spray': float(BW[2])}, 'rows': rows}, open(sys.argv[2], 'w'))
n = len(rows); h = sum(r[3] > 0 for r in rows); tb = sum(r[3] for r in rows)
print('balls', n, 'hit/BIP %.3f' % (h / n), 'bases/BIP %.3f' % (tb / n), 'HR/BIP %.3f' % (sum(r[3] == 4 for r in rows) / n))
