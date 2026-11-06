# The standard league with pitchers who own a real-sized repertoire instead of every pitch of the league (measurement only).
# Each standard pitcher owns the whole league mix (9 pitch types), so the hitter weighs more look-alikes than against any real
# pitcher and misreads more. Here n league copies each give their two pitchers (R and L) the pitch-type set of a real pitcher of
# that hand and year (pitches >= 1000, shares under 3% dropped), with the standard league's own pitches (speed, spin, zone and
# count usage kept as they are); only which pitches are owned and their usage weights change. The n real pitchers per hand are
# the seeded draw whose mean share is nearest the standard mix, then the weights are scaled per pitch type (iterative
# proportional fitting) so that the n pitchers together throw the standard mix.
# usage: python -I -X utf8 standard-archetypes.py <standard cfg.json> <mlb_pitch_type_player_year.csv> <out prefix> [n=6] [year=2024] [seed=1]
#   writes <out prefix>-<i>.json and prints each pitcher's set and the mix against the standard one.
import csv, json, random, sys, collections
base_path, table, out = sys.argv[1:4]
n = int(sys.argv[4]) if len(sys.argv) > 4 else 6
year = sys.argv[5] if len(sys.argv) > 5 else '2024'
rng = random.Random(int(sys.argv[6]) if len(sys.argv) > 6 else 1)
CODE = {'FF': 'FF', 'SI': 'SI', 'FT': 'SI', 'FC': 'FC', 'SL': 'SL', 'ST': 'ST', 'SV': 'ST', 'CU': 'CU', 'CS': 'CU', 'KC': 'KC',
        'CH': 'CH', 'SC': 'CH', 'FS': 'FS', 'FO': 'FS'}
base = json.load(open(base_path, encoding='utf8'))
if isinstance(base.get('measuredClips'), (list, dict)):   # write copies from a shared base (tools/calibration/clips-ref.mjs)
    sys.exit('the measured clips are inline; share them first: node tools/calibration/clips-ref.mjs ' + base_path)
pitchers = [p for p in base['players'] if '-p' in p['playerId']]
std = {}
for p in pitchers:
    rows = p['physical']['pitchRepertoireV78']['pitches']
    std[p['throws']] = {r['pitchId'].rsplit('-', 1)[1]: r for r in rows}
real = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
for r in csv.DictReader(open(table, encoding='utf8')):
    if r['year'] != year or r['pitch_type'] not in CODE: continue
    real[r['throws']][r['mlbam_id']][CODE[r['pitch_type']]] += float(r['pitches'] or 0)
def shares(c):
    t = sum(c.values()); s = {k: v / t for k, v in c.items() if v / t >= .03}; u = sum(s.values())
    return {k: v / u for k, v in s.items()}
picked = {}
for hand, rows in std.items():
    target = {k: r['usageWeightV1'] for k, r in rows.items()}; tt = sum(target.values()); target = {k: v / tt for k, v in target.items()}
    pool = [shares(c) for c in real[hand].values() if sum(c.values()) >= 1000]
    pool = [s for s in pool if set(s) <= set(rows)]
    best = None
    for _ in range(20000):
        draw = rng.sample(pool, n)
        mean = {k: sum(s.get(k, 0) for s in draw) / n for k in target}
        if any(mean[k] == 0 for k in target): continue
        err = sum(abs(mean[k] - target[k]) for k in target)
        if best is None or err < best[0]: best = (err, draw)
    draw = [dict(s) for s in best[1]]
    for _ in range(200):  # scale each pitch type so the n pitchers throw the standard mix, each pitcher's shares summing to 1
        mean = {k: sum(s.get(k, 0) for s in draw) / n for k in target}
        for s in draw:
            for k in s: s[k] *= target[k] / mean[k]
            u = sum(s.values())
            for k in s: s[k] /= u
    picked[hand] = draw
    mean = {k: sum(s.get(k, 0) for s in draw) / n for k in target}
    print(f'{hand}: pool {len(pool)}  drawn mean before scaling L1 {best[0]:.3f}  after: ' + ' '.join(f'{k} {mean[k]:.3f}/{target[k]:.3f}' for k in target))
    for i, s in enumerate(draw): print(f'  {hand}{i} {len(s)} pitches: ' + ' '.join(f'{k}{v * 100:.0f}' for k, v in sorted(s.items(), key=lambda kv: -kv[1])))
for i in range(n):
    cfg = json.loads(json.dumps(base))
    for p in cfg['players']:
        if '-p' not in p['playerId']: continue
        s = picked[p['throws']][i]; rows = std[p['throws']]
        p['physical']['pitchRepertoireV78']['pitches'] = [{**rows[k], 'usageWeightV1': round(s[k] * 100, 3)} for k in rows if k in s]
    json.dump(cfg, open(f'{out}-{i}.json', 'w', encoding='utf8'), ensure_ascii=False)
print('wrote', n, 'leagues')
