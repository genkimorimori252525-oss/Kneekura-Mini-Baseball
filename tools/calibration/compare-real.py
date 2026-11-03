# Real season vs a fielding-free league of the same hitters (balls scored by an outcome table), player by player.
# usage: python -I -X utf8 compare-real.py <truth.json from real-league-spec.py> <table.json> "<records glob>"
import collections
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
sim = af.batter_stats(glob.glob(args[2]), af.ot.predictor(json.load(open(args[1]))))
keys = ['k', 'bb', 'iso', 'babip', 'hr']
print('name'.ljust(18), 'PA ', '  '.join(f'{k:>13}' for k in keys), ' (real/sim)')
for slot, t in truth.items():
    s = sim.get(slot)
    if s:
        print(t['name'][:18].ljust(18), str(s['pa']).rjust(3), '  '.join(f"{t[k]:.3f}/{s[k]:.3f}".rjust(13) for k in keys))
def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
both = [s for s in truth if s in sim]
print('mean'.ljust(22), '  '.join(f"{sum(truth[s][k] for s in both) / len(both):.3f}/{sum(sim[s][k] for s in both) / len(both):.3f}".rjust(13) for k in keys))
print('corr'.ljust(22), '  '.join(f"{corr([truth[s][k] for s in both], [sim[s][k] for s in both]):13.2f}" for k in keys))
