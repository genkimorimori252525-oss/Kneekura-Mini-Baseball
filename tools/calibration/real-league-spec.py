# Picks 18 real hitters spread over power and strikeouts from a targets file, inverts their abilities on a response
# surface, and writes a kbm-maker spec that puts them into the 18 batting slots of the standard league.
# usage: python -I -X utf8 real-league-spec.py <targets.json> <surface.json> <base-config.json> <spec-out.json> <truth-out.json>
import importlib.util
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('af', os.path.join(here, 'ability-fit.py'))
af = importlib.util.module_from_spec(spec)
sys.argv, args = ['x'], sys.argv[1:]
spec.loader.exec_module(af)
targets_path, surface_path, base_path, spec_out, truth_out = args
targets = json.load(open(targets_path, encoding='utf8'))
surface = json.load(open(surface_path))
pool = [(pid, t) for pid, t in targets.items() if t['pa'] >= 400]
picked = []
for group in (sorted(pool, key=lambda x: -x[1]['iso']), sorted(pool, key=lambda x: x[1]['iso']), sorted(pool, key=lambda x: -x[1]['k']), sorted(pool, key=lambda x: x[1]['k'])):
    taken = 0
    for item in group:
        if taken < 5 and item[0] not in [p[0] for p in picked]:
            picked.append(item); taken += 1
picked = picked[:18]
tmp = {pid: {k: t[k] for k in ('pa', 'k', 'bb', 'iso', 'babip', 'hr')} for pid, t in picked}
json.dump(tmp, open(truth_out + '.targets', 'w'))
af.invert(surface_path, truth_out + '.targets', truth_out + '.inv')
inv = json.load(open(truth_out + '.inv'))
base = json.load(open(base_path, encoding='utf8'))
slots = [b for team in base['teams'] for b in team['battingOrder']]
spec_doc, truth = {'players': {}}, {}
for slot, (pid, t) in zip(slots, picked):
    a = inv[pid]['abilities']
    spec_doc['players'][slot] = {'name': t['name'], **({'bats': t['bats']} if t.get('bats') in ('R', 'L') else {}),
                                 'abilities': {k: a[k] for k in ('contact', 'power', 'vision', 'run')}, 'attackAngleDegrees': a['attackAngleDegrees']}
    truth[slot] = {'source': pid, 'name': t['name'], **{k: t[k] for k in ('pa', 'k', 'bb', 'iso', 'babip', 'hr', 'avg')}, 'abilities': a, 'predicted': inv[pid]['predicted']}
json.dump(spec_doc, open(spec_out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(truth, open(truth_out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for slot, t in truth.items():
    print(slot, t['name'][:18].ljust(18), 'abil', {k: round(v) for k, v in t['abilities'].items()})
