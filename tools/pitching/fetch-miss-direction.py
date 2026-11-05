#!/usr/bin/env python
"""Where pitches miss the zone, by pitch type and count, from Baseball Savant pitch data (regular season), measurement only.

usage: python -I -X utf8 fetch-miss-direction.py <work dir> <year> [first_date last_date]
One request per day (all pitches, honest User-Agent, 1 s apart), the same fetch as the history desk's pitch-zone aggregates; only a
small JSON aggregate per day is kept in <work dir>/<year>/ (restartable; raw pitches are never stored). Then <work dir>/missdir_<year>.csv,
one row per (pitch_type, p_throws, stand, balls, strikes, dir, band):
  dir   in (ball centre inside the zone widened by the ball: |plate_x| <= 17/24 + r, sz_bot - r <= plate_z <= sz_top + r, r = 1.45 in),
        else the side it is furthest out on: up, down, arm (the pitcher's throwing-arm side), glove.
  band  distance outside the widened zone on that side, in metres, by the target plan's bands: 0 (in), <.06, <.12, <.20, <.30, <.45, more.
  n, swings, whiffs (swinging_strike, swinging_strike_blocked, foul_tip, missed_bunt), fouls, in_play, called (called strikes),
  rv (sum of delta_run_exp, the pitcher's side negative), nozone (no plate_x / plate_z / sz).
Catcher's view: plate_x > 0 is the first-base side, so a right-hander's arm side is plate_x < 0.
"""
import csv, datetime as dt, io, json, sys, time, urllib.request
from pathlib import Path

work = Path(sys.argv[1]); year = int(sys.argv[2])
d0 = dt.date.fromisoformat(sys.argv[3]) if len(sys.argv) > 3 else dt.date(year, 3, 18)
d1 = dt.date.fromisoformat(sys.argv[4]) if len(sys.argv) > 4 else dt.date(year, 11, 5)
(work / str(year)).mkdir(parents=True, exist_ok=True)
SWING = {"swinging_strike", "swinging_strike_blocked", "foul", "foul_tip", "hit_into_play", "foul_bunt", "missed_bunt", "bunt_foul_tip"}
WHIFF = {"swinging_strike", "swinging_strike_blocked", "foul_tip", "missed_bunt"}
FOUL = {"foul", "foul_bunt", "bunt_foul_tip"}
DROP = {"PO", "IN", "AB", "UN", "", "NA"}
NAMES = "n swings whiffs fouls in_play called rv".split()
HALF, R, FT = 17 / 24, 1.45 / 12, .3048
BANDS = [.06, .12, .20, .30, .45]

def fetch(day):
    u = ("https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfGT=R%7C&hfSea=" + str(year)
         + "%7C&player_type=pitcher&game_date_gt=" + day + "&game_date_lt=" + day + "&type=details")
    for attempt in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "kbm-history-research/1.0 (personal non-commercial research)"}), timeout=180).read().decode("utf-8-sig")
        except Exception:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("giving up on " + day)

def place(r):
    try:
        x, z, top, bot = float(r["plate_x"]), float(r["plate_z"]), float(r["sz_top"]), float(r["sz_bot"])
    except ValueError:
        return None
    side = abs(x) - (HALF + R); up = z - (top + R); down = (bot - R) - z
    out = max(side, up, down)
    if out <= 0:
        return "in", 0
    d = "up" if out == up else "down" if out == down else ("arm" if (x < 0) == (r["p_throws"] == "R") else "glove")
    return d, 1 + sum(out * FT >= b for b in BANDS)

day = d0
while day <= d1:
    f = work / str(year) / (day.isoformat() + ".json")
    if not f.exists():
        text = fetch(day.isoformat()); agg = {}; npitch = 0
        for r in (csv.DictReader(io.StringIO(text)) if text.strip() else []):
            if r["pitch_type"] in DROP: continue
            p = place(r)
            key = "%s|%s|%s|%s|%s|%s|%s" % (r["pitch_type"], r["p_throws"], r["stand"], r["balls"], r["strikes"], *(p or ("none", -1)))
            a = agg.setdefault(key, [0] * len(NAMES)); npitch += 1
            d = r["description"]
            a[0] += 1; a[1] += d in SWING; a[2] += d in WHIFF; a[3] += d in FOUL; a[4] += d == "hit_into_play"; a[5] += d == "called_strike"
            try: a[6] += float(r.get("delta_run_exp") or 0)
            except ValueError: pass
        f.write_text(json.dumps(agg))
        print(year, day.isoformat(), npitch, flush=True)
        time.sleep(1.0)
    day += dt.timedelta(days=1)

tot = {}
for f in sorted((work / str(year)).glob("*.json")):
    for k, a in json.loads(f.read_text()).items():
        t = tot.setdefault(k, [0] * len(NAMES))
        for i, x in enumerate(a): t[i] += x
with open(work / ("missdir_%d.csv" % year), "w", newline="", encoding="utf-8") as o:
    w = csv.writer(o); w.writerow(["pitch_type", "p_throws", "stand", "balls", "strikes", "dir", "band"] + NAMES)
    for k, t in sorted(tot.items()):
        w.writerow(k.split("|") + [round(x, 4) if isinstance(x, float) else x for x in t])
print("done", year, len(tot), flush=True)
