# All leagues: real vs game per hitter (each hitter counted once, in his first league), means and correlations.
import json, glob, importlib.util, sys, math
R = 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/mini-baseball/tools/calibration'
ARGS = sys.argv[1:]
spec = importlib.util.spec_from_file_location('af', R + '/ability-fit.py'); af = importlib.util.module_from_spec(spec); sys.argv = ['x']; spec.loader.exec_module(af)
P = af.ot.predictor(json.load(open('K:/kbm-work/table-statcast24.json')))
rec = ARGS[0] if len(ARGS) > 0 else 'reca'
tag = ARGS[1] if len(ARGS) > 1 else ''
REAL = json.load(open('K:/kbm-work/targets-mlb2024-bb.json', encoding='utf8'))
keys = ['k', 'bb', 'iso', 'babip', 'hr', 'gb', 'fb']
rows, seen = [], set()
for L in range(12):
    truth = json.load(open(f'K:/kbm-work/mlb24all/truth{tag}-{L}.json', encoding='utf8'))
    sim = af.batter_stats(glob.glob(f'K:/kbm-work/mlb24all/{rec}/g-m{L}-*.jsonl'), P)
    for slot, t in truth.items():
        if t['source'] in seen or slot not in sim: continue
        seen.add(t['source']); rows.append(({**t, **{k: REAL[t['source']][k] for k in keys if k in REAL[t['source']]}}, sim[slot]))
def corr(x, y):
    mx, my = sum(x)/len(x), sum(y)/len(y)
    return sum((a-mx)*(b-my) for a, b in zip(x, y)) / math.sqrt(sum((a-mx)**2 for a in x) * sum((b-my)**2 for b in y))
print('hitters', len(rows), 'PA per hitter', round(sum(s['pa'] for _, s in rows) / len(rows)))
for k in keys:
    xs = [t[k] for t, s in rows if k in t]; ys = [s[k] for t, s in rows if k in t]
    print(f'{k:6} real {sum(xs)/len(xs):.3f} game {sum(ys)/len(ys):.3f} corr {corr(xs, ys):.2f}')
