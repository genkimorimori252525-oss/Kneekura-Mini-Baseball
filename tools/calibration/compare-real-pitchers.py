# Real season vs fielding-free games of the same pitchers (real-pitcher-spec.py leagues), pitcher by pitcher, with the surface's
# prediction alongside. Balls in play are scored by an outcome table.
# usage: python -I -X utf8 compare-real-pitchers.py <truth.json> <table.json> "<records glob with {league}>"
import glob
import importlib.util
import json
import math
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('af', os.path.join(here, 'ability-fit.py'))
af = importlib.util.module_from_spec(spec)
sys.argv, args = ['x'], sys.argv[1:]
spec.loader.exec_module(af)
truth = json.load(open(args[0], encoding='utf8'))
predict = af.ot.predictor(json.load(open(args[1])))
sim = {}
for league in sorted({k.split('/')[0] for k in truth}):
    for slot, s in af.batter_stats(glob.glob(args[2].replace('{league}', league)), predict, 'pitcher').items():
        sim[f'{league}/{slot}'] = s
keys = ['k', 'bb', 'hr', 'babip']
print('slot'.ljust(8), 'mph ', 'BF  ', '  '.join(f'{k:>19}' for k in keys), ' (real/predicted/sim)')
both = [s for s in truth if s in sim]
for slot in both:
    t, s = truth[slot], sim[slot]
    print(slot.ljust(8), f"{t['fb_avg_speed']:.1f}", str(s['pa']).rjust(4), '  '.join(f"{t[k]:.3f}/{t['predicted'][k]:.3f}/{s[k]:.3f}".rjust(19) for k in keys))
def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
print('mean'.ljust(18), '  '.join(f"{sum(truth[s][k] for s in both) / len(both):.3f}/{sum(truth[s]['predicted'][k] for s in both) / len(both):.3f}/{sum(sim[s][k] for s in both) / len(both):.3f}".rjust(19) for k in keys))
print('corr real-sim'.ljust(18), '  '.join(f"{corr([truth[s][k] for s in both], [sim[s][k] for s in both]):19.2f}" for k in keys))
print('corr real-pred'.ljust(18), '  '.join(f"{corr([truth[s][k] for s in both], [truth[s]['predicted'][k] for s in both]):19.2f}" for k in keys))
