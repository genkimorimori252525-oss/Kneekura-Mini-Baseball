# Per-ball value under the Statcast table, and the joint exit-speed x angle mix that drives it, sim vs MLB.
# usage: python -I joint-mix.py <table.json> "<records glob>"...
import glob, json, sys, importlib.util
spec = importlib.util.spec_from_file_location('ot', __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'outcome-table.py'))
ot = importlib.util.module_from_spec(spec); spec.loader.exec_module(ot)
T = json.load(open(sys.argv[1])); P = ot.predictor(T)
def cls(ev, la):
    if la < 10: return 'GB<10'
    if la >= 50: return 'PU50+'
    band = 'LD10-25' if la < 25 else 'FB25-50'
    return band + (' 95+' if ev >= 95 else ' <95')
def summ(balls):
    n = len(balls); out = {}
    for ev, la, sp in balls:
        p = P(ev, la, sp); k = cls(ev, la); o = out.setdefault(k, [0, 0.0, 0.0])
        o[0] += 1; o[1] += 1 - p[0]; o[2] += sum(i * p[i] for i in range(5))
    tot = [sum(v[1] for v in out.values()) / n, sum(v[2] for v in out.values()) / n]
    return n, out, tot
mlb = [(r[0], r[1], r[2]) for r in T['rows']][::4]
sets = [('MLB', mlb)]
for pat in sys.argv[2:]:
    b = []
    for f in glob.glob(pat):
        for line in open(f):
            r = json.loads(line); e = r.get('exit')
            if e and r.get('scoring') not in (None, 'plate_appearance_continues') and abs(e['spray']) <= 45: b.append((e['kmh'] / 1.609344, e['launch'], e['spray']))
    sets.append((pat.split('/')[-1], b))
res = [(name,) + summ(b) for name, b in sets]
for name, n, out, tot in res: print(f'{name:16} n {n:5} hit/BIP {tot[0]:.3f} bases/BIP {tot[1]:.3f}')
keys = ['GB<10', 'LD10-25 <95', 'LD10-25 95+', 'FB25-50 <95', 'FB25-50 95+', 'PU50+']
print('class: share% / hit% / bases per ball')
for k in keys:
    print(f'{k:12}', ' | '.join(f"{o.get(k,[0])[0]/n*100:4.1f}/{(o[k][1]/o[k][0]*100 if k in o else 0):3.0f}/{(o[k][2]/o[k][0] if k in o else 0):.2f}" for _, n, o, _ in res))
