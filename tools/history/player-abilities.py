# Turns one season of NPB batting into game abilities, relative to that season's league.
# usage: python -I player-abilities.py <data-dir> <year> [name-substring ...]
# Curves are measured on the standard league. Power and the swing plane are provisional until the
# defense calibration fixes the home run rate. The source data stays outside the repository.
import bisect
import csv
import json
import math
import sys

# Strikeout rate to timing error, from the response grid on the standard league.
STRIKEOUT_TIMING = [(.075, .0045), (.098, .006), (.165, .008), (.30, .011), (.36, .014)]
# Walk rate to plate vision, from the swing threshold grid and visionSelectivityV1.
WALK_VISION = [(.06, 32), (.085, 70), (.12, 100)]
REFERENCE_STRIKEOUT, REFERENCE_WALK = .198, .079
# Aimed bat speed of an average NPB hitter. 28 to 30 m/s brackets the 2020s home run rate of 2.0%.
REFERENCE_SWING_SPEED = 29
PRIOR_PA = 100


def interpolate(points, x):
    xs = [p[0] for p in points]
    if x <= xs[0]:
        return points[0][1]
    if x >= xs[-1]:
        return points[-1][1]
    i = bisect.bisect_right(xs, x)
    (x0, y0), (x1, y1) = points[i - 1], points[i]
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def regressed(count, pa, league_rate):
    return (count + league_rate * PRIOR_PA) / (pa + PRIOR_PA)


data, year, *names = sys.argv[1:]
people = {p['playerID']: p for p in csv.DictReader(open(f'{data}/players.csv', encoding='utf8'))}
rows = [r for r in csv.DictReader(open(f'{data}/batting.csv', encoding='utf8')) if r['yearID'] == year]
num = lambda r, k: float(r[k] or 0)
league = {}
for r in rows:
    group = league.setdefault(r['lgID'], {k: 0. for k in ('PA', 'AB', 'H', '2B', '3B', 'HR', 'BB', 'SO', 'SB', 'CS', 'SF', 'GIDP')})
    for key in group:
        group[key] += num(r, key)
out = []
for r in rows:
    lg, pa = league[r['lgID']], num(r, 'PA')
    if pa < 100:
        continue
    k_lg, bb_lg = lg['SO'] / lg['PA'], lg['BB'] / lg['PA']
    tb = lambda s: s['H'] + s['2B'] + 2 * s['3B'] + 3 * s['HR']
    me = {k: num(r, k) for k in lg}
    iso, iso_lg = (tb(me) - me['H']) / max(1, me['AB']), (tb(lg) - lg['H']) / lg['AB']
    k_rel = regressed(me['SO'], pa, k_lg) / max(.01, k_lg) * REFERENCE_STRIKEOUT
    bb_rel = regressed(me['BB'], pa, bb_lg) / max(.01, bb_lg) * REFERENCE_WALK
    timing = interpolate(STRIKEOUT_TIMING, k_rel)
    target = max(25, min(46, REFERENCE_SWING_SPEED * (max(.02, iso) / iso_lg) ** .25))
    steals = (me['SB'] + me['CS']) / pa / max(.001, (lg['SB'] + lg['CS']) / lg['PA'])
    fly = (me['HR'] + me['SF']) / max(1, me['AB'] - me['SO'])
    fly_lg = (lg['HR'] + lg['SF']) / (lg['AB'] - lg['SO'])
    person = people.get(r['playerID'], {})
    out.append({'playerId': r['playerID'], 'name': person.get('name_jp') or r['playerID'], 'team': r['teamID'], 'pa': int(pa),
                'bats': person.get('bats'), 'heightMeters': round(float(person.get('height_cm') or 175) / 100, 2),
                'timingStdSeconds': round(timing, 5), 'aimStdMeters': round(timing * 2, 4),
                'plateVision': round(interpolate(WALK_VISION, bb_rel)),
                'targetSweetSpotSpeedMps': round(target, 1), 'maximumSweetSpotSpeedMps': round(target / .86, 1),
                'topSpeedMps': round(max(7.2, min(9.2, 8 + .28 * math.log(max(.25, steals)))), 2),
                'attackAngleDegrees': round(max(4, min(24, 12 + 7 * math.log(max(.2, fly / max(.001, fly_lg))))), 1),
                'provisional': ['targetSweetSpotSpeedMps', 'maximumSweetSpotSpeedMps', 'attackAngleDegrees', 'topSpeedMps']})
if names:
    out = [p for p in out if any(n in p['name'] for n in names)]
for p in out:
    print(json.dumps(p, ensure_ascii=False))
print('players', len(out))
