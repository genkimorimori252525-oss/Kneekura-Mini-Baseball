# Count-by-count zone rate (Savant's zone 1-9: ball centre in the zone widened by the ball) against MLB, with K and BB.
# usage: python -I count-zone.py <mlb_count_zone_by_year.csv> <records dir> <tag>... (records <dir>/g-<tag>-*.jsonl)
import csv, glob, json, collections, math, sys
table, folder, tags = sys.argv[1], sys.argv[2], sys.argv[3:]
MLB, W = {}, {}
for r in csv.DictReader(open(table, encoding='utf8')):
    if r['year'] == '2024' and r['pitcher_hand'] == 'ALL' and r['batter_hand'] == 'ALL' and r['pitch_group'] == 'ALL' and r['count'] != 'ALL':
        MLB[r['count']] = int(r['zone_n']) / int(r['pitches']); W[r['count']] = int(r['pitches'])
for t in tags:
    c = collections.defaultdict(lambda: [0, 0]); pa = collections.Counter()
    for f in glob.glob('%s/g-%s-*.jsonl' % (folder, t)):
        for l in open(f):
            r = json.loads(l); s = r['scoring']
            if s and s != 'plate_appearance_continues': pa['pa'] += 1; pa[s] += 1
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; R = .0366; k = '%d-%d' % (r['balls'], r['strikes'])
            c[k][0] += 1; c[k][1] += abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R
    rms = math.sqrt(sum(W[k] * (c[k][1] / c[k][0] - MLB[k]) ** 2 for k in MLB) / sum(W.values()))
    chi = sum((c[k][1] - MLB[k] * c[k][0]) ** 2 / (MLB[k] * (1 - MLB[k]) * c[k][0]) for k in MLB)
    n = sum(v[0] for v in c.values()); zr = sum(v[1] for v in c.values()) / n
    print('%-16s zone %.3f  weighted RMS %.3f  chi2(12) %5.1f  K %.3f BB %.3f PA %d' % (t, zr, rms, chi, pa['strikeout'] / pa['pa'], pa['walk'] / pa['pa'], pa['pa']))
    print('   ' + ' '.join('%s %.2f/%.2f' % (k, c[k][1] / c[k][0], MLB[k]) for k in sorted(MLB)))
