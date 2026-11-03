# Batted-ball outcome table from full-game records: for each ball in play, the bases its neighbours in exit speed,
# launch angle and spray earned. Lets a fielding-free run (--skipField=1) be scored without the slow field play.
# usage: python -I outcome-table.py build "<records glob>" <table.json>
#        python -I outcome-table.py check <table.json> "<records glob>"   (predicted vs actual, per batter and overall)
import collections
import glob
import json
import math
import sys

BW = {'ev': 4.0, 'la': 5.0, 'spray': 10.0}   # kernel widths: mph, degrees, degrees


def balls(pattern):
    for f in glob.glob(pattern):
        for line in open(f):
            r = json.loads(line)
            if r.get('exit') and r['play'] != 'foul' and r.get('scoring') and r['scoring'] not in ('plate_appearance_continues', 'unresolved'):
                yield r


def key(r):
    return (r['exit']['kmh'] / 1.609344, r['exit']['launch'], r['exit']['spray'])


def bases(r):
    return 4 if r['hitBases'] == 4 or (r['homeRuns'] or 0) > 0 else (r['hitBases'] or 0)


def build(pattern, out):
    rows = [(*key(r), bases(r)) for r in balls(pattern)]
    json.dump({'bandwidth': BW, 'rows': [[round(a, 2), round(b, 2), round(c, 2), d] for a, b, c, d in rows]}, open(out, 'w'))
    print('balls', len(rows))


def predictor(table):
    rows = table['rows']
    bw = table['bandwidth']
    def predict(ev, la, spray, skip=None):
        w = [0.0] * 5
        for i, (a, b, c, d) in enumerate(rows):
            if skip is not None and i == skip:
                continue
            z = ((a - ev) / bw['ev']) ** 2 + ((b - la) / bw['la']) ** 2 + ((c - spray) / bw['spray']) ** 2
            if z < 9:
                w[d] += math.exp(-z / 2)
        s = sum(w) or 1
        return [x / s for x in w]
    return predict


def check(table_path, pattern):
    table = json.load(open(table_path))
    predict = predictor(table)
    index = {(a, b, c): i for i, (a, b, c, _) in enumerate(table['rows'])}
    by = collections.defaultdict(lambda: [0, 0.0, 0, 0.0, 0, 0.0, 0])
    for r in balls(pattern):
        ev, la, sp = key(r)
        skip = index.get((round(ev, 2), round(la, 2), round(sp, 2)))   # leave the ball itself out
        p = predict(ev, la, sp, skip)
        got = bases(r)
        for k in (r['batter'], 'ALL'):
            row = by[k]
            row[0] += 1; row[1] += 1 - p[0]; row[2] += got > 0; row[3] += sum(i * p[i] for i in range(5)); row[4] += got; row[5] += p[4]; row[6] += got == 4
    print('who        BIP  hit pred/actual   bases pred/actual   HR pred/actual')
    for k, (n, ph, ah, pb, ab, phr, ahr) in sorted(by.items(), key=lambda kv: -kv[1][0]):
        print(f'{k:10} {n:4d}  {ph / n:.3f}/{ah / n:.3f}       {pb / n:.3f}/{ab / n:.3f}        {phr / n:.3f}/{ahr / n:.3f}')


if __name__ == '__main__':
    if sys.argv[1] == 'build':
        build(sys.argv[2], sys.argv[3])
    else:
        check(sys.argv[2], sys.argv[3])
