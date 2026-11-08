# Breaking-ball swings by pitch type and speed-gap side (under/over 10 mph to the pitcher's own fastball, the more used of fastball
# and sinker in that league): swings, mean gap, whiff/swing, and in the game the misread share; or MLB Statcast pitch files.
# usage: python -I -X utf8 br-type.py game <records folder> <tag> | mlb <folder with p*.csv>
import collections, csv, glob, json, statistics, sys
mode = sys.argv[1]
G = {'slider','sweeper','curve','knuckle_curve','slurve'}
M = {'SL':'slider','ST':'sweeper','CU':'curve','KC':'knuckle_curve','SV':'slurve'}
out = collections.defaultdict(lambda: collections.defaultdict(list))
if mode == 'game':
    files = collections.defaultdict(list)
    for f in glob.glob(f'{sys.argv[2]}/g-{sys.argv[3]}-*.jsonl'):
        if f.count('.jsonl') > 1: continue
        files[f.rsplit('-', 2)[1]].append(f)
    for lg, fs in files.items():
        R = [json.loads(l) for f in fs for l in open(f, encoding='utf8')]
        fb = collections.defaultdict(lambda: collections.defaultdict(list))
        for r in R:
            if r['pitch'] in ('fastball','sinker'): fb[r['pitcher']][r['pitch']].append(r['kmh']/1.609344)
        v = {p: statistics.mean(max(d.values(), key=len)) for p, d in fb.items()}
        for r in R:
            if r['pitch'] in G and r['swing'] and r['pitcher'] in v:
                gap = v[r['pitcher']] - r['kmh']/1.609344
                b = '<10' if gap < 10 else '10+'
                g = r.get('recog') or {}
                for k in (r['pitch'], r['pitch']+b):
                    out[k]['gap'].append(gap); out[k]['wh'].append(float(not r['foulOrContact'])); out[k]['mis'].append(float(not g.get('ok', True)))
else:
    seen=set(); rows=[]; fb = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in sorted(glob.glob(sys.argv[2] + '/p*.csv')):
        for r in csv.DictReader(open(f, encoding='utf-8-sig')):
            k=(r['game_pk'],r['at_bat_number'],r['pitch_number'])
            if k in seen or not r['release_speed']: continue
            seen.add(k); rows.append(r)
            if r['pitch_type'] in ('FF','SI'): fb[r['pitcher']][r['pitch_type']].append(float(r['release_speed']))
    v = {p: statistics.mean(max(d.values(), key=len)) for p, d in fb.items() if sum(map(len, d.values())) >= 20}
    SW={'foul','foul_tip','hit_into_play','swinging_strike','swinging_strike_blocked'}
    for r in rows:
        t=M.get(r['pitch_type'])
        if t and r['pitcher'] in v and r['description'] in SW:
            gap=v[r['pitcher']]-float(r['release_speed']); b = '<10' if gap < 10 else '10+'
            for k in (t, t+b):
                out[k]['gap'].append(gap); out[k]['wh'].append(float(r['description'].startswith('swinging_strike')))
for k in sorted(out):
    d=out[k]; n=len(d['wh'])
    print(f"{k:18} sw {n:6} gap {statistics.mean(d['gap']):5.1f} wh/sw {statistics.mean(d['wh']):.3f}" + (f" mis {statistics.mean(d['mis']):.2f}" if d.get('mis') else ''))
