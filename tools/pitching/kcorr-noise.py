# How much the per-pitcher K correlation with the real pitchers moves with the game seeds alone (pitchers fixed): the
# correlation on all seeds, its spread over a seed-only bootstrap, the two halves of the seeds, and how well two arms' per-pitcher
# K agree with each other.
# usage: python -I -X utf8 kcorr-noise.py <truth.json> <arm glob with {league}>...
import collections, glob, json, math, random, sys
truth = json.load(open(sys.argv[1], encoding='utf8')); arms = sys.argv[2:]
slots = sorted(truth)
def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y); d = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / d if d else math.nan
def read(pattern):
    g = collections.defaultdict(collections.Counter)
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(pattern.replace('{league}', lg)):
            if f.count('.jsonl') > 1: continue
            seed = f.rsplit('-', 1)[1].split('.')[0]
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                s = r['scoring']
                if s and s != 'plate_appearance_continues': g[(slot, seed)]['pa'] += 1; g[(slot, seed)]['k'] += s == 'strikeout'
    return g
def kof(g, slot, seeds):
    pa = sum(g[(slot, s)]['pa'] for s in seeds); return sum(g[(slot, s)]['k'] for s in seeds) / pa if pa else math.nan
real = [truth[s]['k'] for s in slots]
data = {}
for a in arms:
    g = read(a); seeds = sorted({s for (_, s) in g}); data[a] = (g, seeds)
    ks = [kof(g, s, seeds) for s in slots]
    rng = random.Random(1); boot = []
    for _ in range(1000):
        pick = [rng.choice(seeds) for _ in seeds]; boot.append(corr([kof(g, s, pick) for s in slots], real))
    boot.sort(); h = len(seeds) // 2
    c1 = corr([kof(g, s, seeds[:h]) for s in slots], real); c2 = corr([kof(g, s, seeds[h:]) for s in slots], real)
    rel = corr([kof(g, s, seeds[:h]) for s in slots], [kof(g, s, seeds[h:]) for s in slots])
    sd_sim = math.sqrt(sum((k - sum(ks) / len(ks)) ** 2 for k in ks) / len(ks))
    print(f"{a.split('/')[-1]:28} seeds {len(seeds)} corr K {corr(ks, real):+.3f}  seed-boot sd {math.sqrt(sum((b - sum(boot) / len(boot)) ** 2 for b in boot) / len(boot)):.3f} "
          f"[{boot[50]:+.2f}, {boot[950]:+.2f}]  halves {c1:+.2f} {c2:+.2f}  split-half reliability of sim K {rel:+.2f}  sd of sim K {sd_sim:.3f}")
names = list(data)
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        (gi, si), (gj, sj) = data[names[i]], data[names[j]]
        print(f"  per-pitcher K agreement {names[i].split('/')[-1]} vs {names[j].split('/')[-1]}: {corr([kof(gi, s, si) for s in slots], [kof(gj, s, sj) for s in slots]):+.2f}")
print(f"sd of real K {math.sqrt(sum((k - sum(real) / len(real)) ** 2 for k in real) / len(real)):.3f}")
