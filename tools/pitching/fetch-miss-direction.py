#!/usr/bin/env python
"""Where pitches miss the zone, by pitch type and count, from Baseball Savant pitch data (regular season), measurement only.

usage: python -I -X utf8 fetch-miss-direction.py <work dir> <year> [first_date last_date] [--step=N]
--step=N takes every N-th day from first_date (spread over the season, not its first weeks) and totals only those days.
One request per day (all pitches, honest User-Agent, 1 s apart), the same fetch as the history desk's pitch-zone aggregates; only a
small JSON aggregate per day is kept in <work dir>/<year>/ (restartable; raw pitches are never stored). Then <work dir>/missdir_<year>.csv,
one row per (pitch_type, p_throws, stand, balls, strikes, dir, band):
  dir   in the zone (ball centre inside the zone widened by the ball: |plate_x| <= 17/24 + r, sz_bot - r <= plate_z <= sz_top + r,
        r = 1.45 in): heart (the middle 48% box) or the edge it is nearest, eup / edown / earm / eglove; out of it, the side it is
        furthest out on: up, down, arm (the pitcher's throwing-arm side), glove.
  band  distance outside the widened zone on that side, in metres, by the target plan's bands: 0 (in), <.06, <.12, <.20, <.30, <.45, more.
  n, swings, whiffs (swinging_strike, swinging_strike_blocked, foul_tip, missed_bunt), fouls, in_play, called (called strikes),
  rv (sum of delta_run_exp, the pitcher's side negative), woba_bip (sum of woba_value on balls in play), nozone
Also <work dir>/missloc_<year>.csv, one row per (pitch_type, p_throws, stand, balls, strikes): n and the sums of arm (plate_x toward
the pitcher's arm side, ft), up (plate_z above the zone's middle, in zone half-heights) and their squares; and
<work dir>/misspitcher_<year>.csv, one row per (pitcher mlbam id, pitch_type, p_throws, dir), n. (no plate_x / plate_z / sz).
Catcher's view: plate_x > 0 is the first-base side, so a right-hander's arm side is plate_x < 0.
"""
import csv, datetime as dt, io, json, sys, time, urllib.request
from pathlib import Path

step = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--step=')), 1)); argv = [a for a in sys.argv if not a.startswith('--')]
work = Path(argv[1]); year = int(argv[2])
d0 = dt.date.fromisoformat(argv[3]) if len(argv) > 3 else dt.date(year, 3, 18)
d1 = dt.date.fromisoformat(argv[4]) if len(argv) > 4 else dt.date(year, 11, 5)
days = [d0 + dt.timedelta(days=i) for i in range(0, (d1 - d0).days + 1, step)]
(work / str(year)).mkdir(parents=True, exist_ok=True)
SWING = {"swinging_strike", "swinging_strike_blocked", "foul", "foul_tip", "hit_into_play", "foul_bunt", "missed_bunt", "bunt_foul_tip"}
WHIFF = {"swinging_strike", "swinging_strike_blocked", "foul_tip", "missed_bunt"}
FOUL = {"foul", "foul_bunt", "bunt_foul_tip"}
DROP = {"PO", "IN", "AB", "UN", "", "NA"}
NAMES = "n swings whiffs fouls in_play called rv woba_bip".split()
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
    if out <= 0:  # in the zone: the heart box (the middle 48%, as the plan's), else the edge nearest the ball
        mid, half_h = (top + bot) / 2, (top - bot) / 2
        if abs(x) < HALF * .48 and abs(z - mid) < half_h * .48:
            return "heart", 0
        near = min(-side, -up, -down)
        return "e" + ("up" if near == -up else "down" if near == -down else ("arm" if (x < 0) == (r["p_throws"] == "R") else "glove")), 0
    d = "up" if out == up else "down" if out == down else ("arm" if (x < 0) == (r["p_throws"] == "R") else "glove")
    return d, 1 + sum(out * FT >= b for b in BANDS)

for day in days:
    f = work / str(year) / (day.isoformat() + ".json")
    if not f.exists():
        text = fetch(day.isoformat()); agg = {}; npitch = 0
        for r in (csv.DictReader(io.StringIO(text)) if text.strip() else []):
            if r["pitch_type"] in DROP: continue
            p = place(r)
            try:
                x, z, top, bot = float(r["plate_x"]), float(r["plate_z"]), float(r["sz_top"]), float(r["sz_bot"])
                arm, up = (-x if r["p_throws"] == "R" else x), (z - (top + bot) / 2) / ((top - bot) / 2)
                loc = agg.setdefault("L|%s|%s|%s|%s|%s" % (r["pitch_type"], r["p_throws"], r["stand"], r["balls"], r["strikes"]), [0, 0.0, 0.0, 0.0, 0.0])
                loc[0] += 1; loc[1] += arm; loc[2] += up; loc[3] += arm * arm; loc[4] += up * up
            except (ValueError, ZeroDivisionError):
                pass
            pk = "P|%s|%s|%s|%s" % (r["pitcher"], r["pitch_type"], r["p_throws"], (p or ("none",))[0])
            agg[pk] = agg.get(pk, 0) + 1
            key = "%s|%s|%s|%s|%s|%s|%s" % (r["pitch_type"], r["p_throws"], r["stand"], r["balls"], r["strikes"], *(p or ("none", -1)))
            a = agg.setdefault(key, [0] * len(NAMES)); npitch += 1
            d = r["description"]
            a[0] += 1; a[1] += d in SWING; a[2] += d in WHIFF; a[3] += d in FOUL; a[4] += d == "hit_into_play"; a[5] += d == "called_strike"
            try: a[6] += float(r.get("delta_run_exp") or 0)
            except ValueError: pass
            if d == "hit_into_play":
                try: a[7] += float(r.get("woba_value") or 0)
                except ValueError: pass
        f.write_text(json.dumps(agg))
        print(year, day.isoformat(), npitch, flush=True)
        time.sleep(1.0)

tot, loc, pit = {}, {}, {}
for f in [work / str(year) / (d.isoformat() + ".json") for d in days]:
    for k, a in json.loads(f.read_text()).items():
        if k.startswith("P|"): pit[k[2:]] = pit.get(k[2:], 0) + a; continue
        t = (loc.setdefault(k[2:], [0] * 5) if k.startswith("L|") else tot.setdefault(k, [0] * len(NAMES)))
        for i, x in enumerate(a): t[i] += x
with open(work / ("missdir_%d.csv" % year), "w", newline="", encoding="utf-8") as o:
    w = csv.writer(o); w.writerow(["pitch_type", "p_throws", "stand", "balls", "strikes", "dir", "band"] + NAMES)
    for k, t in sorted(tot.items()):
        w.writerow(k.split("|") + [round(x, 4) if isinstance(x, float) else x for x in t])
with open(work / ("missloc_%d.csv" % year), "w", newline="", encoding="utf-8") as o:
    w = csv.writer(o); w.writerow(["pitch_type", "p_throws", "stand", "balls", "strikes", "n", "arm", "up", "arm2", "up2"])
    for k, t in sorted(loc.items()):
        w.writerow(k.split("|") + [round(x, 4) if isinstance(x, float) else x for x in t])
with open(work / ("misspitcher_%d.csv" % year), "w", newline="", encoding="utf-8") as o:
    w = csv.writer(o); w.writerow(["pitcher", "pitch_type", "p_throws", "dir", "n"])
    for k, n in sorted(pit.items()):
        w.writerow(k.split("|") + [n])
print("done", year, len(tot), flush=True)
