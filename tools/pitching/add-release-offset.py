# Gives every pitch of a league config a releaseOffsetV1 [toward the arm, up, toward home] in metres: the Statcast release of
# its pitch type less the pitcher's pitch-weighted mean release (rows with 100+ pitches), so that a pitch type's tell is the one
# MLB pitchers show. A pitch fitted from one pitcher (source id statcast-<mlbam id>-<year>-<type>) takes that pitcher's own
# offset; any other takes the league's pitch-weighted mean offset of its type. Then each pitcher's offsets are centred on his
# usage weights, so his mean release stays where it is. Pitch types without data get no offset.
# usage: python -I -X utf8 add-release-offset.py <mlb_pitch_type_player_year.csv> <year> <in config> <out config> [--scale=1]
import collections, csv, json, math, re, sys
table, year, src, out = sys.argv[1:5]
scale = float(next((a.split('=')[1] for a in sys.argv[5:] if a.startswith('--scale=')), 1))
FT = .3048
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'slurve': 'SV', 'curve': 'CU',
        'knuckle_curve': 'KC', 'slow_curve': 'CS', 'changeup': 'CH', 'splitter': 'FS', 'forkball': 'FO', 'screwball': 'SC'}
def num(r, k):
    try: return float(r[k])
    except (ValueError, KeyError): return math.nan
KEYS = ('rel_side_ft', 'rel_height_ft', 'extension_ft')
rows = [r for r in csv.DictReader(open(table, encoding='utf8')) if r['year'] == year and r['sample'] == 'pitches>=100'
        and all(math.isfinite(num(r, k)) for k in KEYS + ('pitches',))]
by_pitcher = collections.defaultdict(list)
for r in rows: by_pitcher[r['mlbam_id']].append(r)
own, league = {}, collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
for pid, rs in by_pitcher.items():
    if len(rs) < 2: continue
    w = sum(num(r, 'pitches') for r in rs)
    mean = [sum(num(r, 'pitches') * num(r, k) for r in rs) / w for k in KEYS]
    for r in rs:
        d = [(num(r, k) - mean[i]) * FT for i, k in enumerate(KEYS)]   # the table's side is arm-side +, extension toward home +
        own[(pid, r['pitch_type'])] = d
        t = league[r['pitch_type']]; n = num(r, 'pitches'); t[0] += n
        for i in range(3): t[i + 1] += n * d[i]
league = {k: [v[i] / v[0] for i in (1, 2, 3)] for k, v in league.items() if v[0] > 0}
cfg = json.load(open(src, encoding='utf8'))
if isinstance(cfg.get('measuredClips'), (list, dict)):   # write copies from a shared base (tools/calibration/clips-ref.mjs)
    sys.exit('the measured clips are inline; share them first: node tools/calibration/clips-ref.mjs ' + src)
done = collections.Counter()
for p in cfg['players']:
    rep = p.get('physical', {}).get('pitchRepertoireV78')
    if not rep: continue
    got = []
    for pitch in rep['pitches']:
        m = re.match(r'statcast-(\d+)-(\d{4})-(\w+)$', pitch.get('source', {}).get('id', ''))
        code = m.group(3) if m else CODE.get(pitch['pitchType'])
        d = (own.get((m.group(1), m.group(3))) if m else None) or league.get(code)
        if d: got.append((pitch, d, pitch.get('usageWeightV1', 1)))
    w = sum(g[2] for g in got)
    if not w: continue
    centre = [sum(g[2] * g[1][i] for g in got) / w for i in range(3)]
    for pitch, d, _ in got:
        pitch['releaseOffsetV1'] = [round(max(-.15, min(.15, scale * (d[i] - centre[i]))), 4) for i in range(3)]
        done[pitch['pitchType']] += 1
json.dump(cfg, open(out, 'w', encoding='utf8', newline='\n'), ensure_ascii=False)
print('releaseOffsetV1 on', dict(done))
