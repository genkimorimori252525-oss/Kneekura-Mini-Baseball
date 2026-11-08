# The noise-free per-pitcher K sd of two arms on the same seeds, with a paired bootstrap over seeds (pitchers fixed) and over
# pitchers and seeds: how far apart the two can be by chance.
# usage: python -I -X utf8 kspread-boot.py <truth.json> <arm A glob with {league}> <arm B glob>
import collections, glob, json, math, random, sys
truth = json.load(open(sys.argv[1], encoding='utf8')); slots = sorted(truth)
def read(a):
    g = collections.defaultdict(collections.Counter)
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(a.replace('{league}', lg)):
            if f.count('.jsonl') > 1: continue
            seed = f.rsplit('-', 1)[1].split('.')[0]
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                s = r['scoring']
                if s and s != 'plate_appearance_continues': g[(slot, seed)]['pa'] += 1; g[(slot, seed)]['k'] += s == 'strikeout'
    return g
def tsd(g, picks):
    vals = []
    for slot, ss in picks:
        pa = sum(g[(slot, s)]['pa'] for s in ss); k = sum(g[(slot, s)]['k'] for s in ss)
        if pa: vals.append((k / pa, pa))
    m = sum(v for v, _ in vals) / len(vals); var = sum((v - m) ** 2 for v, _ in vals) / (len(vals) - 1); noise = sum(v * (1 - v) / n for v, n in vals) / len(vals)
    return math.sqrt(max(0, var - noise))
A, B = read(sys.argv[2]), read(sys.argv[3]); seeds = sorted({s for (_, s) in A} & {s for (_, s) in B})
full = [(s, seeds) for s in slots]; print(f'A {tsd(A, full):.3f}  B {tsd(B, full):.3f}  B-A {tsd(B, full) - tsd(A, full):+.3f}')
rng = random.Random(1)
for name, pick in (('seeds only', lambda: [(s, [rng.choice(seeds) for _ in seeds]) for s in slots]),
                   ('pitchers and seeds', lambda: [(s, [rng.choice(seeds) for _ in seeds]) for s in (rng.choice(slots) for _ in slots)])):
    d = []; a_ = []
    for _ in range(1000):
        p = pick(); x, y = tsd(A, p), tsd(B, p); d.append(y - x); a_.append(x)
    d.sort(); a_.sort()
    print(f'  {name:18} B-A 90% [{d[50]:+.3f}, {d[950]:+.3f}]  P(B<A) {sum(v < 0 for v in d) / len(d):.2f}   A alone 90% [{a_[50]:.3f}, {a_[950]:.3f}]')
