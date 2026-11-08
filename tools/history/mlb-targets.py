# One MLB season of hitters from the Lahman database, as stat targets for ability-fit.py invert.
# usage: python -I mlb-targets.py <lahman-dir> <year> <min-pa> <out.json>
# Rates are per plate appearance (PA = AB + BB + HBP + SF + SH); BABIP leaves out home runs and strikeouts.
# The source data stays outside the repository.
import csv
import json
import sys

lahman, year, min_pa, out_path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
num = lambda r, k: float(r.get(k) or 0)
season = {}
for r in csv.DictReader(open(f'{lahman}/Batting.csv', encoding='utf8')):
    if r['yearID'] != year:
        continue
    row = season.setdefault(r['playerID'], {k: 0. for k in ('AB', 'H', '2B', '3B', 'HR', 'BB', 'IBB', 'SO', 'HBP', 'SF', 'SH', 'SB', 'CS')})
    for k in row:
        row[k] += num(r, k)
people = {p['playerID']: p for p in csv.DictReader(open(f'{lahman}/People.csv', encoding='utf8'))}
targets, league = {}, {k: 0. for k in ('pa', 'so', 'bb', 'hr', 'ab', 'h', 'tb', 'sf')}
for pid, b in season.items():
    pa = b['AB'] + b['BB'] + b['HBP'] + b['SF'] + b['SH']
    tb = b['H'] + b['2B'] + 2 * b['3B'] + 3 * b['HR']
    for k, v in (('pa', pa), ('so', b['SO']), ('bb', b['BB']), ('hr', b['HR']), ('ab', b['AB']), ('h', b['H']), ('tb', tb), ('sf', b['SF'])):
        league[k] += v
    if pa < min_pa or b['AB'] <= 0:
        continue
    person = people.get(pid, {})
    targets[pid] = {'name': (person.get('nameFirst', '') + ' ' + person.get('nameLast', '')).strip(), 'bats': person.get('bats'),
                    'pa': int(pa), 'k': b['SO'] / pa, 'bb': b['BB'] / pa, 'hr': b['HR'] / pa, 'iso': (tb - b['H']) / b['AB'],
                    'babip': (b['H'] - b['HR']) / max(1, b['AB'] - b['SO'] - b['HR'] + b['SF']), 'avg': b['H'] / b['AB'],
                    'sb': b['SB'], 'cs': b['CS']}
json.dump(targets, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
L = league
print('hitters', len(targets), '| league K %.3f BB %.3f HR %.3f AVG %.3f ISO %.3f BABIP %.3f' % (L['so'] / L['pa'], L['bb'] / L['pa'], L['hr'] / L['pa'], L['h'] / L['ab'],
      (L['tb'] - L['h']) / L['ab'], (L['h'] - L['hr']) / (L['ab'] - L['so'] - L['hr'] + L['sf'])))
