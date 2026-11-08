# Per-pitcher K spread with the binomial noise taken out: true sd = sqrt(var of K over pitchers - mean of K(1-K)/PA), for the
# game arms and for the real pitchers (their season PA from truth.json 'pa' if present). Also whiff/swing the same way.
# usage: python -I -X utf8 kspread.py <truth.json> <arm glob with {league}>...
import collections, glob, json, math, sys
truth = json.load(open(sys.argv[1], encoding='utf8')); slots = sorted(truth)
def spread(vals):   # vals: (rate, n)
    m = sum(v for v, _ in vals) / len(vals); var = sum((v - m) ** 2 for v, _ in vals) / (len(vals) - 1)
    noise = sum(v * (1 - v) / n for v, n in vals) / len(vals)
    return m, math.sqrt(var), math.sqrt(max(0, var - noise)), math.sqrt(noise)
rk = [(truth[s]['k'], truth[s].get('pa') or truth[s].get('bf') or 0) for s in slots]
print('truth keys', sorted(truth[slots[0]].keys()))
if all(n for _, n in rk): print('real   K mean %.3f sd %.3f true sd %.3f noise sd %.3f' % spread(rk))
for a in sys.argv[2:]:
    c = collections.defaultdict(collections.Counter)
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(a.replace('{league}', lg)):
            if f.count('.jsonl') > 1: continue
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                s = r['scoring']; x = c[slot]
                if s and s != 'plate_appearance_continues': x['pa'] += 1; x['k'] += s == 'strikeout'
                x['sw'] += r['swing']; x['wh'] += r['swing'] and not r['foulOrContact']
    k = spread([(c[s]['k'] / c[s]['pa'], c[s]['pa']) for s in slots]); w = spread([(c[s]['wh'] / c[s]['sw'], c[s]['sw']) for s in slots])
    print(f"{a.split('/')[-1][:24]:24} K mean {k[0]:.3f} sd {k[1]:.3f} true sd {k[2]:.3f} noise sd {k[3]:.3f} | wh/sw mean {w[0]:.3f} sd {w[1]:.3f} true sd {w[2]:.3f}")
