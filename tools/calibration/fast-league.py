# League rates from records, with balls in play scored by an outcome table (fielding-free runs) or as played.
# usage: python -I fast-league.py <table.json|-> "<records glob>" [--by=batter]
# Only plate appearances that ended count; fouls and continuing pitches are left out. With a table, a ball settled
# 'unresolved' by a fielding-free run counts as a ball in play.
import collections
import glob
import importlib.util
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('ot', os.path.join(here, 'outcome-table.py'))
ot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ot)
table, pattern, *rest = sys.argv[1:]
by_batter = '--by=batter' in rest
predict = ot.predictor(json.load(open(table))) if table != '-' else None
acc = collections.defaultdict(lambda: collections.Counter())
for f in glob.glob(pattern):
    log = f.replace('/g-', '/glog-').replace('\g-', '\glog-').replace('.jsonl', '.txt')
    if os.path.exists(log) and 'FINISHED' not in open(log, encoding='utf8', errors='ignore').read():
        continue
    for line in open(f):
        r = json.loads(line)
        s = r.get('scoring')
        # Fielding-free runs leave a ball settled as a single 'unresolved'; it still ends the plate appearance.
        if not s or s == 'plate_appearance_continues' or s == 'unresolved' and not (predict and r.get('exit')):
            continue
        for k in ([r['batter']] if by_batter else []) + ['ALL']:
            a = acc[k]
            a['pa'] += 1
            if s in ('strikeout', 'walk', 'hit_by_pitch'):
                a[s] += 1
            elif r.get('exit'):
                if predict and abs(r['exit']['spray']) > 45:
                    pass   # a foul fly caught: an out with no bases
                elif predict:
                    p = predict(*ot.key(r))
                    a['hits'] += 1 - p[0]; a['bases'] += sum(i * p[i] for i in range(5)); a['hr'] += p[4]
                else:
                    b = ot.bases(r); a['hits'] += b > 0; a['bases'] += b; a['hr'] += b == 4; a['sf'] += s == 'sacrifice_fly'
for k, a in sorted(acc.items(), key=lambda kv: (kv[0] != 'ALL', kv[0])):
    ab = a['pa'] - a['walk'] - a['hit_by_pitch'] - a['sf']
    print(f"{k:8} PA {a['pa']:5d} K {a['strikeout'] / a['pa']:.3f} BB {a['walk'] / a['pa']:.3f} AVG {a['hits'] / ab:.3f} SLG {a['bases'] / ab:.3f} ISO {(a['bases'] - a['hits']) / ab:.3f} HR {a['hr'] / a['pa']:.3f}")
