# Per-pitcher K estimated from the pitch outcomes instead of the plate appearances that ended in a strikeout: per pitcher the
# share of pitches that are a ball, a strike (called or whiffed, or a foul short of two strikes), a foul at two strikes, or end
# the plate appearance otherwise (in play, hit by pitch), each by count group (0, 1 or 2 strikes); K is then walked through the
# count. Split-half reliability and correlation with the real K, against the plain K and whiff/swing.
# usage: python -I -X utf8 kcorr-markov.py <truth.json> <arm glob with {league}>...
import collections, glob, json, math, sys
truth = json.load(open(sys.argv[1], encoding='utf8')); slots = sorted(truth)
def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y); d = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / d if d else math.nan
def read(pattern):
    g = collections.defaultdict(collections.Counter)
    for slot in slots:
        lg, pid = slot.split('/')
        for f in glob.glob(pattern.replace('{league}', lg)):
            if f.count('.jsonl') > 1: continue
            seed = f.rsplit('-', 1)[1].split('.')[0]; c = g[(slot, seed)]
            for line in open(f, encoding='utf8'):
                r = json.loads(line)
                if r['pitcher'] != pid: continue
                s = r['scoring']; st = r['strikes']; ends = bool(s) and s != 'plate_appearance_continues'
                if ends: c['pa'] += 1; c['k'] += s == 'strikeout'
                c['sw'] += r['swing']; c['wh'] += r['swing'] and not r['foulOrContact']
                if s in ('strikeout', 'walk'): kind = 's' if s == 'strikeout' else 'b'
                elif ends: kind = 'x'
                elif r['call'] in ('called_strike', 'swinging_strike') or r.get('foulTip'): kind = 's'
                elif r['play'] == 'foul': kind = 'f' if st == 2 else 's'
                else: kind = 'b'
                c[(st, kind)] += 1
    return g
def markov(c):
    p = {}
    for st in range(3):
        n = sum(c[(st, k)] for k in 'sbfx')
        if not n: return math.nan
        p[st] = {k: c[(st, k)] / n for k in 'sbfx'}
    from functools import lru_cache
    @lru_cache(None)
    def K(b, s):
        if s == 3: return 1.0
        if b == 4: return 0.0
        q = p[s]; stay = q['f']; go = 1 - stay
        return (q['s'] * K(b, s + 1) + q['b'] * K(b + 1, s)) / go if go > 0 else 0.0
    return K(0, 0)
def agg(g, slot, seeds):
    c = collections.Counter()
    for s in seeds: c.update(g.get((slot, s), {}))
    return c
real = [truth[s]['k'] for s in slots]
for a in sys.argv[2:]:
    g = read(a); seeds = sorted({s for (_, s) in g}); h = len(seeds) // 2
    out = []
    for name, f in (('K', lambda c: c['k'] / c['pa']), ('wh/sw', lambda c: c['wh'] / c['sw']), ('pitch-K', markov)):
        full = [f(agg(g, s, seeds)) for s in slots]; A = [f(agg(g, s, seeds[:h])) for s in slots]; B = [f(agg(g, s, seeds[h:])) for s in slots]
        out.append(f"{name} corr {corr(full, real):+.2f} halves {corr(A, real):+.2f}/{corr(B, real):+.2f} rel {corr(A, B):+.2f}")
    print(a.split('/')[-1][:22], ' | '.join(out))
