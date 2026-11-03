# Builds a mixed league for ability response curves: the 18 batters take the listed values in turn, so one
# set of games measures every value at once. A single value sets every batter (a standard league).
# usage: python -I grid.py <base-config.json> <out-config.json> <out-map.json> key=v1,v2,... [key=v1,v2,...]
# Several keys pair up value by value, e.g. targetSweetSpotSpeedMps=27,29 timingStdSeconds=.008,.012 gives 4 cells.
import itertools
import json
import sys

base, out, out_map, *specs = sys.argv[1:]
config = json.load(open(base, encoding='utf8'))
keys = [s.split('=', 1)[0] for s in specs]
values = [[float(v) for v in s.split('=', 1)[1].split(',')] for s in specs]
cells = list(itertools.product(*values))
batters = [b for team in config['teams'] for b in team['battingOrder']]
by = {p['playerId']: p for p in config['players']}
# Spread the cells so no lineup slot or team owns one value.
order = [cells[(i * 7) % len(cells)] if len(cells) % 7 else cells[i % len(cells)] for i in range(len(batters))]
mapping = {}
for pid, cell in zip(batters, order):
    physical = by[pid]['physical']
    for key, value in zip(keys, cell):
        physical[key] = value
        if key == 'targetSweetSpotSpeedMps':
            physical['maximumSweetSpotSpeedMps'] = round(value / .86, 2)
    mapping[pid] = list(cell) if len(cell) > 1 else cell[0]
json.dump(config, open(out, 'w', encoding='utf8'), ensure_ascii=False)
json.dump(mapping, open(out_map, 'w'))
print({k: sum(1 for v in mapping.values() if v == k or v == list(k)) for k in cells} if len(cells) > 1 else 'all batters set')
