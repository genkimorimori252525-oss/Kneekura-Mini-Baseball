# Out-of-zone swings and whiffs by distance band and side, the match (read right / read wrong, from pitchRecognitionV2's record)
# against Savant's same bands and sides (fetch-miss-direction.py's day aggregates). Bands past the zone widened by the ball:
# <6, 6-12, 12-20, 20+ cm on the side the ball is furthest out on; sides up, down, side (arm and glove together).
# usage: python -I -X utf8 chase-whiff-bands.py <day aggregate dir> <first_date> <last_date> <step> "<records glob>"...
import collections, datetime as dt, glob, json, sys
from pathlib import Path
R = .0366
src, d0, d1, step = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3]), int(sys.argv[4])
BANDS = ['<6', '6-12', '12-20', '20+']
def band(out_m): return 0 if out_m < .06 else 1 if out_m < .12 else 2 if out_m < .20 else 3
def side3(d): return 'side' if d in ('arm', 'glove') else d
sav = collections.defaultdict(lambda: [0.0, 0.0, 0.0])   # (side, band) -> pitches, swings, whiffs
for i in range(0, (d1 - d0).days + 1, step):
    f = Path(src) / ((d0 + dt.timedelta(days=i)).isoformat() + '.json')
    if not f.exists(): continue
    for k, a in json.loads(f.read_text()).items():
        if k[:2] in ('L|', 'P|'): continue
        pt, throws, stand, balls, strikes, d, b = k.split('|')
        if d not in ('up', 'down', 'arm', 'glove'): continue
        bi = min(3, max(0, int(b) - 1 if int(b) <= 2 else 2 if int(b) == 3 else 3))
        t = sav[(side3(d), bi)]; t[0] += a[0]; t[1] += a[1]; t[2] += a[2]
sim = collections.defaultdict(lambda: [0, 0, 0])   # (read, side, band)
for g in sys.argv[5:]:
    for f in glob.glob(g):
        for l in open(f):
            r = json.loads(l)
            if r['x'] is None or not r['zone'] or 'recog' not in r: continue
            z, x, y = r['zone'], r['x'], r['y']
            sg, up, down = abs(x) - (z['half'] + R), y - (z['high'] + R), (z['low'] - R) - y
            out = max(sg, up, down)
            if out <= 0: continue
            d = 'up' if out == up else 'down' if out == down else 'side'
            for read in ('all', 'right' if r['recog']['ok'] else 'wrong'):
                t = sim[(read, d, band(out))]; t[0] += 1; t[1] += r['swing']; t[2] += r['swing'] and not r['foulOrContact']
print('swing / whiff per swing (swings)   Savant | match all | read right | read wrong')
for d in ('up', 'down', 'side'):
    for b in range(4):
        s = sav[(d, b)]
        cells = [f"{s[1] / s[0]:.3f}/{s[2] / max(1, s[1]):.3f}"]
        for read in ('all', 'right', 'wrong'):
            m = sim[(read, d, b)]
            cells.append(f"{m[1] / max(1, m[0]):.3f}/{m[2] / max(1, m[1]):.3f} ({m[1]})")
        print(f'  {d:5} {BANDS[b]:6}', ' | '.join(cells))
