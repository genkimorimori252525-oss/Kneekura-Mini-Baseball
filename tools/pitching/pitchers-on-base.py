# Puts the pitchers of a league config (e.g. a real-pitcher-spec.py league) onto a base config with the same player ids (e.g.
# the bundle's standard league): each pitcher's physical record, throws and name come from the source; everything else (the
# hitters, policies, park, lift) stays the base's. Measurement only.
# usage: python -I -X utf8 pitchers-on-base.py <base config> <source league config> <out config>
import json, sys
base_path, src_path, out = sys.argv[1:4]
base = json.load(open(base_path, encoding='utf8')); src = json.load(open(src_path, encoding='utf8'))
for c, path in ((base, base_path), (src, src_path)):
    if isinstance(c.get('measuredClips'), (list, dict)):   # write copies from a shared base (tools/calibration/clips-ref.mjs)
        sys.exit('the measured clips are inline; share them first: node tools/calibration/clips-ref.mjs ' + path)
pitchers = {team['pitcherId'] for team in base['teams']}
assert pitchers == {team['pitcherId'] for team in src['teams']}, 'the two configs name different pitchers'
by_id = {p['playerId']: p for p in src['players']}
for p in base['players']:
    if p['playerId'] not in pitchers: continue
    s = by_id[p['playerId']]
    for k in ('physical', 'throws', 'name'):
        if k in s: p[k] = s[k]
        else: p.pop(k, None)
json.dump(base, open(out, 'w', encoding='utf8', newline='\n'), ensure_ascii=False)
print('pitchers from', src_path, sorted(pitchers))
