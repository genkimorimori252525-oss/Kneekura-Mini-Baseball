# Summarises NPB league seasons into the environment targets for calibration.
# usage: python -I npb-env-target.py <league_seasons.csv> [span_years]
# The source data stays outside the repository. Only this reader is tracked.
import csv
import sys

rows = [r for r in csv.DictReader(open(sys.argv[1], encoding='utf8')) if r['league'] != 'NPB' or int(r['year']) < 1950]
span = int(sys.argv[2]) if len(sys.argv) > 2 else 10
buckets = {}
for r in rows:
    buckets.setdefault(int(r['year']) // span * span, []).append(r)
print('from   AVG   OBP   SLG  BABIP  K%   BB%   HR%   R/G')
for start in sorted(buckets):
    group = buckets[start]
    total = lambda key: sum(float(r[key]) for r in group)
    ab, h, hr, so, bb, hbp, sf, pa = (total(k) for k in ('AB', 'H', 'HR', 'SO', 'BB', 'HBP', 'SF', 'PA_noSH'))
    tb = h + total('2B') + 2 * total('3B') + 3 * hr
    print(f"{start}  {h / ab:.3f} {(h + bb + hbp) / (ab + bb + hbp + sf):.3f} {tb / ab:.3f} "
          f"{(h - hr) / (ab - so - hr + sf):.3f} {so / pa * 100:4.1f} {bb / pa * 100:4.1f} {hr / pa * 100:4.2f} "
          f"{total('R') / total('team_G'):.2f}")
