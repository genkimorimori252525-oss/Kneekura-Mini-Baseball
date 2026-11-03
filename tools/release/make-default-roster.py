# Builds the private default roster from the owner's maker export.
# usage: python -I make-default-roster.py <export.json> <current-roster.json> <out.json>
# The output holds the owner's own data, so it belongs under release/game/assets, not in git.
# Values the export has win. Fields added after the export keep the current default.
import json
import sys

source, current, out = sys.argv[1:4]
exported = json.load(open(source, encoding='utf8'))
exported = exported.get('livePhysicalRoster', exported)
base = {e['playerId']: e for e in json.load(open(current, encoding='utf8'))['entries']}
for entry in exported['entries']:
    for key, value in base[entry['playerId']]['physical'].items():
        entry['physical'].setdefault(key, value)
json.dump(exported, open(out, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('roster', exported['sourceId'][:60], len(exported['entries']))
