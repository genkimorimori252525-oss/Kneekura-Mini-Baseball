# Gives every pitch of every pitcher in a league config an aimCenterV1 (toward the arm side in metres, above the zone's middle in
# zone half-heights): the MLB mean location of its pitch type (fetch-miss-direction.py's missloc table) less the match's own
# mean location of that type without it (loc-centroid.py output saved as JSON {pitchType: [arm, up]}), so that the plan's spot
# moved by it lands where MLB pitches of that type land on average. Pitch types missing from either side get no aimCenterV1.
# usage: python -I -X utf8 add-aim-center.py <missloc csv> <match centroid json> <in config> <out config>
import csv, collections, json, sys
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH',
        'splitter': 'FS', 'knuckle_curve': 'KC', 'slurve': 'SV', 'knuckleball': 'KN', 'forkball': 'FO'}
mlb = collections.defaultdict(lambda: [0, 0.0, 0.0])
for r in csv.DictReader(open(sys.argv[1], encoding='utf8')):
    t = mlb[r['pitch_type']]; t[0] += int(r['n']); t[1] += float(r['arm']) * .3048; t[2] += float(r['up'])
match = json.load(open(sys.argv[2], encoding='utf8'))
cfg = json.load(open(sys.argv[3], encoding='utf8')); done = collections.Counter()
for p in cfg['players']:
    rep = p.get('physical', {}).get('pitchRepertoireV78')
    if not rep: continue
    for row in rep['pitches']:
        code = CODE.get(row['pitchType']); m = mlb.get(code); s = match.get(row['pitchType'])
        if not m or not m[0] or s is None: continue
        row['aimCenterV1'] = [round(m[1] / m[0] - s[0], 4), round(m[2] / m[0] - s[1], 4)]; done[row['pitchType']] += 1
json.dump(cfg, open(sys.argv[4], 'w', encoding='utf8'), ensure_ascii=False)
print('aimCenterV1 on', dict(done))
