#!/usr/bin/env python
"""Extract plain CSVs from the OOTP NPB historical database (data is untrusted; it is only parsed).

Usage:  python -I extract-odb.py <OOTP_NPB_Historical dir> <output dir>

Reads  stats/historical_database.odb, stats/Master.csv, stats/Teams.csv, database/era_ballparks.txt
Writes batting.csv pitching.csv fielding.csv players.csv league_seasons.csv parks.csv

.odb layout (reverse-engineered): 5 preamble bytes, then records until EOF, each
    [table id: u8][length: u16 little-endian][UTF-8 text, tab-separated, CSV-quoted]
The first record of every table id is its header row. Table ids used here:
    0 players, 1 batting, 3 pitching, 5 fielding, 10 teams (identical to Teams.csv).
The text has no tab-in-field escape: a comma inside a name/city was rewritten as a tab,
so tabs inside a parsed field are turned back into commas.

Nothing is corrected. Suspect rows are kept and flagged (in_teams, note, chk_* columns).
All-empty source columns are dropped. A blank stays blank; a 0 stays 0 (the source
cannot tell "not recorded" from zero for old seasons, e.g. IBB/GIDP/SF before the 1950s).
"""
import csv
import struct
import sys
from collections import defaultdict
from pathlib import Path

TABLES = {0: "players", 1: "batting", 3: "pitching", 5: "fielding", 10: "teams"}
# lgID in the source: AL = Central League, NL = Pacific League; 1936-49 was one league (labelled AL).
LEAGUE = {"AL": "Central", "NL": "Pacific"}


def read_odb(path):
    """Return {table name: (header, rows)}; fail loudly if the structure does not hold."""
    data = Path(path).read_bytes()
    raw, pos = defaultdict(list), 5
    while pos < len(data):
        tid, size = data[pos], struct.unpack_from("<H", data, pos + 1)[0]
        if pos + 3 + size > len(data):
            raise ValueError("truncated record at byte %d" % pos)
        raw[tid].append(data[pos + 3:pos + 3 + size].decode("utf-8"))
        pos += 3 + size
    out = {}
    for tid, name in TABLES.items():
        rows = [[f.replace("\t", ",") for f in next(csv.reader([line], delimiter="\t"))] for line in raw[tid]]
        width = len(rows[0])
        bad = [r for r in rows if len(r) != width]
        if bad:
            raise ValueError("table %s: %d rows with wrong field count" % (name, len(bad)))
        out[name] = (rows[0], rows[1:])
    return out


def read_csv(path, **kw):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f, **kw))
    return rows[0], rows[1:]


def num(s):
    return int(s) if s not in ("", None) else 0


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print("%-20s %7d rows, %2d columns" % (path.name, len(rows), len(header)))


def stat_table(out, header, rows, team_keys, extra=()):
    """Write a per-player-season table without its all-empty columns; add in_teams (+ extras)."""
    keep = [i for i in range(len(header)) if any(r[i] != "" for r in rows)]
    ix = {h: i for i, h in enumerate(header)}
    new_h = [header[i] for i in keep] + [h for h, _ in extra] + ["in_teams"]
    new_r = []
    for r in rows:
        d = {h: r[i] for h, i in ix.items()}
        new_r.append([r[i] for i in keep] + [f(d) for _, f in extra]
                     + [int((r[ix["yearID"]], r[ix["teamID"]]) in team_keys)])
    write_csv(out, new_h, new_r)
    return new_h, new_r


def main(src, dst):
    src, dst = Path(src), Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    odb = read_odb(src / "stats" / "historical_database.odb")
    th, trows = read_csv(src / "stats" / "Teams.csv")
    assert (th, trows) == (odb["teams"][0], odb["teams"][1]), "Teams.csv differs from the .odb teams table"
    tix = {h: i for i, h in enumerate(th)}
    team_keys = {(r[tix["yearID"]], r[tix["teamID"]]) for r in trows}

    # --- per-player-season tables ---------------------------------------------------------
    pa = ("PA", lambda d: num(d["AB"]) + num(d["BB"]) + num(d["HBP"]) + num(d["SH"]) + num(d["SF"]))
    bh, brows = stat_table(dst / "batting.csv", *odb["batting"], team_keys, extra=[pa])
    stat_table(dst / "pitching.csv", *odb["pitching"], team_keys)
    stat_table(dst / "fielding.csv", *odb["fielding"], team_keys)

    # --- players: Master.csv is the superset; blanks are filled from the .odb copy -----------
    mh, mrows = read_csv(src / "stats" / "Master.csv")
    ph, prows = odb["players"]
    mix, oix = {h: i for i, h in enumerate(mh)}, {h: i for i, h in enumerate(ph)}
    odb_by_id = {r[0]: r for r in prows}
    seen = {r[0] for r in odb["batting"][1]} | {r[0] for r in odb["pitching"][1]} | {r[0] for r in odb["fielding"][1]}
    out = []
    for m in mrows:
        o = odb_by_id.get(m[0])
        g = lambda k: m[mix[k]] or (o[oix[k]] if o else "")
        inch, lb = g("Height"), g("weight")
        out.append([m[0], g("nameGiven"), (g("namefirst") + " " + g("namelast")).strip(), g("nameNick"),
                    g("bats"), g("throws"), inch, lb,
                    round(int(inch) * 2.54) if inch.isdigit() else "", round(int(lb) * 0.4536) if lb.isdigit() else "",
                    g("birthYear"), g("birthMonth"), g("birthDay"), g("birthCountry"),
                    g("debut"), g("finalGame"), int(m[0] in seen), int(o is not None)])
    write_csv(dst / "players.csv",
              ["playerID", "name_jp", "name_romaji", "nickname", "bats", "throws", "height_in", "weight_lb",
               "height_cm", "weight_kg", "birth_year", "birth_month", "birth_day", "birth_country",
               "debut", "final", "has_stats", "in_odb"], out)

    # --- league_seasons: sums of batting rows whose (year, team) is in Teams.csv ---------------
    bix = {h: i for i, h in enumerate(bh)}
    agg, unmatched = defaultdict(lambda: defaultdict(int)), defaultdict(int)
    keys = ["AB", "R", "H", "2B", "3B", "HR", "BB", "SO", "HBP", "SH", "SF"]
    for r in brows:
        k = (r[bix["yearID"]], r[bix["lgID"]])
        if r[bix["in_teams"]]:
            for s in keys:
                agg[k][s] += num(r[bix[s]])
        else:
            unmatched[k] += num(r[bix["AB"]])
    tagg = defaultdict(lambda: defaultdict(int))
    team_diff = defaultdict(int)
    batting_team = defaultdict(lambda: defaultdict(int))
    for r in brows:
        if r[bix["in_teams"]]:
            for s in ("AB", "R", "H", "HR", "BB", "SO"):
                batting_team[(r[bix["yearID"]], r[bix["teamID"]])][s] += num(r[bix[s]])
    chk = ("AB", "R", "H", "HR", "BB", "SO")
    for t in trows:
        k = (t[tix["yearID"]], t[tix["lgID"]])
        tagg[k]["teams"] += 1
        tagg[k]["team_G"] += num(t[tix["G"]])
        for s in chk:
            tagg[k][s] += num(t[tix[s]])
        if any(batting_team[(t[tix["yearID"]], t[tix["teamID"]])][s] != num(t[tix[s]]) for s in chk):
            team_diff[k] += 1
    lines = []
    for k in sorted(tagg, key=lambda k: (int(k[0]), k[1])):
        a, t = agg[k], tagg[k]
        year, lg = k
        league = LEAGUE[lg] if int(year) >= 1950 else "NPB"
        pa_full = a["AB"] + a["BB"] + a["HBP"] + a["SH"] + a["SF"]
        pa_nosh = pa_full - a["SH"]          # = what Teams.csv can give (it has no SH column)
        tb = a["H"] + a["2B"] + 2 * a["3B"] + 3 * a["HR"]
        d = lambda x, y: round(x / y, 5) if y else ""
        rel = max(abs(a[s] - t[s]) / t[s] if t[s] else 0 for s in chk)
        lines.append([year, league, lg, t["teams"], t["team_G"] / 2, t["team_G"], pa_full, pa_nosh,
                      a["AB"], a["H"], a["2B"], a["3B"], a["HR"], a["BB"], a["SO"], a["HBP"], a["SH"], a["SF"], a["R"],
                      d(a["H"], a["AB"]), d(a["H"] + a["BB"] + a["HBP"], a["AB"] + a["BB"] + a["HBP"] + a["SF"]),
                      d(tb, a["AB"]), d(a["SO"], pa_full), d(a["BB"], pa_full), d(a["HR"], pa_full),
                      d(a["R"], t["team_G"]), d(a["H"] - a["HR"], a["AB"] - a["SO"] - a["HR"] + a["SF"]),
                      d(a["SO"], pa_nosh), d(a["BB"], pa_nosh), d(a["HR"], pa_nosh)]
                     + [t[s] for s in chk] + [round(rel, 5), team_diff[k], unmatched[k]])
    write_csv(dst / "league_seasons.csv",
              ["year", "league", "lgID", "teams", "G", "team_G", "PA", "PA_noSH",
               "AB", "H", "2B", "3B", "HR", "BB", "SO", "HBP", "SH", "SF", "R",
               "AVG", "OBP", "SLG", "K_PA", "BB_PA", "HR_PA", "R_per_team_G", "BABIP",
               "K_PA_noSH", "BB_PA_noSH", "HR_PA_noSH"]
              + ["teams_csv_" + s for s in chk] + ["chk_max_rel_diff", "chk_teams_differing", "excluded_AB_not_in_teams"],
              lines)

    # --- parks: era_ballparks.txt (one row per team-season, same keys as Teams.csv) -------------
    bph, bprows = read_csv(src / "database" / "era_ballparks.txt")
    pix = {h: i for i, h in enumerate(bph)}
    cols = ["Capacity", "Type", "Surface", "BA Overall", "2B Overall", "3B Overall", "HR Overall",
            "BA LH", "HR LH", "BA RH", "HR RH", "LLd", "LFd", "LCd", "CFd", "RCd", "RFd", "RLd",
            "LLh", "LFh", "LCh", "CFh", "RCh", "RFh", "RLh"]
    rows = []
    for r in bprows:
        year, team = r[pix["yearID"]], r[pix["teamID"]]
        assert (year, team) in team_keys, "ballpark row without a Teams.csv row"
        note = ""
        if year == "1936" and "Korakuen" in r[pix["park"]]:
            note = "known upstream error: Korakuen Stadium listed for 1936 (kept as-is)"
        rows.append([year, r[pix["lgID"]], team, r[pix["name"]], r[pix["park"]], r[pix["attendance"]]]
                    + [r[pix[c]] for c in cols] + [note])
    write_csv(dst / "parks.csv",
              ["year", "lgID", "teamID", "team_name", "park", "attendance"]
              + ["park_" + c.replace(" ", "_") if c in ("Capacity", "Type", "Surface") else c.replace(" ", "_") for c in cols]
              + ["note"], rows)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
