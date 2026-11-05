# The rows of pitchTargetPlanV2's forecast by side (missDirectionV2) from fetch-miss-direction.py's day aggregates, and the MLB
# share of out-of-zone pitches by side for each pitch type (to check the match against).
# Per family (FB, BR, OFF, and ALL) and cell: 0-23 the misses, side (up / down / arm / glove) x band (<6, <12, <20, <30, <45 cm,
# more); 24-27 the zone's edge (in it, off the middle 48% box) by its nearest side; the heart stays on the band-only rows.
#   swing by count (12 rows, 0-0 0-1 0-2 1-0 ... 3-2), contact per swing, fouls per contact, runs = wOBA on balls in play / 1.24.
# Thin cells are pulled toward the same band (or the edge) over all sides, that toward ALL, with the weight of 30 pitches
# (swing) or 30 swings / contacts / balls in play.
# usage: python -I -X utf8 fit-miss-direction.py <day aggregate dir> <first_date> <last_date> <step> <out .ts> [--shares]
import collections, datetime as dt, json, sys
from pathlib import Path
src, d0, d1, step, out = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
FAMILY = {'FF': 'FB', 'SI': 'FB', 'FT': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'SV': 'BR', 'CU': 'BR', 'KC': 'BR', 'CS': 'BR',
          'CH': 'OFF', 'FS': 'OFF', 'FO': 'OFF', 'SC': 'OFF', 'KN': 'OFF', 'EP': 'OFF'}
SIDES = ['up', 'down', 'arm', 'glove']
CELLS = [(s, b) for s in range(4) for b in range(6)] + [(s, 6) for s in range(4)]   # band 6 = the zone's edge
M = 30
cell = collections.defaultdict(lambda: [0.0] * 8)   # (family, count, side, band) -> n swings whiffs fouls in_play called rv woba
types = collections.defaultdict(collections.Counter)
days = [d0 + dt.timedelta(days=i) for i in range(0, (d1 - d0).days + 1, step)]
used = 0
for d in days:
    f = Path(src) / (d.isoformat() + '.json')
    if not f.exists(): continue
    used += 1
    for k, a in json.loads(f.read_text()).items():
        if k[:2] in ('L|', 'P|'): continue
        pt, throws, stand, balls, strikes, side, band = k.split('|')
        if side == 'none': continue
        inzone = side in ('in', 'heart') or side.startswith('e')
        types[pt]['in' if inzone else side] += a[0]
        if side in ('in', 'heart'): continue
        c = int(balls) * 3 + int(strikes)
        if c > 11: continue
        key = (SIDES.index(side[1:]), 6) if side.startswith('e') else (SIDES.index(side), int(band) - 1)
        for fam in ('ALL', FAMILY.get(pt)):
            if fam is None: continue
            t = cell[(fam, c) + key]
            for i in range(8): t[i] += a[i]
def total(fam, side=None, band=None, count=None):
    t = [0.0] * 8
    for (f, c, s, b), a in cell.items():
        if f == fam and (side is None or s == side) and (band is None or b == band) and (count is None or c == count):
            for i in range(8): t[i] += a[i]
    return t
def shrink(num, den, prior): return (num + M * prior) / (den + M)
rows = {}
for fam in ('ALL', 'FB', 'BR', 'OFF'):
    swing, contact, foul, runs = [], [], [], []
    for c in range(12):
        line = []
        for s, b in CELLS:
            pa, pf, a = total('ALL', None, b, c), total(fam, None, b, c), cell.get((fam, c, s, b), [0.0] * 8)
            p_fam = shrink(pf[1], pf[0], pa[1] / pa[0] if pa[0] else 0)
            line.append(round(shrink(a[1], a[0], p_fam), 3))
        swing.append(line)
    for s, b in CELLS:
        pa, pf, a = total('ALL', None, b), total(fam, None, b), total(fam, s, b)
        c_fam = shrink(pf[1] - pf[2], pf[1], 1 - pa[2] / pa[1] if pa[1] else 0)
        contact.append(round(shrink(a[1] - a[2], a[1], c_fam), 3))
        f_fam = shrink(pf[3], pf[3] + pf[4], pa[3] / (pa[3] + pa[4]) if pa[3] + pa[4] else .5)
        foul.append(round(shrink(a[3], a[3] + a[4], f_fam), 3))
        r_fam = shrink(pf[7] / 1.24, pf[4], pa[7] / pa[4] / 1.24 if pa[4] else .25)
        runs.append(round(shrink(a[7] / 1.24, a[4], r_fam), 3))
    rows[fam] = {'swing': swing, 'contact': contact, 'foul': foul, 'runs': runs}
def arr(v): return '[' + ','.join(arr(x) if isinstance(x, list) else ('%g' % x).replace('0.', '.', 1) if 0 < x < 1 else '%g' % x for x in v) + ']'
body = ',\n'.join(f" {fam}:{{swing:{arr(r['swing'])},\n  contact:{arr(r['contact'])},foul:{arr(r['foul'])},runs:{arr(r['runs'])}}}" for fam, r in rows.items())
Path(out).write_text(f"""// pitchTargetPlanV2's forecast by side (missDirectionV2): MLB {d0.year} regular season, every {step}th day from {d0.isoformat()} to
// {d1.isoformat()} ({used} days), Statcast pitches by plate_x / plate_z against sz_top / sz_bot widened by the ball. Cells 0-23 are the misses,
// side * 6 + band: sides up, down, arm (the pitcher's throwing-arm side), glove; bands past the widened zone <6, <12, <20, <30, <45 cm,
// more; cells 24-27 are the zone's edge (in it, off the middle 48% box) by its nearest side, in the same order.
// swing: 12 rows by count (0-0 0-1 0-2 1-0 ... 3-2); contact per swing, fouls per contact, runs = wOBA on balls in play / 1.24.
// Thin cells lean on the same band (or edge) over all sides with 30 pitches' weight. Made by tools/pitching/fit-miss-direction.py.
type SideRowsV2=Readonly<{{swing:readonly (readonly number[])[];contact:readonly number[];foul:readonly number[];runs:readonly number[]}}>;
export const V2_MISS_DIRECTION:Readonly<Record<'ALL'|'FB'|'BR'|'OFF',SideRowsV2>>={{
{body}}};
""", encoding='utf8')
print('days used', used)
if '--shares' in sys.argv:
    print('MLB out-of-zone share by side (up down arm glove), in-zone share:')
    for pt, c in sorted(types.items(), key=lambda kv: -sum(kv[1].values())):
        o = sum(c[s] for s in SIDES)
        if o < 500: continue
        print(f"  {pt}  n {sum(c.values()):7.0f}  zone {c['in'] / (o + c['in']):.3f}  " + '  '.join(f'{s} {c[s] / o:.3f}' for s in SIDES))
