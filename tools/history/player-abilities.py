# Turns one season of NPB batting into game abilities, relative to that season's league.
# usage: python -I player-abilities.py <data-dir> <year> [name-substring ...]
# Curves are measured on the standard league (all hitters alike, 29 m/s). The swing plane and running
# speed are still provisional. The source data stays outside the repository.
import bisect
import csv
import json
import math
import sys

# Strikeout rate to timing error. Measured 2026-11-03 on the standard league with the game's defaults and the late
# adjustment from contact skill alone (lateLookByMeetOnlyV1): 18 games, neighbours pooled. Tops out near 33%.
STRIKEOUT_TIMING = [(.07, .0048), (.125, .00775), (.173, .01), (.26, .0115), (.32, .014)]
# Walk rate to plate vision, same grid conditions as the strikeouts. Walks top out near 11%, short of the best NPB eyes.
WALK_VISION = [(.037, 37), (.057, 60), (.089, 75), (.11, 95)]
REFERENCE_STRIKEOUT, REFERENCE_WALK = .198, .079
# Isolated power to aimed bat speed. At 29 m/s the standard league hits 2.3% home runs, the NPB 2015-24 rate.
# Measured 2026-11-03: 27 to 33 m/s from one mixed league of 18 games, 26 and above 33 from a wider grid.
POWER_SPEED = [(.009, 26), (.039, 27), (.098, 29), (.156, 31), (.207, 33), (.279, 35), (.447, 38)]
LEAGUE_ISO = .098
# Batting average on balls in play to aim error. The standard league aims at .016 m; tighter aim squares
# up more balls, so contact hitters keep their singles without a faster bat.
# Least squares over aim .006/.010/.016/.024 (BABIP .314/.261/.294/.232, 18 games): -3.5 BABIP per metre.
BABIP_PER_AIM = -3.5
LEAGUE_AIM = .016
PRIOR_PA = 100
# Balls in play before a hitter's BABIP counts as half skill, half luck.
PRIOR_BIP = 400


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
    target = interpolate(POWER_SPEED, LEAGUE_ISO * (me['AB'] * iso + PRIOR_PA * iso_lg) / (me['AB'] + PRIOR_PA) / iso_lg)
    bip = me['AB'] - me['SO'] - me['HR'] + me['SF']
    babip_lg = (lg['H'] - lg['HR']) / (lg['AB'] - lg['SO'] - lg['HR'] + lg['SF'])
    babip = ((me['H'] - me['HR']) + babip_lg * PRIOR_BIP) / (bip + PRIOR_BIP)
    aim = max(.005, min(.03, LEAGUE_AIM + (babip - babip_lg) / BABIP_PER_AIM))
    steals = (me['SB'] + me['CS']) / pa / max(.001, (lg['SB'] + lg['CS']) / lg['PA'])
    fly = (me['HR'] + me['SF']) / max(1, me['AB'] - me['SO'])
    fly_lg = (lg['HR'] + lg['SF']) / (lg['AB'] - lg['SO'])
    person = people.get(r['playerID'], {})
    out.append({'playerId': r['playerID'], 'name': person.get('name_jp') or r['playerID'], 'team': r['teamID'], 'pa': int(pa),
                'bats': person.get('bats'), 'heightMeters': round(float(person.get('height_cm') or 175) / 100, 2),
                'timingStdSeconds': round(timing, 5), 'aimStdMeters': round(aim, 4),
                'plateVision': round(interpolate(WALK_VISION, bb_rel)),
                'targetSweetSpotSpeedMps': round(target, 1), 'maximumSweetSpotSpeedMps': round(target / .86, 1),
                'topSpeedMps': round(max(7.2, min(9.2, 8 + .28 * math.log(max(.25, steals)))), 2),
                'attackAngleDegrees': round(max(4, min(24, 12 + 7 * math.log(max(.2, fly / max(.001, fly_lg))))), 1),
                'provisional': ['attackAngleDegrees', 'topSpeedMps']})
if names:
    out = [p for p in out if any(n in p['name'] for n in names)]
for p in out:
    print(json.dumps(p, ensure_ascii=False))
print('players', len(out))
