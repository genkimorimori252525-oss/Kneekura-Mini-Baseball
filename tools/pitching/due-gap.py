# Swings in records with judge.due (ms, the bat's timing minus the ball's crossing; negative early): by pitch group and the speed
# gap from the pitcher's own fastball, misread and right read apart, the median timing relative to right-read fastballs, the
# share more than 20 ms off, and the whiff; and how whiff and foul follow the timing error.
# usage: python -I -X utf8 due-gap.py <records folder> <tag>
import collections, glob, json, statistics as st, sys
G = {'changeup': 'OS', 'splitter': 'OS', 'slider': 'BR', 'sweeper': 'BR', 'curve': 'BR', 'knuckle_curve': 'BR', 'slurve': 'BR', 'fastball': 'FB', 'sinker': 'FB', 'cutter': 'FB'}
R = []
for f in glob.glob(f'{sys.argv[1]}/g-{sys.argv[2]}-*.jsonl'):
    if f.count('.jsonl') > 1: continue
    lg = f.rsplit('-', 2)[0]; R += [dict(r, lg=lg) for r in map(json.loads, open(f, encoding='utf8'))]
fb = collections.defaultdict(list)
for r in R:
    if r['pitch'] in ('fastball', 'sinker'): fb[(r['lg'], r['pitcher'])].append(r['kmh'] / 1.609)
v = {k: sum(x) / len(x) for k, x in fb.items()}
S = [dict(g=G[r['pitch']], gap=v[(r['lg'], r['pitcher'])] - r['kmh'] / 1.609, d=r['judge']['due'], wh=not r['foulOrContact'], foul=r['play'] == 'foul',
          mis=bool(r.get('recog')) and not r['recog']['ok']) for r in R if r['swing'] and r['pitch'] in G and (r['lg'], r['pitcher']) in v and 'due' in (r.get('judge') or {})]
ref = st.median(o['d'] for o in S if o['g'] == 'FB' and not o['mis'])
print(f'swings {len(S)}; right-read fastball median due {ref:+.1f} ms (taken as on time)')
for g in ('FB', 'BR', 'OS'):
    for lab, f in (('misread', lambda o: o['mis']), ('read right', lambda o: not o['mis'])):
        row = []
        for lo, hi in ((-99, 4), (4, 7), (7, 10), (10, 13), (13, 99)):
            a = [o for o in S if o['g'] == g and f(o) and lo <= o['gap'] < hi]
            if len(a) >= 15: row.append(f"[{lo},{hi}) n {len(a):4} {st.median(o['d'] for o in a) - ref:+6.1f}ms off20 {sum(abs(o['d'] - ref) > 20 for o in a) / len(a):.2f} wh {sum(o['wh'] for o in a) / len(a):.2f}")
        print(f'{g} {lab:10} ' + ' | '.join(row))
print('by timing (ms from on time): whiff, foul')
for lo, hi in ((-999, -60), (-60, -40), (-40, -20), (-20, -10), (-10, 10), (10, 20), (20, 40), (40, 999)):
    a = [o for o in S if lo <= o['d'] - ref < hi]
    if a: print(f'  [{lo},{hi}) n {len(a):5} whiff {sum(o["wh"] for o in a) / len(a):.2f} foul {sum(o["foul"] for o in a) / len(a):.2f}')
