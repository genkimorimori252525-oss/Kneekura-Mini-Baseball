# Swing-and-miss against MLB 2024 from playthrough records: K, BB, whiff per swing, CSW, chase, whiffs in and out of Savant's
# zone (ball centre in the zone widened by the ball), the share of swings on misread pitches, and per pitch type whiff per
# swing with its RMS against Savant (weighted by swings).
# usage: python -I whiff-score.py <records dir> <tag>...
import glob, json, math, sys, collections
R = .0366
CODE = {'fastball': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'slider': 'SL', 'sweeper': 'ST', 'curve': 'CU', 'changeup': 'CH', 'splitter': 'FS'}
SAVANT = {'fastball': .219, 'sinker': .136, 'cutter': .234, 'slider': .341, 'sweeper': .317, 'curve': .313, 'changeup': .312, 'splitter': .348}
MLB = 'K .226 BB .082 wh/sw .253 CSW .285 oSw .286 zWh .174 oWh .438'
folder, tags = sys.argv[1], sys.argv[2:]
print('MLB 2024'.ljust(18), MLB)
for t in tags:
    a = collections.Counter(); ty = collections.defaultdict(collections.Counter)
    for f in glob.glob('%s/g-%s-*.jsonl' % (folder, t)):
        for l in open(f):
            r = json.loads(l); s = r['scoring']
            if s and s != 'plate_appearance_continues': a['pa'] += 1; a[s] += 1
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; inz = abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R
            sw, wh = r['swing'], r['swing'] and not r['foulOrContact']
            a['n'] += 1; a['sw'] += sw; a['wh'] += wh; a['cs'] += (not sw) and r['call'] == 'called_strike'
            a['out'] += not inz; a['osw'] += sw and not inz; a['owh'] += wh and not inz; a['zsw'] += sw and inz; a['zwh'] += wh and inz
            a['mis'] += sw and r.get('recog') is not None and not r['recog']['ok']
            ty[r['pitch']]['sw'] += sw; ty[r['pitch']]['wh'] += wh
    rms = math.sqrt(sum(ty[k]['sw'] * (ty[k]['wh'] / ty[k]['sw'] - v) ** 2 for k, v in SAVANT.items() if ty[k]['sw']) / sum(ty[k]['sw'] for k in SAVANT))
    print(t.ljust(18), 'K %.3f BB %.3f wh/sw %.3f CSW %.3f oSw %.3f zWh %.3f oWh %.3f misread %.2f typeRMS %.3f PA %d' % (
        a['strikeout'] / a['pa'], a['walk'] / a['pa'], a['wh'] / a['sw'], (a['wh'] + a['cs']) / a['n'], a['osw'] / a['out'],
        a['zwh'] / a['zsw'], a['owh'] / a['osw'], a['mis'] / a['sw'], rms, a['pa']))
    print(' ' * 18, ' '.join('%s %.3f/%.3f' % (CODE[k], ty[k]['wh'] / max(1, ty[k]['sw']), v) for k, v in SAVANT.items()))
