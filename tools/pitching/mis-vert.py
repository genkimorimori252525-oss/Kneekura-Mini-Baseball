# Offspeed (or another group's) pitches by the speed gap to the pitcher's own fastball (mph, the mean of his more used of fastball
# and sinker over all the tag's games in that league, as gap-bins.py), misread and read right apart: the misread share, whiff/swing,
# and how far over the ball (cm, median; + = above) the hitter put it where the decision saw it (judge.obs) and with the
# zone-judgment error (judge.est), and with --miss=1 records the bat at the commit (req) and after the late look (req + late);
# the median gap to the pitch he read it as, and the misread swings with the bat over 6 cm off after the late look.
# usage: python -I -X utf8 mis-vert.py <records folder> <tag>... [--group=OS]
import collections, glob, json, statistics, sys
GROUP = {'fastball': 'FB', 'sinker': 'FB', 'cutter': 'FB', 'slider': 'BR', 'sweeper': 'BR', 'curve': 'BR', 'knuckle_curve': 'BR',
         'slurve': 'BR', 'changeup': 'OS', 'splitter': 'OS'}
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
want = opt.get('group', 'OS')
BINS = [(0, 4), (4, 7), (7, 10), (10, 13), (13, 99)]
med = lambda v: statistics.median(v) if v else float('nan')
for tag in args[1:]:
    games = collections.defaultdict(list)
    for f in sorted(glob.glob(f'{args[0]}/g-{tag}-*.jsonl')):
        if f.count('.jsonl') > 1: continue
        games[f.rsplit('-', 2)[1]].append([json.loads(l) for l in open(f, encoding='utf8')])
    rows = []
    for league, recs in games.items():
        recs = [r for g in recs for r in g]
        fb = collections.defaultdict(lambda: collections.defaultdict(list)); read = collections.defaultdict(list)
        for r in recs:
            if r['pitch'] in ('fastball', 'sinker'): fb[r['pitcher']][r['pitch']].append(r['kmh'])
            if r.get('recog') and r['recog']['ok']: read[(r['pitcher'], r['recog']['read'])].append(r['kmh'])
        v = {p: statistics.mean(max(d.values(), key=len)) for p, d in fb.items()}
        for r in recs:
            g, j, m = r.get('recog'), r.get('judge'), r.get('miss')
            if GROUP.get(r['pitch']) != want or not g or r['pitcher'] not in v or r['y'] is None or r.get('call') == 'hit_by_pitch': continue
            ball = (m or {}).get('ball') or {'y': r['y']}
            late = ((m or {}).get('late') or {}).get('y', 0) or 0
            ref = read.get((r['pitcher'], g['read']))
            rows.append(dict(gap=(v[r['pitcher']] - r['kmh']) / 1.609344, mis=not g['ok'], sw=r['swing'], wh=r['swing'] and not r['foulOrContact'],
                             rgap=(statistics.mean(ref) - r['kmh']) / 1.609344 if ref else None,
                             obs=100 * (j['obs']['y'] - r['y']) if j else None, est=100 * (j['est']['y'] - r['y']) if j else None,
                             req=100 * (m['req']['y'] - ball['y']) if m and m.get('req') and r['swing'] else None,
                             aim=100 * (m['req']['y'] + late - ball['y']) if m and m.get('req') and r['swing'] else None))
    print(f'#### {tag} {want}: pitches {len(rows)}')
    for lo, hi in BINS:
        a = [o for o in rows if lo <= o['gap'] < hi]
        if not a: continue
        s = [o for o in a if o['sw']]; ms = [o for o in s if o['mis']]; mp = [o for o in a if o['mis']]
        col = lambda rows, k: med([o[k] for o in rows if o[k] is not None])
        print(f'  gap [{lo},{hi}) n {len(a):5} sw {len(s):4} wh/sw {sum(o["wh"] for o in s) / max(1, len(s)):.3f}  misread share of swings {len(ms) / max(1, len(s)):.2f}'
              f' wh|mis {sum(o["wh"] for o in ms) / max(1, len(ms)):.3f} wh|ok {sum(o["wh"] for o in s if not o["mis"]) / max(1, len(s) - len(ms)):.3f}'
              f' | misread, cm over: decision {col(mp, "obs"):+5.1f} est {col(mp, "est"):+5.1f} (swings {col(ms, "obs"):+5.1f}) bat {col(ms, "req"):+5.1f}'
              f' after late {col(ms, "aim"):+5.1f} >6cm {sum(abs(o["aim"]) > 6 for o in ms if o["aim"] is not None) / max(1, sum(o["aim"] is not None for o in ms)):.2f}'
              f' | read-gap {col(mp, "rgap"):5.1f} | right read decision {col([o for o in a if not o["mis"]], "obs"):+5.1f}')
