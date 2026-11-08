# Pitch by pitch, offspeed and breaking balls: whiff/swing by the speed gap from the pitcher's own fastball (mph), MLB (Statcast
# pitch files) or the game's records (pitcher's mean fastball speed from his records; misread share and the whiff on a misread
# and on a right read).
# usage: python -I -X utf8 gap-bins.py mlb <folder with p*.csv> | game <records folder> <tag>...
import collections, csv, glob, json, sys
BINS = [(0, 4), (4, 7), (7, 10), (10, 13), (13, 99)]
G_MLB = {'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS'}
G_GAME = {'slider': 'BR', 'sweeper': 'BR', 'curve': 'BR', 'knuckle_curve': 'BR', 'slurve': 'BR', 'changeup': 'OS', 'splitter': 'OS'}
def show(name, P):
    for g in ('BR', 'OS'):
        out = []
        for lo, hi in BINS:
            a = [o for o in P if o['g'] == g and lo <= o['gap'] < hi]; s = [o for o in a if o['sw']]; m = [o for o in s if o.get('mis')]
            txt = f"[{lo},{hi}) sw {len(s):5} wh {sum(o['wh'] for o in s) / max(1, len(s)):.3f}"
            if any('mis' in o for o in s): txt += f" mis {len(m) / max(1, len(s)):.2f} wh|ok {sum(o['wh'] for o in s if not o['mis']) / max(1, len(s) - len(m)):.3f}"
            out.append(txt)
        print(f"{name} {g}: " + ' | '.join(out))
if sys.argv[1] == 'mlb':
    rows, seen = [], set(); fb = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in sorted(glob.glob(sys.argv[2] + '/p*.csv')):
        for r in csv.DictReader(open(f, encoding='utf-8-sig')):
            k = (r['game_pk'], r['at_bat_number'], r['pitch_number'])
            if k in seen or not r['release_speed']: continue
            seen.add(k); rows.append(r)
            if r['pitch_type'] in ('FF', 'SI'): fb[r['pitcher']][r['pitch_type']].append(float(r['release_speed']))
    v = {p: (lambda t: sum(d[t]) / len(d[t]))(max(d, key=lambda t: len(d[t]))) for p, d in fb.items() if sum(map(len, d.values())) >= 20}
    SW = {'foul', 'foul_tip', 'hit_into_play', 'swinging_strike', 'swinging_strike_blocked'}
    P = [dict(g=G_MLB[r['pitch_type']], gap=v[r['pitcher']] - float(r['release_speed']), sw=r['description'] in SW, wh=r['description'] in ('swinging_strike', 'swinging_strike_blocked'))
         for r in rows if r['pitch_type'] in G_MLB and r['pitcher'] in v]
    show('MLB', P)
else:
    for tag in sys.argv[3:]:
        R = []
        for f in glob.glob(f'{sys.argv[2]}/g-{tag}-*.jsonl'):
            if f.count('.jsonl') > 1: continue
            lg = f.rsplit('-', 2)[1]
            R += [dict(r, lg=lg) for r in map(json.loads, open(f, encoding='utf8'))]
        fb = collections.defaultdict(list)
        for r in R:
            if r['pitch'] in ('fastball', 'sinker'): fb[(r['lg'], r['pitcher'])].append(r['kmh'] / 1.609)
        v = {k: sum(x) / len(x) for k, x in fb.items()}
        P = [dict(g=G_GAME[r['pitch']], gap=v[(r['lg'], r['pitcher'])] - r['kmh'] / 1.609, sw=r['swing'], wh=r['swing'] and not r['foulOrContact'],
                  mis=bool(r.get('recog')) and not r['recog']['ok']) for r in R if r['pitch'] in G_GAME and (r['lg'], r['pitcher']) in v]
        show(tag, P)
