# Adds gain x (real - game) league mean gaps of a pass to a targets file. usage: adjust.py <rec dir> <truth tag> <base targets> <out> [gain]
import json, glob, importlib.util, sys
ARGS = sys.argv[1:]
R = 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/mini-baseball/tools/calibration'
spec = importlib.util.spec_from_file_location('af', R + '/ability-fit.py'); af = importlib.util.module_from_spec(spec); sys.argv = ['x']; spec.loader.exec_module(af)
rec, tag, base, out = ARGS[:4]; gain = float(ARGS[4]) if len(ARGS) > 4 else 1.0
P = af.ot.predictor(json.load(open('K:/kbm-work/table-statcast24.json')))
REAL = json.load(open('K:/kbm-work/targets-mlb2024-bb.json', encoding='utf8'))
keys = ['k', 'bb', 'iso', 'babip', 'hr', 'gb', 'fb']; gaps = {k: [] for k in keys}; seen = set()
for L in range(12):
    truth = json.load(open(f'K:/kbm-work/mlb24all/truth{tag}-{L}.json', encoding='utf8'))
    sim = af.batter_stats(glob.glob(f'K:/kbm-work/mlb24all/{rec}/g-m{L}-*.jsonl'), P)
    for slot, t in truth.items():
        if t['source'] in seen or slot not in sim: continue
        seen.add(t['source'])
        for k in keys:
            if k in REAL[t['source']]: gaps[k].append(REAL[t['source']][k] - sim[slot][k])
mean = {k: gain * sum(v) / len(v) for k, v in gaps.items()}; print({k: round(v, 4) for k, v in mean.items()})
T = json.load(open(base, encoding='utf8'))
for t in T.values():
    for k in keys:
        if k in t: t[k] = max(0.0, t[k] + mean[k])
json.dump(T, open(out, 'w', encoding='utf8'), ensure_ascii=False)
