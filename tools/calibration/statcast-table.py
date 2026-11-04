# usage: python -I statcast-table.py <savant bip json {cols, rows}> <table out.json>
# Outcome table from Statcast batted balls (exit speed mph, launch angle, spray, bases), in outcome-table.py's format,
# so a fielding-free run can be scored as if MLB fielders had played its balls. Spray: + toward right field, as in the game,
# with the usual 0.75 from hit coordinates to field angle.
import json, math, sys
d = json.load(open(sys.argv[1])); c = d['cols']; B = {'single': 1, 'double': 2, 'triple': 3, 'home_run': 4}
rows = []
for r in d['rows']:
    ev, la, x, y, ev_ = r[c.index('ev')], r[c.index('la')], r[c.index('hc_x')], r[c.index('hc_y')], r[c.index('event')]
    if None in (ev, la, x, y) or ev_ in ('sac_bunt', 'catcher_interf'): continue
    rows.append([ev, la, round(.75 * math.degrees(math.atan2(x - 125.42, 198.27 - y)), 2), B.get(ev_, 0)])
json.dump({'bandwidth': {'ev': 4.0, 'la': 5.0, 'spray': 10.0}, 'rows': rows}, open(sys.argv[2], 'w'))
n = len(rows); h = sum(r[3] > 0 for r in rows); tb = sum(r[3] for r in rows)
print('balls', n, 'hit/BIP %.3f' % (h / n), 'bases/BIP %.3f' % (tb / n), 'HR/BIP %.3f' % (sum(r[3] == 4 for r in rows) / n))
