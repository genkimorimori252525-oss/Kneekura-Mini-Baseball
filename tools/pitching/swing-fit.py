# One line per arm for the swing decision's refit: K, BB, HR per PA, the zone share, in/out-of-zone swing and whiff (Savant's
# zone widened by the ball), the breaking balls' out-of-zone whiff, the misread share of in- and out-of-zone swings, and the
# contact made on in-zone swings (contact per swing, HR per contact, mean exit speed), so a refit can be seen not to cost
# contact quality.
# The breaking balls' in-zone whiff is shown too (BR z-wh).
# usage: python -I -X utf8 swing-fit.py "<records glob>"...
import collections, glob, json, sys

R = .0366
BR = {'slider', 'sweeper', 'curve', 'knuckle_curve', 'slurve'}
print('arm            PA     K    BB   HR/PA  zone  z-sw  z-wh  o-sw  o-wh  BR z-wh BR o-wh  mis|z-sw mis|o-sw  z-ct  HR/ct  exit')
for pattern in sys.argv[1:]:
    c = collections.Counter()
    for f in glob.glob(pattern):
        if f.count('.jsonl') > 1: continue   # an instrumented build's side records (<game>.jsonl.pl.jsonl)
        for line in open(f, encoding='utf8'):
            r = json.loads(line); s = r['scoring']
            if s and s != 'plate_appearance_continues': c['pa'] += 1; c['k'] += s == 'strikeout'; c['bb'] += s == 'walk'
            c['hr'] += bool(r['homeRuns'])
            if r['x'] is None or not r['zone']: continue
            z = r['zone']; side = 'z' if abs(r['x']) <= z['half'] + R and z['low'] - R <= r['y'] <= z['high'] + R else 'o'
            whiff = r['swing'] and not r['foulOrContact']; mis = bool(r.get('recog')) and not r['recog']['ok']
            c[side] += 1; c[side + 'sw'] += r['swing']; c[side + 'wh'] += whiff; c[side + 'mis'] += r['swing'] and mis
            if r['pitch'] in BR: c[f'br{side}sw'] += r['swing']; c[f'br{side}wh'] += whiff
            if side == 'z' and r['swing'] and r['foulOrContact']:
                c['zct'] += 1; c['zcthr'] += bool(r['homeRuns'])
                if r['exit']: c['zexit'] += r['exit']['kmh']; c['zexitn'] += 1
    if not c['pa']: continue
    name = pattern.replace('\\', '/').split('/')[-1].split('-*')[0]
    print(f"{name:12} {c['pa']:5}  {c['k'] / c['pa']:.3f} {c['bb'] / c['pa']:.3f} {c['hr'] / c['pa']:.4f}  {c['z'] / (c['z'] + c['o']):.3f} "
          f"{c['zsw'] / c['z']:.3f} {c['zwh'] / c['zsw']:.3f} {c['osw'] / c['o']:.3f} {c['owh'] / c['osw']:.3f}  {c['brzwh'] / max(1, c['brzsw']):.3f}  {c['browh'] / max(1, c['brosw']):.3f}"
          f"    {c['zmis'] / c['zsw']:.3f}    {c['omis'] / c['osw']:.3f}   {c['zct'] / c['zsw']:.3f} {c['zcthr'] / max(1, c['zct']):.4f} {c['zexit'] / max(1, c['zexitn']):.1f}")
print('MLB 2024                       .495  .678  .174  .286  .438  .183   .565')
