"""Builds a calibration config where every player is the same league-average profile.

Two identical clubs remove roster strength from a league-level measurement.
usage: make-standard-league.py <config.json> <output.json> [key=value ...]
Values override the batter profile, e.g. aimStdMeters=0.05.
"""
import json
import statistics
import sys

source, output, *overrides = sys.argv[1:]
config = json.load(open(source, encoding="utf-8"))
players = {p["playerId"]: p for p in config["players"]}
hitters = [players[i]["physical"] for i in config["teams"][0]["battingOrder"]]


def median_profile(group):
    profile = dict(group[0])
    for key, value in group[0].items():
        values = [p.get(key) for p in group]
        if isinstance(value, (int, float)) and not isinstance(value, bool) and all(isinstance(v, (int, float)) for v in values):
            profile[key] = statistics.median(values)
    return profile


standard = median_profile(hitters)
standard.pop("fieldingReactionScaleV98", None)
pitcher = dict(players[config["teams"][0]["pitcherId"]]["physical"])
pitcher.update({k: standard[k] for k in ("targetSweetSpotSpeedMps", "maximumSweetSpotSpeedMps", "aimStdMeters", "timingStdSeconds") if k in standard})
for item in overrides:
    key, value = item.split("=")
    standard[key] = float(value)
    pitcher[key] = float(value)
for order, team in enumerate(config["teams"]):
    for slot, player_id in enumerate(team["battingOrder"]):
        player = players[player_id]
        player["physical"] = dict(standard)
        player["bats"] = "R" if slot % 2 == 0 else "L"
        player["throws"] = "R"
        player["heightMeters"] = 1.82
        player.pop("traitProfile", None)
    arm = players[team["pitcherId"]]
    arm["physical"] = dict(pitcher)
    arm.pop("traitProfile", None)
    arm["physical"]["commandStdMeters"] = .2
# Unmeasured environment values, adjusted against real league rates.
config["batterObservationV151"] = {**config["batterObservationV151"], "commitSwingSeconds": .26, "contactSpeedCeilingV1": True, "twoStrikeExpansionV1": .22,
                                   "countReadinessV1": [[.62, .85, 1], [.72, .9, 1], [.72, .95, 1], [.12, .85, 1]]}
config["park"] = {**config["park"], "groundMaterialV101": {"restitution": .42, "slidingFriction": .45, "rollingDecelerationMps2": 3.2, "normalSpinDecayPerSecond": .18}}
json.dump(config, open(output, "w", encoding="utf-8"), ensure_ascii=False)
print({k: standard.get(k) for k in ("targetSweetSpotSpeedMps", "maximumSweetSpotSpeedMps", "aimStdMeters", "timingStdSeconds", "topSpeedMps", "reactionSeconds", "releaseSpeedMps")}, "pitcher", pitcher.get("releaseSpeedMps"), pitcher.get("maximumPitchSpeedMps"), pitcher.get("commandStdMeters"))
